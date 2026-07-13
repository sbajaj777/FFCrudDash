"""
Curve Metrics — Computes spreads (M1-M2, M1-M6, etc.)
"""
import pandas as pd
from config import SPREAD_STRUCTURES

def compute_spreads(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute defined spread structures based on c1, c2, etc. columns.
    Adds new columns (e.g., "m1_m2") to the DataFrame.
    """
    for name, leg1, leg2 in SPREAD_STRUCTURES:
        c_leg1 = f"c{leg1}"
        c_leg2 = f"c{leg2}"
        
        if c_leg1 in df.columns and c_leg2 in df.columns:
            df[name] = df[c_leg1] - df[c_leg2]
        else:
            df[name] = pd.NA
            
    return df
