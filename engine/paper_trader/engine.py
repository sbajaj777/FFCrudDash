"""
Paper Trading Engine — Live Signal Monitor & Virtual Position Manager

Runs as a background thread inside the FastAPI app.
Every POLL_INTERVAL seconds it:
  1. Fetches live M1 and M2 prices from Yahoo Finance
  2. Computes the live spread and 60-day rolling Z-score using ENGINE_STATE history
  3. Checks entry/exit conditions
  4. Opens / closes virtual paper trades
  5. Persists all state to paper_trades.json for survival across restarts

Supported instruments (Yahoo Finance free tier):
  CL  — WTI Crude Oil  (NYMEX)
  LCO — Brent Crude    (uses CL spread as proxy, ICE not freely available)
"""
import json
import logging
import os
import time
import threading
from datetime import date, datetime
from pathlib import Path
import numpy as np
import pandas as pd
import requests

logger = logging.getLogger("paper_trader")

# ── Config ───────────────────────────────────────────────────────────
POLL_INTERVAL   = 300          # seconds between live price checks (5 min)
ROLL_WINDOW     = 60           # days for rolling Z-score
ENTRY_Z         = 2.0
EXIT_Z          = 0.3
STOP_Z          = 0.5
MAX_HOLD_DAYS   = 30
LOT_SIZE        = 1000.0       # barrels per lot

ALLOWED_REGIMES = ["R4_BACKWARDATION", "R5_EXTREME_BACKWARDATION"]

STATE_FILE = Path(__file__).parent.parent.parent / "paper_trades.json"   # f:\dashboard 2\paper_trades.json

YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept":     "application/json",
}

# Month letter codes for futures tickers
MONTH_CODES = {
    1:"F", 2:"G", 3:"H", 4:"J", 5:"K", 6:"M",
    7:"N", 8:"Q", 9:"U", 10:"V", 11:"X", 12:"Z"
}

# ── State (shared with app.py via this module) ───────────────────────
PAPER_STATE = {
    "open_positions":   [],   # list of dicts
    "closed_trades":    [],   # list of dicts
    "live_signals":     {},   # {product_structure: signal_dict}
    "last_update":      None,
    "is_running":       False,
}


# ── Helpers ──────────────────────────────────────────────────────────

def get_contract_tickers(product: str, months: list, as_of: date = None):
    """Dynamically compute Yahoo Finance tickers for a list of month offsets."""
    if as_of is None:
        as_of = date.today()

    year, month, day = as_of.year, as_of.month, as_of.day

    if day >= 20:
        base_month = month + 2
    else:
        base_month = month + 1

    base_year = year

    # NYMEX proxies for Yahoo Finance
    prefix = {
        "CL": "CL",
        "HO": "HO",
        "LCO": "BZ",  # Brent proxy
        "LGO": "HO",  # Gasoil proxy (heating oil proxy)
    }.get(product, product)
    
    suffix = ".NYM"

    tickers = {}
    for m in months:
        t_month = base_month + (m - 1)
        t_year = base_year
        while t_month > 12:
            t_month -= 12
            t_year += 1
        tickers[m] = f"{prefix}{MONTH_CODES[t_month]}{str(t_year)[2:]}{suffix}"
        
    return tickers


def fetch_price(ticker: str) -> float | None:
    """Fetch latest price for a Yahoo Finance ticker."""
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1d&interval=5m"
    try:
        r = requests.get(url, headers=YAHOO_HEADERS, timeout=10)
        if r.status_code == 200:
            meta = r.json()["chart"]["result"][0]["meta"]
            return float(meta.get("regularMarketPrice") or meta.get("previousClose"))
    except Exception as e:
        logger.warning(f"Failed to fetch {ticker}: {e}")
    return None


def compute_live_zscore(engine_state: dict, product: str, structure: str, live_spread: float):
    """
    Compute Expected Fair Value (EFV) and Residual Z-score using the trained ML model.
    Returns (z_score, efv, test_rmse, current_regime)
    """
    df = engine_state["products_enriched"].get(product)
    if df is None or structure not in df.columns:
        return None, None, None, None

    # Current regime from latest enriched row
    current_regime = str(df["regime"].dropna().iloc[-1]) if "regime" in df.columns else None
    
    # Fallback to daily rolling Z if no model exists for this regime
    regressions = engine_state.get("regressions", {})
    try:
        model_data = regressions[product][structure][current_regime]
    except KeyError:
        # Fallback to ALL regime or return none
        try:
            model_data = regressions[product][structure]["ALL"]
        except KeyError:
            return None, None, None, None
            
    best_model_name = model_data.get("best_model")
    if not best_model_name:
        return None, None, None, None
        
    model = model_data["models"][best_model_name]
    scaler = model_data["scaler"]
    
    # Extract latest daily features
    latest_row = df.iloc[-1]
    
    efv = model["intercept"]
    for i, feature_name in enumerate(scaler["features"]):
        val = latest_row.get(feature_name)
        if pd.isna(val):
            val = 0.0 # fallback
        
        # Standardize
        mean = scaler["mean"][i]
        scale = scaler["scale"][i]
        z_feat = (val - mean) / scale if scale != 0 else 0
        
        coef = model["coefficients"].get(feature_name, 0.0)
        efv += z_feat * coef
        
    residual = live_spread - efv
    test_rmse = model["test_rmse"]
    
    if test_rmse == 0 or pd.isna(test_rmse):
        return None, None, None, None
        
    z = residual / test_rmse

    return round(float(z), 4), round(float(efv), 4), round(float(test_rmse), 4), current_regime


