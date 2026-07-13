"""
Seasonality — Computes seasonal features (month, quarter)
"""
import pandas as pd
import numpy as np

def compute_seasonality(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes month, quarter, and cyclical seasonal encodings.
    """
    if df.empty:
        return df
        
    df["month"] = df.index.month
    df["quarter"] = df.index.quarter
    
    # Cyclical encoding for regression models
    # This preserves the distance between Dec (12) and Jan (1)
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    
    return df
