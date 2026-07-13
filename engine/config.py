"""
Phase 2 Engine Configuration
All thresholds and parameters are centralized here for easy adjustment.
"""
import os
from pathlib import Path

# ─── Paths ───
PROJECT_ROOT = Path(__file__).parent.parent  # f:\dashboard 2
DATA_DIR = PROJECT_ROOT / "data"
ENGINE_DIR = PROJECT_ROOT / "engine"

# ─── Products ───
# Maps internal product key → CSV prefix pattern and display name
PRODUCTS = {
    "CL":  {"prefix": "CL",  "name": "WTI Crude Oil",   "exchange": "NYMEX", "unit": "$/bbl"},
    "LCO": {"prefix": "LCO", "name": "Brent Crude Oil",  "exchange": "ICE",   "unit": "$/bbl"},
    "HO":  {"prefix": "HO",  "name": "Heating Oil",      "exchange": "NYMEX", "unit": "$/gal"},
    "LGO": {"prefix": "LGO", "name": "ICE Gasoil",       "exchange": "ICE",   "unit": "$/mt"},
}

# ─── Regime Classification ───
# Primary driver: M1-M12 spread percentile
# Thresholds are (lower_pctl, upper_pctl) — configurable
REGIME_THRESHOLDS = {
    "R1_DEEP_CONTANGO":         (0,  20),
    "R2_CONTANGO":              (20, 40),
    "R3_FLAT":                  (40, 60),
    "R4_BACKWARDATION":         (60, 80),
    "R5_EXTREME_BACKWARDATION": (80, 100),
}

REGIME_LABELS = {
    "R1_DEEP_CONTANGO":         "Deep Contango",
    "R2_CONTANGO":              "Contango",
    "R3_FLAT":                  "Flat",
    "R4_BACKWARDATION":         "Backwardation",
    "R5_EXTREME_BACKWARDATION": "Extreme Backwardation",
}

REGIME_COLORS = {
    "R1_DEEP_CONTANGO":         "#ff4757",
    "R2_CONTANGO":              "#ff6b8a",
    "R3_FLAT":                  "#f5a623",
    "R4_BACKWARDATION":         "#00c48f",
    "R5_EXTREME_BACKWARDATION": "#00d4ff",
}

# ─── Curve Metrics ───
# Spread structures to compute: (front_month, back_month)
SPREAD_STRUCTURES = [
    ("m1_m2",  1, 2),
    ("m1_m3",  1, 3),
    ("m1_m6",  1, 6),
    ("m1_m12", 1, 12),
]

# Butterfly structures: (name, leg1, leg2_weight, leg2, leg3)
# Formula: c[leg1] - leg2_weight * c[leg2] + c[leg3]
BUTTERFLY_STRUCTURES = [
    ("fly_1_3_5",  1, 2, 3, 5),
    ("fly_1_6_12", 1, 2, 6, 12),
    ("fly_2_4_6",  2, 2, 4, 6),
    ("fly_3_6_9",  3, 2, 6, 9),
]

# ─── Volatility ───
VOL_WINDOWS = [20, 60]
ANNUALIZATION_FACTOR = 252  # Trading days per year

# ─── Regression ───
ROLLING_WINDOW = 252  # ~1 year
TRAIN_TEST_SPLIT = 0.8  # 80% train, 20% test (chronological)
CV_FOLDS = 5
RIDGE_ALPHAS = [0.01, 0.1, 1.0, 10.0, 100.0]
LASSO_ALPHAS = [0.0001, 0.001, 0.01, 0.1, 1.0]

# ─── Signal Generation ───
SIGNAL_THRESHOLDS = {
    "RICH":           2.0,
    "SLIGHTLY_RICH":  1.0,
    "FAIR":           0.0,
    "SLIGHTLY_CHEAP": -1.0,
    "CHEAP":          -2.0,
}

# ─── Opportunity Ranking Weights ───
RANKING_WEIGHTS = {
    "z_score_extremity":    0.40,
    "model_confidence":     0.25,
    "regime_confidence":    0.20,
    "sample_robustness":    0.15,
}

# ─── Macro ───
MACRO_SYMBOLS = {
    "DXY": "DX-Y.NYB",
    "VIX": "^VIX",
}

# EIA API for weekly crude inventory
EIA_CRUDE_INVENTORY_SERIES = "PET.WCESTUS1.W"
EIA_API_KEY = os.getenv("EIA_API_KEY", "")

# ─── Resampling ───
# Take the last available observation per day as daily "close"
RESAMPLE_METHOD = "last"
