import pandas as pd
import numpy as np
import time
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge

def parse_data(filepath, start_date, end_date):
    print(f"Loading {filepath} between {start_date} and {end_date}...")
    with open(filepath, "r", encoding="utf-8") as f:
        f.readline() # meta
        header = f.readline().strip().split(",")
        
    price_cols = {}
    for i, h in enumerate(header):
        if "weighted_mid" in h:
            contract_num = h.split("||")[0].strip()
            if contract_num in ['c1', 'c2', 'c3', 'c6']:
                price_cols[i] = contract_num
                
    usecols = [0] + list(price_cols.keys())
    col_names = ["timestamp"] + list(price_cols.values())
    
    df = pd.read_csv(filepath, skiprows=1, usecols=usecols, names=col_names, header=0, parse_dates=["timestamp"], low_memory=False)
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True, errors="coerce")
    df = df.set_index('timestamp').dropna()
    
    # Slice to 2.5 months roughly
    df = df.loc[start_date:end_date]
    
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna()
    return df

def run():
    # 1. Load Data
    t0 = time.time()
    df = parse_data("f:/dashboard 2/data/CL_data.csv", "2026-03-01", "2026-05-25")
    print(f"Loaded {len(df)} 1-minute rows in {time.time()-t0:.1f}s")
    
    # 2. Resample to 1-Hour bars
    print("Resampling to 1-Hour bars...")
    df = df.resample('1H').last().dropna()
    print(f"Resampled to {len(df)} 1-Hour rows.")
    
    # 3. Spread & ML Features
    df['spread'] = df['c1'] - df['c2']
    
    # Intraday ML Features
    df['slope_m2_m6'] = df['c2'] - df['c6']
    df['fly_1_2_3'] = df['c1'] - 2*df['c2'] + df['c3']
    
    # Rolling Volatility (5 days * 24 hours = 120 periods)
    df['returns'] = np.log(df['c1'] / df['c1'].shift(1))
    df['vol_5d'] = df['returns'].rolling(window=120).std() * np.sqrt(252*24) * 100
    df = df.dropna()
    
    features = ['slope_m2_m6', 'fly_1_2_3', 'vol_5d']
    target = 'spread'
    
    # 4. Train / Test Split
    train_end = "2026-04-15"
    train_df = df.loc[:train_end]
    test_df = df.loc[train_end:]
    print(f"Training on {len(train_df)} rows, Testing on {len(test_df)} rows.")
    
    # 5. Train Ridge Model
    X_train = train_df[features].values
    y_train = train_df[target].values
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    
    model = Ridge(alpha=1.0)
    model.fit(X_train_scaled, y_train)
    
    # Evaluate Train RMSE
    train_preds = model.predict(X_train_scaled)
    rmse = np.sqrt(np.mean((y_train - train_preds)**2))
    print(f"Train RMSE: {rmse:.4f}")
    
    # 6. Predict on Test Set (Out of Sample)
    X_test = test_df[features].values
    y_test = test_df[target].values
    X_test_scaled = scaler.transform(X_test)
    
    test_df = test_df.copy()
    test_df['efv'] = model.predict(X_test_scaled)
    test_df['residual'] = test_df['spread'] - test_df['efv']
    test_df['z_score'] = test_df['residual'] / rmse
    
    # 7. Dynamic Stop Loss Intraday Backtest
    entry_z = 2.0
    exit_z = 0.3
    stop_cushion = 0.5
    lot_size = 1000.0
    
    position = None
    trades = []
    
    print("Running out-of-sample backtest...")
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
    
    # Calculate Sharpe Ratio
    df_trades['Date'] = pd.to_datetime(df_trades['Exit Date']).dt.date
    daily_pnl = df_trades.groupby('Date')['PnL'].sum()
    sharpe = (daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)) if len(daily_pnl) > 1 and daily_pnl.std() != 0 else 0
    
    winning_trades = df_trades[df_trades['PnL'] > 0]
    losing_trades = df_trades[df_trades['PnL'] <= 0]
    avg_profit = winning_trades['PnL'].mean() if len(winning_trades) > 0 else 0
    avg_loss = losing_trades['PnL'].mean() if len(losing_trades) > 0 else 0
    
    print("\n--- Profitable ML Intraday Backtest Metrics (1-Hour Bars) ---")
    print(f"Total Trades: {len(df_trades)}")
    print(f"Total PnL: ${total_pnl:,.2f}")
    print(f"Win Rate: {win_rate:.2f}%")
    print(f"Average Profit: ${avg_profit:,.2f}")
    print(f"Average Loss: ${avg_loss:,.2f}")
    print(f"Sharpe Ratio: {sharpe:.3f}")
    
    # Export to CSV (Excel readable)
    csv_path = 'f:/dashboard 2/successful_ml_intraday_results.csv'
    # Drop the temporary Date column used for Sharpe
    df_trades = df_trades.drop(columns=['Date'])
    df_trades.to_csv(csv_path, index=False)
    
    print(f"\nDone! Trade log successfully exported to Excel CSV: {csv_path}")

if __name__ == '__main__':
    run()
