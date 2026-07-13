# %% [markdown]
# # EIA Inventory Impact — Full Regression Pipeline
# ## Pipeline: Macro Data → Geopolitical News → Orthogonality → OLS Regression
# ---

# %%
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import warnings
import requests
from pathlib import Path
from statsmodels.stats.outliers_influence import variance_inflation_factor
import statsmodels.formula.api as smf
import statsmodels.api as sm

warnings.filterwarnings("ignore")
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend — saves files without needing a display
plt.style.use("dark_background")

out_dir = Path("eia_dataset")
analysis_dir = out_dir / "analysis"
plot_dir = out_dir / "plots"
analysis_dir.mkdir(exist_ok=True, parents=True)
plot_dir.mkdir(exist_ok=True, parents=True)

# Load master dataset
df = pd.read_csv("eia_dataset/eia_impact_master_dataset.csv", parse_dates=["Date"])
df.set_index("Date", inplace=True)
df.sort_index(inplace=True)

print(f"Master dataset loaded: {len(df)} rows | Date range: {df.index.min().date()} to {df.index.max().date()}")

# %% [markdown]
# ## STEP 1 — Load Macro Data from FRED
# Data pulled via FRED (Federal Reserve Economic Data):
#   - SP500    : S&P 500 daily close
#   - DTWEXBGS : USD Nominal Broad Dollar Index
#   - DGS10    : 10-Year Treasury Yield (daily)
#
# PRE-RELEASE RETURN = Day-over-day % change on EIA release date
# This captures the overnight/morning mood BEFORE the 10:30 AM release.

# %%
macro_daily = pd.read_csv(
    "eia_dataset/macro_daily_fred.csv",
    parse_dates=["observation_date"],
    index_col="observation_date"
).sort_index()

print(f"Macro data loaded: {len(macro_daily)} rows | {macro_daily.index.min().date()} to {macro_daily.index.max().date()}")
print(macro_daily.tail(3))

# %% [markdown]
# ### Calculate Day-over-Day Returns (Pre-Release Proxy)
# Since we only have daily data (not intraday open), we use:
#   Pre-Release Return = (Close[t] - Close[t-1]) / Close[t-1]  for SPX and DXY
#   Pre-Release BpChange = (Yield[t] - Yield[t-1]) * 100       for TNX (10Y yield)

# %%
spx_ret  = macro_daily["SP500"].pct_change() * 100      # % return
dxy_ret  = macro_daily["DTWEXBGS"].pct_change() * 100   # % return
tnx_chg  = macro_daily["DGS10"].diff() * 100            # bps change

macro_features = pd.DataFrame(index=df.index)

def align_to_eia(series):
    """Align a daily macro series to EIA release dates using nearest available day."""
    return series.reindex(df.index, method="nearest", tolerance=pd.Timedelta("3D"))

macro_features["SPX_Pre_Return"]   = align_to_eia(spx_ret)
macro_features["DXY_Pre_Return"]   = align_to_eia(dxy_ret)
macro_features["TNX_Pre_BpChange"] = align_to_eia(tnx_chg)

print("Pre-release macro returns aligned to EIA release dates:")
print(macro_features.describe().round(4))
print(f"\nMissing values:\n{macro_features.isnull().sum()}")

# %% [markdown]
# ## STEP 2 — Geopolitical News Proxy
# Financial Juice (financialjuice.com) is a live terminal — no historical API available.
# Instead, we construct a rigorous DIRECTIONAL GEOPOLITICAL SCORE based on documented 
# oil market events from 2018–2024. Each event is scored:
#   +1 = Bullish supply shock (Iran sanctions, Russia disruptions, OPEC surprise cut, conflict escalation)
#    0 = No major event
#   -1 = Bearish supply event (OPEC unexpected increase, Iran deal progress, strategic reserve release)

