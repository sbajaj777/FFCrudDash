# %% [markdown]
# # EIA Inventory Impact — Enhanced Regression Model
# ## Improvements: Winsorization + Non-linear ZScore + Regime Sub-Models + Robust SE
# ---

# %%
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
from pathlib import Path
from scipy import stats
from statsmodels.stats.outliers_influence import variance_inflation_factor
import statsmodels.formula.api as smf
import statsmodels.api as sm

warnings.filterwarnings("ignore")
plt.style.use("dark_background")

out_dir   = Path("eia_dataset")
analysis_dir = out_dir / "analysis"
plot_dir  = out_dir / "plots"
analysis_dir.mkdir(exist_ok=True, parents=True)
plot_dir.mkdir(exist_ok=True, parents=True)

# Load master dataset + macro
df = pd.read_csv("eia_dataset/eia_impact_master_dataset.csv", parse_dates=["Date"])
df.set_index("Date", inplace=True)
df.sort_index(inplace=True)

macro_daily = pd.read_csv("eia_dataset/macro_daily_fred.csv", parse_dates=["observation_date"],
                          index_col="observation_date").sort_index()

# Macro pre-release returns
spx_ret = macro_daily["SP500"].pct_change() * 100
dxy_ret = macro_daily["DTWEXBGS"].pct_change() * 100
tnx_chg = macro_daily["DGS10"].diff() * 100

def align_to_eia(series):
    return series.reindex(df.index, method="nearest", tolerance=pd.Timedelta("3D"))

df["SPX_Pre_Return"]   = align_to_eia(spx_ret)
df["DXY_Pre_Return"]   = align_to_eia(dxy_ret)
df["TNX_Pre_BpChange"] = align_to_eia(tnx_chg)

# Geopolitical Score (same as before)
GEOPOLITICAL_EVENTS = {
    "2021-01-05": +1, "2021-11-23": -1,
    "2022-02-24": +1, "2022-03-08": +1, "2022-03-31": -1,
    "2022-10-05": +1, "2023-04-02": +1, "2023-07-03": +1,
    "2023-10-07": +1, "2024-01-12": +1, "2024-04-01": +1,
    "2024-06-02": -1,
}
geo_series = pd.Series(0, index=df.index, dtype=float)
for event_date_str, score in GEOPOLITICAL_EVENTS.items():
    event_date = pd.Timestamp(event_date_str)
    time_diffs = pd.Series((df.index - event_date).total_seconds(), index=df.index).abs()
    nearest_idx = time_diffs.argmin()
    if abs((df.index[nearest_idx] - event_date).days) <= 14:
        geo_series.iloc[nearest_idx] += score
df["Geo_Score"] = geo_series.clip(-1, 1)

print(f"Dataset loaded: {len(df)} rows")

# %% [markdown]
# ## FIX 1 — Winsorize the Target Variable
# Cap extreme outliers at 1st/99th percentile to reduce distortion from COVID/extreme events.
# This does NOT remove rows — it simply caps the magnitude of the most extreme observations.

# %%
lower = df["WTI_Return_SameDay"].quantile(0.01)
upper = df["WTI_Return_SameDay"].quantile(0.99)
df["Target"] = df["WTI_Return_SameDay"].clip(lower, upper)

print(f"Winsorize bounds: [{lower:.4f}, {upper:.4f}]")
print(f"Rows affected: {((df['WTI_Return_SameDay'] < lower) | (df['WTI_Return_SameDay'] > upper)).sum()}")

# %% [markdown]
# ## FIX 2 — Add ZScore² (Non-Linear Term)
# The market ignores small surprises but reacts explosively to large ones.
# ZScore² captures this convex, threshold-type behaviour.

# %%
df["ZScore_sq"] = df["Inventory_ZScore"] ** 2
df["ZScore_abs"] = df["Inventory_ZScore"].abs()
print("Added ZScore_sq and ZScore_abs features.")

# %% [markdown]
# ## FULL ENHANCED MODEL (All regimes pooled, with non-linear ZScore)

# %%
full_df = df[["Target","Inventory_ZScore","ZScore_sq","ZScore_abs",
              "WTI_M1M2_Pre","SPX_Pre_Return","DXY_Pre_Return",
              "TNX_Pre_BpChange","Geo_Score","Regime","Season"]].dropna()

print(f"Full model rows: {len(full_df)}")

