"""
Inventory Metrics — Computes inventory percentiles and z-scores
"""
import pandas as pd
import numpy as np

def compute_inventory_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes expanding percentiles and z-scores for inventory level and change.
    Avoids look-ahead bias by using expanding windows.
    """
    if "inv_level" not in df.columns or "inv_change" not in df.columns:
        return df
        
    # Percentiles
    df["inv_pctl"] = df["inv_level"].expanding().apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100 if len(x) > 0 else np.nan
    )
    
    df["inv_change_pctl"] = df["inv_change"].expanding().apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100 if len(x) > 0 else np.nan
    )
    
    # Z-Scores (using 1-year rolling window for local context)
    window = 252
    df["inv_zscore"] = (df["inv_level"] - df["inv_level"].rolling(window, min_periods=30).mean()) / df["inv_level"].rolling(window, min_periods=30).std()
    
    # Backfill the burn-in period to preserve rows for regression
    df["inv_pctl"] = df["inv_pctl"].bfill()
    df["inv_change_pctl"] = df["inv_change_pctl"].bfill()
    df["inv_zscore"] = df["inv_zscore"].bfill()
    df["inv_zscore"] = df["inv_zscore"].replace([np.inf, -np.inf], 0)
    df["inv_zscore"] = df["inv_zscore"].fillna(0) # in case std was 0
    
    return df