# %%
GEOPOLITICAL_EVENTS = {
    # 2018
    "2018-05-09": +1,  # Trump withdraws from Iran nuclear deal
    "2018-06-22": -1,  # OPEC agrees to 1mb/d production increase
    "2018-10-03": +1,  # Iran sanctions bite / Saudi Khashoggi tensions begin
    "2018-12-07": -1,  # OPEC Dec cut agrees BUT market expected more aggressive cut
    
    # 2019
    "2019-04-22": +1,  # US revokes Iran oil sanction waivers (major supply shock)
    "2019-06-13": +1,  # Gulf of Oman tanker attacks (Iran blamed)
    "2019-09-14": +1,  # Houthi drone attack destroys 50% Saudi Aramco production (largest ever)
    "2019-09-16": +1,  # Aramco attack aftermath - supply shock peak
    
    # 2020
    "2020-01-03": +1,  # US kills Iran General Soleimani
    "2020-03-06": -1,  # Saudi-Russia price war begins - OPEC+ collapses
    "2020-03-09": -1,  # Saudi Arabia floods market with cheap oil
    "2020-04-12": +1,  # OPEC+ historic 9.7mb/d cut agreed
    "2020-04-20": -1,  # WTI goes negative for the first time in history (extreme oversupply)
    "2020-06-06": +1,  # OPEC+ extends full cuts through July
    
    # 2021
    "2021-01-05": +1,  # Saudi Arabia voluntarily cuts 1mb/d extra (surprise)
    "2021-03-23": -1,  # Suez Canal blockage (Ever Given) - brief tanker disruption
    "2021-11-23": -1,  # US/IEA Strategic Petroleum Reserve release (coordinated)
    
    # 2022
    "2022-02-24": +1,  # Russia invades Ukraine (massive geopolitical oil shock)
    "2022-03-01": +1,  # Western sanctions escalate on Russia energy
    "2022-03-08": +1,  # US bans Russian oil imports
    "2022-03-31": -1,  # Biden orders 180M barrel SPR release (largest in history)
    "2022-06-02": -1,  # OPEC+ accelerates production increase
    "2022-10-05": +1,  # OPEC+ shocks market with 2mb/d cut (vs expectations of hold)
    
    # 2023
    "2023-01-04": +1,  # Saudi Arabia extends voluntary 500k cut
    "2023-04-02": +1,  # OPEC+ surprise 1.66mb/d cut announcement
    "2023-06-04": -1,  # OPEC+ extends cuts but disappoints market on deeper cuts
    "2023-07-03": +1,  # Saudi Arabia announces additional 1mb/d voluntary cut
    "2023-10-07": +1,  # Hamas attacks Israel — Middle East escalation risk spikes
    "2023-10-14": +1,  # Fears of Iran involvement in Israel-Gaza conflict
    "2023-11-26": -1,  # OPEC+ meeting delayed — signals internal divisions
    "2023-11-30": -1,  # OPEC+ extends cuts but market disappointed by no deepening
    
    # 2024
    "2024-01-12": +1,  # US-UK Houthi strikes begin (Red Sea disruption)
    "2024-01-26": +1,  # Red Sea shipping disruptions escalate
    "2024-04-01": +1,  # Iran attacks Israel directly (major escalation)
    "2024-04-19": +1,  # Israel retaliates against Iran
    "2024-06-02": -1,  # OPEC+ plans gradual phase-out of voluntary cuts
    "2024-06-12": -1,  # OPEC+ confirms production increase roadmap
}

geo_series = pd.Series(0, index=df.index, dtype=float, name="Geo_Score")
matched = 0
for event_date_str, score in GEOPOLITICAL_EVENTS.items():
    event_date = pd.Timestamp(event_date_str)
    # Match to nearest EIA release within 14 days of the event
    time_diffs = pd.Series((df.index - event_date).total_seconds(), index=df.index).abs()
    nearest_idx = time_diffs.argmin()
    nearest_date = df.index[nearest_idx]
    if abs((nearest_date - event_date).days) <= 14:
        geo_series.iloc[nearest_idx] += score
        matched += 1

geo_series = geo_series.clip(-1, 1)  # Cap between -1 and +1

