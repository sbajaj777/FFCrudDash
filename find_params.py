import sqlite3
import pandas as pd
import numpy as np

db_path = 'data/bars_15min_20260612.db'
conn = sqlite3.connect(db_path)

m1 = pd.read_sql('SELECT timestamp, close as m1_close FROM CL_N26', conn)
m2 = pd.read_sql('SELECT timestamp, close as m2_close FROM CL_Q26', conn)
df = pd.merge(m1, m2, on='timestamp', how='inner')
df['timestamp'] = pd.to_datetime(df['timestamp'])
df = df.sort_values('timestamp').reset_index(drop=True)
df['spread'] = df['m1_close'] - df['m2_close']

for entry_z in [1.0, 1.2, 1.4, 1.6, 1.8]:
    for exit_z in [0.0, 0.2, 0.5]:
        for roll_window in [15, 20]:
            d = df.copy()
            d['roll_mean'] = d['spread'].rolling(window=roll_window, min_periods=5).mean()
            d['roll_std'] = d['spread'].rolling(window=roll_window, min_periods=5).std()
            d['z_score'] = (d['spread'] - d['roll_mean']) / d['roll_std'].replace(0, np.nan)
            
            stop_z = 3.0
            lot_size = 1000.0
            
            position = None
            trades = []
            
            for i, row in d.iterrows():
                if pd.isna(row['z_score']): continue
                z, p, ts = row['z_score'], row['spread'], row['timestamp']
                
                if position is not None:
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
                        trades.append(pnl)
                        position = None
                        
                if position is None:
                    if z >= entry_z:
                        position = {'direction': 'SELL', 'entry_time': ts, 'entry_price': p, 'entry_z': z}
                    elif z <= -entry_z:
                        position = {'direction': 'BUY', 'entry_time': ts, 'entry_price': p, 'entry_z': z}
            
            total_pnl = sum(trades)
            if len(trades) >= 4 and total_pnl > 0:
                print(f'Trades: {len(trades)}, PnL: {total_pnl}, entry_z: {entry_z}, exit_z: {exit_z}, roll: {roll_window}')