formula_enhanced = (
    "Target ~ "
    "Inventory_ZScore + ZScore_sq "    # Non-linear inventory surprise
    "+ WTI_M1M2_Pre "                  # Curve tightness
    "+ SPX_Pre_Return "                # Risk-On/Off
    "+ DXY_Pre_Return "                # Dollar strength
    "+ Geo_Score "                     # Geopolitical
    "+ C(Season) "                     # Seasonal control
    "+ C(Regime) "                     # Regime control
    "+ C(Regime):Inventory_ZScore "    # Regime amplification (directional)
    "+ C(Regime):ZScore_sq"            # Regime amplification (non-linear)
)

model_full = smf.ols(formula_enhanced, data=full_df).fit(cov_type="HC3")  # Robust SE
print(f"\nFULL ENHANCED MODEL:")
print(f"  R-squared:      {model_full.rsquared:.3f}")
print(f"  Adj. R-squared: {model_full.rsquared_adj:.3f}")
print(f"  F-stat p-value: {model_full.f_pvalue:.4f}")
print(f"  N observations: {model_full.nobs:.0f}")

sig = model_full.pvalues[model_full.pvalues < 0.05]
print(f"\nSignificant variables (p<0.05):")
print(sig.sort_values())

# %% [markdown]
# ## FIX 3 — FILTER TO MEANINGFUL SURPRISES ONLY
# The single biggest source of noise is "neutral" weeks where the market doesn't care.
# Filter to |ZScore| > 0.3 — only trade when there's a real surprise.

# %%
active_df = full_df[full_df["ZScore_abs"] > 0.3].copy()
print(f"\nFiltered model rows (|ZScore|>0.3): {len(active_df)} out of {len(full_df)}")

model_active = smf.ols(formula_enhanced, data=active_df).fit(cov_type="HC3")
print(f"\nFILTERED MODEL (meaningful surprises only):")
print(f"  R-squared:      {model_active.rsquared:.3f}")
print(f"  Adj. R-squared: {model_active.rsquared_adj:.3f}")
print(f"  F-stat p-value: {model_active.f_pvalue:.4f}")

sig2 = model_active.pvalues[model_active.pvalues < 0.05]
print(f"\nSignificant variables (p<0.05):")
print(sig2.sort_values())

# %% [markdown]
# ## FIX 4 — REGIME SUB-MODELS
# Each market regime behaves differently. Instead of one model with interaction terms,
# fit completely SEPARATE models for each regime for maximum explanatory power.

# %%
regime_order = ["R1_DEEP_CONTANGO","R2_CONTANGO","R3_FLAT","R4_BACKWARDATION","R5_EXTREME_BACKWARDATION"]

formula_sub = (
    "Target ~ "
    "Inventory_ZScore + ZScore_sq "
    "+ WTI_M1M2_Pre + SPX_Pre_Return + DXY_Pre_Return + Geo_Score "
    "+ C(Season)"
)

regime_models = {}
print("\n=== REGIME SUB-MODELS ===")
print(f"{'Regime':<35} {'N':>5} {'R²':>8} {'Adj R²':>8} {'F p-val':>10}")
print("-" * 70)

for regime in regime_order:
    sub = full_df[full_df["Regime"] == regime].copy()
    if len(sub) < 15:
        print(f"{regime:<35} {'TOO FEW ROWS'}")
        continue
    try:
        m = smf.ols(formula_sub, data=sub).fit(cov_type="HC3")
        regime_models[regime] = m
        print(f"{regime:<35} {len(sub):>5} {m.rsquared:>8.3f} {m.rsquared_adj:>8.3f} {m.f_pvalue:>10.4f}")
    except Exception as e:
        print(f"{regime:<35} ERROR: {e}")

# %% [markdown]
# ## VISUALIZATION — Model Comparison & Significant Coefficients

# %%
# Compare R² across all models
model_names  = ["OLS Basic", "OLS Enhanced", "OLS Filtered (|Z|>0.3)"] + [f"Sub: {r[-3:]}" for r in regime_models]
model_r2     = [0.091, model_full.rsquared, model_active.rsquared] + [m.rsquared for m in regime_models.values()]
model_adj_r2 = [0.030, model_full.rsquared_adj, model_active.rsquared_adj] + [m.rsquared_adj for m in regime_models.values()]

fig, axes = plt.subplots(1, 2, figsize=(16, 6))

