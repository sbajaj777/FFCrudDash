"""
Phase 2 Engine — FastAPI Application Entry Point

This is the main analysis engine server. It:
1. Auto-discovers CSV files in the data/ directory
2. Parses and resamples them to daily close prices
3. Computes features, regimes, regressions, and signals
4. Exposes REST API endpoints for the React frontend
"""
import os
import glob
import time
import asyncio
import logging
from typing import Dict, List, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import pandas as pd

from config import (
    DATA_DIR, MACRO_SYMBOLS, EIA_API_KEY, REGIME_THRESHOLDS,
    PRODUCTS
)
from ingest.csv_loader import load_all_products
from ingest.resampler import resample_all_products
from ingest.macro_loader import fetch_macro_yfinance, fetch_eia_inventory, merge_macro_with_daily

from features import build_features

from regime import run_regime_pipeline, compute_regime_statistics, explain_regime

from regression import run_regression_pipeline, run_rolling_regression
from config import SPREAD_STRUCTURES, BUTTERFLY_STRUCTURES

# ─── Logging ───
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("engine")

# ─── Global State ───
# Holds all computed data in memory for fast API responses
ENGINE_STATE = {
    "products_raw": {},      # {product: DataFrame (1-min)}
    "products_daily": {},    # {product: DataFrame (daily, c1-c14)}
    "products_enriched": {}, # {product: DataFrame (daily + macro + features + regime)}
    "regime_stats": {},      # {product: {regime: stats, transitions: {...}}}
    "regressions": {},       # {product: {structure: {regime: regression_results}}}
    "macro": None,           # DataFrame (DXY, VIX)
    "inventory": None,       # DataFrame (inv_level, inv_change)
    "boot_time": None,
    "status": "initializing",
}


def boot_engine():
    """
    Full boot sequence: load data → resample → fetch macro → merge → compute features → classify regimes → run regressions.
    Called once at startup.
    """
    t0 = time.time()
    logger.info("=" * 60)
    logger.info("Phase 2 Engine — Boot Sequence")
    logger.info("=" * 60)
    
    # Step 1: Discover and parse CSV files
    logger.info("\n[1/7] Loading CSV files...")
    products_raw = load_all_products(DATA_DIR)
    ENGINE_STATE["products_raw"] = products_raw
    logger.info(f"  Loaded {len(products_raw)} products: {list(products_raw.keys())}")
    
    # Step 2: Resample to daily
    logger.info("\n[2/7] Resampling to daily close...")
    products_daily = resample_all_products(products_raw)
    ENGINE_STATE["products_daily"] = products_daily
    
    for key, df in products_daily.items():
        if not df.empty:
            # Count how many contract months have data
            valid_cols = [c for c in df.columns if df[c].notna().sum() > 10]
            logger.info(f"  [{key}] {len(df)} days, {len(valid_cols)} active contracts")
    
    # Step 3: Fetch macro data
    logger.info("\n[3/7] Fetching macro data (DXY, VIX, EIA)...")
    macro_df = fetch_macro_yfinance(MACRO_SYMBOLS)
    inv_df = fetch_eia_inventory(EIA_API_KEY)
    ENGINE_STATE["macro"] = macro_df
    ENGINE_STATE["inventory"] = inv_df
    
    # Step 4: Merge macro into each product
    logger.info("\n[4/7] Merging macro data into product DataFrames...")
    products_merged = {}
    for key, daily_df in products_daily.items():
        if not daily_df.empty:
            merged = merge_macro_with_daily(daily_df, macro_df, inv_df)
            products_merged[key] = merged
            logger.info(f"  [{key}] Merged: {len(merged)} rows × {len(merged.columns)} columns")
            
    # Step 5: Feature Engineering
    logger.info("\n[5/7] Computing features (spreads, butterflies, volatility, seasonality)...")
    products_featured = {}
    for key, merged_df in products_merged.items():
        if not merged_df.empty:
            featured = build_features(merged_df)
            products_featured[key] = featured
            logger.info(f"  [{key}] Enriched features: {len(featured)} rows × {len(featured.columns)} columns")
            
    # Step 6: Regime Classification
    logger.info("\n[6/7] Classifying Regimes & Computing Statistics...")
    products_enriched = {}
    regime_stats = {}
    for key, featured_df in products_featured.items():
        if not featured_df.empty:
            # By default, use M1-M12 as primary driver. (Could be customized per product later)
            enriched = run_regime_pipeline(featured_df, primary_driver="m1_m12")
            products_enriched[key] = enriched
            stats = compute_regime_statistics(enriched)
            regime_stats[key] = stats
            logger.info(f"  [{key}] Regimes classified. Transitions: {len(stats.get('transitions', {}))} states")
    
    ENGINE_STATE["products_enriched"] = products_enriched
    ENGINE_STATE["regime_stats"] = regime_stats
    
    # Step 7: Regression Modeling
    logger.info("\n[7/7] Running Regressions (Linear, Ridge, Lasso) per Regime...")
    
    structures = [s[0] for s in SPREAD_STRUCTURES] + [b[0] for b in BUTTERFLY_STRUCTURES]
    features_list = [
        "inv_level", "inv_change", "inv_pctl", "inv_zscore",
        "vol_20d", "vol_60d", "vol_20d_pctl",
        "dxy", "vix",
        "month_sin", "month_cos"
    ]
    
    regressions_db = {}
    
    for product, df in products_enriched.items():
        if df.empty:
            continue
            
        regressions_db[product] = {}
        for struct in structures:
            if struct not in df.columns:
                continue
                
            regressions_db[product][struct] = {}
            
            # Determine valid features for this product
            valid_features = [f for f in features_list if f in df.columns]
            
            # Regression per regime
            regimes_present = df["regime"].dropna().unique()
            for r in regimes_present:
                subset = df[df["regime"] == r]
                res = run_regression_pipeline(subset, target=struct, features=valid_features)
                regressions_db[product][struct][r] = res
                
            # Global regression (All regimes combined)
            res_all = run_regression_pipeline(df, target=struct, features=valid_features)
            regressions_db[product][struct]["ALL"] = res_all
            
            
        logger.info(f"  [{product}] Trained models for {len(structures)} structures across {len(regimes_present)} regimes.")
        
    ENGINE_STATE["regressions"] = regressions_db
    
    elapsed = time.time() - t0
    ENGINE_STATE["boot_time"] = elapsed
    ENGINE_STATE["status"] = "ready"
    
    logger.info("\n" + "=" * 60)
    logger.info(f"Engine ready in {elapsed:.1f}s")
    logger.info("=" * 60)


