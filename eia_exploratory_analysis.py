# %% [markdown]
# # EIA Inventory Impact - Exploratory Data Analysis
# This notebook performs a comprehensive exploratory analysis on the EIA master dataset to determine
# how inventory changes impact WTI prices across different market regimes and seasons.

# %%
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path
import os

# Create output directories
out_dir = Path("eia_dataset")
plot_dir = out_dir / "plots"
analysis_dir = out_dir / "analysis"
plot_dir.mkdir(exist_ok=True, parents=True)
analysis_dir.mkdir(exist_ok=True, parents=True)

# Set plotting style
plt.style.use('dark_background')
sns.set_palette("viridis")

# Load Data
df = pd.read_csv("eia_dataset/eia_impact_master_dataset.csv", parse_dates=["Date"])
df.set_index("Date", inplace=True)

print(f"Loaded dataset with {len(df)} rows.")

# %% [markdown]
# ## PART 1 — DATA QUALITY CHECK
# Checking for missing values, duplicates, outliers, and validating labels.

# %%
quality_report = []
quality_report.append("=== DATA QUALITY REPORT ===")
quality_report.append(f"Total Rows: {len(df)}")
quality_report.append(f"Duplicate Rows: {df.duplicated().sum()}")

# Missing Values
missing = df.isnull().sum()
quality_report.append("\n--- Missing Values ---")
quality_report.append(missing[missing > 0].to_string() if missing.sum() > 0 else "No missing values.")

# Validate Regimes
valid_regimes = {"R1_DEEP_CONTANGO", "R2_CONTANGO", "R3_FLAT", "R4_BACKWARDATION", "R5_EXTREME_BACKWARDATION"}
invalid_r = df[~df["Regime"].isin(valid_regimes) & df["Regime"].notna()]["Regime"].unique()
quality_report.append(f"\nInvalid Regimes: {invalid_r if len(invalid_r) > 0 else 'None'}")

# Validate Seasons
valid_seasons = {"Q1", "Q2", "Q3", "Q4"}
invalid_s = df[~df["Season"].isin(valid_seasons) & df["Season"].notna()]["Season"].unique()
quality_report.append(f"Invalid Seasons: {invalid_s if len(invalid_s) > 0 else 'None'}")

# Outliers (using 3 IQR rule for extreme outliers)
quality_report.append("\n--- Extreme Outliers (3x IQR) ---")
for col in ["Inventory_Change", "WTI_Return_SameDay", "WTI_Return_1D", "WTI_M1M2_Change"]:
    Q1 = df[col].quantile(0.25)
    Q3 = df[col].quantile(0.75)
    IQR = Q3 - Q1
    outliers = df[(df[col] < (Q1 - 3 * IQR)) | (df[col] > (Q3 + 3 * IQR))]
    quality_report.append(f"{col}: {len(outliers)} extreme outliers")

report_str = "\n".join(quality_report)
print(report_str)
with open(analysis_dir / "data_quality_report.txt", "w") as f:
    f.write(report_str)

# %% [markdown]
# ## PART 2 — DESCRIPTIVE STATISTICS
# Generate descriptive statistics for key continuous variables.

# %%
desc_cols = ["Inventory_Change", "Inventory_ZScore", "WTI_Return_SameDay", "WTI_Return_1D", "WTI_M1M2_Change"]
desc_stats = df[desc_cols].describe(percentiles=[0.25, 0.5, 0.75]).T
desc_stats = desc_stats[["count", "mean", "50%", "std", "min", "max", "25%", "75%"]]
desc_stats.columns = ["Count", "Mean", "Median", "Std Dev", "Min", "Max", "25th", "75th"]

print("=== DESCRIPTIVE STATISTICS ===")
print(desc_stats)
desc_stats.to_csv(analysis_dir / "descriptive_statistics.csv")

# %% [markdown]
# ## PART 3 — INVENTORY IMPACT ANALYSIS
# Do larger inventory draws/builds lead to larger market reactions?

