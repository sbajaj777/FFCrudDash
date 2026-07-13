"""
Regime Explainer — Generates human-readable explanations for regime classifications.
"""
import pandas as pd
import numpy as np

def explain_regime(row: pd.Series) -> dict:
    """
    Given a single day's data (a row from the enriched DataFrame),
    returns a dictionary explaining the current regime.
    """
    if "regime" not in row or pd.isna(row["regime"]):
        return {"error": "No regime classified"}
        
    from config import REGIME_THRESHOLDS
    
    regime_name = row["regime"]
    lower_bound, upper_bound = REGIME_THRESHOLDS.get(regime_name, (0, 100))
    
    # Calculate Confidence Decomposition dynamically
    # 1. Curve Structure (up to 60%)
    driver_pctl = float(row.get("driver_pctl", 50))
    center = (lower_bound + upper_bound) / 2
    width = upper_bound - lower_bound
    dist_from_center = abs(driver_pctl - center)
    curve_conf = max(0.0, 1.0 - (dist_from_center / (width / 2))) * 60
    
    # 2. Volatility Consistency (up to 20%)
    vol_pctl = float(row.get("vol_20d_pctl", 50))
    # E.g. Extreme backwardation expects high vol, Deep contango expects high vol, Flat expects low vol
    # Simplification: closer to 50 is more "normal", closer to extremes is more "volatile"
    vol_conf = 10.0 # baseline
    if regime_name in ["R5_EXTREME_BACKWARDATION", "R1_DEEP_CONTANGO"]:
        vol_conf = 20.0 if vol_pctl > 75 else 10.0
    else:
        vol_conf = 20.0 if 25 <= vol_pctl <= 75 else 10.0
        
    # 3. Inventory Consistency (up to 20%)
    inv_pctl = float(row.get("inv_pctl", 50))
    inv_conf = 10.0 # baseline
    if "BACKWARDATION" in regime_name:
        inv_conf = 20.0 if inv_pctl < 40 else 10.0
    elif "CONTANGO" in regime_name:
        inv_conf = 20.0 if inv_pctl > 60 else 10.0
        
    total_conf = curve_conf + vol_conf + inv_conf
    
    explanation = {
        "regime": regime_name,
        "confidence": round(total_conf, 1),
        "confidence_decomposition": {
            "curve_structure": round(curve_conf, 1),
            "volatility_consistency": round(vol_conf, 1),
            "inventory_consistency": round(inv_conf, 1)
        },
        "primary_driver": {
            "name": "M1-M12 Spread",
            "value": float(row.get("m1_m12", 0)),
            "percentile": driver_pctl,
        },
        "classification_thresholds": {
            "lower": lower_bound,
            "upper": upper_bound
        },
        "enrichment": []
    }
    
    # Enrichment: Volatility context
    if "vol_20d_pctl" in row and not pd.isna(row["vol_20d_pctl"]):
        pctl = row["vol_20d_pctl"]
        context = "Elevated" if pctl > 75 else "Subdued" if pctl < 25 else "Normal"
        explanation["enrichment"].append({
            "metric": "Volatility (20d)",
            "value": f"{row['vol_20d']:.1f}%",
            "percentile": float(pctl),
            "context": context
        })
        
    # Enrichment: Inventory context
    if "inv_pctl" in row and not pd.isna(row["inv_pctl"]):
        pctl = row["inv_pctl"]
        context = "High" if pctl > 75 else "Low" if pctl < 25 else "Normal"
        explanation["enrichment"].append({
            "metric": "Inventory Level",
            "value": "N/A",  # The absolute number isn't very meaningful without units, keep pctl
            "percentile": float(pctl),
            "context": context
        })
        
    # Enrichment: Macro context
    if "dxy" in row and not pd.isna(row["dxy"]):
        # A simple comparison to recent history would be better, but level is okay
        explanation["enrichment"].append({
            "metric": "DXY Level",
            "value": f"{row['dxy']:.2f}",
            "percentile": None,
            "context": "Macro Environment"
        })
        
    return explanation