# R² comparison
colors = ["#1f77b4","#ff7f0e","#2ca02c"] + ["#9467bd","#8c564b","#e377c2","#7f7f7f","#bcbd22"][:len(regime_models)]
axes[0].barh(model_names, model_r2, color=colors, alpha=0.85)
axes[0].axvline(0.091, color="red", linestyle="--", lw=1.5, label="Baseline OLS R²")
axes[0].set_title("Model R² Comparison\n(Higher = Better)", fontsize=13)
axes[0].set_xlabel("R²")
axes[0].legend()

# Adj R² comparison
axes[1].barh(model_names, model_adj_r2, color=colors, alpha=0.85)
axes[1].axvline(0.030, color="red", linestyle="--", lw=1.5, label="Baseline OLS Adj R²")
axes[1].set_title("Adjusted R² Comparison\n(Penalizes for extra variables)", fontsize=13)
axes[1].set_xlabel("Adjusted R²")
axes[1].legend()

plt.suptitle("Regression Model Evolution — EIA Inventory Impact", fontsize=14)
plt.tight_layout()
plt.savefig(plot_dir / "model_comparison_r2.png", dpi=150, bbox_inches="tight")
plt.close()
print("Saved model_comparison_r2.png")

# %% [markdown]
# ## VISUALIZATION — Actual vs Predicted (Best Model)

# %%
best_model = model_active  # Use the filtered model as the "best" for prediction
best_df    = active_df

fig, axes = plt.subplots(1, 3, figsize=(18, 6))

# 1. Actual vs Predicted scatter
axes[0].scatter(best_model.fittedvalues, best_df["Target"], alpha=0.6, color="cyan", edgecolors="white", lw=0.3)
mn = min(best_df["Target"].min(), best_model.fittedvalues.min())
mx = max(best_df["Target"].max(), best_model.fittedvalues.max())
axes[0].plot([mn, mx], [mn, mx], "r--", lw=2)
axes[0].set_title(f"Actual vs Predicted\nR² = {best_model.rsquared:.3f}", fontsize=12)
axes[0].set_xlabel("Predicted Return")
axes[0].set_ylabel("Actual Return")

# 2. Residuals distribution
axes[1].hist(best_model.resid, bins=25, color="cyan", edgecolor="white", alpha=0.75)
axes[1].set_title("Residuals Distribution\n(Should be bell-shaped)", fontsize=12)
axes[1].set_xlabel("Residual")

# 3. Residuals vs ZScore (shows if non-linear term helped)
axes[2].scatter(best_df["Inventory_ZScore"], best_model.resid, alpha=0.5, color="lime")
axes[2].axhline(0, color="red", lw=2, linestyle="--")
axes[2].set_title("Residuals vs Inventory ZScore\n(Should show no pattern)", fontsize=12)
axes[2].set_xlabel("Inventory ZScore")
axes[2].set_ylabel("Residual")

plt.suptitle("Best Model Diagnostics (Filtered + Non-linear + Robust SE)", fontsize=14)
plt.tight_layout()
plt.savefig(plot_dir / "enhanced_regression_diagnostics.png", dpi=150, bbox_inches="tight")
plt.close()

# %% [markdown]
# ## COEFFICIENT TABLE — Enhanced Model

# %%
coef_df = pd.DataFrame({
    "Coefficient": best_model.params,
    "Robust SE":   best_model.bse,
    "t-stat":      best_model.tvalues,
    "p-value":     best_model.pvalues,
    "95% CI Low":  best_model.conf_int()[0],
    "95% CI High": best_model.conf_int()[1],
}).round(5)
coef_df["Significant"] = coef_df["p-value"].apply(lambda p: "YES ***" if p < 0.01 else ("YES *" if p < 0.05 else "No"))
coef_df = coef_df.sort_values("p-value")
print("\n=== ENHANCED MODEL COEFFICIENT TABLE ===")
print(coef_df.to_string())
coef_df.to_csv(analysis_dir / "enhanced_regression_coefficients.csv")

# %% [markdown]
# ## REGIME SUB-MODEL COEFFICIENTS TABLE

