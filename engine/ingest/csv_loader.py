"""
CSV Loader — Auto-discovers and parses energy futures CSV files.

Handles the proprietary format:
    #meta:1min||contract_num||field
    timestamp, c1||contract, c1||weighted_mid, c2||contract, c2||weighted_mid, ...

Returns a dict of {product_key: DataFrame} where each DataFrame has:
    - index: timestamp (datetime)
    - columns: c1, c2, ..., c14 (weighted mid prices as float)
"""
import pandas as pd
import numpy as np
from pathlib import Path
import re
import logging

logger = logging.getLogger(__name__)


def discover_csv_files(data_dir: Path) -> dict:
    """
    Scan the data directory and map each CSV to a product key.
    
    Returns:
        {
            "CL":  [Path("CL_data.csv")],
            "LCO": [Path("LCO_data.csv"), Path("LCOSettle 2.csv")],
            ...
        }
    """
    csv_files = sorted(data_dir.glob("*.csv"))
    
    # Product prefix patterns — order matters (longest prefix first)
    product_patterns = [
        ("LCO", re.compile(r"^LCO", re.IGNORECASE)),
        ("LGO", re.compile(r"^LGO", re.IGNORECASE)),
        ("CL",  re.compile(r"^CL",  re.IGNORECASE)),
        ("HO",  re.compile(r"^HO",  re.IGNORECASE)),
        ("RB",  re.compile(r"^RB",  re.IGNORECASE)),  # RBOB if added later
    ]
    
    # Special files that span multiple products
    multi_product_patterns = [
        ("WTCL_LCO", re.compile(r"^wtcl_lco", re.IGNORECASE)),
    ]
    
    discovered = {}
    multi_product = {}
    
    for csv_path in csv_files:
        name = csv_path.stem
        matched = False
        
        # Check multi-product first
        for key, pattern in multi_product_patterns:
            if pattern.match(name):
                multi_product.setdefault(key, []).append(csv_path)
                matched = True
                break
        
        if not matched:
            for key, pattern in product_patterns:
                if pattern.match(name):
                    discovered.setdefault(key, []).append(csv_path)
                    matched = True
                    break
        
        if not matched:
            logger.warning(f"Unrecognized CSV file: {csv_path.name}")
    
    logger.info(f"Discovered {sum(len(v) for v in discovered.values())} product CSV files: "
                f"{', '.join(f'{k}({len(v)})' for k, v in discovered.items())}")
    if multi_product:
        logger.info(f"Discovered {sum(len(v) for v in multi_product.values())} multi-product files: "
                    f"{', '.join(f'{k}({len(v)})' for k, v in multi_product.items())}")
    
    return discovered, multi_product


def _detect_file_format(filepath: Path) -> str:
    """
    Detect whether a CSV is in the 1-min outright format or the settlement format.
    
    Returns: "outright_1min" | "settlement_daily" | "unknown"
    """
    with open(filepath, "r", encoding="utf-8") as f:
        first_line = f.readline().strip()
        second_line = f.readline().strip()
    
    if first_line.startswith("#meta:1min"):
        return "outright_1min"
    
    # Settlement format: first row has contract names like "LCOc1,LCOc1,..."
    if "Timestamp" in second_line and "SETTLE" in second_line:
        return "settlement_daily"
    
    return "unknown"


def parse_outright_1min(filepath: Path) -> pd.DataFrame:
    """
    Parse the 1-min outright format into a clean DataFrame.
    
    Input format:
        #meta:1min||contract_num||field
        timestamp, c1||contract, c1||weighted_mid, c2||contract, ...
        2021-01-04 01:00:00+00:00, CLG1, 48.424, CLH1, 48.61, ...
    
    Output:
        DataFrame with DatetimeIndex and columns c1, c2, ..., c14 (float prices)
    """
    logger.info(f"Parsing outright 1-min file: {filepath.name} ({filepath.stat().st_size / 1e6:.0f} MB)")
    
    # Read header to determine column structure
    with open(filepath, "r", encoding="utf-8") as f:
        meta_line = f.readline()  # #meta:1min||...
        header_line = f.readline().strip()
    
    headers = [h.strip() for h in header_line.split(",")]
    
    # Identify which columns are weighted_mid prices
    # Pattern: c1||weighted_mid, c2||weighted_mid, etc.
    price_cols = {}  # {column_index: "c1", "c2", ...}
    contract_cols = {}  # {column_index: "c1_contract", ...}
    
    for i, h in enumerate(headers):
        if "weighted_mid" in h:
            # Extract contract number: "c1||weighted_mid" → "c1"
            contract_num = h.split("||")[0].strip()
            price_cols[i] = contract_num
        elif "contract" in h and i > 0:
            contract_num = h.split("||")[0].strip()
            contract_cols[i] = f"{contract_num}_contract"
    
    # Read CSV, skipping the meta line
    # Use only timestamp + price columns for memory efficiency
    usecols = [0] + list(price_cols.keys())
    col_names = ["timestamp"] + list(price_cols.values())
    
    df = pd.read_csv(
        filepath,
        skiprows=1,  # Skip #meta line
        usecols=usecols,
        names=col_names,
        header=0,  # The actual header is row 1 (after skip)
        parse_dates=["timestamp"],
        low_memory=False,
    )
    
    # The column names from usecols mapping might not align perfectly.
    # Let's re-read more carefully:
    df = pd.read_csv(
        filepath,
        skiprows=1,   # Skip #meta line
        header=0,
        low_memory=False,
    )
    
    # Rename columns based on detected structure
    # First column is always timestamp
    ts_col = df.columns[0]
    df[ts_col] = pd.to_datetime(df[ts_col], utc=True, errors="coerce")
    df = df.set_index(ts_col)
    df.index.name = "timestamp"
    
    # Extract only weighted_mid columns
    mid_columns = {}
    for col in df.columns:
        col_stripped = col.strip()
        if "weighted_mid" in col_stripped:
            contract_num = col_stripped.split("||")[0].strip()
            mid_columns[col] = contract_num
    
    # Select and rename
    price_df = df[list(mid_columns.keys())].rename(columns=mid_columns)
    
    # Convert to float
    for col in price_df.columns:
        price_df[col] = pd.to_numeric(price_df[col], errors="coerce")
    
    logger.info(f"  → Parsed {len(price_df)} rows, {len(price_df.columns)} contracts "
                f"({price_df.index.min().date()} → {price_df.index.max().date()})")
    
    return price_df


