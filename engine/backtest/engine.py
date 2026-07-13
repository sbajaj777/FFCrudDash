"""
Backtest Engine — Calendar Spread Mean-Reversion Strategy

Strategy Logic:
  - Compute 60-day rolling Z-score of the M1-M2 (or any spread) price series
  - ENTRY:  Z > +entry_z  → SELL the spread (it is RICH vs historical)
            Z < -entry_z  → BUY  the spread (it is CHEAP vs historical)
  - EXIT:   Z reverts to ±exit_z (default 0.0)   → PROFIT TARGET hit
            Z moves to ±stop_z  (default 3.5)     → STOP LOSS hit
            Trade age > max_hold days             → TIMEOUT exit
  - REGIME FILTER: Only trade when current regime is in allowed_regimes

Returns:
  - Trade log: each trade with entry/exit dates, prices, z-scores, PnL, exit reason
  - Portfolio metrics: Sharpe, Max Drawdown, Win Rate, Avg P&L, etc.
"""
import numpy as np
import pandas as pd
import logging

logger = logging.getLogger(__name__)


def run_backtest(
    df: pd.DataFrame,
    product: str = None,
    engine_state: dict = None,
    structure: str = "m1_m2",
    roll_window: int = 60,
    entry_z: float = 2.0,
    exit_z: float = 0.3,
    stop_z: float = 3.5,
    max_hold: int = 30,
    allowed_regimes: list = None,
    lot_size: float = 1000.0,   # barrels per lot (1 CL contract = 1000 bbl)
    strategy_type: str = "basic_rolling",  # "basic_rolling" | "fair_value_residual"
) -> dict:
    """
    Run the full backtest on a product's enriched DataFrame.

    Args:
        df:               Product enriched DataFrame (must have `structure`, `regime` columns)
        structure:        Column name of the spread to trade (e.g. 'm1_m2')
        roll_window:      Rolling Z-score lookback window in days
        entry_z:          Z-score threshold to enter a trade
        exit_z:           Z-score threshold to exit at profit target
        stop_z:           Z-score threshold for stop loss
        max_hold:         Maximum number of days to hold a position
        allowed_regimes:  List of regime strings to allow trading in. None = all regimes.
        lot_size:         Notional size per lot in barrels

    Returns:
        dict with keys: trades, metrics, equity_curve, zscore_series
    """
    if allowed_regimes is None:
        allowed_regimes = [
            "R4_BACKWARDATION",
            "R5_EXTREME_BACKWARDATION",
        ]

    if structure not in df.columns:
        return {"error": f"Structure '{structure}' not found in DataFrame columns."}

    # ── 1. Build Z-Score Series ──────────────────────────────────────
    spread = df[structure].dropna()
    regime_series = df["regime"].reindex(spread.index)
    
    if strategy_type == "fair_value_residual" and engine_state and product:
        regressions = engine_state.get("regressions", {}).get(product, {}).get(structure, {})
        z_scores = []
        
        for date, row in df.reindex(spread.index).iterrows():
            current_regime = str(row["regime"]) if pd.notna(row["regime"]) else "ALL"
            model_data = regressions.get(current_regime, regressions.get("ALL"))
            
            if not model_data or not model_data.get("best_model"):
                z_scores.append(np.nan)
                continue
                
            model = model_data["models"][model_data["best_model"]]
            scaler = model_data["scaler"]
            
            efv = model["intercept"]
            for i, feat in enumerate(scaler["features"]):
                val = row.get(feat, 0.0)
                if pd.isna(val): val = 0.0
                mean = scaler["mean"][i]
                scale = scaler["scale"][i]
                z_feat = (val - mean) / scale if scale != 0 else 0
                efv += z_feat * model["coefficients"].get(feat, 0.0)
                
            residual = row[structure] - efv
            test_rmse = model["test_rmse"]
            
            if test_rmse == 0 or pd.isna(test_rmse):
                z_scores.append(np.nan)
            else:
                z_scores.append(residual / test_rmse)
                
        z_series = pd.Series(z_scores, index=spread.index)
    else:
        roll_mean = spread.rolling(window=roll_window, min_periods=30).mean()
        roll_std  = spread.rolling(window=roll_window, min_periods=30).std()
        roll_std  = roll_std.replace(0, np.nan)   # avoid divide-by-zero
        z_series  = (spread - roll_mean) / roll_std

    # Align regime with spread index
    regime_series = df["regime"].reindex(spread.index)

    # ── 2. Walk Forward (no look-ahead bias) ─────────────────────────
    trades      = []
    position    = None   # None = flat, dict = open trade
    equity      = []     # daily equity curve (cumulative PnL)
    cum_pnl     = 0.0

    dates = spread.index.tolist()

    for i, date in enumerate(dates):
        z   = z_series.iloc[i]
        p   = spread.iloc[i]
        reg = regime_series.iloc[i]

        if pd.isna(z) or pd.isna(p):
            equity.append({"date": str(date.date()), "cum_pnl": cum_pnl})
            continue

        # ── Check exit on open position ─────────────────────────────
        if position is not None:
            days_held = (date - position["entry_date"]).days
            exit_reason = None
            
            # Use dynamically stored stop_z from when the trade was entered
            pos_stop_z = position["dynamic_stop_z"]

            if position["direction"] == "SELL":
                # Profit target: Z reverts toward 0
                if z <= exit_z:
                    exit_reason = "PROFIT_TARGET"
                elif z >= pos_stop_z:
                    exit_reason = "STOP_LOSS"
            else:  # BUY
                if z >= -exit_z:
                    exit_reason = "PROFIT_TARGET"
                elif z <= -pos_stop_z:
                    exit_reason = "STOP_LOSS"

            if days_held >= max_hold:
                exit_reason = "TIMEOUT"

            if exit_reason:
                # Calculate PnL: spread change × lot_size × direction
                spread_change = p - position["entry_price"]
                direction_mult = -1 if position["direction"] == "SELL" else 1
                trade_pnl = direction_mult * spread_change * lot_size

                cum_pnl += trade_pnl

                trades.append({
                    "entry_date":    str(position["entry_date"].date()),
                    "exit_date":     str(date.date()),
                    "direction":     position["direction"],
                    "entry_price":   round(position["entry_price"], 4),
                    "exit_price":    round(p, 4),
                    "entry_z":       round(position["entry_z"], 3),
                    "exit_z":        round(float(z), 3),
                    "days_held":     days_held,
                    "pnl":           round(trade_pnl, 2),
                    "cum_pnl":       round(cum_pnl, 2),
                    "exit_reason":   exit_reason,
                    "regime":        position["regime"],
                })
                position = None

        # ── Check entry (only if flat) ──────────────────────────────
        if position is None:
            in_allowed_regime = (reg in allowed_regimes) if allowed_regimes else True

            if in_allowed_regime and not pd.isna(reg):
                # Calculate dynamic stop based on regime volatility
                regime_multipliers = {
                    "R1_DEEP_CONTANGO": 0.8,
                    "R2_CONTANGO": 0.9,
                    "R3_FLAT": 1.0,
                    "R4_BACKWARDATION": 1.2,
                    "R5_EXTREME_BACKWARDATION": 1.5,
                }
                mult = regime_multipliers.get(reg, 1.0)
                dyn_stop = abs(z) + (stop_z * mult)

                if z >= entry_z:
                    position = {
                        "direction":   "SELL",
                        "entry_date":  date,
                        "entry_price": p,
                        "entry_z":     float(z),
                        "regime":      reg,
                        "dynamic_stop_z": dyn_stop,
                    }
                elif z <= -entry_z:
                    position = {
                        "direction":   "BUY",
                        "entry_date":  date,
                        "entry_price": p,
                        "entry_z":     float(z),
                        "regime":      reg,
                        "dynamic_stop_z": dyn_stop,
                    }

        equity.append({"date": str(date.date()), "cum_pnl": round(cum_pnl, 2)})

    # Close any open position at last price
    if position is not None:
        last_date  = dates[-1]
        last_p     = spread.iloc[-1]
        last_z     = z_series.iloc[-1]
        spread_change = last_p - position["entry_price"]
        direction_mult = -1 if position["direction"] == "SELL" else 1
        trade_pnl = direction_mult * spread_change * lot_size
        cum_pnl += trade_pnl
        trades.append({
            "entry_date":  str(position["entry_date"].date()),
            "exit_date":   str(last_date.date()),
            "direction":   position["direction"],
            "entry_price": round(position["entry_price"], 4),
            "exit_price":  round(last_p, 4),
            "entry_z":     round(position["entry_z"], 3),
            "exit_z":      round(float(last_z), 3),
            "days_held":   (last_date - position["entry_date"]).days,
            "pnl":         round(trade_pnl, 2),
            "cum_pnl":     round(cum_pnl, 2),
            "exit_reason": "OPEN_AT_END",
            "regime":      position["regime"],
        })

    # ── 3. Compute Portfolio Metrics ─────────────────────────────────
    metrics = _compute_metrics(trades, equity)

    # ── 4. Z-Score series for chart ──────────────────────────────────
    zscore_data = [
        {"date": str(d.date()), "z": round(float(z_series.loc[d]), 4)}
        for d in z_series.index
        if not pd.isna(z_series.loc[d])
    ]

    return {
        "product":      None,   # filled by caller
        "structure":    structure,
        "params": {
            "roll_window": roll_window,
            "entry_z":     entry_z,
            "exit_z":      exit_z,
            "stop_z":      stop_z,
            "max_hold":    max_hold,
            "allowed_regimes": allowed_regimes,
        },
        "trades":       trades,
        "metrics":      metrics,
        "equity_curve": equity,
        "zscore_series": zscore_data,
    }


