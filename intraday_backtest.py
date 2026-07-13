import sqlite3
import pandas as pd
import numpy as np

def run_intraday_backtest():
    db_path = 'data/bars_15min_20260612.db'
    conn = sqlite3.connect(db_path)
    
    # Load M1 (N26) and M2 (Q26) for CL
    m1 = pd.read_sql('SELECT timestamp, close as m1_close FROM CL_N26', conn)
    m2 = pd.read_sql('SELECT timestamp, close as m2_close FROM CL_Q26', conn)
    
    # Merge on timestamp
    df = pd.merge(m1, m2, on='timestamp', how='inner')
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    df = df.sort_values('timestamp').reset_index(drop=True)
    
    # Calculate Spread
    df['spread'] = df['m1_close'] - df['m2_close']
    
    # Intraday rolling Z-Score
    roll_window = 30
    df['roll_mean'] = df['spread'].rolling(window=roll_window, min_periods=5).mean()
    df['roll_std'] = df['spread'].rolling(window=roll_window, min_periods=5).std()
    df['z_score'] = (df['spread'] - df['roll_mean']) / df['roll_std'].replace(0, np.nan)
    
    # Backtest Logic
    entry_z = 1.5
    exit_z = 0.3
    stop_z = 10.0
    lot_size = 1000.0
    
    position = None
    trades = []
    
    for i, row in df.iterrows():
        if pd.isna(row['z_score']):
            continue
            
        z = row['z_score']
        p = row['spread']
        ts = row['timestamp']
        
        if position is not None:
            # Track MAE
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
                    'Entry Time': position['entry_time'].strftime('%H:%M'),
                    'Exit Time': ts.strftime('%H:%M'),
                    'Dir': position['direction'],
                    'Entry Spread': round(position['entry_price'], 3),
                    'Exit Spread': round(p, 3),
                    'Entry Z': round(position['entry_z'], 2),
                    'Exit Z': round(z, 2),
                    'Max Adverse Z': round(position['max_adverse_z'], 2),
                    'Reason': exit_reason,
                    'PnL': pnl
                })
                position = None
                
        if position is None:
            if z >= entry_z:
                position = {'direction': 'SELL', 'entry_time': ts, 'entry_price': p, 'entry_z': z}
            elif z <= -entry_z:
                position = {'direction': 'BUY', 'entry_time': ts, 'entry_price': p, 'entry_z': z}

    out = "# Intraday Backtest Results (CL M1-M2 on June 12, 2026)\n\n"
    out += f"**Total Trades:** {len(trades)}\n\n"
    out += "| Entry Time | Exit Time | Dir | Entry Spread | Exit Spread | Entry Z | Exit Z | Max Adverse Z | Reason | PnL |\n"
    out += "|---|---|---|---|---|---|---|---|---|---|\n"
    for t in trades:
        color = '#00c48f' if t['PnL'] >= 0 else '#f43f5e'
        sign = '+' if t['PnL'] >= 0 else ''
        out += f"| {t['Entry Time']} | {t['Exit Time']} | {t['Dir']} | ${t['Entry Spread']:.3f} | ${t['Exit Spread']:.3f} | {t['Entry Z']:.2f} | {t['Exit Z']:.2f} | {t['Max Adverse Z']:.2f} | {t['Reason']} | <span style='color: {color}'>{sign}${t['PnL']:.2f}</span> |\n"

    with open('intraday_results.md', 'w') as f:
        f.write(out)
    print("Done")

if __name__ == '__main__':
    run_intraday_backtest()
