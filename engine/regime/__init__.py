"""
Regime Engine Package
"""
import pandas as pd
from regime.classifier import classify_regimes
from regime.statistics import compute_regime_statistics
from regime.explainer import explain_regime

def run_regime_pipeline(df: pd.DataFrame, primary_driver: str = "m1_m12") -> pd.DataFrame:
    """
    Runs the regime classification pipeline on an enriched DataFrame.
    """
    if df is None or df.empty:
        return df
        
    df = df.copy()
    df = classify_regimes(df, primary_driver=primary_driver)
    return df