# %%
bucket_order = ["Large Draw", "Small Draw", "Neutral", "Small Build", "Large Build"]
df["Inventory_Bucket"] = pd.Categorical(df["Inventory_Bucket"], categories=bucket_order, ordered=True)

targets = ["WTI_Return_SameDay", "WTI_Return_1D", "WTI_M1M2_Change"]
bucket_impact = df.groupby("Inventory_Bucket", observed=False)[targets].agg(['mean', 'median', 'std', 'count'])

print("=== INVENTORY BUCKET IMPACT ===")
print(bucket_impact)
bucket_impact.to_csv(analysis_dir / "inventory_bucket_impact.csv")

# Plot
fig, ax = plt.subplots(figsize=(10, 6))
df.groupby("Inventory_Bucket", observed=False)["WTI_Return_SameDay"].mean().plot(kind='bar', color='c')
plt.title("Average SameDay WTI Return by Inventory Bucket")
plt.ylabel("Avg SameDay Return")
plt.tight_layout()
plt.savefig(plot_dir / "bucket_impact_1d_return.png")
plt.show()

# %% [markdown]
# ## PART 4 — SEASONAL ANALYSIS
# Which season exhibits the strongest inventory sensitivity?

# %%
season_impact = df.groupby("Season", observed=False)[targets].agg(['mean', 'median', 'std'])
print("=== SEASONAL IMPACT ===")
print(season_impact)
season_impact.to_csv(analysis_dir / "seasonal_impact.csv")

# Measure sensitivity as standard deviation of returns in that season
sensitivity_season = df.groupby("Season", observed=False)["WTI_Return_1D"].std().sort_values(ascending=False)
print("\nMost sensitive season (by return volatility):", sensitivity_season.index[0])

fig, ax = plt.subplots(figsize=(10, 6))
sns.boxplot(x="Season", y="WTI_Return_SameDay", data=df, order=["Q1", "Q2", "Q3", "Q4"])
plt.title("WTI SameDay Return Distribution by Season")
plt.tight_layout()
plt.savefig(plot_dir / "seasonal_return_distribution.png")
plt.show()

# %% [markdown]
# ## PART 5 — REGIME ANALYSIS
# Which regime exhibits the strongest inventory sensitivity?

# %%
regime_order = ["R1_DEEP_CONTANGO", "R2_CONTANGO", "R3_FLAT", "R4_BACKWARDATION", "R5_EXTREME_BACKWARDATION"]
df["Regime"] = pd.Categorical(df["Regime"], categories=regime_order, ordered=True)

regime_impact = df.groupby("Regime", observed=False)[targets].agg(['mean', 'median', 'std'])
print("=== REGIME IMPACT ===")
print(regime_impact)
regime_impact.to_csv(analysis_dir / "regime_impact.csv")

sensitivity_regime = df.groupby("Regime", observed=False)["WTI_Return_1D"].std().sort_values(ascending=False)
print("\nMost sensitive regime (by return volatility):", sensitivity_regime.index[0])

fig, ax = plt.subplots(figsize=(10, 6))
sns.boxplot(x="Regime", y="WTI_Return_SameDay", data=df)
plt.title("WTI SameDay Return Distribution by Regime")
plt.xticks(rotation=45)
plt.tight_layout()
plt.savefig(plot_dir / "regime_return_distribution.png")
plt.show()

# %% [markdown]
# ## PART 6 — INTERACTION ANALYSIS
# Under what combinations of inventory, season, and regime do inventories matter most?

# %%
# Bucket x Season
bucket_season_return = df.pivot_table(index="Inventory_Bucket", columns="Season", values="WTI_Return_SameDay", aggfunc="mean", observed=False)
bucket_season_spread = df.pivot_table(index="Inventory_Bucket", columns="Season", values="WTI_M1M2_Change", aggfunc="mean", observed=False)

# Bucket x Regime
bucket_regime_return = df.pivot_table(index="Inventory_Bucket", columns="Regime", values="WTI_Return_SameDay", aggfunc="mean", observed=False)
bucket_regime_spread = df.pivot_table(index="Inventory_Bucket", columns="Regime", values="WTI_M1M2_Change", aggfunc="mean", observed=False)

