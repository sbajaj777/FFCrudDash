import requests
import time

products = ["CL", "HO", "LCO", "LGO"]
structures = ["m1_m2", "m1_m3", "m1_m6", "m1_m12", "fly_1_2_3", "fly_1_3_5", "fly_1_6_12", "fly_2_4_6"]

total_trades = 0
total_pnl = 0

print("Fetching ML Backtest Data for all Products & Structures...")

for p in products:
    for s in structures:
        try:
            url = f"http://127.0.0.1:5000/api/v2/backtest/{p}/{s}?roll_window=60&entry_z=2&exit_z=0.3&stop_cushion=0.5&max_hold=30&regime_filter=all&strategy_type=fair_value_residual"
            res = requests.get(url).json()
            if "error" not in res and "metrics" in res:
                trades = res["metrics"].get("total_trades", 0)
                pnl = res["metrics"].get("total_pnl", 0)
                total_trades += trades
                total_pnl += pnl
                print(f"[{p}] {s}: {trades} trades, ${pnl:.2f}")
        except Exception as e:
            print(f"Error on {p} {s}: {e}")

print(f"\n--- FINAL RESULTS ---")
print(f"Total ML Trades (All Regimes): {total_trades}")
print(f"Total ML PnL (All Regimes): ${total_pnl:,.2f}")
