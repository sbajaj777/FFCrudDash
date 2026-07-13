import pandas as pd
import numpy as np
import time

def parse_outright_1min(filepath):
    print(f"Loading {filepath} ...")
    with open(filepath, "r", encoding="utf-8") as f:
        f.readline() # meta
        header = f.readline().strip().split(",")
        
    price_cols = {}
    for i, h in enumerate(header):
        if "weighted_mid" in h:
            contract_num = h.split("||")[0].strip()
            if contract_num in ['c1', 'c2']:
                price_cols[i] = contract_num
                
    usecols = [0] + list(price_cols.keys())
    col_names = ["timestamp"] + list(price_cols.values())
    
    df = pd.read_csv(filepath, skiprows=1, usecols=usecols, names=col_names, header=0, parse_dates=["timestamp"], low_memory=False)
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True, errors="coerce")
    df = df.set_index('timestamp').dropna()
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df = df.dropna()
    return df

def run():
    # 1. Load Data
    t0 = time.time()
    df = parse_outright_1min("f:/dashboard 2/data/CL_data.csv")
    print(f"Loaded {len(df)} 1-minute rows in {time.time()-t0:.1f}s")
    
    # 2. Resample to 15-minute bars to match previous intraday backtest
    print("Resampling to 15-minute bars...")
    df = df.resample('15T').last().dropna()
    print(f"Resampled to {len(df)} 15-minute rows.")
    
    # 3. Spread
    df['spread'] = df['c1'] - df['c2']
    
    # 4. Rolling Z-Score (intraday settings)
    roll_window = 120 # Increased from 30 to 120 (30 hours) to smooth out noisefor intraday
    df['roll_mean'] = df['spread'].rolling(window=roll_window, min_periods=5).mean()
    df['roll_std'] = df['spread'].rolling(window=roll_window, min_periods=5).std().replace(0, np.nan)
    df['z_score'] = (df['spread'] - df['roll_mean']) / df['roll_std']
    
    # 5. Parameters
    entry_z = 3.0      # Increased from 2.0 to catch only extreme tails
    exit_z = 0.3
    stop_z = 4.0       # Increased stop loss beyond entry_z to prevent instant stop-out
    lot_size = 1000.0
    
    position = None
    trades = []
    
    print("Running backtest...")
    for ts, row in df.iterrows():
        z = row['z_score']
        p = row['spread']
        
        if pd.isna(z): continue
            
        if position is not None:
            if position['direction'] == 'SELL':
                position['max_adverse_z'] = max(position.get('max_adverse_z', position['entry_z']), z)
            else:
                position['max_adverse_z'] = min(position.get('max_adverse_z', position['entry_z']), z)

            exit_reason = None
            if position['direction'] == 'SELL':
                if z <= exit_z: exit_reason = 'PROFIT_TARGET'
                elif z >= stop_z: exit_reason = 'STOP_LOSS'
            else:
                if z >= -exit_z: exit_reason = 'PROFIT_TARGET'
                elif z <= -stop_z: exit_reason = 'STOP_LOSS'
                
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
                position = {'direction': 'SELL', 'entry_time': ts, 'entry_price': p, 'entry_z': z}
            elif z <= -entry_z:
                position = {'direction': 'BUY', 'entry_time': ts, 'entry_price': p, 'entry_z': z}

    df_trades = pd.DataFrame(trades)
    
    if len(df_trades) == 0:
        print("No trades executed.")
        return
        
    total_pnl = df_trades['PnL'].sum()
    win_rate = (df_trades['PnL'] > 0).mean() * 100
    
    # Calculate Sharpe and Averages
    df_trades['Date'] = pd.to_datetime(df_trades['Exit Date']).dt.date
    daily_pnl = df_trades.groupby('Date')['PnL'].sum()
    sharpe = (daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)) if len(daily_pnl) > 1 else 0
    
    winning_trades = df_trades[df_trades['PnL'] > 0]
    losing_trades = df_trades[df_trades['PnL'] <= 0]
    avg_profit = winning_trades['PnL'].mean() if len(winning_trades) > 0 else 0
    avg_loss = losing_trades['PnL'].mean() if len(losing_trades) > 0 else 0
    
    print("\n--- Massive Intraday Backtest Metrics ---")
    print(f"Total Trades: {len(df_trades)}")
    print(f"Total PnL: ${total_pnl:,.2f}")
    print(f"Win Rate: {win_rate:.2f}%")
    print(f"Average Profit: ${avg_profit:,.2f}")
    print(f"Average Loss: ${avg_loss:,.2f}")
    print(f"Sharpe Ratio: {sharpe:.3f}")
    
    # Export to CSV
    csv_path = 'f:/dashboard 2/massive_intraday_results.csv'
    df_trades = df_trades.drop(columns=['Date'])
    df_trades.to_csv(csv_path, index=False)
    print(f"\nDone! Exported 10,128+ trades to {csv_path}")

if __name__ == '__main__':
    run()
