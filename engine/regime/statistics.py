"""
Regime Statistics — Analyzes spread/butterfly behavior per regime and computes transition matrices.
"""
import pandas as pd
import numpy as np
import logging
from config import REGIME_THRESHOLDS, SPREAD_STRUCTURES, BUTTERFLY_STRUCTURES

logger = logging.getLogger(__name__)

def compute_regime_statistics(df: pd.DataFrame) -> dict:
    """
    Computes summary statistics for all spreads and butterflies, grouped by regime.
    Also computes the transition matrix.
    """
    if "regime" not in df.columns:
        return {}
        
    stats = {}
    structures = [s[0] for s in SPREAD_STRUCTURES] + [b[0] for b in BUTTERFLY_STRUCTURES]
    
    # 1. Behavior by Regime
    for regime in REGIME_THRESHOLDS.keys():
        regime_df = df[df["regime"] == regime]
        regime_stats = {
            "n_obs": len(regime_df),
            "frequency_pct": len(regime_df) / len(df) * 100 if len(df) > 0 else 0,
            "structures": {}
        }
        
        if len(regime_df) > 0:
            for struct in structures:
                if struct in regime_df.columns:
                    series = regime_df[struct].dropna()
                    if len(series) > 0:
                        regime_stats["structures"][struct] = {
                            "mean": float(series.mean()),
                            "median": float(series.median()),
                            "std": float(series.std()),
                            "min": float(series.min()),
                            "max": float(series.max()),
                            "q10": float(series.quantile(0.10)),
                            "q25": float(series.quantile(0.25)),
                            "q75": float(series.quantile(0.75)),
                            "q90": float(series.quantile(0.90)),
                        }
        
        stats[regime] = regime_stats
        
    # 2. Transition Matrix (P(regime_t | regime_t-1))
    # Fill NA so we don't break crosstab
    regimes_shifted = df["regime"].shift(1).fillna("UNKNOWN")
    current_regimes = df["regime"].fillna("UNKNOWN")
    
    # Only keep known regimes
    valid_mask = (regimes_shifted != "UNKNOWN") & (current_regimes != "UNKNOWN")
    
    if valid_mask.sum() > 0:
        trans_matrix = pd.crosstab(
            regimes_shifted[valid_mask], 
            current_regimes[valid_mask], 
            normalize="index"
        )
        # Convert to nested dict
        stats["transitions"] = trans_matrix.to_dict(orient="index")
    else:
        stats["transitions"] = {}
        
    return stats
