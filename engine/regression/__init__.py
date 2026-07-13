"""
Regression Engine Package
"""
import pandas as pd
from regression.models import prepare_data, fit_models
from regression.evaluation import evaluate_models, select_best_model
from regression.feature_selection import analyze_feature_importance
from regression.rolling import run_rolling_regression
from config import TRAIN_TEST_SPLIT
import logging

logger = logging.getLogger(__name__)

def run_regression_pipeline(df: pd.DataFrame, target: str, features: list) -> dict:
    """
    Runs the full regression pipeline (Linear, Ridge, Lasso) for a given target.
    Expects data to be pre-filtered for a specific regime if needed.
    """
    X_scaled_df, y, scaler = prepare_data(df, target, features)
    
    if X_scaled_df is None or len(X_scaled_df) < 30:
        return {"error": "Insufficient data"}
        
    # Chronological split
    split_idx = int(len(X_scaled_df) * TRAIN_TEST_SPLIT)
    
    X_train = X_scaled_df.iloc[:split_idx]
    y_train = y.iloc[:split_idx]
    
    X_test = X_scaled_df.iloc[split_idx:]
    y_test = y.iloc[split_idx:]
    
    if len(X_test) < 5:
        return {"error": "Insufficient test data"}
        
    # Fit models
    models = fit_models(X_train, y_train)
    
    # Evaluate
    results = evaluate_models(models, X_train, X_test, y_train, y_test)
    
    # Select Best
    best_model_name = select_best_model(results, metric="test_r2")
    for name in results:
        results[name]["is_best"] = (name == best_model_name)
        
    # Feature Selection (from Lasso)
    feature_importance = {}
    if "lasso" in results:
        feature_importance = analyze_feature_importance(results["lasso"])
        
    # Save scaler params for fair value reconstruction
    scaler_params = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "features": features
    }
        
    return {
        "target": target,
        "n_obs": len(X_scaled_df),
        "train_obs": len(X_train),
        "test_obs": len(X_test),
        "best_model": best_model_name,
        "models": results,
        "feature_importance": feature_importance,
        "scaler": scaler_params
    }
