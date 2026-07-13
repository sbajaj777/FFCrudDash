"""
Regime Classifier — Assigns market regimes based on percentile thresholds.
"""
import pandas as pd
import numpy as np
import logging
from config import REGIME_THRESHOLDS

logger = logging.getLogger(__name__)

def classify_regimes(df: pd.DataFrame, primary_driver: str = "m1_m12") -> pd.DataFrame:
    """
    Classifies the market regime for each daily observation using the primary driver.
    Computes percentiles and assigns labels based on REGIME_THRESHOLDS.
    Also computes a confidence score (how deep into the band the observation is).
    """
    if primary_driver not in df.columns:
        logger.warning(f"Primary driver '{primary_driver}' not found. Cannot classify regimes.")
        df["regime"] = pd.NA
        df["regime_confidence"] = np.nan
        df["driver_pctl"] = np.nan
        return df
        
    # We use expanding rank to avoid look-ahead bias
    # At day T, what percentile is the spread relative to all days up to T?
    # To have meaningful percentiles, we need a minimum history (e.g., 252 days)
    # For days < 252, we use the first 252 days to seed the percentiles
    
    # Calculate expanding percentile
    # Note: rank(pct=True) returns [0, 1]
    driver_series = df[primary_driver]
    
    # Fast expanding percentile approximation using rank over rolling window
    # A fully expanding rank at every step is O(N^2), so we use rolling for speed
    window = 504  # 2 years of local context
    pctl_series = driver_series.rolling(window=window, min_periods=60).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    )
    
    # Forward/backward fill the initial burn-in period
    pctl_series = pctl_series.bfill()
    df["driver_pctl"] = pctl_series
    
    # Assign labels and compute confidence
    regimes = []
    confidences = []
    
    for pctl in df["driver_pctl"]:
        if pd.isna(pctl):
            regimes.append(pd.NA)
            confidences.append(np.nan)
            continue
            
        assigned = False
        for label, (lower, upper) in REGIME_THRESHOLDS.items():
            if lower <= pctl <= upper:
                regimes.append(label)
                # Confidence: distance from edge. Max 100% at center, 0% at edge
                center = (lower + upper) / 2
                width = upper - lower
                dist_from_center = abs(pctl - center)
                # 1.0 at center, 0.0 at edge
                conf = max(0.0, 1.0 - (dist_from_center / (width / 2)))
                confidences.append(round(conf * 100, 1))
                assigned = True
                break
                
        if not assigned:
            # Handle edge case where pctl might be slightly > 100 or < 0
            if pctl > 100:
                regimes.append("R5_EXTREME_BACKWARDATION")
                confidences.append(100.0)
            elif pctl < 0:
                regimes.append("R1_DEEP_CONTANGO")
                confidences.append(100.0)
            else:
                regimes.append(pd.NA)
                confidences.append(np.nan)
                
    df["regime"] = regimes
    df["regime_confidence"] = confidences
    
    return df