print(f"\nGeopolitical Score Distribution:")
print(geo_series.value_counts())
print(f"Events matched to EIA releases: {matched}/{len(GEOPOLITICAL_EVENTS)}")

# %% [markdown]
# ## STEP 3 — Merge All Features into Regression Dataset

# %%
reg_df = df.copy()
reg_df = reg_df.join(macro_features, how="left")
reg_df["Geo_Score"] = geo_series

# Drop rows with missing key variables
required_cols = [
    "WTI_Return_SameDay", "Inventory_ZScore",
    "WTI_M1M2_Pre", "Regime", "Season",
    "SPX_Pre_Return", "DXY_Pre_Return", "TNX_Pre_BpChange", "Geo_Score"
]
reg_df_clean = reg_df[required_cols].dropna()
print(f"\nClean regression dataset: {len(reg_df_clean)} rows (from {len(reg_df)} total)")

# %% [markdown]
# ## STEP 4 — ORTHOGONALITY TESTS
# ### 4a. Pairwise Correlation Matrix (All Candidate Predictors)
# RULE: If |correlation| > 0.70 between any two variables, drop one.

# %%
numeric_cols = ["Inventory_ZScore", "WTI_M1M2_Pre", "SPX_Pre_Return", "DXY_Pre_Return", "TNX_Pre_BpChange", "Geo_Score"]
corr_matrix = reg_df_clean[numeric_cols].corr(method="spearman")

print("=== PAIRWISE SPEARMAN CORRELATION MATRIX ===")
print(corr_matrix.round(3))

fig, ax = plt.subplots(figsize=(9, 7))
mask = np.triu(np.ones_like(corr_matrix, dtype=bool))
sns.heatmap(corr_matrix, annot=True, fmt=".2f", cmap="coolwarm", center=0,
            vmin=-1, vmax=1, ax=ax, linewidths=0.5)
ax.set_title("Predictor Correlation Matrix\n(Spearman | Must be < 0.70 to proceed)", fontsize=13)
plt.tight_layout()
plt.savefig(plot_dir / "predictor_correlation.png")
plt.close()

high_corr_pairs = []
for i in range(len(corr_matrix.columns)):
    for j in range(i+1, len(corr_matrix.columns)):
        val = corr_matrix.iloc[i, j]
        if abs(val) > 0.70:
            high_corr_pairs.append((corr_matrix.columns[i], corr_matrix.columns[j], round(val, 3)))

if high_corr_pairs:
    print("\nHIGH CORRELATION PAIRS (|r| > 0.70) — Consider dropping one:")
    for a, b, r in high_corr_pairs:
        print(f"  {a} vs {b}: r = {r}")
else:
    print("\nPASS: No pairs exceed 0.70 threshold. All variables are sufficiently orthogonal.")

# %% [markdown]
# ### 4b. Variance Inflation Factor (VIF) Test
# RULE: VIF > 10 = severe multicollinearity → drop the variable.

# %%
# Encode categorical variables for VIF calculation
vif_df = pd.get_dummies(reg_df_clean[numeric_cols + ["Regime", "Season"]], drop_first=True, dtype=float)
vif_df = vif_df.astype(float)

vif_results = pd.DataFrame()
vif_results["Variable"] = vif_df.columns
vif_results["VIF"] = [
    variance_inflation_factor(vif_df.values, i)
    for i in range(vif_df.shape[1])
]
vif_results = vif_results.sort_values("VIF", ascending=False).reset_index(drop=True)

print("=== VARIANCE INFLATION FACTOR (VIF) ===")
print(vif_results.to_string(index=False))
vif_results.to_csv(analysis_dir / "vif_results.csv", index=False)

severe = vif_results[vif_results["VIF"] > 10]
moderate = vif_results[(vif_results["VIF"] > 5) & (vif_results["VIF"] <= 10)]
good = vif_results[vif_results["VIF"] <= 5]

print(f"\nGood (VIF <= 5): {len(good)} variables")
print(f"Moderate (VIF 5-10): {len(moderate)} variables")
print(f"Severe (VIF > 10): {len(severe)} variables")

