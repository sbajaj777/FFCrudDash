import pandas as pd
import numpy as np
import os

def process_brent_data(input_file, output_dir):
    print(f"Loading data from {input_file}...")
    # Read the file
    df_raw = pd.read_csv(input_file, header=[0, 1])
    
    # The columns are multi-index: level 0 is contract (LCOc1), level 1 is 'Timestamp' or 'SETTLE'
    
    # We want to extract Timestamp and SETTLE for each contract we care about
    # M1 = LCOc1, M2 = LCOc2, M4 = LCOc4, M6 = LCOc6
    contracts = {'M1': 'LCOc1', 'M2': 'LCOc2', 'M4': 'LCOc4', 'M6': 'LCOc6'}
    
    df_clean = pd.DataFrame()
    
    for label, contract in contracts.items():
        if contract in df_raw.columns.levels[0]:
            # Extract Timestamp
            dates = df_raw[(contract, 'Timestamp')]
            settle = df_raw[(contract, 'SETTLE')]
            
            # Use M1 dates as the master index since they represent the most liquid prompt contract
            if label == 'M1':
                df_clean['date'] = pd.to_datetime(dates, format='%d-%m-%y', errors='coerce')
                
            df_clean[f'{label}_settle'] = pd.to_numeric(settle, errors='coerce')
        else:
            print(f"Warning: {contract} not found in dataset")
    
    # Drop rows without dates
    df_clean = df_clean.dropna(subset=['date'])
    df_clean = df_clean.sort_values('date').reset_index(drop=True)
    
    print("Calculating spreads and daily changes...")
    # Calculate Spreads
    df_clean['M1_M2'] = df_clean['M1_settle'] - df_clean['M2_settle']
    df_clean['M2_M4'] = df_clean['M2_settle'] - df_clean['M4_settle']
    df_clean['M1_M6'] = df_clean['M1_settle'] - df_clean['M6_settle']
    
    # Calculate daily changes
    df_clean['delta_M1_M2'] = df_clean['M1_M2'].diff()
    df_clean['delta_M2_M4'] = df_clean['M2_M4'].diff()
    df_clean['delta_M1_M6'] = df_clean['M1_M6'].diff()
    
    # Reaction Score: Sum of absolute changes
    df_clean['reaction_score'] = (
        df_clean['delta_M1_M2'].abs() + 
        df_clean['delta_M2_M4'].abs() + 
        df_clean['delta_M1_M6'].abs()
    )
    
    # Find top 50 dates
    top_50 = df_clean.nlargest(50, 'reaction_score')
    top_50 = top_50.sort_values('date', ascending=False)
    
    # Save outputs
    os.makedirs(output_dir, exist_ok=True)
    clean_path = os.path.join(output_dir, 'cleaned_brent_spreads.csv')
    top50_path = os.path.join(output_dir, 'top_50_dates.csv')
    
    df_clean.to_csv(clean_path, index=False)
    top_50.to_csv(top50_path, index=False)
    
    print(f"Saved cleaned data to {clean_path}")
    print(f"Saved top 50 dates to {top50_path}")
    
    print("\nTop 5 Dates by Reaction Score:")
    print(top_50[['date', 'delta_M1_M2', 'delta_M2_M4', 'delta_M1_M6', 'reaction_score']].head())

if __name__ == "__main__":
    input_file = r"f:\spread_analyse\LCOSettle 2.csv"
    output_dir = r"f:\dashboard 2\engine\data"
    process_brent_data(input_file, output_dir)
