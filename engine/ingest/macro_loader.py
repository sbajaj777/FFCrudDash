"""
Macro Data Loader — Fetches historical DXY, VIX, and EIA inventory data.

Uses yfinance for DXY and VIX.
Uses the EIA API (v2) for weekly crude oil inventory.
All data is aligned to daily frequency and merged with product data.
"""
import pandas as pd
import numpy as np
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


def fetch_macro_yfinance(symbols: dict, start_date: str = "2020-01-01") -> pd.DataFrame:
    """
    Fetch historical daily close prices for macro indicators via yfinance.
    
    Args:
        symbols: {"DXY": "DX-Y.NYB", "VIX": "^VIX"}
        start_date: Start date string (YYYY-MM-DD)
    
    Returns:
        DataFrame with DatetimeIndex, columns: DXY, VIX
    """
    try:
        import yfinance as yf
    except ImportError:
        logger.error("yfinance not installed. Run: pip install yfinance")
        return pd.DataFrame()
    
    macro_data = {}
    
    for name, ticker in symbols.items():
        try:
            logger.info(f"Fetching {name} ({ticker}) from Yahoo Finance...")
            data = yf.download(ticker, start=start_date, progress=False, auto_adjust=True)
            if data is not None and not data.empty:
                # Use Close price
                close = data["Close"]
                if isinstance(close, pd.DataFrame):
                    close = close.iloc[:, 0]
                macro_data[name] = close
                logger.info(f"  → {name}: {len(close)} daily observations "
                           f"({close.index.min().date()} → {close.index.max().date()})")
            else:
                logger.warning(f"  → {name}: No data returned")
        except Exception as e:
            logger.warning(f"  → {name} failed: {e}")
    
    if not macro_data:
        return pd.DataFrame()
    
    result = pd.DataFrame(macro_data)
    result.columns = [col.lower() for col in result.columns] # lowercase dxy and vix
    result.index = pd.to_datetime(result.index)
    result.index.name = "date"
    
    # Remove timezone if present
    if result.index.tz is not None:
        result.index = result.index.tz_localize(None)
    
    # Forward-fill weekends/holidays (macro data has gaps)
    result = result.fillna(method="ffill", limit=5)
    
    return result


def fetch_eia_inventory(api_key: str = "", start_date: str = "2020-01-01") -> pd.DataFrame:
    """
    Fetch weekly U.S. crude oil inventory from the EIA API.
    
    Returns:
        DataFrame with DatetimeIndex (weekly), columns:
        - inv_level: Total commercial crude stocks (thousand barrels)
        - inv_change: Week-over-week change
    """
    if not api_key:
        logger.warning("No EIA API key provided. Skipping inventory data.")
        logger.info("Set EIA_API_KEY environment variable or provide key in config.")
        return _generate_synthetic_inventory(start_date)
    
    try:
        import urllib.request
        import json
        
        url = (f"https://api.eia.gov/v2/petroleum/stoc/wstk/data/"
               f"?api_key={api_key}"
               f"&frequency=weekly"
               f"&data[0]=value"
               f"&facets[product][]=EPC0"
               f"&facets[process][]=SAE"
               f"&sort[0][column]=period"
               f"&sort[0][direction]=asc"
               f"&start={start_date}")
        
        logger.info("Fetching EIA crude inventory data...")
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read())
        
        records = data.get("response", {}).get("data", [])
        if not records:
            logger.warning("EIA API returned no data")
            return _generate_synthetic_inventory(start_date)
        
        inv_df = pd.DataFrame(records)
        inv_df["date"] = pd.to_datetime(inv_df["period"])
        inv_df["inv_level"] = pd.to_numeric(inv_df["value"], errors="coerce")
        inv_df = inv_df.set_index("date").sort_index()
        inv_df["inv_change"] = inv_df["inv_level"].diff()
        
        logger.info(f"  → EIA: {len(inv_df)} weekly observations")
        
        return inv_df[["inv_level", "inv_change"]]
        
    except Exception as e:
        logger.warning(f"EIA API failed: {e}")
        return _generate_synthetic_inventory(start_date)


def _generate_synthetic_inventory(start_date: str) -> pd.DataFrame:
    """
    Generate a placeholder inventory series when EIA API is unavailable.
    Uses a sine-wave pattern with noise to simulate seasonal inventory cycles.
    This is clearly marked as synthetic in the dashboard.
    """
    logger.info("Generating synthetic inventory placeholder (EIA API unavailable)")
    
    dates = pd.date_range(start=start_date, end=datetime.now(), freq="W-WED")
    n = len(dates)
    
    # Base level ~430M barrels with seasonal variation
    base = 430_000
    seasonal = 20_000 * np.sin(2 * np.pi * np.arange(n) / 52)  # Annual cycle
    trend = np.linspace(0, -10_000, n)  # Slight downtrend
    noise = np.random.normal(0, 3_000, n)
    
    levels = base + seasonal + trend + noise
    
    df = pd.DataFrame({
        "inv_level": levels,
        "inv_change": np.concatenate([[0], np.diff(levels)]),
    }, index=dates)
    df.index.name = "date"
    
    return df


def merge_macro_with_daily(daily_df: pd.DataFrame, macro_df: pd.DataFrame, 
                           inv_df: pd.DataFrame) -> pd.DataFrame:
    """
    Merge macro indicators and inventory data into a product's daily DataFrame.
    Uses forward-fill to align weekly inventory to daily frequency.
    
    Args:
        daily_df: Product daily prices (c1, c2, ...)
        macro_df: DXY, VIX daily
        inv_df: inv_level, inv_change weekly
    
    Returns:
        Merged DataFrame with all columns
    """
    result = daily_df.copy()
    
    # Remove timezone from index if present
    if result.index.tz is not None:
        result.index = result.index.tz_localize(None)
    
    # Merge macro (daily → daily, straightforward)
    if not macro_df.empty:
        macro_aligned = macro_df.reindex(result.index, method="ffill")
        for col in macro_df.columns:
            result[col] = macro_aligned[col]
    
    # Merge inventory (weekly → daily via forward-fill)
    if not inv_df.empty:
        inv_daily = inv_df.reindex(result.index, method="ffill")
        for col in inv_df.columns:
            result[col] = inv_daily[col]
    
    return result