# ─── FastAPI Lifecycle ───
from paper_trader import start_paper_trader, PAPER_STATE

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run boot sequence on startup."""
    boot_engine()
    # Start paper trader AFTER engine is ready
    start_paper_trader(ENGINE_STATE)
    yield
    PAPER_STATE["is_running"] = False
    logger.info("Engine shutting down.")


# ─── FastAPI App ───
app = FastAPI(
    title="Energy Futures Analysis Engine",
    description="Phase 2: Regime-based market analysis for energy spreads and butterflies",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════
# API Routes
# ════════════════════════════════════════════

@app.get("/api/v2/status")
def get_status():
    """Engine health check."""
    return {
        "status": ENGINE_STATE["status"],
        "boot_time_seconds": ENGINE_STATE.get("boot_time"),
        "products_loaded": list(ENGINE_STATE["products_daily"].keys()),
        "macro_available": ENGINE_STATE["macro"] is not None and not ENGINE_STATE["macro"].empty,
        "inventory_available": ENGINE_STATE["inventory"] is not None and not ENGINE_STATE["inventory"].empty,
    }


@app.get("/api/v2/data/summary")
def get_data_summary():
    """
    Returns a summary of all loaded data: products, date ranges, 
    contract counts, and data quality metrics.
    """
    products_summary = {}
    
    for key, df in ENGINE_STATE["products_daily"].items():
        if df.empty:
            continue
        
        # Count valid contracts per column
        contract_stats = {}
        for col in df.columns:
            if col.startswith("c"):
                valid_count = df[col].notna().sum()
                contract_stats[col] = {
                    "valid_observations": int(valid_count),
                    "coverage_pct": round(valid_count / len(df) * 100, 1),
                    "latest_price": float(df[col].dropna().iloc[-1]) if valid_count > 0 else None,
                }
        
        products_summary[key] = {
            "name": PRODUCTS.get(key, {}).get("name", key),
            "exchange": PRODUCTS.get(key, {}).get("exchange", ""),
            "unit": PRODUCTS.get(key, {}).get("unit", ""),
            "total_days": len(df),
            "date_range": {
                "start": str(df.index.min().date()),
                "end": str(df.index.max().date()),
            },
            "contracts": contract_stats,
        }
    
    # Macro summary
    macro_summary = {}
    macro_df = ENGINE_STATE.get("macro")
    if macro_df is not None and not macro_df.empty:
        for col in macro_df.columns:
            series = macro_df[col].dropna()
            if len(series) > 0:
                macro_summary[col] = {
                    "observations": len(series),
                    "latest": float(series.iloc[-1]),
                    "date_range": {
                        "start": str(series.index.min().date()),
                        "end": str(series.index.max().date()),
                    },
                }
    
    # Inventory summary
    inv_summary = {}
    inv_df = ENGINE_STATE.get("inventory")
    if inv_df is not None and not inv_df.empty:
        inv_summary = {
            "observations": len(inv_df),
            "latest_level": float(inv_df["inv_level"].dropna().iloc[-1]),
            "latest_change": float(inv_df["inv_change"].dropna().iloc[-1]),
            "date_range": {
                "start": str(inv_df.index.min().date()),
                "end": str(inv_df.index.max().date()),
            },
        }
    
    return {
        "products": products_summary,
        "macro": macro_summary,
        "inventory": inv_summary,
        "engine_status": ENGINE_STATE["status"],
        "boot_time_seconds": ENGINE_STATE.get("boot_time"),
    }


@app.get("/api/v2/data/daily/{product}")
def get_daily_data(product: str, limit: int = 252):
    """
    Returns the most recent N daily observations for a product.
    Useful for charting the raw curve data.
    """
    product = product.upper()
    df = ENGINE_STATE["products_enriched"].get(product)
    
    if df is None or df.empty:
        return {"error": f"Product '{product}' not found", "available": list(ENGINE_STATE["products_enriched"].keys())}
    
    # Take last N rows
    subset = df.tail(limit)
    
    # Convert to JSON-serializable format
    records = []
    for date, row in subset.iterrows():
        record = {"date": str(date.date())}
        for col in row.index:
            val = row[col]
            if val is not None and not (isinstance(val, float) and (val != val)):  # NaN check
                record[col] = round(float(val), 6) if isinstance(val, float) else val
        records.append(record)
    
    return {
        "product": product,
        "count": len(records),
        "data": records,
    }


@app.get("/api/v2/regime/current/{product}")
def get_current_regime(product: str):
    """
    Returns the current regime classification and its explanation for a product.
    """
    product = product.upper()
    df = ENGINE_STATE["products_enriched"].get(product)
    
    if df is None or df.empty:
        return {"error": f"Product '{product}' not found"}
        
    latest_row = df.iloc[-1]
    explanation = explain_regime(latest_row)
    
    return {
        "product": product,
        "date": str(latest_row.name.date()),
        "regime": explanation
    }

@app.get("/api/v2/regime/history/{product}")
def get_regime_history(product: str):
    """
    Returns the full regime timeline and transition matrix for a product.
    """
    product = product.upper()
    df = ENGINE_STATE["products_enriched"].get(product)
    stats = ENGINE_STATE["regime_stats"].get(product)
    
    if df is None or df.empty or stats is None:
        return {"error": f"Product '{product}' not found"}
        
    # Extract regime timeline (date, regime)
    timeline = []
    for date, row in df.iterrows():
        if not pd.isna(row["regime"]):
            timeline.append({
                "date": str(date.date()),
                "regime": row["regime"]
            })
            
    return {
        "product": product,
        "timeline": timeline,
        "stats": stats
    }


@app.get("/api/v2/regression/{product}/{structure}")
def get_regression_results(product: str, structure: str, regime: str = "ALL"):
    """
    Returns regression models and feature importance for a product structure in a specific regime.
    """
    product = product.upper()
    structure = structure.lower()
    regime = regime.upper() if regime != "ALL" else "ALL"
    
    product_regs = ENGINE_STATE["regressions"].get(product)
    if not product_regs:
        return {"error": f"Product '{product}' not found in regressions"}
        
    struct_regs = product_regs.get(structure)
    if not struct_regs:
        return {"error": f"Structure '{structure}' not found", "available": list(product_regs.keys())}
        
    res = struct_regs.get(regime)
    if not res:
        return {"error": f"Regime '{regime}' not found", "available": list(struct_regs.keys())}
        
    return res


from signals import scan_opportunities

@app.get("/api/v2/signals/ranked")
def get_ranked_signals():
    """
    Returns a ranked list of the best market opportunities across all products and structures.
    """
    opportunities = scan_opportunities(
        ENGINE_STATE["products_enriched"], 
        ENGINE_STATE["regressions"],
        ENGINE_STATE["regime_stats"]
    )
    
    return {
        "count": len(opportunities),
        "opportunities": opportunities
    }


@app.get("/api/v2/regime/drivers/{product}")
def get_regime_drivers(product: str):
    """
    Returns the aggregated Lasso feature selection results for all regimes of a given product.
    This provides Regime Driver Analysis (Priority 6).
    """
    product = product.upper()
    product_regs = ENGINE_STATE["regressions"].get(product)
    
    if not product_regs:
        return {"error": f"Product '{product}' not found in regressions"}
        
    drivers = {}
    
    # We will use the primary structure m1_m12 as the canonical driver mapping
    struct_regs = product_regs.get("m1_m12", {})
    if not struct_regs:
        struct_regs = list(product_regs.values())[0] if product_regs else {}
        
    for regime_name, res in struct_regs.items():
        if regime_name == "ALL" or "error" in res:
            continue
            
        feat_imp = res.get("feature_importance", {})
        selected = feat_imp.get("selected", [])
        ignored = feat_imp.get("ignored", [])
        
        # Sort by absolute coefficient size
        selected.sort(key=lambda x: abs(x.get("coefficient", 0)), reverse=True)
        
        drivers[regime_name] = {
            "most_important": selected[:3] if selected else [],
            "ignored": [feat["feature"] for feat in ignored] if ignored else []
        }
        
    return {
        "product": product,
        "drivers": drivers
    }


from regression.rolling import run_rolling_regression

FEATURES = [
    "inv_level", "inv_change", "inv_pctl", "inv_zscore",
    "vol_20d", "vol_60d", "vol_20d_pctl",
    "dxy", "vix",
    "month_sin", "month_cos"
]

@app.get("/api/v2/regression/rolling/{product}/{structure}")
def get_rolling_regression(product: str, structure: str):
    """
    Runs a 252-day rolling regression for a specific product and structure.
    Returns the timeline of R2 and coefficients. (Priority 5)
    """
    product = product.upper()
    structure = structure.lower()
    
    df = ENGINE_STATE["products_enriched"].get(product)
    if df is None or df.empty:
        return {"error": f"Product '{product}' not found"}
        
    if structure not in df.columns:
        return {"error": f"Structure '{structure}' not found"}
        
    valid_features = [f for f in FEATURES if f in df.columns]
    rolling_df = run_rolling_regression(df, target=structure, features=valid_features, window=252)
    
    if rolling_df.empty:
        return {"error": "Not enough data for 252-day rolling regression"}
        
    # Convert to JSON records
    records = []
    for date, row in rolling_df.iterrows():
        record = {"date": str(date.date())}
        for col in row.index:
            val = row[col]
            if not pd.isna(val):
                record[col] = round(float(val), 4)
        records.append(record)
        
    return {
        "product": product,
        "structure": structure,
        "count": len(records),
        "data": records
    }

# ════════════════════════════════════════════
# Backtest Endpoints
# ════════════════════════════════════════════

from backtest import run_backtest

# In-memory cache so repeated UI calls don't re-run the whole backtest
_backtest_cache = {}

@app.get("/api/v2/backtest/{product}/{structure}")
def get_backtest(
    product: str,
    structure: str,
    roll_window: int = 60,
    entry_z: float = 2.0,
    exit_z: float = 0.3,
    stop_cushion: float = 0.5,
    max_hold: int = 30,
    regime_filter: str = "backwardation",  # "backwardation" | "contango" | "all"
    strategy_type: str = "basic_rolling",  # "basic_rolling" | "fair_value_residual"
):
    """
    Run (or retrieve cached) backtest for a product + structure.
    Returns full trade log, equity curve, Z-score series, and portfolio metrics.
    """
    product   = product.upper()
    structure = structure.lower()

    cache_key = f"{product}_{structure}_{roll_window}_{entry_z}_{exit_z}_{stop_cushion}_{max_hold}_{regime_filter}_{strategy_type}"

    if cache_key in _backtest_cache:
        return _backtest_cache[cache_key]

    df = ENGINE_STATE["products_enriched"].get(product)
    if df is None or df.empty:
        return {"error": f"Product '{product}' not found"}

    if structure not in df.columns:
        return {"error": f"Structure '{structure}' not found", "available": [c for c in df.columns if "_" in c]}

    # Map regime_filter parameter to actual regime labels
    if regime_filter == "backwardation":
        allowed = ["R4_BACKWARDATION", "R5_EXTREME_BACKWARDATION"]
    elif regime_filter == "contango":
        allowed = ["R1_DEEP_CONTANGO", "R2_CONTANGO"]
    elif regime_filter == "flat":
        allowed = ["R3_FLAT"]
    else:  # "all"
        allowed = None

    result = run_backtest(
        df,
        product=product,
        engine_state=ENGINE_STATE,
        structure=structure,
        roll_window=roll_window,
        entry_z=entry_z,
        exit_z=exit_z,
        stop_z=stop_cushion,
        max_hold=max_hold,
        allowed_regimes=allowed,
        strategy_type=strategy_type,
    )
    result["product"] = product
    _backtest_cache[cache_key] = result
    return result


# ════════════════════════════════════════════
# Paper Trading Endpoints
# ════════════════════════════════════════════

@app.get("/api/v2/paper/signals")
def get_paper_signals():
    """Returns the latest live signal snapshot for all watched instruments."""
    return {
        "signals":     list(PAPER_STATE["live_signals"].values()),
        "last_update": PAPER_STATE["last_update"],
        "is_running":  PAPER_STATE["is_running"],
    }


@app.get("/api/v2/paper/positions")
def get_paper_positions():
    """Returns all currently open paper trading positions with live mark-to-market PnL."""
    total_unrealized = sum(p.get("current_pnl", 0) for p in PAPER_STATE["open_positions"])
    return {
        "open_count":      len(PAPER_STATE["open_positions"]),
        "total_unrealized_pnl": round(total_unrealized, 2),
        "positions":       PAPER_STATE["open_positions"],
        "last_update":     PAPER_STATE["last_update"],
    }


@app.get("/api/v2/paper/trades")
def get_paper_trades():
    """Returns all closed paper trades with full PnL history."""
    trades = PAPER_STATE["closed_trades"]
    if not trades:
        return {"trade_count": 0, "total_realized_pnl": 0, "trades": []}

    pnls = [t.get("final_pnl", 0) for t in trades]
    winners = [p for p in pnls if p > 0]
    total_pnl = round(sum(pnls), 2)
    win_rate  = round(len(winners) / len(pnls) * 100, 1) if pnls else 0

    return {
        "trade_count":        len(trades),
        "total_realized_pnl": total_pnl,
        "win_rate":           win_rate,
        "avg_pnl":            round(sum(pnls) / len(pnls), 2) if pnls else 0,
        "trades":             trades,
    }


@app.post("/api/v2/paper/reset")
def reset_paper_trades():
    """Clears all open and closed paper trades (use with caution)."""
    PAPER_STATE["open_positions"] = []
    PAPER_STATE["closed_trades"]  = []
    PAPER_STATE["live_signals"]   = {}
    from paper_trader.engine import save_state
    save_state()
    return {"status": "reset", "message": "All paper trades cleared."}


@app.post("/api/v2/paper/force_tick")
def force_paper_tick():
    """Manually trigger a live price check and signal evaluation immediately."""
    from paper_trader.engine import run_tick
    try:
        run_tick(ENGINE_STATE)
        return {"status": "ok", "message": "Tick completed.", "signals": list(PAPER_STATE["live_signals"].values())}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# ════════════════════════════════════════════
# Main
# ════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000, log_level="info")
