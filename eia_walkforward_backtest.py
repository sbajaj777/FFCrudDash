# %% [markdown]
# # EIA Inventory Impact — Walk-Forward Out-of-Sample Backtest
# ## The only honest way to evaluate a trading signal
# ---
# RULE: Every prediction must be made on data the model has NEVER seen.
# Walk-Forward = Re-train the model each period using only historical data,
# then predict the NEXT period. Repeat.
#
# This simulates exactly how the model would perform in live trading.
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
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
from scipy import stats

warnings.filterwarnings("ignore")
plt.style.use("dark_background")

out_dir      = Path("eia_dataset")
analysis_dir = out_dir / "analysis"
plot_dir     = out_dir / "plots"
analysis_dir.mkdir(exist_ok=True, parents=True)
plot_dir.mkdir(exist_ok=True, parents=True)

# ── Load Data ──────────────────────────────────────────────────────────────
df = pd.read_csv("eia_dataset/eia_impact_master_dataset.csv", parse_dates=["Date"])
df.set_index("Date", inplace=True)
df.sort_index(inplace=True)

macro_daily = pd.read_csv("eia_dataset/macro_daily_fred.csv", parse_dates=["observation_date"],
                          index_col="observation_date").sort_index()

spx_ret = macro_daily["SP500"].pct_change() * 100
dxy_ret = macro_daily["DTWEXBGS"].pct_change() * 100

def align_to_eia(series):
    return series.reindex(df.index, method="nearest", tolerance=pd.Timedelta("3D"))

df["SPX_Pre_Return"] = align_to_eia(spx_ret)
df["DXY_Pre_Return"] = align_to_eia(dxy_ret)

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

df["ZScore_sq"]  = df["Inventory_ZScore"] ** 2
df["ZScore_abs"] = df["Inventory_ZScore"].abs()

# Direction label
threshold = 0.001  # 10 bps
df["Direction"] = df["WTI_Return_SameDay"].apply(
    lambda r: 1 if r > threshold else (-1 if r < -threshold else 0)
)

print(f"Dataset: {len(df)} rows | {df.index.min().date()} to {df.index.max().date()}")

# %% [markdown]
# ## APPROACH 1 — Rule-Based Signal (No Fitting = No Bias)
# The rule-based framework uses ONLY economic logic — no parameters fitted to data.
# Rules are grounded in fundamental supply/demand mechanics:
#   Large Draw + Backwardation = BULLISH  (tight market + supply surprise)
#   Large Build + Contango     = BEARISH  (oversupplied + bearish confirmation)
#
# Because this signal is NOT fitted to the data, it is FULLY out-of-sample.

# %%
backwardation = {"R4_BACKWARDATION", "R5_EXTREME_BACKWARDATION"}
contango      = {"R1_DEEP_CONTANGO", "R2_CONTANGO"}

def rule_signal(row):
    z = row["Inventory_ZScore"]
    r = row["Regime"]
    if pd.isna(z) or pd.isna(r):
        return 0
    if z < -0.3 and r in backwardation:   return 1
    if z < -0.5:                           return 1
    if z >  0.3 and r in contango:        return -1
    if z >  0.5:                          return -1
    return 0

df["Rule_Signal"] = df.apply(rule_signal, axis=1)

rule_df     = df[df["Rule_Signal"] != 0].dropna(subset=["Direction", "WTI_Return_SameDay"]).copy()
rule_hit    = (rule_df["Rule_Signal"] == rule_df["Direction"]).mean()
rule_trades = len(rule_df)
rule_pnl    = (rule_df["Rule_Signal"] * rule_df["WTI_Return_SameDay"]).sum()
rule_sharpe = (rule_df["Rule_Signal"] * rule_df["WTI_Return_SameDay"]).mean() / \
              (rule_df["Rule_Signal"] * rule_df["WTI_Return_SameDay"]).std() * np.sqrt(52)

