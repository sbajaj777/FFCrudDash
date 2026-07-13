import pandas as pd
import numpy as np

csv_path = 'f:/dashboard 2/massive_intraday_results.csv'
df = pd.read_csv(csv_path)

total_pnl = df['PnL'].sum()
win_rate = (df['PnL'] > 0).mean() * 100

df['Date'] = pd.to_datetime(df['Exit Date']).dt.date
daily_pnl = df.groupby('Date')['PnL'].sum()
sharpe = (daily_pnl.mean() / daily_pnl.std() * np.sqrt(252)) if len(daily_pnl) > 1 else 0

winning_trades = df[df['PnL'] > 0]
losing_trades = df[df['PnL'] <= 0]
avg_profit = winning_trades['PnL'].mean() if len(winning_trades) > 0 else 0
avg_loss = losing_trades['PnL'].mean() if len(losing_trades) > 0 else 0

df = df.drop(columns=['Date'])

out_path = 'f:/dashboard 2/filtered_intraday_results.csv'
with open(out_path, 'w') as f:
    f.write("--- Massive Intraday Backtest Metrics ---\n")
    f.write(f"Total Trades,{len(df)}\n")
    f.write(f"Total PnL,${total_pnl:,.2f}\n")
    f.write(f"Win Rate,{win_rate:.2f}%\n")
    f.write(f"Average Profit,${avg_profit:,.2f}\n")
    f.write(f"Average Loss,${avg_loss:,.2f}\n")
    f.write(f"Sharpe Ratio,{sharpe:.3f}\n")
    f.write("\n")

df.to_csv(out_path, mode='a', index=False)
print("Metrics successfully injected into CSV!")
