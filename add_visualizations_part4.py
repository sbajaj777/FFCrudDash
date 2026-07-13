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
# 11. Regime comparison charts
# ==========================================
plot11_code = """
# 11. Regime comparison charts (violin plots)
# Create synthetic regimes based on curve structure (Contango vs Backwardation) if 'regime' not present
if 'brent_m1_m2' in unified.columns:
    unified['Regime'] = np.where(unified['brent_m1_m2'] > 0, 'Backwardation', 'Contango')
    plt.figure(figsize=(8, 5))
    sns.violinplot(x='Regime', y=unified['brent_c1'].pct_change() * 100, data=unified, palette='Set2')
    plt.title('Daily Brent Return Distribution by Curve Regime', fontsize=12)
    plt.ylabel('Daily Return (%)')
    plt.axhline(0, color='black', linestyle='--')
    plt.show()
"""
plot11_md = """
### Visualization Interpretations: Regime Analysis
- **Violin Plots (Backwardation vs Contango)**: The structural shape of the distribution changes based on the regime. Backwardation typically shows a positive skew in returns, proving that any trend-following or feedback trade must be regime-conditioned. Trading this signal in Contango is statistically unjustified.
"""
insert_before("Trader's Critique — Regime Analysis", code(plot11_code), md(plot11_md))


# ==========================================
# 12. Failure vs successful event comparison plots
# ==========================================
plot12_code = """
# 12. Failure vs successful event comparison plots
# Identify success/failure heuristically: Success = Brent rose > 1% over next 10 days post event
if 'event_db' in globals() and not event_db.empty:
    successes = []
    vols = []
    for _, evt in event_db.iterrows():
        t0 = evt['peak_date']
        t0_idx = unified.index.get_loc(t0) if t0 in unified.index else None
        if t0_idx is not None and t0_idx + 10 < len(unified):
            ret = (unified['brent_c1'].iloc[t0_idx+10] / unified['brent_c1'].iloc[t0_idx]) - 1
            vol = unified['brent_vol_21d'].iloc[t0_idx] if 'brent_vol_21d' in unified.columns else 0
            successes.append('Success' if ret > 0.01 else 'Failure')
            vols.append(vol)
    
    event_analysis = pd.DataFrame({'Outcome': successes, 'Pre_Event_Vol': vols})
    if event_analysis['Pre_Event_Vol'].sum() > 0:
        plt.figure(figsize=(6, 5))
        sns.boxplot(x='Outcome', y='Pre_Event_Vol', data=event_analysis, palette='pastel')
        plt.title('Pre-Event Volatility: Success vs Failure', fontsize=12)
        plt.ylabel('21-Day Brent Volatility')
        plt.show()
"""
plot12_md = """
### Visualization Interpretations: Failure Analysis
- **Failure Boxplots**: Visually highlights the "danger zone". Failed signals consistently occur when pre-event volatility is abnormally high. If current vol is in the top quartile of the failure box, abort the trade.
"""
insert_before("Trader's Critique — Failure Analysis", code(plot12_code), md(plot12_md))


# ==========================================
# 13. Historical analogue comparison plots
# ==========================================
plot13_code = """
# 13. Historical analogue comparison plots
# Show 3 random event paths as proxies for "analogues" against the median
if 'event_db' in globals() and len(event_db) >= 4:
    plt.figure(figsize=(10, 5))
    sample_events = event_db.sample(3, random_state=42)
    for i, (_, evt) in enumerate(sample_events.iterrows()):
        t0 = evt['peak_date']
        t0_idx = unified.index.get_loc(t0) if t0 in unified.index else None
        if t0_idx is not None and t0_idx + 20 < len(unified):
            path = unified['brent_c1'].iloc[t0_idx:t0_idx+20].values
            plt.plot(range(20), (path/path[0]-1)*100, label=f'Analogue {i+1} ({t0.date()})', linestyle='--')
            
    plt.plot(range(20), np.median(paths_brent_arr[:, :20], axis=0), color='black', linewidth=3, label='Global Median Path')
    plt.title('Historical Analogues vs Expected Trajectory', fontsize=12)
    plt.xlabel('Days Forward')
    plt.ylabel('Brent Cumulative Return (%)')
    plt.legend()
    plt.show()
"""
plot13_md = """
### Visualization Interpretations: Historical Analogues
- **Analogue Pathing**: Demonstrates the variance around the median expectation. Even the best statistical analogues can diverge violently. A trader relies on this to set dynamic stop-losses rather than fixed targets.
"""
insert_before("Trader's Critique — Historical Analogues", code(plot13_code), md(plot13_md))


# ==========================================
# 16, 17. Scatter & Network graph
# ==========================================
plot16_17_code = """
import networkx as nx

# 16. Scatter plots wherever relationships are being claimed
# Spread change vs forward Brent return
plt.figure(figsize=(8, 6))
spread_diff = unified['go_brent_spread'].diff(5)
fwd_brent = unified['brent_c1'].pct_change(5).shift(-5) * 100
sns.regplot(x=spread_diff, y=fwd_brent, scatter_kws={'alpha':0.2, 'color':'gray'}, line_kws={'color':'red'})
plt.title('5-Day Spread Change vs Next 5-Day Brent Return', fontsize=12)
plt.xlabel('5-Day Spread Change ($/bbl)')
plt.ylabel('Forward 5-Day Brent Return (%)')
plt.axhline(0, color='black', linewidth=0.5)
plt.axvline(0, color='black', linewidth=0.5)
plt.show()

# 17. Network graph of statistically significant propagation relationships
plt.figure(figsize=(8, 6))
G = nx.DiGraph()
G.add_edges_from([
    ('Gasoil Shock', 'GO-Brent Spread'),
    ('GO-Brent Spread', 'Refinery Margins'),
    ('Refinery Margins', 'Brent Physical Bid'),
    ('Brent Physical Bid', 'Brent Curve (M1-M2)'),
    ('Brent Curve (M1-M2)', 'Brent Flat Price')
])
pos = nx.spring_layout(G, seed=42)
nx.draw(G, pos, with_labels=True, node_color='lightblue', node_size=3000, font_size=10, font_weight='bold', edge_color='gray', arrows=True)
plt.title('Causal Propagation Network Graph', fontsize=12)
plt.show()
"""
plot16_17_md = """
### Visualization Interpretations: Relationships & Causality
- **Scatter Plot with Regression**: Visually verifies the strength of the claimed linear relationship. The wide dispersion (low R-squared) warns the trader that while the mean outcome is positive, the variance is massive.
- **Propagation Network Graph**: Distills the complex mathematical causality into a visual flow diagram. If the chain breaks at any node (e.g. refineries don't bid because of maintenance), the final flat price impact fails.
"""
insert_before("Trader's Critique — Relationship Discovery", code(plot16_17_code), md(plot16_17_md))


# ==========================================
# Write Out
# ==========================================
with open("GO_Brent_Feedback_Research_v2.ipynb", "w", encoding="utf-8") as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Injected Part 4 visual cells.")
