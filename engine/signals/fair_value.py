"""
Fair Value — Generates expected fair values and residuals based on best regression model.
"""
import pandas as pd
import numpy as np
import logging

logger = logging.getLogger(__name__)

def generate_fair_values_for_series(df: pd.DataFrame, target: str, model_results: dict) -> pd.DataFrame:
    """
    Generates a historical series of fair values and residuals based on the best model.
    Uses the stored coefficients and scaler parameters to reconstruct predictions
    without needing the raw sklearn objects.
    """
    if df.empty or not model_results or "best_model" not in model_results:
        return pd.DataFrame()
        
    best_name = model_results.get("best_model")
    if not best_name:
        return pd.DataFrame()
        
    best_model_info = model_results.get("models", {}).get(best_name)
    scaler_info = model_results.get("scaler")
    
    if not best_model_info or not scaler_info:
        return pd.DataFrame()
        
    coefs = best_model_info.get("coefficients", {})
    intercept = best_model_info.get("intercept", 0.0)
    
    features = scaler_info.get("features", [])
    means = scaler_info.get("mean", [])
    scales = scaler_info.get("scale", [])
    
    # We only compute fair value for rows where we have the target and all features
    cols_needed = features + [target]
    missing = [c for c in cols_needed if c not in df.columns]
    if missing:
        return pd.DataFrame()
        
    # Drop NaNs to compute fair values cleanly
    clean_df = df[cols_needed].dropna().copy()
    if clean_df.empty:
        return pd.DataFrame()
        
    # Compute the expected value manually:
    # 1. Scale features
    # 2. Multiply by coefficients
    # 3. Add intercept
    
    expected_values = np.ones(len(clean_df)) * intercept
    
    for i, feature in enumerate(features):
        if feature in coefs:
            # Scale the feature: (X - mean) / scale
            scaled_feature = (clean_df[feature] - means[i]) / scales[i]
            expected_values += scaled_feature * coefs[feature]
            
    clean_df["expected"] = expected_values
    clean_df["actual"] = clean_df[target]
    clean_df["residual"] = clean_df["actual"] - clean_df["expected"]
    
    # Return just the relevant columns
    return clean_df[["actual", "expected", "residual"]]
