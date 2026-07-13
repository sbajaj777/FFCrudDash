import sys
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)

# Add engine directory to path
sys.path.append(str(Path(__file__).parent))

from config import DATA_DIR
from ingest.csv_loader import load_all_products
from ingest.resampler import resample_all_products

def test_ingest():
    print(f"Testing ingestion from: {DATA_DIR}")
    
    # Test CSV loader
    print("\n--- Loading Raw CSVs ---")
    products_raw = load_all_products(DATA_DIR)
    for k, df in products_raw.items():
        print(f"  {k}: {len(df)} rows, columns: {list(df.columns)}")
        
    # Test Resampler
    print("\n--- Resampling to Daily ---")
    products_daily = resample_all_products(products_raw)
    for k, df in products_daily.items():
        print(f"  {k}: {len(df)} days")
        if not df.empty:
            print(f"    Date range: {df.index.min()} to {df.index.max()}")
            print(f"    Sample tail:\n{df.tail(2)}")

if __name__ == "__main__":
    test_ingest()
