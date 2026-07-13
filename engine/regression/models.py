"""
Regression Models — Implements Linear, Ridge, and Lasso regressions.
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression, RidgeCV, LassoCV
from sklearn.preprocessing import StandardScaler
from config import RIDGE_ALPHAS, LASSO_ALPHAS, CV_FOLDS
import logging

logger = logging.getLogger(__name__)

def prepare_data(df: pd.DataFrame, target: str, features: list) -> tuple:
    """
    Cleans and scales data for regression.
    """
    # Keep only rows where all features and target are non-NaN
    cols_to_keep = features + [target]
    
    # Check if columns exist
    missing = [c for c in cols_to_keep if c not in df.columns]
    if missing:
        logger.warning(f"Missing columns for regression: {missing}")
        return None, None, None
        
    clean_df = df[cols_to_keep].dropna()
    
    if len(clean_df) < 30: # Need minimum sample size
        return None, None, None
        
    X = clean_df[features]
    y = clean_df[target]
    
    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    X_scaled_df = pd.DataFrame(X_scaled, columns=features, index=X.index)
    
    return X_scaled_df, y, scaler

def fit_models(X: pd.DataFrame, y: pd.Series) -> dict:
    """
    Fits Linear, Ridge, and Lasso models.
    Returns dictionary of trained models.
    """
    models = {}
    
    # 1. Linear OLS
    ols = LinearRegression()
    ols.fit(X, y)
    models["linear"] = ols
    
    # 2. Ridge (L2 regularization, handles multicollinearity)
    # Use built-in Cross-Validation to find best alpha
    ridge = RidgeCV(alphas=RIDGE_ALPHAS, cv=CV_FOLDS)
    ridge.fit(X, y)
    models["ridge"] = ridge
    
    # 3. Lasso (L1 regularization, performs feature selection)
    # Using max_iter=10000 to ensure convergence. Removing explicit alphas so it auto-computes the optimal path.
    lasso = LassoCV(cv=CV_FOLDS, max_iter=10000)
    lasso.fit(X, y)
    models["lasso"] = lasso
    
    return models