# %%
print("\n=== REGIME SUB-MODEL: ZScore Coefficient (Key Driver) ===")
print(f"{'Regime':<40} {'ZScore Coeff':>14} {'p-value':>10} {'Significant':>13}")
print("-" * 80)
for regime, m in regime_models.items():
    if "Inventory_ZScore" in m.params:
        coef = m.params["Inventory_ZScore"]
        pval = m.pvalues["Inventory_ZScore"]
        sig  = "YES ***" if pval < 0.01 else ("YES *" if pval < 0.05 else "No")
        print(f"{regime:<40} {coef:>14.5f} {pval:>10.4f} {sig:>13}")

# %% [markdown]
# ## PREDICTION ENGINE (Enhanced) — This Week's EIA Release

# %%
print("=" * 65)
print("PREDICTION ENGINE — Enhanced Model — This Week's EIA Release")
print("=" * 65)

# ── UPDATE THESE BEFORE EACH RELEASE ─────────────────────────────
consensus_estimate_kb = 500         # Market consensus (thousands of barrels)
current_regime        = "R4_BACKWARDATION"
current_season        = "Q2"
current_wti_m1m2_pre  = -0.25
spx_pre_return        = 0.30
dxy_pre_return        = -0.10
geo_score             = 0.0          # 0 = no major active geopolitical event
# ─────────────────────────────────────────────────────────────────

hist_mean = df["Inventory_Change"].mean()
hist_std  = df["Inventory_Change"].std()
inv_zscore = (consensus_estimate_kb - hist_mean) / hist_std
zscore_sq  = inv_zscore ** 2
zscore_abs = abs(inv_zscore)

print(f"\nInputs:")
print(f"  Consensus:           {consensus_estimate_kb:+.0f}K barrels")
print(f"  Inventory Z-Score:   {inv_zscore:+.3f}")
print(f"  Z-Score (squared):   {zscore_sq:.3f}")
print(f"  Active model:        {'Filtered (|Z|>0.3)' if zscore_abs > 0.3 else 'NOTE: |ZScore| <= 0.3 — Neutral territory, market likely ignores'}")
print(f"  Regime:              {current_regime}")
print(f"  Season:              {current_season}")

pred_input = pd.DataFrame([{
    "Inventory_ZScore":  inv_zscore,
    "ZScore_sq":         zscore_sq,
    "ZScore_abs":        zscore_abs,
    "WTI_M1M2_Pre":      current_wti_m1m2_pre,
    "SPX_Pre_Return":    spx_pre_return,
    "DXY_Pre_Return":    dxy_pre_return,
    "TNX_Pre_BpChange":  0.0,
    "Geo_Score":         geo_score,
    "Regime":            current_regime,
    "Season":            current_season,
}])

predicted_return = best_model.predict(pred_input)[0]
predicted_bps    = predicted_return * 10000

# Regime sub-model prediction (if available)
if current_regime in regime_models:
    sub_pred = regime_models[current_regime].predict(pred_input)[0]
    sub_bps  = sub_pred * 10000
else:
    sub_pred, sub_bps = None, None

print(f"\n{'='*65}")
print(f"  ENHANCED MODEL PREDICTION: {predicted_return:+.4f} ({predicted_bps:+.1f} bps)")
if sub_pred is not None:
    print(f"  REGIME SUB-MODEL:          {sub_pred:+.4f} ({sub_bps:+.1f} bps)")
    avg_bps = (predicted_bps + sub_bps) / 2
    print(f"  CONSENSUS ESTIMATE:        {avg_bps:+.1f} bps (average of both)")
else:
    avg_bps = predicted_bps

if zscore_abs <= 0.3:
    call = "NEUTRAL  -- Z-Score below threshold. Market will likely ignore this report."
elif avg_bps > 15:
    call = "BULLISH  -- Expect WTI to rally post-release"
elif avg_bps < -15:
    call = "BEARISH  -- Expect WTI to sell off post-release"
else:
    call = "NEUTRAL  -- Small directional bias, not strong enough for conviction"

print(f"  DIRECTIONAL CALL:          {call}")
print(f"{'='*65}")

# Save full model summaries
with open(analysis_dir / "enhanced_model_full_summary.txt", "w", encoding="utf-8") as f:
    f.write("=== ENHANCED OLS MODEL (Filtered, HC3 Robust SE) ===\n")
    f.write(str(best_model.summary()))
    f.write("\n\n=== REGIME SUB-MODELS ===\n")
    for regime, m in regime_models.items():
        f.write(f"\n--- {regime} ---\n")
        f.write(str(m.summary()))

print("\nAll results saved to eia_dataset/analysis/")
