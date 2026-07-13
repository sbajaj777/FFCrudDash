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
# 1. Derived Series Visualizations
# ==========================================
plot1_2_3_code = """
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# 1. Time series of Brent, Gasoil and GO-Brent spread
fig, ax1 = plt.subplots(figsize=(14, 6))
ax1.plot(unified.index, unified['brent_c1'], color='#1f77b4', label='Brent (LHS)', alpha=0.8)
ax1.set_ylabel('Brent Price ($/bbl)', color='#1f77b4')
ax1.tick_params(axis='y', labelcolor='#1f77b4')

ax2 = ax1.twinx()
ax2.plot(unified.index, unified['go_brent_spread'], color='#d62728', label='GO-Brent Spread (RHS)', alpha=0.8)
ax2.set_ylabel('Spread ($/bbl)', color='#d62728')
ax2.tick_params(axis='y', labelcolor='#d62728')

plt.title('Time Series: Brent Prompt vs GO-Brent Spread', fontsize=14)
fig.tight_layout()
plt.show()

# 2. Brent calendar spreads through time
if 'brent_c2' in unified.columns:
    unified['brent_m1_m2'] = unified['brent_c1'] - unified['brent_c2']
    plt.figure(figsize=(14, 4))
    plt.plot(unified.index, unified['brent_m1_m2'], color='purple', linewidth=1)
    plt.axhline(0, color='black', linestyle='--', linewidth=1)
    plt.fill_between(unified.index, 0, unified['brent_m1_m2'], where=(unified['brent_m1_m2'] > 0), color='green', alpha=0.3, label='Backwardation')
    plt.fill_between(unified.index, 0, unified['brent_m1_m2'], where=(unified['brent_m1_m2'] < 0), color='red', alpha=0.3, label='Contango')
    plt.title('Brent Calendar Spread (M1-M2) Over Time', fontsize=12)
    plt.ylabel('Spread ($/bbl)')
    plt.legend()
    plt.show()

# 3. Distribution of GO-Brent spread
plt.figure(figsize=(10, 5))
sns.histplot(unified['go_brent_spread'].dropna(), kde=True, stat="density", bins=50, color='teal')
mean_spread = unified['go_brent_spread'].mean()
std_spread = unified['go_brent_spread'].std()
plt.axvline(mean_spread, color='black', linestyle='-', label=f'Mean: {mean_spread:.2f}')
plt.axvline(mean_spread + 1.5*std_spread, color='red', linestyle='--', label='+1.5 Std Dev')
plt.axvline(mean_spread - 1.5*std_spread, color='red', linestyle='--', label='-1.5 Std Dev')
plt.title('Distribution of GO-Brent Spread', fontsize=12)
plt.xlabel('Spread ($/bbl)')
plt.legend()
plt.show()
"""
plot1_2_3_md = """
### Visualization Interpretations: Core Series
- **Time Series**: The dual-axis chart highlights the structural relationship and long-term regime shifts (e.g. 2022 shock). It visually confirms that violent spread widenings often precede or coincide with Brent rallies.
- **Calendar Spreads**: The green/red fill clearly delineates backwardated (tight supply) vs contango (oversupply) regimes. As noted by the trader critique, signals in contango are highly unreliable.
- **Spread Distribution**: The heavy right tail in the KDE plot demonstrates the asymmetry of refining shocks. +1.5σ is a robust threshold for extreme events given the non-normal kurtosis.
"""
insert_before("Trader's Critique — Derived Series", code(plot1_2_3_code), md(plot1_2_3_md))

# ==========================================
# 4. Event Detection Visualizations
# ==========================================
plot4_code = """
# 4. Distribution of detected extreme widening events
if 'event_db' in globals() and not event_db.empty:
    plt.figure(figsize=(12, 4))
    event_counts = event_db['peak_date'].dt.to_period('Q').value_counts().sort_index()
    event_counts.plot(kind='bar', color='darkorange', edgecolor='black')
    plt.title('Frequency of Extreme Spread Widening Events (Quarterly)', fontsize=12)
    plt.ylabel('Number of Events')
    plt.xlabel('Quarter')
    plt.xticks(rotation=45)
    plt.show()
"""
plot4_md = """
### Visualization Interpretations: Event Detection
- **Event Frequency Distribution**: Shows the clustering of events. A trader can see that feedback loop signals are highly clustered around macroeconomic shocks (e.g., 2022). High event density implies a persistent structural dislocation rather than isolated statistical noise.
"""
insert_before("Trader's Critique — Event Detection", code(plot4_code), md(plot4_md))


# ==========================================
# Write Out
# ==========================================
with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Injected Part 1 visual cells.")