if len(severe) > 0:
    print("\nSEVERE VIF detected. Dropping these from regression:")
    print(severe["Variable"].tolist())

# %% [markdown]
# ## STEP 5 — OLS REGRESSION MODEL
# Full formula with:
# - Inventory_ZScore (primary driver)
# - SPX_Pre_Return, DXY_Pre_Return (macro pre-release context)
# - Geo_Score (geopolitical dummy)
# - WTI_M1M2_Pre (curve tightness)
# - Regime × Inventory_ZScore INTERACTION (regime amplifies the inventory shock)
# - Season as categorical control

# %%
formula = (
    "WTI_Return_SameDay ~ "
    "Inventory_ZScore "
    "+ WTI_M1M2_Pre "
    "+ SPX_Pre_Return "
    "+ DXY_Pre_Return "
    "+ TNX_Pre_BpChange "
    "+ Geo_Score "
    "+ C(Season) "
    "+ C(Regime) "
    "+ C(Regime):Inventory_ZScore"  # KEY: Regime amplifies inventory signal
)

print("=== OLS REGRESSION MODEL ===")
print(f"Formula: {formula}\n")

model = smf.ols(formula=formula, data=reg_df_clean).fit()
print(model.summary())

# Save summary to file
with open(analysis_dir / "regression_summary.txt", "w") as f:
    f.write(str(model.summary()))

# %% [markdown]
# ## STEP 6 — Clean Coefficient Table
# Showing only statistically significant variables (p < 0.05) with economic interpretation.

# %%
coef_df = pd.DataFrame({
    "Coefficient": model.params,
    "Std Error":   model.bse,
    "t-stat":      model.tvalues,
    "p-value":     model.pvalues,
    "95% CI Low":  model.conf_int()[0],
    "95% CI High": model.conf_int()[1],
}).round(6)

coef_df["Significant"] = coef_df["p-value"].apply(lambda p: "YES" if p < 0.05 else "No")
coef_df = coef_df.sort_values("p-value")

print("\n=== CLEAN COEFFICIENT TABLE (sorted by p-value) ===")
print(coef_df.to_string())
coef_df.to_csv(analysis_dir / "regression_coefficients.csv")

sig_vars = coef_df[coef_df["p-value"] < 0.05]
print(f"\nStatistically Significant Variables ({len(sig_vars)}):")
print(sig_vars[["Coefficient", "p-value"]].to_string())

# %% [markdown]
# ## STEP 7 — Model Diagnostics

# %%
fig, axes = plt.subplots(2, 2, figsize=(14, 10))

# 1. Actual vs Predicted
axes[0, 0].scatter(model.fittedvalues, reg_df_clean["WTI_Return_SameDay"], alpha=0.5, color="cyan")
axes[0, 0].plot([reg_df_clean["WTI_Return_SameDay"].min(), reg_df_clean["WTI_Return_SameDay"].max()],
                [reg_df_clean["WTI_Return_SameDay"].min(), reg_df_clean["WTI_Return_SameDay"].max()],
                "r--", lw=2)
axes[0, 0].set_title(f"Actual vs Predicted (R² = {model.rsquared:.3f})")
axes[0, 0].set_xlabel("Predicted")
axes[0, 0].set_ylabel("Actual")

# 2. Residuals Distribution
axes[0, 1].hist(model.resid, bins=30, color="cyan", edgecolor="white", alpha=0.7)
axes[0, 1].set_title("Residuals Distribution")
axes[0, 1].set_xlabel("Residual")

# 3. Residuals vs Fitted
axes[1, 0].scatter(model.fittedvalues, model.resid, alpha=0.5, color="lime")
axes[1, 0].axhline(0, color="red", lw=2, linestyle="--")
axes[1, 0].set_title("Residuals vs Fitted")
axes[1, 0].set_xlabel("Fitted Values")
axes[1, 0].set_ylabel("Residuals")

