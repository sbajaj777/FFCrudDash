"""
Signal Engine Package
"""
import pandas as pd
from signals.fair_value import generate_fair_values_for_series
from signals.signal_gen import generate_signals
from signals.ranker import score_opportunity

def scan_opportunities(products_enriched: dict, regressions: dict, regime_stats: dict) -> list:
    """
    Scans all products and structures for the latest date to find the best opportunities.
    Returns a ranked list of opportunities with regime historical statistics attached.
    """
    opportunities = []
    
    for product, df in products_enriched.items():
        if df.empty or product not in regressions:
            continue
            
        latest_row = df.iloc[-1]
        latest_date = latest_row.name
        current_regime = latest_row.get("regime")
        regime_conf = latest_row.get("regime_confidence", 0)
        
        if pd.isna(current_regime):
            continue
            
        product_regs = regressions[product]
        
        for structure, struct_regs in product_regs.items():
            if structure not in latest_row or pd.isna(latest_row[structure]):
                continue
                
            # Prefer regime-specific model, fallback to ALL
            model_results = struct_regs.get(current_regime, struct_regs.get("ALL"))
            if not model_results:
                continue
                
            # We need to compute the fair value and signal for the latest point
            # To do this accurately with z-scores, we re-run the series
            fv_df = generate_fair_values_for_series(df, structure, model_results)
            if fv_df.empty:
                continue
                
            signal_df = generate_signals(fv_df)
            if signal_df.empty:
                continue
                
            latest_signal = signal_df.iloc[-1]
            
            # Score the opportunity
            signal_dict = latest_signal.to_dict()
            score_data = score_opportunity(signal_dict, model_results, regime_conf)
            
            # Extract historical regime statistics for this structure
            hist_mean = 0.0
            hist_std = 0.0
            if product in regime_stats:
                r_stats = regime_stats[product].get(current_regime, {}).get("structures", {}).get(structure, {})
                hist_mean = float(r_stats.get("mean", 0.0))
                hist_std = float(r_stats.get("std", 0.0))
                
            opp = {
                "product": product,
                "structure": structure,
                "date": str(latest_date.date()),
                "regime": current_regime,
                "regime_confidence": regime_conf,
                "actual": float(signal_dict.get("actual", 0.0)),
                "expected": float(signal_dict.get("expected", 0.0)),
                "residual": float(signal_dict.get("residual", 0.0)),
                "z_score": float(signal_dict.get("z_score", 0.0)),
                "percentile": float(signal_dict.get("percentile", 0.0)),
                "hist_regime_mean": hist_mean,
                "hist_regime_std": hist_std,
                "signal": signal_dict.get("signal", "NEUTRAL"),
                "score": score_data.get("total_score", 0.0) if isinstance(score_data, dict) else 0.0,
                "score_decomposition": score_data.get("decomposition", {}) if isinstance(score_data, dict) else {},
                "best_model": model_results.get("best_model", "unknown")
            }
            
            opportunities.append(opp)
            
    # Sort by score descending
    opportunities.sort(key=lambda x: x["score"], reverse=True)
    
    return opportunities
