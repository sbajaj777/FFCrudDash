"""
Resampler — Converts 1-minute outright data to daily close prices.

For each product's 1-min DataFrame, produces a daily DataFrame where:
- Each row is one trading day
- Each column (c1, c2, ...) contains the LAST valid price of that day
- Forward-fills short gaps (≤5 bars) but preserves genuine NaN for illiquid months
"""
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)


def resample_to_daily(df_1min: pd.DataFrame, method: str = "last") -> pd.DataFrame:
    """
    Resample a 1-min DataFrame to daily frequency.
    
    Args:
        df_1min: DataFrame with DatetimeIndex (UTC), columns c1, c2, ...
        method: "last" (default) — take last non-NaN value per day.
                This simulates the end-of-day settlement price.
    
    Returns:
        DataFrame with daily DatetimeIndex, same columns
    """
    if df_1min.empty:
        return df_1min
    
    # Ensure index is datetime and UTC
    if df_1min.index.tz is None:
        df_1min.index = df_1min.index.tz_localize("UTC")
    
    # Group by calendar date and take last valid observation
    if method == "last":
        daily = df_1min.groupby(df_1min.index.date).last()
    elif method == "mean":
        daily = df_1min.groupby(df_1min.index.date).mean()
    else:
        daily = df_1min.groupby(df_1min.index.date).last()
    
    # Convert index to datetime
    daily.index = pd.to_datetime(daily.index)
    daily.index.name = "date"
    
    # Sort chronologically
    daily = daily.sort_index()
    
    # Drop rows that are entirely NaN (weekends/holidays that slipped through)
    daily = daily.dropna(how="all")
    
    # For the front months (c1-c6), forward-fill gaps of 1-2 days
    # (contract rolls can cause brief gaps)
    front_months = [c for c in daily.columns if c in ["c1", "c2", "c3", "c4", "c5", "c6"]]
    if front_months:
        daily[front_months] = daily[front_months].fillna(method="ffill", limit=2)
    
    logger.info(f"  Resampled to {len(daily)} daily observations "
                f"({daily.index.min().date()} → {daily.index.max().date()})")
    
    return daily


def resample_all_products(products_1min: dict) -> dict:
    """
    Resample all product DataFrames from 1-min to daily.
    
    Args:
        products_1min: {product_key: DataFrame (1-min)}
    
    Returns:
        {product_key: DataFrame (daily)}
    """
    daily_products = {}
    
    for product_key, df in products_1min.items():
        if df.empty:
            logger.warning(f"[{product_key}] Empty DataFrame, skipping resample")
            continue
        
        # Check if already daily (e.g., settlement files)
        if len(df) < 5000:  # Settlement files have ~2700 rows, 1-min files have millions
            logger.info(f"[{product_key}] Data appears to be daily already ({len(df)} rows), skipping resample")
            # Still ensure proper index
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index)
            df.index.name = "date"
            daily_products[product_key] = df
        else:
            logger.info(f"[{product_key}] Resampling {len(df)} 1-min rows to daily...")
            daily_products[product_key] = resample_to_daily(df)
    
    return daily_products