def parse_settlement_daily(filepath: Path) -> pd.DataFrame:
    """
    Parse the daily settlement format (e.g., LCOSettle 2.csv).
    
    Input format:
        LCOc1,LCOc1,LCOc2,LCOc2,...
        Timestamp,SETTLE,Timestamp,SETTLE,...
        26-05-26,99.58,26-05-26,96.67,...
    
    Output:
        DataFrame with DatetimeIndex, columns c1, c2, ..., c31
    """
    logger.info(f"Parsing settlement file: {filepath.name}")
    
    # Read the first row to get contract identifiers
    with open(filepath, "r", encoding="utf-8") as f:
        contract_row = f.readline().strip().split(",")
        field_row = f.readline().strip().split(",")
    
    # Build column mapping: pairs of (Timestamp, SETTLE) for each contract
    df = pd.read_csv(filepath, skiprows=2, header=None)
    
    # Extract settlement prices — every odd-indexed column (1, 3, 5, ...)
    # and dates from every even-indexed column (0, 2, 4, ...)
    settle_data = {}
    date_col = None
    
    for i in range(0, len(contract_row), 2):
        contract_name = contract_row[i].strip()  # e.g., "LCOc1"
        # Extract contract number
        match = re.search(r"c(\d+)", contract_name)
        if match:
            c_num = f"c{match.group(1)}"
            if date_col is None:
                date_col = df.iloc[:, i]
            settle_data[c_num] = pd.to_numeric(df.iloc[:, i + 1], errors="coerce")
    
    result = pd.DataFrame(settle_data)
    
    # Parse dates
    dates = pd.to_datetime(date_col, format="%d-%m-%y", errors="coerce")
    result.index = dates
    result.index.name = "timestamp"
    result = result.sort_index()
    result = result.dropna(how="all")
    
    logger.info(f"  → Parsed {len(result)} rows, {len(result.columns)} contracts "
                f"({result.index.min().date()} → {result.index.max().date()})")
    
    return result


def load_product_data(product_key: str, file_paths: list) -> pd.DataFrame:
    """
    Load all CSV files for a given product, selecting the best available source.
    
    Priority:
        1. Settlement daily files (already daily, highest quality)
        2. Primary _data.csv files (1-min, most complete)
        3. Other outright files
    """
    settlement_dfs = []
    outright_dfs = []
    
    for fp in file_paths:
        fmt = _detect_file_format(fp)
        if fmt == "settlement_daily":
            settlement_dfs.append(parse_settlement_daily(fp))
        elif fmt == "outright_1min":
            outright_dfs.append(parse_outright_1min(fp))
        else:
            logger.warning(f"Skipping unrecognized format: {fp.name}")
    
    # Prefer the primary _data.csv (usually the most complete 1-min file)
    # For each product, pick the file with the most data points
    if outright_dfs:
        # Sort by row count descending, take the largest
        outright_dfs.sort(key=lambda df: len(df), reverse=True)
        primary = outright_dfs[0]
        logger.info(f"[{product_key}] Using primary outright file: {len(primary)} rows")
        return primary
    elif settlement_dfs:
        settlement_dfs.sort(key=lambda df: len(df), reverse=True)
        primary = settlement_dfs[0]
        logger.info(f"[{product_key}] Using settlement file: {len(primary)} rows")
        return primary
    
    logger.error(f"[{product_key}] No valid data found!")
    return pd.DataFrame()


def load_all_products(data_dir: Path) -> dict:
    """
    Master function: discover all CSVs, parse them, return dict of DataFrames.
    
    Returns:
        {
            "CL":  DataFrame (1-min or daily, columns c1..c14),
            "LCO": DataFrame,
            "HO":  DataFrame,
            "LGO": DataFrame,
        }
    """
    discovered, multi_product = discover_csv_files(data_dir)
    
    products = {}
    for product_key, file_paths in discovered.items():
        products[product_key] = load_product_data(product_key, file_paths)
    
    return products
