"""
Signal Generation — Computes z-scores of residuals and assigns signal classifications.
"""
import pandas as pd
import numpy as np
import scipy.stats as stats
from config import SIGNAL_THRESHOLDS

def generate_signals(fair_value_df: pd.DataFrame) -> pd.DataFrame:
    """
    Takes a DataFrame containing actual, expected, and residual columns,
    and computes the z-score of the residual to generate a signal.
    """
    if fair_value_df.empty or "residual" not in fair_value_df.columns:
        return pd.DataFrame()
        
    df = fair_value_df.copy()
    
    # Compute expanding historical z-score of the residual to avoid lookahead bias
    # Or for simplicity in historical view, compute the standard z-score
    # We use expanding window of at least 30 days
    df["residual_mean"] = df["residual"].expanding(min_periods=30).mean()
    df["residual_std"] = df["residual"].expanding(min_periods=30).std()
    
    # For initial periods (<30 days), backfill with the first valid values
    df["residual_mean"] = df["residual_mean"].bfill()
    df["residual_std"] = df["residual_std"].bfill()
    
    # Handle zero std
    df["residual_std"] = df["residual_std"].replace(0, 1e-6)
    
    df["z_score"] = (df["residual"] - df["residual_mean"]) / df["residual_std"]
    
    # Also compute percentiles
    df["percentile"] = df["residual"].expanding(min_periods=30).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    ).bfill()
    
    # Classify Signals
    signals = []
    for z in df["z_score"]:
        if pd.isna(z):
            signals.append("NEUTRAL")
        elif z >= SIGNAL_THRESHOLDS["RICH"]:
            signals.append("RICH")
        elif z >= SIGNAL_THRESHOLDS["SLIGHTLY_RICH"]:
            signals.append("SLIGHTLY_RICH")
        elif z <= SIGNAL_THRESHOLDS["CHEAP"]:
            signals.append("CHEAP")
        elif z <= SIGNAL_THRESHOLDS["SLIGHTLY_CHEAP"]:
            signals.append("SLIGHTLY_CHEAP")
        else:
            signals.append("FAIR")
            
    df["signal"] = signals
    
    return df
