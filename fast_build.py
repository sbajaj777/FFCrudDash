import sys
import os
from pathlib import Path
import pandas as pd
import numpy as np
import requests
import io
import datetime

project_dir = Path("c:/Users/shivam.bajaj/Downloads/dashboard 2/dashboard 2")
sys.path.append(str(project_dir))
sys.path.append(str(project_dir / "engine"))

from regime.classifier import classify_regimes

def fast_load_1min(filepath):
    print(f"Fast loading {filepath.name}...", flush=True)
    with open(filepath, 'r') as f:
        f.readline()
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
    print("Parsing datetimes...", flush=True)
    df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601', utc=True)
    df.set_index('timestamp', inplace=True)
    df.sort_index(inplace=True)
    print("Loaded completely.", flush=True)
    return df

def get_eia_excel_data():
    print("Downloading EIA Excel...", flush=True)
    url = 'https://www.eia.gov/dnav/pet/hist_xls/WCESTUS1w.xls'
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        df = pd.read_excel(io.BytesIO(resp.content), sheet_name='Data 1', skiprows=2)
        df.columns = ["Week_Ending", "Inventory_Abs"]
        df["Week_Ending"] = pd.to_datetime(df["Week_Ending"])
        df["Inventory_Change"] = df["Inventory_Abs"].diff()
        df["Date"] = df["Week_Ending"] + pd.Timedelta(days=5)
        df = df.dropna(subset=["Inventory_Change"])
        # Keep 5+ years of data to speed up extraction (2018 onwards)
        df = df[df["Date"] >= "2018-01-01"]
        return df.set_index("Date")
    else:
        raise Exception("EIA download failed")

def extract_prices(cl_data, eia_df):
    print("Extracting intraday prices...", flush=True)
    
    print("Resampling daily close...", flush=True)
    cl_1430 = cl_data.between_time("14:29", "14:31")
    cl_daily = cl_1430.resample("D").last().dropna(how="all")
    cl_daily["m1_m12"] = cl_daily["c1"] - cl_daily["c12"]
    
    print("Classifying Regimes...", flush=True)
    cl_daily = classify_regimes(cl_daily, primary_driver="m1_m12")
    
    results = []
    
    total = len(eia_df)
    print(f"Processing {total} EIA dates...", flush=True)
    
    cl_data_dates = set(cl_data.index.strftime("%Y-%m-%d").unique())
    
    for idx, (release_date, row) in enumerate(eia_df.iterrows()):
        if idx % 50 == 0:
            print(f"Processed {idx}/{total} dates...", flush=True)
            
        rd_str = release_date.strftime("%Y-%m-%d")
        if rd_str not in cl_data_dates:
            release_date = release_date + pd.Timedelta(days=1)
            rd_str = release_date.strftime("%Y-%m-%d")
            if rd_str not in cl_data_dates:
                continue
                
        day_data_cl = cl_data.loc[rd_str]
        
        try:
            pre_cl = day_data_cl.between_time("10:20", "10:26").iloc[-1]
            post_cl = day_data_cl.between_time("10:44", "10:46").iloc[-1]
        except IndexError:
            continue
            
        wti_pre = pre_cl["c1"]
        wti_post = post_cl["c1"]
        wti_m1m2_pre = pre_cl["c1"] - pre_cl["c2"]
        wti_m1m2_post = post_cl["c1"] - post_cl["c2"]
        wti_m1m2_change = wti_m1m2_post - wti_m1m2_pre
        
        future_dates = cl_daily.loc[rd_str:].index
        if len(future_dates) >= 2:
            next_day_idx = future_dates[1]
            wti_ret_1d = (cl_daily.loc[next_day_idx, "c1"] / cl_daily.loc[future_dates[0], "c1"]) - 1
            wti_ret_sameday = (cl_daily.loc[future_dates[0], "c1"] / wti_pre) - 1
        else:
            wti_ret_1d = np.nan
            wti_ret_sameday = np.nan
            
        regime = cl_daily.loc[future_dates[0], "regime"] if future_dates[0] in cl_daily.index else pd.NA
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
    print("Computing percentiles...", flush=True)
    df["Inventory_ZScore"] = (df["Inventory_Change"] - df["Inventory_Change"].rolling(52, min_periods=10).mean()) / df["Inventory_Change"].rolling(52, min_periods=10).std()
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
    
    abs_ret = df["WTI_Return_1D"].abs()
    ret_pctl = abs_ret.expanding(min_periods=20).apply(lambda x: pd.Series(x).rank(pct=True).iloc[-1])
    ret_conditions = [ret_pctl <= 0.333, (ret_pctl > 0.333) & (ret_pctl <= 0.666), ret_pctl > 0.666]
    df["WTI_Reaction_Strength"] = np.select(ret_conditions, ["Weak", "Medium", "Strong"], default=pd.NA)
    return df

def main():
    cl_path = project_dir / "data" / "CL_data.csv"
    cl_data = fast_load_1min(cl_path)
    
    print("Converting timezone...", flush=True)
    cl_data.index = cl_data.index.tz_convert("America/New_York")
    
    # Filter to speed up
    cl_data = cl_data[cl_data.index >= "2018-01-01"]
    
    eia_df = get_eia_excel_data()
    df = extract_prices(cl_data, eia_df)
    df = compute_percentile_features(df)
    
    out_dir = project_dir / "eia_dataset"
    out_dir.mkdir(exist_ok=True)
    
    df.to_csv(out_dir / "eia_impact_master_dataset.csv")
    print("Done!", flush=True)

if __name__ == "__main__":
    main()
