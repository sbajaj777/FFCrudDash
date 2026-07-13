"""
Regression Evaluation — Evaluates models and selects the best one.
"""
import pandas as pd
import numpy as np
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error
from sklearn.model_selection import cross_val_score
from config import CV_FOLDS

def evaluate_models(models: dict, X_train: pd.DataFrame, X_test: pd.DataFrame, 
                   y_train: pd.Series, y_test: pd.Series) -> dict:
    """
    Evaluates all models using standard metrics on both train and test sets.
    """
    results = {}
    
    for name, model in models.items():
        y_train_pred = model.predict(X_train)
        y_test_pred = model.predict(X_test)
        
        # Test Metrics
        test_r2 = r2_score(y_test, y_test_pred)
        test_rmse = np.sqrt(mean_squared_error(y_test, y_test_pred))
        test_mae = mean_absolute_error(y_test, y_test_pred)
        
        # Train Metrics
        train_r2 = r2_score(y_train, y_train_pred)
        
        # Get Coefficients and Intercept
        coefs = {col: float(coef) for col, coef in zip(X_train.columns, model.coef_)}
        intercept = float(model.intercept_)
        
        # Get alpha for regularized models
        alpha = None
        if hasattr(model, 'alpha_'):
            alpha = float(model.alpha_)
            
        # Cross validation score
        cv_scores = cross_val_score(model, pd.concat([X_train, X_test]), 
                                  pd.concat([y_train, y_test]), cv=CV_FOLDS, scoring='r2')
        cv_mean = float(cv_scores.mean())
        
        results[name] = {
            "model_type": name,
            "train_r2": float(train_r2),
            "test_r2": float(test_r2),
            "test_rmse": float(test_rmse),
            "test_mae": float(test_mae),
            "cv_r2_mean": cv_mean,
            "alpha": alpha,
            "coefficients": coefs,
            "intercept": intercept
        }
        
    return results

def select_best_model(results: dict, metric: str = "test_r2") -> str:
    """
    Selects the best model based on the specified metric.
    """
    best_model = None
    best_score = -float('inf') if metric in ["test_r2", "train_r2", "cv_r2_mean"] else float('inf')
    
    for name, result in results.items():
        score = result.get(metric)
        if score is None:
            continue
            
        if metric in ["test_r2", "train_r2", "cv_r2_mean"]:
            # Higher is better
            if score > best_score:
                best_score = score
                best_model = name
        else:
            # Lower is better (RMSE, MAE)
            if score < best_score:
                best_score = score
                best_model = name
                
    return best_model