def _compute_metrics(trades: list, equity: list) -> dict:
    """Compute Sharpe, drawdown, win rate, etc. from trade log."""
    if not trades:
        return {
            "total_trades": 0, "win_rate": 0, "avg_pnl": 0,
            "total_pnl": 0, "sharpe_ratio": 0, "max_drawdown": 0,
            "profit_factor": 0, "avg_days_held": 0,
            "best_trade": 0, "worst_trade": 0,
        }

    pnls     = [t["pnl"] for t in trades]
    winners  = [p for p in pnls if p > 0]
    losers   = [p for p in pnls if p < 0]
    days_held = [t["days_held"] for t in trades]

    total_pnl = sum(pnls)
    win_rate  = len(winners) / len(pnls) * 100 if pnls else 0

    # Daily returns for Sharpe (from equity curve)
    eq_vals = [e["cum_pnl"] for e in equity]
    daily_returns = np.diff(eq_vals)
    sharpe = 0.0
    if len(daily_returns) > 1 and np.std(daily_returns) > 0:
        sharpe = round(float(np.mean(daily_returns) / np.std(daily_returns) * np.sqrt(252)), 3)

    # Max Drawdown
    peak    = -np.inf
    max_dd  = 0.0
    for v in eq_vals:
        if v > peak:
            peak = v
        dd = peak - v
        if dd > max_dd:
            max_dd = dd

    # Profit factor
    gross_profit = sum(winners) if winners else 0
    gross_loss   = abs(sum(losers)) if losers else 1e-9
    profit_factor = round(gross_profit / gross_loss, 3) if gross_loss > 0 else float("inf")

    # Exit reason breakdown
    exit_reasons = {}
    for t in trades:
        r = t["exit_reason"]
        exit_reasons[r] = exit_reasons.get(r, 0) + 1

    return {
        "total_trades":   len(trades),
        "win_rate":       round(win_rate, 2),
        "avg_pnl":        round(np.mean(pnls), 2),
        "total_pnl":      round(total_pnl, 2),
        "sharpe_ratio":   sharpe,
        "max_drawdown":   round(max_dd, 2),
        "profit_factor":  profit_factor,
        "avg_days_held":  round(np.mean(days_held), 1),
        "best_trade":     round(max(pnls), 2),
        "worst_trade":    round(min(pnls), 2),
        "gross_profit":   round(gross_profit, 2),
        "gross_loss":     round(gross_loss, 2),
        "exit_reasons":   exit_reasons,
    }