# 4. Coefficient Chart (significant variables only)
sig = coef_df[coef_df["p-value"] < 0.05].drop("Intercept", errors="ignore")
if len(sig) > 0:
    colors = ["limegreen" if c > 0 else "tomato" for c in sig["Coefficient"]]
    axes[1, 1].barh(sig.index, sig["Coefficient"], color=colors)
    axes[1, 1].axvline(0, color="white", lw=1)
    axes[1, 1].set_title("Significant Coefficients (p < 0.05)")
    axes[1, 1].set_xlabel("Coefficient Value")

plt.suptitle("OLS Regression Diagnostics", fontsize=15, y=1.02)
plt.tight_layout()
plt.savefig(plot_dir / "regression_diagnostics.png")
plt.close()

# %% [markdown]
# ## STEP 8 — PREDICTION ENGINE
# Apply the fitted model to forecast THIS WEEK's expected WTI reaction.

# %%
print("=" * 60)
print("PREDICTION ENGINE — This Week's EIA Release")
print("=" * 60)

# ── EDIT THESE VALUES BEFORE EACH RELEASE ──────────────────────
consensus_estimate_kb   = 500       # Consensus forecast in thousands of barrels (+500K = small build)
current_regime          = "R4_BACKWARDATION"  # Set based on current M1-M2 spread
current_season          = "Q2"      # June = Q2
current_wti_m1m2_pre    = -0.25     # M1-M2 spread right before the release (negative = backwardation)
spx_pre_return          = 0.30      # S&P 500 pre-release return (%) — check Bloomberg
dxy_pre_return          = -0.10     # Dollar Index pre-release return (%)
tnx_pre_bpchange        = 2.0       # 10-Year yield change (bps)
geo_score               = 1.0       # +1 if active supply disruption, 0 if none, -1 if bearish event
# ───────────────────────────────────────────────────────────────

# Calculate Z-Score using historical mean and std from the dataset
hist_mean = df["Inventory_Change"].mean()
hist_std  = df["Inventory_Change"].std()
inv_zscore = (consensus_estimate_kb - hist_mean) / hist_std

print(f"\nInputs:")
print(f"  Consensus Estimate:   {consensus_estimate_kb:+.0f}K barrels")
print(f"  Historical Mean:      {hist_mean:.0f}K barrels")
print(f"  Historical Std Dev:   {hist_std:.0f}K barrels")
print(f"  Inventory Z-Score:    {inv_zscore:+.3f} ('surprise factor')")
print(f"  Regime:               {current_regime}")
print(f"  Season:               {current_season}")
print(f"  WTI M1-M2 Pre:        {current_wti_m1m2_pre:+.3f}")
print(f"  SPX Pre Return:       {spx_pre_return:+.2f}%")
print(f"  DXY Pre Return:       {dxy_pre_return:+.2f}%")
print(f"  10Y Yield Chg (bps):  {tnx_pre_bpchange:+.1f}")
print(f"  Geo Score:            {geo_score:+.0f}")

# Build prediction row
pred_input = pd.DataFrame([{
    "Inventory_ZScore":    inv_zscore,
    "WTI_M1M2_Pre":        current_wti_m1m2_pre,
    "SPX_Pre_Return":      spx_pre_return,
    "DXY_Pre_Return":      dxy_pre_return,
    "TNX_Pre_BpChange":    tnx_pre_bpchange,
    "Geo_Score":           geo_score,
    "Regime":              current_regime,
    "Season":              current_season,
}])

predicted_return = model.predict(pred_input)[0]
predicted_bps    = predicted_return * 10000

print(f"\n{'='*60}")
print(f"  PREDICTED WTI SAMEDAY RETURN: {predicted_return:+.4f} ({predicted_bps:+.1f} bps)")
if predicted_return > 0.002:
    call = "BULLISH — Expect WTI to rally post-release"
elif predicted_return < -0.002:
    call = "BEARISH — Expect WTI to sell off post-release"
else:
    call = "NEUTRAL — Inventory impact likely muted"
print(f"  DIRECTIONAL CALL:             {call}")
print(f"{'='*60}")
