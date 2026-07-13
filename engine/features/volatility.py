"""
Volatility Metrics — Computes rolling historical volatility
"""
import pandas as pd
import numpy as np
from config import VOL_WINDOWS, ANNUALIZATION_FACTOR

def compute_volatility(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute rolling realized volatility for the front month (c1).
    Adds vol_XXd and percentiles.
    """
    if "c1" not in df.columns:
        return df
        
    # Log returns
    returns = np.log(df["c1"] / df["c1"].shift(1))
    
    for window in VOL_WINDOWS:
        # Rolling standard deviation * sqrt(252)
        vol_col = f"vol_{window}d"
        df[vol_col] = returns.rolling(window=window).std() * np.sqrt(ANNUALIZATION_FACTOR) * 100
        
        # Compute expanding percentile (how high is vol compared to history up to that point)
        # We use rolling rank to avoid look-ahead bias
        # For simplicity in this engine, we can compute the overall percentile or expanding
        # Since this is for historical analysis, we'll use an expanding window for realism
        pctl_col = f"vol_{window}d_pctl"
        df[pctl_col] = df[vol_col].expanding().apply(
            lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100 if len(x) > 0 else np.nan
        )
        
    return df