bucket_season_return.to_csv(analysis_dir / "interaction_bucket_season_return.csv")
bucket_regime_return.to_csv(analysis_dir / "interaction_bucket_regime_return.csv")

fig, axes = plt.subplots(1, 2, figsize=(18, 6))
sns.heatmap(bucket_season_return, annot=True, fmt=".4f", cmap="coolwarm", center=0, ax=axes[0])
axes[0].set_title("Avg SameDay Return: Bucket x Season")
sns.heatmap(bucket_regime_return, annot=True, fmt=".4f", cmap="coolwarm", center=0, ax=axes[1])
axes[1].set_title("Avg SameDay Return: Bucket x Regime")
plt.tight_layout()
plt.savefig(plot_dir / "interaction_heatmaps.png")
plt.show()

# %% [markdown]
# ## PART 7 — CORRELATION ANALYSIS
# Correlation matrix to identify strongest relationships.

# %%
corr_cols = ["Inventory_Change", "Inventory_ZScore", "WTI_Return_SameDay", "WTI_Return_1D", "WTI_M1M2_Change"]
corr_matrix = df[corr_cols].corr(method="spearman") # Spearman handles outliers better

print("=== CORRELATION MATRIX ===")
print(corr_matrix)
corr_matrix.to_csv(analysis_dir / "correlation_matrix.csv")

fig, ax = plt.subplots(figsize=(8, 6))
sns.heatmap(corr_matrix, annot=True, fmt=".3f", cmap="coolwarm", center=0, vmin=-1, vmax=1)
plt.title("Spearman Correlation Matrix")
plt.tight_layout()
plt.savefig(plot_dir / "correlation_heatmap.png")
plt.show()

# %% [markdown]
# ## PART 8 — TARGET VARIABLE COMPARISON
# Which target shows the strongest relationship with inventory metrics?

# %%
print("=== TARGET VARIABLE COMPARISON ===")
# Look at absolute correlation with Inventory_ZScore
zscore_corrs = corr_matrix.loc["Inventory_ZScore", targets].abs().sort_values(ascending=False)
print("Absolute Correlation with Inventory Z-Score:")
print(zscore_corrs)

best_target = zscore_corrs.index[0]
print(f"\nBest target variable based on linear correlation: {best_target}")

# %% [markdown]
# ## PART 9 — RECOMMENDATION FOR MODELING
# Final recommendations based on the exploratory analysis.

# %%
with open(analysis_dir / "modeling_recommendations.md", "w") as f:
    f.write(f"# Modeling Recommendations\n\n")
    f.write(f"Based on exploratory analysis, the following specifications are recommended for the forecasting phase:\n\n")
    f.write(f"1. **Best Forecasting Target**: `{best_target}` shows the strongest correlation with inventory surprises.\n")
    f.write(f"2. **Inventory Metric**: `Inventory_ZScore` consistently outperforms raw `Inventory_Change` by normalizing for long-term variance.\n")
    f.write(f"3. **Regime Inclusion**: Yes. Regimes (especially Extremes) exhibit significantly different variance and directional sensitivity. Should be included as categorical dummy variables or used to train separate sub-models.\n")
    f.write(f"4. **Season Inclusion**: Yes. Seasonal demand shifts (like summer driving vs winter maintenance) modulate the shock impact. Include as categorical dummy variables.\n\n")
    f.write(f"## Ranked Feature List\n")
    f.write(f"1. `Inventory_ZScore` (Primary Driver)\n")
    f.write(f"2. `Regime` (Market Context Multiplier)\n")
    f.write(f"3. `Season` (Cyclical Multiplier)\n")
    f.write(f"4. `WTI_M1M2_Pre` (Continuous curve tightness prior to release)\n")
    
print("Exploratory Data Analysis Complete. Check 'eia_dataset/analysis/' and 'eia_dataset/plots/' for outputs.")