def save_state():
    """Persist paper trade state to disk."""
    try:
        with open(STATE_FILE, "w") as f:
            json.dump({
                "open_positions": PAPER_STATE["open_positions"],
                "closed_trades":  PAPER_STATE["closed_trades"],
            }, f, indent=2, default=str)
    except Exception as e:
        logger.warning(f"Could not save paper trade state: {e}")


def load_state():
    """Load persisted paper trade state from disk."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE) as f:
                data = json.load(f)
                PAPER_STATE["open_positions"] = data.get("open_positions", [])
                PAPER_STATE["closed_trades"]  = data.get("closed_trades", [])
                logger.info(f"[PaperTrader] Loaded {len(PAPER_STATE['open_positions'])} open + "
                            f"{len(PAPER_STATE['closed_trades'])} closed trades from disk.")
        except Exception as e:
            logger.warning(f"Could not load paper trade state: {e}")


# ── Core Tick ────────────────────────────────────────────────────────

def run_tick(engine_state: dict):
    """
    One complete tick: fetch prices → compute Z-scores → check signals → manage positions.
    Scans across multiple products and forward curve structures.
    """
    logger.info("[PaperTrader] Running live tick…")
    now_str = datetime.utcnow().isoformat()

    UNIVERSE = ["CL", "HO", "LCO", "LGO"]
    MONTH_REQS = [1, 2, 3, 6, 12]
    STRUCTURES = {
        "m1_m2": (1, 2),
        "m1_m3": (1, 3),
        "m1_m6": (1, 6),
        "m1_m12": (1, 12),
    }

    PAPER_STATE["live_signals"].clear()

    for product in UNIVERSE:
        tickers = get_contract_tickers(product, MONTH_REQS)
        prices = {}
        for m, ticker in tickers.items():
            price = fetch_price(ticker)
            if price is not None:
                prices[m] = price
            else:
                # If we fail to fetch a leg, we can't reliably trade structures involving it
                logger.warning(f"[PaperTrader] Failed to fetch {ticker} for {product} M{m}")

        # Compute structures
        for structure, (m1, m2) in STRUCTURES.items():
            if m1 not in prices or m2 not in prices:
                continue
                
            m1_price = prices[m1]
            m2_price = prices[m2]
            live_spread = round(m1_price - m2_price, 4)

            # Calculate Z-score for this product and structure
            z, efv, rmse, regime = compute_live_zscore(engine_state, product, structure, live_spread)

            if z is None:
                continue

            signal_label = "NEUTRAL"
            if z >= ENTRY_Z:     signal_label = "SELL (RICH)"
            elif z >= 1.0:       signal_label = "SLIGHTLY RICH"
            elif z <= -ENTRY_Z:  signal_label = "BUY (CHEAP)"
            elif z <= -1.0:      signal_label = "SLIGHTLY CHEAP"

            sig_key = f"{product}_{structure}"
            PAPER_STATE["live_signals"][sig_key] = {
                "product":       product,
                "structure":     structure,
                "m1_ticker":     tickers[m1],
                "m2_ticker":     tickers[m2],
                "m1_price":      m1_price,
                "m2_price":      m2_price,
                "live_spread":   live_spread,
                "z_score":       z,
                "efv":           efv,
                "rmse":          rmse,
                "current_regime": regime,
                "signal":        signal_label,
                "timestamp":     now_str,
            }

            in_allowed_regime = regime in ALLOWED_REGIMES if regime else False

            # ── Check exits on open positions ────────────────────────────────
            still_open = []
            for pos in PAPER_STATE["open_positions"]:
                # If this position belongs to another product/structure, pass it down to keep it
                if pos["product"] != product or pos["structure"] != structure:
                    # Actually wait! If we do this inside the product loop, we'll duplicate or drop things!
                    # We should process ALL open positions in a separate loop or filter!
                    pass

    # ── Check exits for ALL open positions ────────────────────────────────
    still_open = []
    for pos in PAPER_STATE["open_positions"]:
        sig_key = f"{pos['product']}_{pos['structure']}"
        sig = PAPER_STATE["live_signals"].get(sig_key)
        
        if not sig:
            # If we don't have live data for this position right now, keep it open but untouched
            still_open.append(pos)
            continue
            
        z = sig["z_score"]
        live_spread = sig["live_spread"]
        
        entry_date  = datetime.fromisoformat(pos["entry_date"])
        days_held   = (datetime.utcnow() - entry_date).days
        current_pnl = round(
            (-1 if pos["direction"] == "SELL" else 1) * (live_spread - pos["entry_spread"]) * LOT_SIZE, 2
        )
        pos["current_spread"] = live_spread
        pos["current_pnl"]    = current_pnl
        pos["days_held"]      = days_held
        pos["current_z"]      = z
        pos["last_updated"]   = now_str

        # Dynamic stop Z stored in the position
        pos_stop_z = pos.get("dynamic_stop_z", STOP_Z)

        exit_reason = None
        if pos["direction"] == "SELL":
            if z <= EXIT_Z:    exit_reason = "PROFIT_TARGET"
            elif z >= pos_stop_z:  exit_reason = "STOP_LOSS"
        else:
            if z >= -EXIT_Z:   exit_reason = "PROFIT_TARGET"
            elif z <= -pos_stop_z: exit_reason = "STOP_LOSS"

        if days_held >= MAX_HOLD_DAYS:
            exit_reason = "TIMEOUT"

        if exit_reason:
            closed = {**pos, "exit_spread": live_spread, "exit_z": z,
                      "exit_reason": exit_reason, "exit_date": now_str,
                      "final_pnl": current_pnl}
            PAPER_STATE["closed_trades"].append(closed)
            logger.info(f"[PaperTrader] CLOSED {pos['direction']} {pos['product']} {pos['structure']} | PnL: ${current_pnl} | Reason: {exit_reason}")
        else:
            still_open.append(pos)

    PAPER_STATE["open_positions"] = still_open

    # ── Check entries ────────────────────────────────────────────────
    for sig_key, sig in PAPER_STATE["live_signals"].items():
        z = sig["z_score"]
        regime = sig["current_regime"]
        in_allowed_regime = regime in ALLOWED_REGIMES if regime else False
        
        has_open = any(p["product"] == sig["product"] and p["structure"] == sig["structure"]
                          for p in PAPER_STATE["open_positions"])

        if not has_open and in_allowed_regime:
            regime_multipliers = {
                "R1_DEEP_CONTANGO": 0.8,
                "R2_CONTANGO": 0.9,
                "R3_FLAT": 1.0,
                "R4_BACKWARDATION": 1.2,
                "R5_EXTREME_BACKWARDATION": 1.5,
            }
            mult = regime_multipliers.get(regime, 1.0)

            direction = None
            if z >= ENTRY_Z:    direction = "SELL"
            elif z <= -ENTRY_Z: direction = "BUY"

            if direction:
                # STOP_Z now acts as the risk cushion base multiplier (e.g. 0.5)
                dynamic_stop = abs(z) + (STOP_Z * mult)

                new_trade = {
                    "id":            f"PT{int(time.time())}_{sig['product']}_{sig['structure']}",
                    "product":       sig["product"],
                    "structure":     sig["structure"],
                    "direction":     direction,
                    "entry_date":    now_str,
                    "entry_spread":  sig["live_spread"],
                    "entry_z":       z,
                    "entry_m1":      sig["m1_price"],
                    "entry_m2":      sig["m2_price"],
                    "regime":        regime,
                    "lot_size":      LOT_SIZE,
                    "current_spread": sig["live_spread"],
                    "current_pnl":   0.0,
                    "current_z":     z,
                    "days_held":     0,
                    "last_updated":  now_str,
                    "dynamic_stop_z": dynamic_stop,
                }
                PAPER_STATE["open_positions"].append(new_trade)
                logger.info(f"[PaperTrader] OPENED {direction} {sig['product']} {sig['structure']} | Spread: {sig['live_spread']} | Z: {z} | Regime: {regime}")

    PAPER_STATE["last_update"] = now_str
    save_state()


# ── Background Thread ────────────────────────────────────────────────

def start_paper_trader(engine_state: dict):
    """
    Launch the paper trading engine as a daemon background thread.
    Called once after the Phase 2 engine boot completes.
    """
    load_state()
    PAPER_STATE["is_running"] = True

    def loop():
        # Wait 10s before first tick to let FastAPI fully start
        time.sleep(10)
        while PAPER_STATE["is_running"]:
            try:
                run_tick(engine_state)
            except Exception as e:
                logger.error(f"[PaperTrader] Tick error: {e}", exc_info=True)
            time.sleep(POLL_INTERVAL)

    t = threading.Thread(target=loop, daemon=True, name="PaperTrader")
    t.start()
    logger.info(f"[PaperTrader] Started. Polling every {POLL_INTERVAL}s.")
