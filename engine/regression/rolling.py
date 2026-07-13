"""
Rolling Regression — Implements rolling window regressions to track coefficient stability.
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from config import ROLLING_WINDOW
import logging

logger = logging.getLogger(__name__)

def run_rolling_regression(df: pd.DataFrame, target: str, features: list, window: int = ROLLING_WINDOW) -> pd.DataFrame:
    """
    Runs a rolling OLS regression to see how feature importance changes over time.
    Returns a DataFrame with rolling coefficients and R-squared.
    """
    cols_to_keep = features + [target]
    missing = [c for c in cols_to_keep if c not in df.columns]
    if missing:
        return pd.DataFrame()
        
    clean_df = df[cols_to_keep].dropna()
    if len(clean_df) <= window:
        return pd.DataFrame()
        
    results = []
    
    # We use basic OLS for rolling to keep it fast
    model = LinearRegression()
    
    # Slide the window
    for i in range(window, len(clean_df)):
        window_data = clean_df.iloc[i-window:i]
        
        X = window_data[features]
        y = window_data[target]
        
        # Standardize within window so coefficients are comparable
        X_mean = X.mean()
        X_std = X.std()
        
        # Handle zero standard deviation
        X_std = X_std.replace(0, 1)
        
        X_scaled = (X - X_mean) / X_std
        
        model.fit(X_scaled, y)
        r2 = model.score(X_scaled, y)
        
        row_result = {
            "date": clean_df.index[i-1],
            "r2": r2
        }
        
        for j, feature in enumerate(features):
            row_result[feature] = model.coef_[j]
            
        results.append(row_result)
        
    result_df = pd.DataFrame(results)
    if not result_df.empty:
        result_df = result_df.set_index("date")
        
    return result_df