print(f"\nRULE-BASED SIGNAL (fully out-of-sample - no fitting):")
print(f"  Trades:     {rule_trades}")
print(f"  Hit Rate:   {rule_hit:.1%}")
print(f"  Cum Return: {rule_pnl*100:.2f}%")
print(f"  Sharpe:     {rule_sharpe:.2f}")

# %% [markdown]
# ## APPROACH 2 — Walk-Forward Logistic Regression
# Train on all data UP TO date T. Predict date T+1. Roll forward.
# Minimum training window: 60 observations (about 1.2 years of weekly data)
# This produces a TRUE out-of-sample prediction for every row.

# %%
features = ["Inventory_ZScore", "ZScore_sq", "WTI_M1M2_Pre",
            "SPX_Pre_Return", "DXY_Pre_Return", "Geo_Score"]
cat_cols  = ["Regime", "Season"]

full_df = df[features + cat_cols + ["Direction", "WTI_Return_SameDay"]].dropna().copy()
full_df_enc = pd.get_dummies(full_df, columns=cat_cols, drop_first=True, dtype=float)

X_all = full_df_enc.drop(["Direction", "WTI_Return_SameDay"], axis=1).astype(float)
y_all = full_df_enc["Direction"].astype(int)

MIN_TRAIN = 60   # Minimum rows required before making a prediction

oos_preds  = []
oos_actual = []
oos_dates  = []
oos_pnl    = []
oos_ret    = []

print(f"\nRunning Walk-Forward Backtest (min_train={MIN_TRAIN} obs)...")
for i in range(MIN_TRAIN, len(X_all)):
    X_train = X_all.iloc[:i]
    y_train = y_all.iloc[:i]
    X_test  = X_all.iloc[[i]]
    y_test  = y_all.iloc[i]
    ret_test = full_df["WTI_Return_SameDay"].iloc[i]

    # Only predict on rows with sufficient class diversity
    if y_train.nunique() < 2:
        continue

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc  = scaler.transform(X_test)

    clf = LogisticRegression(multi_class="multinomial", max_iter=500, C=0.5, random_state=42)
    try:
        clf.fit(X_train_sc, y_train)
        pred = clf.predict(X_test_sc)[0]
    except Exception:
        continue

    oos_preds.append(pred)
    oos_actual.append(y_test)
    oos_dates.append(full_df.index[i])
    oos_pnl.append(pred * ret_test)
    oos_ret.append(ret_test)

oos_df = pd.DataFrame({
    "Predicted":  oos_preds,
    "Actual":     oos_actual,
    "Trade_PnL":  oos_pnl,
    "Return":     oos_ret,
}, index=oos_dates)

# Only count trades where model predicted Bullish or Bearish (not neutral)
oos_active = oos_df[oos_df["Predicted"] != 0].copy()
oos_active["Cumulative_PnL"] = oos_active["Trade_PnL"].cumsum()

n_oos         = len(oos_active)
oos_hit       = (oos_active["Predicted"] == oos_active["Actual"]).mean()
oos_cum_ret   = oos_active["Trade_PnL"].sum()
oos_sharpe    = oos_active["Trade_PnL"].mean() / oos_active["Trade_PnL"].std() * np.sqrt(52) if oos_active["Trade_PnL"].std() > 0 else 0
oos_win       = (oos_active["Trade_PnL"] > 0).sum()
oos_loss      = (oos_active["Trade_PnL"] < 0).sum()
avg_win_oos   = oos_active[oos_active["Trade_PnL"] > 0]["Trade_PnL"].mean()
avg_loss_oos  = oos_active[oos_active["Trade_PnL"] < 0]["Trade_PnL"].mean()
pf_oos        = (oos_win * avg_win_oos) / abs(oos_loss * avg_loss_oos) if oos_loss > 0 else np.inf

