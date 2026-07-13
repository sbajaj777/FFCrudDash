"""
Pull macro data from FRED (Federal Reserve) - always accessible.
FRED Series Used:
  - SP500  : S&P 500 daily close (FRED)
  - DTWEXBGS: Dollar Index (Nominal Broad U.S. Dollar Index) - daily
  - DGS10  : 10-Year Treasury yield - daily
"""
import requests
import pandas as pd
from io import StringIO
from pathlib import Path
import time

def fetch_fred(series_id, start="2020-01-01"):
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    r = requests.get(url, timeout=15)
    if r.status_code != 200:
        print(f"  FAILED: {series_id} — HTTP {r.status_code}")
        return None
    df = pd.read_csv(StringIO(r.text), parse_dates=["observation_date"], index_col="observation_date")
    df = df[df.index >= start]
    df.columns = [series_id]
    # FRED uses "." for missing — convert to NaN
    df[series_id] = pd.to_numeric(df[series_id], errors="coerce")
    return df

print("Fetching macro data from FRED...")
series = {
    "SP500":    "S&P 500 Daily Close",
    "DTWEXBGS": "USD Nominal Broad Dollar Index",
    "DGS10":    "10-Year Treasury Yield (daily)"
}

frames = {}
for sid, label in series.items():
    print(f"  Pulling {sid} ({label})...", end=" ")
    df = fetch_fred(sid, start="2020-01-01")
    if df is not None:
        df.dropna(inplace=True)
        frames[sid] = df
        print(f"OK {len(df)} rows")
    time.sleep(0.3)  # Be polite to FRED

macro_daily = pd.concat(frames.values(), axis=1).sort_index()
macro_daily.dropna(how="all", inplace=True)
macro_daily.to_csv("eia_dataset/macro_daily_fred.csv")
print(f"\nSaved macro_daily_fred.csv: {macro_daily.shape}")
print(macro_daily.tail(5))
