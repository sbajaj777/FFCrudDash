"""
Feature Selection — Analyzes Lasso coefficients for feature importance.
"""

def analyze_feature_importance(lasso_result: dict, threshold: float = 1e-4) -> dict:
    """
    Extracts selected and ignored features from the Lasso model results.
    """
    if lasso_result["model_type"] != "lasso":
        return {"error": "Expected lasso model results"}
        
    coefs = lasso_result.get("coefficients", {})
    
    selected = []
    ignored = []
    
    for feature, coef in coefs.items():
        if abs(coef) > threshold:
            selected.append({"feature": feature, "coefficient": coef})
        else:
            ignored.append({"feature": feature, "coefficient": coef})
            
    # Sort selected by absolute importance
    selected.sort(key=lambda x: abs(x["coefficient"]), reverse=True)
    
    return {
        "selected": selected,
        "ignored": ignored,
        "selected_count": len(selected),
        "total_count": len(coefs)
    }