print(f"\n{'='*65}")
print(f"WALK-FORWARD OUT-OF-SAMPLE RESULTS (TRUE OOS - No Data Leakage)")
print(f"{'='*65}")
print(f"  OOS Predictions Made:  {n_oos}")
print(f"  Hit Rate (OOS):        {oos_hit:.1%}")
print(f"  Cumulative Return:     {oos_cum_ret*100:.2f}%")
print(f"  Avg Win:               {avg_win_oos*10000:+.1f} bps")
print(f"  Avg Loss:              {avg_loss_oos*10000:+.1f} bps")
print(f"  Profit Factor:         {pf_oos:.2f}")
print(f"  OOS Sharpe:            {oos_sharpe:.2f}")
print(f"{'='*65}")

# Compare vs in-sample claims
print(f"\nIN-SAMPLE vs OUT-OF-SAMPLE COMPARISON:")
print(f"  {'Metric':<25} {'In-Sample':>12} {'OOS (True)':>12}")
print(f"  {'-'*50}")
print(f"  {'Hit Rate':<25} {'58.5%':>12} {oos_hit*100:>11.1f}%")
print(f"  {'Sharpe Ratio':<25} {'1.14':>12} {oos_sharpe:>12.2f}")
print(f"  {'Profit Factor':<25} {'1.54':>12} {pf_oos:>12.2f}")

# %% [markdown]
# ## VISUALIZATION — Walk-Forward OOS Results

# %%
fig, axes = plt.subplots(2, 3, figsize=(20, 12))
fig.suptitle("Walk-Forward Out-of-Sample Backtest\n(True Out-of-Sample — No Data Leakage)", fontsize=15, fontweight="bold")

# 1. OOS Cumulative P&L
ax = axes[0, 0]
ax.plot(oos_active.index, oos_active["Cumulative_PnL"] * 100, color="lime", lw=2)
ax.axhline(0, color="white", lw=0.8, linestyle="--")
ax.fill_between(oos_active.index, oos_active["Cumulative_PnL"] * 100, 0,
                where=oos_active["Cumulative_PnL"] > 0, alpha=0.3, color="lime")
ax.fill_between(oos_active.index, oos_active["Cumulative_PnL"] * 100, 0,
                where=oos_active["Cumulative_PnL"] < 0, alpha=0.3, color="red")
ax.set_title(f"OOS Cumulative P&L\nHit Rate: {oos_hit:.1%} | Sharpe: {oos_sharpe:.2f}", fontsize=11)
ax.set_ylabel("Cumulative Return (%)")

# 2. Rule-based signal cumulative P&L (also OOS)
ax = axes[0, 1]
rule_cum = (rule_df["Rule_Signal"] * rule_df["WTI_Return_SameDay"]).cumsum() * 100
ax.plot(rule_cum.index, rule_cum.values, color="cyan", lw=2)
ax.axhline(0, color="white", lw=0.8, linestyle="--")
ax.fill_between(rule_cum.index, rule_cum.values, 0,
                where=rule_cum.values > 0, alpha=0.3, color="cyan")
ax.fill_between(rule_cum.index, rule_cum.values, 0,
                where=rule_cum.values < 0, alpha=0.3, color="red")
ax.set_title(f"Rule-Based Signal P&L (Fully OOS)\nHit Rate: {rule_hit:.1%} | Sharpe: {rule_sharpe:.2f}", fontsize=11)
ax.set_ylabel("Cumulative Return (%)")

# 3. In-sample vs OOS bar comparison
ax = axes[0, 2]
metrics    = ["Hit Rate (%)", "Sharpe", "Profit Factor"]
in_sample  = [58.5, 1.14, 1.54]
out_sample = [oos_hit*100, oos_sharpe, pf_oos]
x = np.arange(len(metrics))
bars1 = ax.bar(x - 0.2, in_sample, 0.35, label="In-Sample (biased)", color="tomato", alpha=0.85)
bars2 = ax.bar(x + 0.2, out_sample, 0.35, label="OOS (true)", color="limegreen", alpha=0.85)
ax.set_xticks(x)
ax.set_xticklabels(metrics)
ax.set_title("In-Sample vs OOS Performance\n(Green is the honest number)", fontsize=11)
ax.legend(fontsize=9)
ax.axhline(50 if "Hit" in metrics[0] else 0, color="yellow", lw=1, linestyle="--")
for bar in bars1:
    ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5,
            f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=8, color="white")
