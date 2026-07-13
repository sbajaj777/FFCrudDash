import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import requests
import io
import datetime

# Add dashboard path so we can import engine modules
project_dir = Path("c:/Users/shivam.bajaj/Downloads/dashboard 2/dashboard 2")
sys.path.append(str(project_dir))
sys.path.append(str(project_dir / "engine"))

from regime.classifier import classify_regimes

def fast_load_1min(filepath):
    print(f"Fast loading {filepath.name}...")
    with open(filepath, 'r') as f:
        f.readline() # skip meta
        headers = f.readline().strip().split(",")
    
    usecols = [0]
    names = ['timestamp']
    for i, h in enumerate(headers):
        if 'weighted_mid' in h:
            c_num = h.split('||')[0].strip()
            if c_num in ['c1', 'c2', 'c12']:
                usecols.append(i)
                names.append(c_num)
                
    df = pd.read_csv(filepath, skiprows=1, usecols=usecols, names=names, header=0, engine='c')
    df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601', utc=True)
    df.set_index('timestamp', inplace=True)
    df.sort_index(inplace=True)
    return df


def get_eia_excel_data():
    print("Downloading EIA Excel...")
    url = 'https://www.eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls'
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        df = pd.read_excel(io.BytesIO(resp.content), sheet_name='Data 1', skiprows=2)
        df.columns = ["Week_Ending", "Inventory_Abs"]
        df["Week_Ending"] = pd.to_datetime(df["Week_Ending"])
        # Calculate week-over-week change
        df["Inventory_Change"] = df["Inventory_Abs"].diff()
        # Typical EIA release is Wednesday (+5 days from previous Friday)
        df["Date"] = df["Week_Ending"] + pd.Timedelta(days=5)
        # Drop rows with NaN
        df = df.dropna(subset=["Inventory_Change"])
        return df.set_index("Date")
    else:
        raise Exception(f"EIA download failed with status {resp.status_code}")

def extract_prices(cl_data, eia_df):
    print("Extracting intraday prices...")
    
    cl_1430 = cl_data.between_time("14:29", "14:31")
    cl_daily = cl_1430.resample("D").last().dropna(how="all")
    
    cl_daily["m1_m12"] = cl_daily["c1"] - cl_daily["c12"]
    
    # Classify Regimes using the dashboard's 5-state logic
    print("Classifying Regimes...")
    cl_daily = classify_regimes(cl_daily, primary_driver="m1_m12")
    
    results = []
    
    # Iterate over EIA release dates
    for release_date, row in eia_df.iterrows():
        rd_str = release_date.strftime("%Y-%m-%d")
        
        # Check if trading data exists on this date
        if rd_str not in cl_data.index.strftime("%Y-%m-%d"):
            # If missing (holiday), shift to Thursday
            release_date = release_date + pd.Timedelta(days=1)
            rd_str = release_date.strftime("%Y-%m-%d")
            if rd_str not in cl_data.index.strftime("%Y-%m-%d"):
                continue # Skip if still missing
                
        # Define Pre (10:25) and Post (10:45)
        # Slicing the day
        day_data_cl = cl_data.loc[rd_str]
        
        try:
            # Pre: Close to 10:25
            pre_cl = day_data_cl.between_time("10:20", "10:26").iloc[-1]
            # Post: Close to 10:45
            post_cl = day_data_cl.between_time("10:44", "10:46").iloc[-1]
        except IndexError:
            continue # Missing intraday data around release
            
        wti_pre = pre_cl["c1"]
        wti_post = post_cl["c1"]
        wti_m1m2_pre = pre_cl["c1"] - pre_cl["c2"]
        wti_m1m2_post = post_cl["c1"] - post_cl["c2"]
        wti_m1m2_change = wti_m1m2_post - wti_m1m2_pre
        
        # Daily Returns (14:30 Release Day -> 14:30 Next Day)
        # Find next trading day in cl_daily
        future_dates = cl_daily.loc[rd_str:].index
        if len(future_dates) >= 2:
            next_day_idx = future_dates[1]
            wti_ret_1d = (cl_daily.loc[next_day_idx, "c1"] / cl_daily.loc[future_dates[0], "c1"]) - 1
            wti_ret_sameday = (cl_daily.loc[future_dates[0], "c1"] / wti_pre) - 1
        else:
            wti_ret_1d = np.nan
            wti_ret_sameday = np.nan
            
        # Get Regime for the release day
        if future_dates[0] in cl_daily.index:
            regime = cl_daily.loc[future_dates[0], "regime"]
        else:
            regime = pd.NA
            
        # Season classification Q1-Q4
        month = release_date.month
        season = f"Q{(month - 1) // 3 + 1}"
            
        results.append({
            "Date": release_date.date(),
            "Inventory_Change": row["Inventory_Change"],
            "Inventory_Abs": row["Inventory_Abs"],
            "Season": season,
            "Regime": regime,
            "WTI_Close_Pre": wti_pre,
            "WTI_Close_Post": wti_post,
            "WTI_M1M2_Pre": wti_m1m2_pre,
            "WTI_M1M2_Post": wti_m1m2_post,
            "WTI_M1M2_Change": wti_m1m2_change,
            "WTI_Return_SameDay": wti_ret_sameday,
            "WTI_Return_1D": wti_ret_1d
        })
        
    return pd.DataFrame(results).set_index("Date")

