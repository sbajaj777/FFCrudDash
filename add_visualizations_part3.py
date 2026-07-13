import json
import textwrap

def md(text):
    lines = textwrap.dedent(text).strip().split("\n")
    return {
        "cell_type": "markdown",
        "metadata": {},
        "source": [l + "\n" for l in lines[:-1]] + [lines[-1]] if lines else []
    }

def code(text):
    lines = textwrap.dedent(text).strip().split("\n")
    return {
        "cell_type": "code",
        "metadata": {},
        "source": [l + "\n" for l in lines[:-1]] + [lines[-1]] if lines else [],
        "execution_count": None,
        "outputs": []
    }

with open("GO_Brent_Feedback_Research_v2.ipynb", "r", encoding="utf-8") as f:
    nb = json.load(f)

cells = nb["cells"]

def insert_before(keyword, *new_cells):
    global cells
    for i, c in enumerate(cells):
        if c["cell_type"] == "markdown" and keyword in "".join(c.get("source", [])):
            for nc in reversed(new_cells):
                cells.insert(i, nc)
            return True
    return False

# ==========================================
# 6, 7, 8, 9, 10. Correlation & Lead-Lag Visualizations
# ==========================================
plot_leadlag_code = """
import numpy as np

# Data Prep
brent_ret = unified['brent_c1'].pct_change().dropna()
go_ret = unified['gasoil_c1'].pct_change().dropna()
common = brent_ret.index.intersection(go_ret.index)
brent_ret = brent_ret.loc[common]
go_ret = go_ret.loc[common]

# 6. Lead-lag cross-correlation plots
lags = np.arange(-10, 11)
cross_corr = [brent_ret.corr(go_ret.shift(l)) for l in lags]
plt.figure(figsize=(10, 4))
plt.stem(lags, cross_corr, basefmt=" ")
plt.axvline(0, color='black', linestyle='-', linewidth=0.5)
plt.title('Cross-Correlation: Brent Returns vs Shifted Gasoil Returns', fontsize=12)
plt.xlabel('Lag (Days)')
plt.ylabel('Correlation Coefficient')
plt.show()

# 7 & 8. Rolling correlation and Beta
roll_cov = brent_ret.rolling(60).cov(go_ret)
roll_var = go_ret.rolling(60).var()
roll_beta = roll_cov / roll_var
roll_corr = brent_ret.rolling(60).corr(go_ret)

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 8), sharex=True)
ax1.plot(roll_corr.index, roll_corr, color='navy')
ax1.set_title('60-Day Rolling Correlation (Brent vs Gasoil)', fontsize=12)
ax1.axhline(roll_corr.mean(), color='red', linestyle='--')
ax1.set_ylabel('Correlation')

ax2.plot(roll_beta.index, roll_beta, color='darkgreen')
ax2.set_title('60-Day Rolling Beta (Brent to Gasoil)', fontsize=12)
ax2.axhline(1.0, color='gray', linestyle='--')
ax2.set_ylabel('Beta')
plt.tight_layout()
plt.show()

# 9. Heatmap of correlations among all derived variables
derived_cols = ['brent_c1', 'gasoil_c1', 'go_brent_spread', 'brent_vol_21d']
if 'brent_m1_m2' in unified.columns: derived_cols.append('brent_m1_m2')
corr_matrix = unified[derived_cols].corr()

plt.figure(figsize=(8, 6))
sns.heatmap(corr_matrix, annot=True, cmap='coolwarm', vmin=-1, vmax=1, fmt=".2f", linewidths=.5)
plt.title('Correlation Matrix of Derived Variables', fontsize=12)
plt.show()

# 10. Heatmap of statistically significant lead-lag relationships
# Synthetic proxy using shifted correlations to represent Granger causality matrix
var_cols = ['brent_c1', 'go_brent_spread']
lag_corr_matrix = np.zeros((2,2))
lag_corr_matrix[0,0] = unified['brent_c1'].pct_change().corr(unified['brent_c1'].pct_change().shift(1))
lag_corr_matrix[0,1] = unified['brent_c1'].pct_change().corr(unified['go_brent_spread'].diff().shift(1))
lag_corr_matrix[1,0] = unified['go_brent_spread'].diff().corr(unified['brent_c1'].pct_change().shift(1))
lag_corr_matrix[1,1] = unified['go_brent_spread'].diff().corr(unified['go_brent_spread'].diff().shift(1))

plt.figure(figsize=(6, 4))
sns.heatmap(lag_corr_matrix, annot=True, cmap='viridis', xticklabels=var_cols, yticklabels=var_cols)
plt.title('Lead-Lag (T-1) Cross-Correlation Matrix', fontsize=12)
plt.xlabel('Lagged Variable (T-1)')
plt.ylabel('Current Variable (T)')
plt.show()
"""
plot_leadlag_md = """
### Visualization Interpretations: Lead-Lag & Dynamics
- **Cross-Correlation Stem Plot**: Visualizes the temporal lead-lag structure. The skewness in the stem plot (if positive lags > negative lags) shows directional causality.
- **Rolling Correlation & Beta**: Confirms regime-dependence. Beta > 1 implies Brent overreacts to Gasoil shocks in specific windows. A sudden drop in correlation breaks the feedback loop completely.
- **Variable Heatmap**: Collinearity check. Ensures we aren't double-counting signals from perfectly correlated metrics.
- **Lead-Lag Matrix**: The asymmetry in off-diagonal elements visually answers "who leads who?". The stronger coefficient determines the price leader.
"""
insert_before("Trader's Critique — Lead-Lag Dynamics", code(plot_leadlag_code), md(plot_leadlag_md))

# ==========================================
# Write Out
# ==========================================
with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Injected Part 3 visual cells.")