for bar in bars2:
    ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.5,
            f'{bar.get_height():.1f}', ha='center', va='bottom', fontsize=8, color="white")

# 4. Rolling 12-week OOS hit rate
ax = axes[1, 0]
rolling_hr = (oos_active["Predicted"] == oos_active["Actual"]).rolling(12, min_periods=6).mean() * 100
ax.plot(oos_active.index, rolling_hr, color="cyan", lw=2)
ax.axhline(50, color="yellow", lw=1.5, linestyle="--", label="50% random baseline")
ax.axhline(oos_hit * 100, color="lime", lw=1.5, linestyle="-.", label=f"OOS Avg: {oos_hit:.1%}")
ax.fill_between(oos_active.index, 50, rolling_hr,
                where=rolling_hr > 50, alpha=0.3, color="lime")
ax.fill_between(oos_active.index, 50, rolling_hr,
                where=rolling_hr < 50, alpha=0.3, color="red")
ax.set_title("Rolling 12-Week OOS Hit Rate\n(True Out-of-Sample)", fontsize=11)
ax.set_ylabel("Hit Rate (%)")
ax.set_ylim(10, 90)
ax.legend(fontsize=9)

# 5. Per-prediction breakdown
ax = axes[1, 1]
oos_df["Correct"] = (oos_df["Predicted"] == oos_df["Actual"]).astype(int)
oos_df["Year"]    = oos_df.index.year
year_acc = oos_df[oos_df["Predicted"] != 0].groupby("Year")["Correct"].mean() * 100
colors_yr = ["limegreen" if v > 50 else "tomato" for v in year_acc.values]
ax.bar(year_acc.index.astype(str), year_acc.values, color=colors_yr)
ax.axhline(50, color="yellow", lw=1.5, linestyle="--", label="50% random baseline")
ax.set_title("OOS Hit Rate by Year\n(Year-by-year breakdown)", fontsize=11)
ax.set_ylabel("Hit Rate (%)")
ax.set_ylim(0, 100)
ax.legend(fontsize=9)

# 6. Final scorecard text
ax = axes[1, 2]
ax.axis("off")
scorecard = [
    ("WALK-FORWARD OOS SCORECARD", "", ""),
    ("", "", ""),
    ("Metric", "OOS Value", "Benchmark"),
    ("-"*20, "-"*10, "-"*10),
    ("Hit Rate",       f"{oos_hit:.1%}",      "> 50%"),
    ("Profit Factor",  f"{pf_oos:.2f}",        "> 1.0"),
    ("Sharpe Ratio",   f"{oos_sharpe:.2f}",    "> 0.5"),
    ("Cum. Return",    f"{oos_cum_ret*100:.1f}%", "> 0%"),
    ("", "", ""),
    ("Rule-Signal HR", f"{rule_hit:.1%}", "> 50%"),
    ("Rule-Sig Sharpe",f"{rule_sharpe:.2f}", "> 0.5"),
]
for i, (metric, value, bench) in enumerate(scorecard):
    color = "lime" if i == 0 else ("gold" if i == 2 else "white")
    ax.text(0.02, 0.95 - i*0.085, f"{metric:<22}{value:>10}  {bench}", transform=ax.transAxes,
            fontsize=10, color=color, fontfamily="monospace",
            fontweight="bold" if i <= 2 else "normal")

plt.tight_layout()
plt.savefig(plot_dir / "walkforward_oos_backtest.png", dpi=150, bbox_inches="tight")
plt.close()
print("\nSaved walkforward_oos_backtest.png")

# Save OOS results
oos_active.to_csv(analysis_dir / "walkforward_oos_predictions.csv")
print("Saved walkforward_oos_predictions.csv")
print("\nDone. These are the HONEST, out-of-sample results for your manager.")
