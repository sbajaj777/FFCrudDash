import nbformat as nbf

nb = nbf.v4.new_notebook()

text = """\
# ML Intraday Backtest Results

This notebook executes the Out-of-Sample Machine Learning Fair Value backtest on the `CL M1-M2` spread, using intraday data.
It calculates detailed metrics including the Sharpe Ratio, Average Profit/Loss, and displays the complete trade log.
"""

code_1 = """\
import pandas as pd
import numpy as np
import time
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge

import warnings
warnings.filterwarnings('ignore')
"""

text_2 = """\
## 1. Load Data & Resample
Loading `CL_data.csv` and resampling it to 15-Minute bars.
"""

code_2 = """\
def parse_data(filepath, start_date, end_date):
    print(f"Loading {filepath} between {start_date} and {end_date}...")
    with open(filepath, "r", encoding="utf-8") as f:
        f.readline() # meta
        header = f.readline().strip().split(",")
        
    price_cols = {}
    for i, h in enumerate(header):
        if "weighted_mid" in h:
            contract_num = h.split("||")[0].strip()
            if contract_num in ['c1', 'c2', 'c3', 'c6']:
                price_cols[i] = contract_num
                
    usecols = [0] + list(price_cols.keys())
    col_names = ["timestamp"] + list(price_cols.values())
    
    df = pd.read_csv(filepath, skiprows=1, usecols=usecols, names=col_names, header=0, parse_dates=["timestamp"], low_memory=False)
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True, errors="coerce")
    df = df.set_index('timestamp').dropna()
    
    df = df.loc[start_date:end_date]
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')
    return df.dropna()

t0 = time.time()
df = parse_data("f:/dashboard 2/data/CL_data.csv", "2026-03-01", "2026-05-25")
print(f"Loaded {len(df)} 1-minute rows in {time.time()-t0:.1f}s")

# Resample to 15-Minute bars
df = df.resample('15min').last().dropna()
print(f"Resampled to {len(df)} 15-Minute rows.")
"""

text_3 = """\
## 2. Feature Engineering & Train/Test Split
Calculating the macroeconomic features and splitting the dataset.
"""

code_3 = """\
df['spread'] = df['c1'] - df['c2']
df['slope_m2_m6'] = df['c2'] - df['c6']
df['fly_1_2_3'] = df['c1'] - 2*df['c2'] + df['c3']

# Rolling Volatility (5 days = 5 * 24 * 4 = 480 periods)
df['returns'] = np.log(df['c1'] / df['c1'].shift(1))
df['vol_5d'] = df['returns'].rolling(window=480).std() * np.sqrt(252*24*4) * 100
df = df.dropna()

features = ['slope_m2_m6', 'fly_1_2_3', 'vol_5d']
target = 'spread'

train_end = "2026-04-15"
train_df = df.loc[:train_end]
test_df = df.loc[train_end:]
print(f"Training on {len(train_df)} rows, Testing on {len(test_df)} rows.")
"""

text_4 = """\
## 3. Train ML Model & Compute Residuals
We use `Ridge` regression to calculate Fair Value and standard scale the features. We apply a 3-day dynamic rolling RMSE to compute the ML Z-Score.
"""

code_4 = """\
X_train = train_df[features].values
y_train = train_df[target].values

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)

model = Ridge(alpha=1.0)
model.fit(X_train_scaled, y_train)

# Predict on Test Set
X_test = test_df[features].values
y_test = test_df[target].values
X_test_scaled = scaler.transform(X_test)

test_df = test_df.copy()
test_df['efv'] = model.predict(X_test_scaled)
test_df['residual'] = test_df['spread'] - test_df['efv']

# Dynamic 3-day Rolling RMSE
test_df['rolling_rmse'] = test_df['residual'].rolling(window=288, min_periods=24).std().replace(0, np.nan)
test_df['z_score'] = test_df['residual'] / test_df['rolling_rmse']
"""

text_5 = """\
## 4. Run Dynamic Backtest
Executing the trade logic...
"""

