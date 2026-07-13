"""
Opportunity Ranker — Ranks generated signals using a composite score.
"""
from config import RANKING_WEIGHTS

def score_opportunity(signal_row: dict, model_results: dict, regime_conf: float) -> dict:
    """
    Computes a composite ranking score for an opportunity.
    Higher score = Better opportunity (more extreme, more robust).
    """
    if "z_score" not in signal_row or signal_row["z_score"] is None:
        return 0.0
        
    z_score = abs(float(signal_row["z_score"]))
    
    best_name = model_results.get("best_model")
    if not best_name:
        return 0.0
        
    best_model_info = model_results.get("models", {}).get(best_name, {})
    
    # Extract components
    # 1. Z-Score Extremity (Normalize roughly 0-1, capping around 3.0)
    z_score_norm = min(z_score / 3.0, 1.0)
    
    # 2. Model Confidence (Test R2)
    test_r2 = float(best_model_info.get("test_r2", 0.0))
    model_conf_norm = max(min(test_r2, 1.0), 0.0)
    
    # 3. Regime Confidence
    regime_conf_norm = float(regime_conf) / 100.0 if regime_conf else 0.0
    
    # 4. Sample Size Robustness (Assume 500+ is max score)
    n_obs = float(model_results.get("n_obs", 0))
    sample_norm = min(n_obs / 500.0, 1.0)
    
    # Compute weighted score components
    z_score_pts = RANKING_WEIGHTS["z_score_extremity"] * z_score_norm
    model_conf_pts = RANKING_WEIGHTS["model_confidence"] * model_conf_norm
    regime_conf_pts = RANKING_WEIGHTS["regime_confidence"] * regime_conf_norm
    sample_pts = RANKING_WEIGHTS["sample_robustness"] * sample_norm
    
    score = z_score_pts + model_conf_pts + regime_conf_pts + sample_pts
    
    return {
        "total_score": round(score * 100, 2),
        "decomposition": {
            "z_score": round(z_score_pts * 100, 2),
            "model_confidence": round(model_conf_pts * 100, 2),
            "regime_confidence": round(regime_conf_pts * 100, 2),
            "sample_robustness": round(sample_pts * 100, 2),
        }
    }
