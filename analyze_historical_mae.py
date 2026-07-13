import pandas as pd
import numpy as np

def analyze_historical_data():
    print("Loading historical CL data...")
    # Load just a subset of columns to save memory
    cols = ['timestamp', 'c1||weighted_mid', 'c2||weighted_mid']
    
    # We will read in chunks to filter for 2026 data only to save memory
    chunksize = 500000
    df_list = []
    
    for chunk in pd.read_csv('data/CL_data.csv', usecols=cols, chunksize=chunksize, skiprows=1):
        # Filter for 2026
        chunk['timestamp'] = pd.to_datetime(chunk['timestamp'])
        chunk_2026 = chunk[chunk['timestamp'].dt.year == 2026]
        if not chunk_2026.empty:
            df_list.append(chunk_2026)
            
    if not df_list:
        print("No 2026 data found in CL_data.csv! Trying 2025...")
        for chunk in pd.read_csv('data/CL_data.csv', usecols=cols, chunksize=chunksize, skiprows=1):
            chunk['timestamp'] = pd.to_datetime(chunk['timestamp'])
            chunk_2025 = chunk[chunk['timestamp'].dt.year == 2025]
            if not chunk_2025.empty:
                df_list.append(chunk_2025)

    if not df_list:
        print("No data found!")
        return

    df = pd.concat(df_list)
    df = df.sort_values('timestamp').reset_index(drop=True)
    print(f"Loaded {len(df)} rows.")
    
    df.rename(columns={'c1||weighted_mid': 'm1', 'c2||weighted_mid': 'm2'}, inplace=True)
    df['spread'] = df['m1'] - df['m2']
    
    # Calculate rolling Z-score (assuming 1min data, 30 days = 30 * 24 * 60 = 43200 bars)
    # Actually for intraday 1-min, let's use a 3-day window (4320 bars)
    window = 4320
    df['roll_mean'] = df['spread'].rolling(window=window).mean()
    df['roll_std']  = df['spread'].rolling(window=window).std()
    df['z_score']   = (df['spread'] - df['roll_mean']) / df['roll_std'].replace(0, np.nan)
    
    df.dropna(subset=['z_score'], inplace=True)
    
    entries = [1.5, 2.0, 2.5, 3.0]
    exit_z = 0.3
    
    print("\n--- MAX ADVERSE EXCURSION ANALYSIS ---")
    for entry in entries:
        position = None
        max_adverse_list = []
        
        for i, row in df.iterrows():
            z = row['z_score']
            
            if position is not None:
                if position['dir'] == 'SELL':
                    position['mae'] = max(position['mae'], z)
                    if z <= exit_z:
                        max_adverse_list.append(position['mae'])
                        position = None
                else:
                    position['mae'] = min(position['mae'], z)
                    if z >= -exit_z:
                        max_adverse_list.append(position['mae'])
                        position = None
            else:
                if z >= entry:
                    position = {'dir': 'SELL', 'mae': z}
                elif z <= -entry:
                    position = {'dir': 'BUY', 'mae': z}
                    
        if len(max_adverse_list) > 0:
            avg_mae = np.mean([abs(x) for x in max_adverse_list])
            max_mae = max([abs(x) for x in max_adverse_list])
            print(f"Entry: {entry} | Trades: {len(max_adverse_list)} | Avg MAE: {avg_mae:.2f} | Max MAE: {max_mae:.2f}")

if __name__ == '__main__':
    analyze_historical_data()