def compute_percentile_features(df):
    print("Computing rolling percentiles and Z-scores...")
    # Inventory Z-Score (1 year rolling ~ 52 weeks)
    df["Inventory_ZScore"] = (df["Inventory_Change"] - df["Inventory_Change"].rolling(52, min_periods=10).mean()) / df["Inventory_Change"].rolling(52, min_periods=10).std()
    
    # Inventory Bucket (Expanding percentiles)
    # Using expanding rank for accurate historical simulation
    inv_pctl = df["Inventory_Change"].expanding(min_periods=20).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1])
    
    conditions = [
        inv_pctl <= 0.20,
        (inv_pctl > 0.20) & (inv_pctl <= 0.40),
        (inv_pctl > 0.40) & (inv_pctl <= 0.60),
        (inv_pctl > 0.60) & (inv_pctl <= 0.80),
        inv_pctl > 0.80
    ]
    choices = ["Large Draw", "Small Draw", "Neutral", "Small Build", "Large Build"]
    df["Inventory_Bucket"] = np.select(conditions, choices, default=pd.NA)
    
    # WTI Reaction Strength (Expanding percentiles of Absolute 1D Return)
    abs_ret = df["WTI_Return_1D"].abs()
    ret_pctl = abs_ret.expanding(min_periods=20).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1])
    
    ret_conditions = [
        ret_pctl <= 0.333,
        (ret_pctl > 0.333) & (ret_pctl <= 0.666),
        ret_pctl > 0.666
    ]
    ret_choices = ["Weak", "Medium", "Strong"]
    df["WTI_Reaction_Strength"] = np.select(ret_conditions, ret_choices, default=pd.NA)
    
    return df

def create_summary_report(df, output_path):
    report = f"""# EIA Inventory Impact Dataset Summary

**Total Releases:** {len(df)}
**Date Range:** {df.index.min()} to {df.index.max()}

## Inventory Statistics
- Mean Change: {df['Inventory_Change'].mean():.1f}k bbl
- Max Build: {df['Inventory_Change'].max():.1f}k bbl
- Max Draw: {df['Inventory_Change'].min():.1f}k bbl

## 1D Return Statistics (WTI)
- Mean Return: {df['WTI_Return_1D'].mean():.4%}
- Volatility (Std Dev): {df['WTI_Return_1D'].std():.4%}
- Max Positive Reaction: {df['WTI_Return_1D'].max():.4%}
- Max Negative Reaction: {df['WTI_Return_1D'].min():.4%}

## Category Counts
**Regime Distribution:**
{df['Regime'].value_counts().to_string()}

**Season Distribution:**
{df['Season'].value_counts().to_string()}

**Inventory Bucket Distribution:**
{df['Inventory_Bucket'].value_counts().to_string()}

**WTI Reaction Strength Distribution:**
{df['WTI_Reaction_Strength'].value_counts().to_string()}
"""
    with open(output_path, "w") as f:
        f.write(report)
        
def create_data_dictionary(output_path):
    dictionary = """# Data Dictionary - EIA Inventory Impact Dataset

| Column | Description |
|--------|-------------|
| Date | Date of the EIA Inventory Release |
| Inventory_Change | EIA weekly crude inventory change (thousands of barrels) |
| Inventory_Abs | Absolute inventory level (thousands of barrels) |
| Season | Q1-Q4 based on release month |
| Regime | Market regime label from 5-state classifier |
| WTI_Close_Pre | WTI c1 price before release (10:25 AM EST) |
| WTI_Close_Post | WTI c1 price after release (10:45 AM EST) |
| WTI_M1M2_Pre | WTI calendar spread (c1-c2) at 10:25 AM EST |
| WTI_M1M2_Post | WTI calendar spread (c1-c2) at 10:45 AM EST |
| WTI_M1M2_Change | Change in calendar spread (Post - Pre) |
| WTI_Return_SameDay | % return from 10:25 AM to 14:30 EST settlement |
| WTI_Return_1D | % return from release day 14:30 to next day 14:30 |
| Brent_Close_Pre | Brent c1 price at 10:25 AM EST |
| Brent_Close_Post | Brent c1 price at 10:45 AM EST |
| Brent_Return_1D | Brent % return from release day 14:30 to next day 14:30 |
| Inventory_ZScore | Z-Score of Inventory_Change (rolling 52-week window) |
| Inventory_Bucket | Expanding percentile bucket (Large Draw to Large Build) |
| WTI_Reaction_Strength | Expanding percentile bucket of absolute 1D Return (Weak/Medium/Strong) |
"""
    with open(output_path, "w") as f:
        f.write(dictionary)

def main():
    print("Loading outright 1-min data (fast mode)...")
    cl_path = project_dir / "data" / "CL_data.csv"
    
    cl_data = fast_load_1min(cl_path)
    
    print("Converting timestamps to America/New_York...")
    cl_data.index = cl_data.index.tz_convert("America/New_York")
    
    eia_df = get_eia_excel_data()
    
    df = extract_prices(cl_data, eia_df)
    df = compute_percentile_features(df)
    
    out_dir = project_dir / "eia_dataset"
    out_dir.mkdir(exist_ok=True)
    
    print("Saving outputs...")
    df.to_csv(out_dir / "eia_impact_master_dataset.csv")
    create_summary_report(df, out_dir / "eia_summary_report.md")
    create_data_dictionary(out_dir / "eia_data_dictionary.md")
    
    print("Done! Files saved in eia_dataset/")

if __name__ == "__main__":
    main()
