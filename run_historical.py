import requests
import time
import json

def wait_for_server():
    print("Waiting for Engine to finish booting (this may take 10+ minutes)...")
    while True:
        try:
            r = requests.get('http://localhost:5000/api/v2/status', timeout=5)
            if r.status_code == 200 and r.json().get('status') == 'ready':
                print("Engine is ready!")
                break
        except Exception:
            pass
        time.sleep(30)

def run_backtest():
    url = "http://localhost:5000/api/v2/backtest/CL/m1_m2"
    params = {
        "roll_window": 60,
        "entry_z": 2.0,
        "exit_z": 0.3,
        "stop_cushion": 0.5,
        "max_hold": 30,
        "regime_filter": "all",
        "strategy_type": "fair_value_residual"
    }
    print(f"Running backtest with params: {params}")
    r = requests.get(url, params=params)
    data = r.json()
    
    if "error" in data:
        print("Backtest failed:", data["error"])
        return
        
    m = data["metrics"]
    trades = data["trades"]
    
    out = "# Historical Backtest Results: CL M1-M2\n\n"
    out += f"**Parameters:** Entry Z: 2.0, Exit Z: 0.3, Stop Cushion: 0.5, Regime: All, Strategy: ML Fair Value\n\n"
    out += "## Portfolio Metrics\n"
    out += f"- **Total PnL:** ${m['total_pnl']:,.2f}\n"
    out += f"- **Sharpe Ratio:** {m['sharpe_ratio']:.3f}\n"
    out += f"- **Win Rate:** {m['win_rate']:.2f}%\n"
    out += f"- **Total Trades:** {m['total_trades']}\n"
    out += f"- **Profit Factor:** {m['profit_factor']:.2f}\n"
    out += f"- **Max Drawdown:** ${m['max_drawdown']:,.2f}\n"
    out += f"- **Avg Days Held:** {m['avg_days_held']:.1f}\n\n"
    
    out += "## Full Trade Log\n"
    out += "| # | Entry Date | Exit Date | Dir | Entry | Exit | Entry Z | Exit Z | Reason | Regime | PnL |\n"
    out += "|---|---|---|---|---|---|---|---|---|---|---|\n"
    
    for i, t in enumerate(trades):
        color = '#00c48f' if t['pnl'] >= 0 else '#f43f5e'
        sign = '+' if t['pnl'] >= 0 else ''
        reg = str(t.get('regime', 'N/A')).replace('R1_', '').replace('R2_', '').replace('R3_', '').replace('R4_', '').replace('R5_', '').replace('_', ' ')
        out += f"| {i+1} | {t['entry_date']} | {t['exit_date']} | {t['direction']} | ${t['entry_price']:.3f} | ${t['exit_price']:.3f} | {t['entry_z']:.2f} | {t['exit_z']:.2f} | {t['exit_reason']} | {reg} | <span style='color: {color}'>{sign}${t['pnl']:.2f}</span> |\n"
        
    with open('C:/Users/USER/.gemini/antigravity-ide/brain/1cfddbab-b9b4-40d1-9c38-e3c16cb64560/historical_backtest_results.md', 'w') as f:
        f.write(out)
    
    print("Backtest results written to artifact successfully!")

if __name__ == '__main__':
    wait_for_server()
    run_backtest()
