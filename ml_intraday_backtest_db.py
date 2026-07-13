import sqlite3
import pandas as pd
import numpy as np
import time
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge

def run_ml_intraday_backtest():
    db_path = 'data/bars_15min_20260612.db'
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    
    # Check available tables
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table';").fetchall()]
    print(f"Tables found in database: {tables}")
    
    # We need M1, M2, M3, M6 to match the ML strategy requirements
    cl_tables = sorted([t for t in tables if t.startswith('CL_')])
    
    if len(cl_tables) < 4:
        print("\n[ERROR] Not enough contracts found in the database to run the ML strategy.")
        print(f"The ML strategy requires 4 distinct futures contracts to compute curve features (e.g., slope_m2_m6, fly_1_2_3).")
        print(f"Found {len(cl_tables)} contracts: {cl_tables}")
        print("Please use a database containing the full forward curve (at least 4 legs).")
        return
        
    print("\nAttempting to load data for ML features...")
    # Assuming alphabetical/chronological sorting of symbols gives sequential months
    m1_tbl = cl_tables[0]
    m2_tbl = cl_tables[1]
    m3_tbl = cl_tables[2]
    m6_tbl = cl_tables[min(5, len(cl_tables)-1)]
    
    print(f"Using tables -> c1: {m1_tbl}, c2: {m2_tbl}, c3: {m3_tbl}, c6: {m6_tbl}")
    
    try:
        df1 = pd.read_sql(f'SELECT timestamp, close as c1 FROM {m1_tbl}', conn)
        df2 = pd.read_sql(f'SELECT timestamp, close as c2 FROM {m2_tbl}', conn)
        df3 = pd.read_sql(f'SELECT timestamp, close as c3 FROM {m3_tbl}', conn)
        df6 = pd.read_sql(f'SELECT timestamp, close as c6 FROM {m6_tbl}', conn)
    except Exception as e:
        print(f"[ERROR] Failed to read tables: {e}")
        return
        
    # Merge on timestamp
    df = df1.merge(df2, on='timestamp', how='inner')\
            .merge(df3, on='timestamp', how='inner')\
            .merge(df6, on='timestamp', how='inner')
            
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').set_index('timestamp')
    df = df.dropna()
    
    print(f"Merged Data: {len(df)} rows.")
    if len(df) < 100:
        print("[ERROR] Not enough overlapping rows to train the ML model.")
        return
    
    # 3. Spread & ML Features
    df['spread'] = df['c1'] - df['c2']
    df['slope_m2_m6'] = df['c2'] - df['c6']
    df['fly_1_2_3'] = df['c1'] - 2*df['c2'] + df['c3']
    
    # Rolling Volatility (15 min bars: ~96 per day. 5 days = 480 bars)
    df['returns'] = np.log(df['c1'] / df['c1'].shift(1))
    df['vol_5d'] = df['returns'].rolling(window=480).std() * np.sqrt(252*96) * 100
    df = df.dropna()
    
    features = ['slope_m2_m6', 'fly_1_2_3', 'vol_5d']
    target = 'spread'
    
    # 4. Train / Test Split
    train_size = int(len(df) * 0.5)
    train_df = df.iloc[:train_size]
    test_df = df.iloc[train_size:]
    print(f"Training on {len(train_df)} rows, Testing on {len(test_df)} rows.")
    
    if len(train_df) == 0 or len(test_df) == 0:
        print("Not enough data to split into train/test.")
        return
    
    # 5. Train Ridge Model
    X_train = train_df[features].values
    y_train = train_df[target].values
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    
    model = Ridge(alpha=1.0)
    model.fit(X_train_scaled, y_train)
    
    train_preds = model.predict(X_train_scaled)
    rmse = np.sqrt(np.mean((y_train - train_preds)**2))
    print(f"Train RMSE: {rmse:.4f}")
    
    # 6. Predict on Test Set
    X_test = test_df[features].values
    X_test_scaled = scaler.transform(X_test)
    
    test_df = test_df.copy()
    test_df['efv'] = model.predict(X_test_scaled)
    test_df['residual'] = test_df['spread'] - test_df['efv']
    test_df['z_score'] = test_df['residual'] / rmse
    
    # 7. Backtest Logic
    entry_z = 2.0
    exit_z = 0.3
    stop_cushion = 0.5
    lot_size = 1000.0
    
    position = None
    trades = []
    
    print("Running backtest on SQLite DB data...")
    for ts, row in test_df.iterrows():
        z = row['z_score']
        p = row['spread']
        
        if pd.isna(z): continue
            
        if position is not None:
            exit_reason = None
            pos_stop_z = position['dynamic_stop']
            
            if position['direction'] == 'SELL':
                if z <= exit_z: exit_reason = 'PROFIT_TARGET'
                elif z >= pos_stop_z: exit_reason = 'STOP_LOSS'
            else:
                if z >= -exit_z: exit_reason = 'PROFIT_TARGET'
                elif z <= -pos_stop_z: exit_reason = 'STOP_LOSS'
                
            if exit_reason:
                direction_mult = -1 if position['direction'] == 'SELL' else 1
                pnl = direction_mult * (p - position['entry_price']) * lot_size
                
                trades.append({
                    'Entry Date': position['entry_time'].strftime('%Y-%m-%d %H:%M'),
                    'Exit Date': ts.strftime('%Y-%m-%d %H:%M'),
                    'Dir': position['direction'],
                    'Entry Spread': position['entry_price'],
                    'Exit Spread': p,
                    'Entry Z': position['entry_z'],
                    'Exit Z': z,
                    'Reason': exit_reason,
                    'PnL': pnl
                })
                position = None
                
        if position is None:
            if z >= entry_z:
                position = {'direction': 'SELL', 'entry_time': ts, 'entry_price': p, 'entry_z': z, 'dynamic_stop': z + stop_cushion}
            elif z <= -entry_z:
                position = {'direction': 'BUY', 'entry_time': ts, 'entry_price': p, 'entry_z': z, 'dynamic_stop': abs(z) + stop_cushion}

    df_trades = pd.DataFrame(trades)
    
    if len(df_trades) == 0:
        print("No trades executed.")
        return
        
    total_pnl = df_trades['PnL'].sum()
    win_rate = (df_trades['PnL'] > 0).mean() * 100
    
    print("\n--- ML Intraday Backtest Metrics (DB Output) ---")
    print(f"Total Trades: {len(df_trades)}")
    print(f"Total PnL: ${total_pnl:,.2f}")
    print(f"Win Rate: {win_rate:.2f}%")
    
    csv_path = 'ml_db_intraday_results.csv'
    df_trades.to_csv(csv_path, index=False)
    print(f"Done! Results exported to: {csv_path}")

if __name__ == '__main__':
    run_ml_intraday_backtest()