code_5 = """\
entry_z = 1.5
exit_z = 0.3
stop_cushion = 0.5
lot_size = 1000.0

position = None
trades = []

for ts, row in test_df.iterrows():
    z = row['z_score']
    p = row['spread']
    
    if pd.isna(z): continue
        
    if position is not None:
        exit_reason = None
        pos_stop_z = position['dynamic_stop']
        
        if position['direction'] == 'SELL':
            if z <= exit_z: exit_reason = 'PROFIT_TARGET'
            elif z >= pos_stop_z: exit_reason = 'STOP_LOSS'
        else:
            if z >= -exit_z: exit_reason = 'PROFIT_TARGET'
            elif z <= -pos_stop_z: exit_reason = 'STOP_LOSS'
            
        if exit_reason:
            direction_mult = -1 if position['direction'] == 'SELL' else 1
            pnl = direction_mult * (p - position['entry_price']) * lot_size
            
            trades.append({
                'Entry Date': position['entry_time'],
                'Exit Date': ts,
                'Dir': position['direction'],
                'Entry Spread': position['entry_price'],
                'Exit Spread': p,
                'Entry Z': position['entry_z'],
                'Exit Z': z,
                'Reason': exit_reason,
                'PnL': pnl
            })
            position = None
            
    if position is None:
        if z >= entry_z:
            position = {'direction': 'SELL', 'entry_time': ts, 'entry_price': p, 'entry_z': z, 'dynamic_stop': z + stop_cushion}
        elif z <= -entry_z:
            position = {'direction': 'BUY', 'entry_time': ts, 'entry_price': p, 'entry_z': z, 'dynamic_stop': abs(z) + stop_cushion}

df_trades = pd.DataFrame(trades)
print(f"Executed {len(df_trades)} trades.")
"""

text_6 = """\
## 5. Portfolio Metrics
Detailed analysis of performance.
"""

code_6 = """\
if len(df_trades) > 0:
    total_pnl = df_trades['PnL'].sum()
    win_rate = (df_trades['PnL'] > 0).mean() * 100
    winning_trades = df_trades[df_trades['PnL'] > 0]
    losing_trades = df_trades[df_trades['PnL'] <= 0]
    
    avg_profit = winning_trades['PnL'].mean() if len(winning_trades) > 0 else 0
    avg_loss = losing_trades['PnL'].mean() if len(losing_trades) > 0 else 0
    
    # Simple Daily Sharpe Approximation
    df_trades['Date'] = pd.to_datetime(df_trades['Exit Date']).dt.date
    daily_pnl = df_trades.groupby('Date')['PnL'].sum()
    sharpe = (daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)) if len(daily_pnl) > 1 else 0

    print(f"Total PnL: ${total_pnl:,.2f}")
    print(f"Win Rate: {win_rate:.2f}%")
    print(f"Total Trades: {len(df_trades)}")
    print(f"Average Profit (Winners): ${avg_profit:,.2f}")
    print(f"Average Loss (Losers): ${avg_loss:,.2f}")
    print(f"Estimated Annualized Sharpe Ratio: {sharpe:.3f}")
else:
    print("No trades executed.")
"""

text_7 = """\
## 6. Complete Trade Log
"""

code_7 = """\
df_trades.style.format({
    'Entry Spread': '${:.3f}',
    'Exit Spread': '${:.3f}',
    'Entry Z': '{:.2f}',
    'Exit Z': '{:.2f}',
    'PnL': '${:.2f}'
}).map(lambda x: 'color: #00c48f' if x > 0 else 'color: #f43f5e', subset=['PnL'])
"""

nb['cells'] = [
    nbf.v4.new_markdown_cell(text),
    nbf.v4.new_code_cell(code_1),
    nbf.v4.new_markdown_cell(text_2),
    nbf.v4.new_code_cell(code_2),
    nbf.v4.new_markdown_cell(text_3),
    nbf.v4.new_code_cell(code_3),
    nbf.v4.new_markdown_cell(text_4),
    nbf.v4.new_code_cell(code_4),
    nbf.v4.new_markdown_cell(text_5),
    nbf.v4.new_code_cell(code_5),
    nbf.v4.new_markdown_cell(text_6),
    nbf.v4.new_code_cell(code_6),
    nbf.v4.new_markdown_cell(text_7),
    nbf.v4.new_code_cell(code_7),
]

with open('f:/dashboard 2/ml_intraday_results.ipynb', 'w') as f:
    nbf.write(nb, f)
print("Notebook created successfully!")
