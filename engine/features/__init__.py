"""
Feature Engineering Pipeline
"""
import pandas as pd
import logging

from features.curve_metrics import compute_spreads
from features.butterflies import compute_butterflies
from features.volatility import compute_volatility
from features.inventory import compute_inventory_metrics
from features.seasonality import compute_seasonality

logger = logging.getLogger(__name__)

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Runs the complete feature engineering pipeline on a daily DataFrame.
    """
    if df is None or df.empty:
        return df
        
    df = df.copy()
    
    df = compute_spreads(df)
    df = compute_butterflies(df)
    df = compute_volatility(df)
    df = compute_inventory_metrics(df)
    df = compute_seasonality(df)
    
    # Drop rows where we don't have the primary target (m1_m6)
    if "m1_m6" in df.columns:
        initial_len = len(df)
        df = df.dropna(subset=["m1_m6"])
        if len(df) < initial_len:
            logger.debug(f"  Dropped {initial_len - len(df)} rows missing primary structure (m1_m6)")
            
    return df
