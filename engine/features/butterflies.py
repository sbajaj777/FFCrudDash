"""
Butterflies — Computes butterfly spread structures
"""
import pandas as pd
from config import BUTTERFLY_STRUCTURES

def compute_butterflies(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute defined butterfly structures.
    Adds new columns (e.g., "fly_1_3_5") to the DataFrame.
    """
    for name, leg1, leg2_weight, leg2, leg3 in BUTTERFLY_STRUCTURES:
        c_leg1 = f"c{leg1}"
        c_leg2 = f"c{leg2}"
        c_leg3 = f"c{leg3}"
        
        if c_leg1 in df.columns and c_leg2 in df.columns and c_leg3 in df.columns:
            df[name] = df[c_leg1] - (leg2_weight * df[c_leg2]) + df[c_leg3]
        else:
            df[name] = pd.NA
            
    return df
