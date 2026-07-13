# Modeling Recommendations

Based on exploratory analysis, the following specifications are recommended for the forecasting phase:

1. **Best Forecasting Target**: `WTI_Return_SameDay` shows the strongest correlation with inventory surprises.
2. **Inventory Metric**: `Inventory_ZScore` consistently outperforms raw `Inventory_Change` by normalizing for long-term variance.
3. **Regime Inclusion**: Yes. Regimes (especially Extremes) exhibit significantly different variance and directional sensitivity. Should be included as categorical dummy variables or used to train separate sub-models.
4. **Season Inclusion**: Yes. Seasonal demand shifts (like summer driving vs winter maintenance) modulate the shock impact. Include as categorical dummy variables.

## Ranked Feature List
1. `Inventory_ZScore` (Primary Driver)
2. `Regime` (Market Context Multiplier)
3. `Season` (Cyclical Multiplier)
4. `WTI_M1M2_Pre` (Continuous curve tightness prior to release)
