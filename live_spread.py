"""
Live WTI Crude Oil Spread Calculator
Fetches real-time prices from Yahoo Finance and calculates:
- M1-M2 (prompt spread for trading signals)
- M1-M12 (curve structure for regime classification)
"""
import requests
from datetime import datetime

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
}

# As of June 2026:
# M1 = August 2026 contract (CLQ26)
# M2 = September 2026 contract (CLU26)
# M12 = August 2027 contract (CLQ27)
CONTRACTS = {
    "M1  (Aug 2026)": "CLQ26.NYM",
    "M2  (Sep 2026)": "CLU26.NYM",
    "M3  (Oct 2026)": "CLV26.NYM",
    "M6  (Jan 2027)": "CLF27.NYM",
    "M12 (Aug 2027)": "CLQ27.NYM",
}

def get_price(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=1d&interval=1m"
    try:
        r = requests.get(url, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            d = r.json()
            meta = d["chart"]["result"][0]["meta"]
            return meta.get("regularMarketPrice")
    except Exception as e:
        print(f"  Error fetching {ticker}: {e}")
    return None

def classify_regime(m1_m12):
    if m1_m12 > 6:   return "EXTREME BACKWARDATION (80-100th pctl)"
    if m1_m12 > 3:   return "BACKWARDATION (60-80th pctl)"
    if m1_m12 > -1:  return "FLAT (40-60th pctl)"
    if m1_m12 > -4:  return "CONTANGO (20-40th pctl)"
    return "DEEP CONTANGO (0-20th pctl)"

def signal_from_zscore(z):
    if z > 2.0:    return "SELL SPREAD (RICH)"
    if z > 1.0:    return "SLIGHT SELL (SLIGHTLY RICH)"
    if z < -2.0:   return "BUY SPREAD (CHEAP)"
    if z < -1.0:   return "SLIGHT BUY (SLIGHTLY CHEAP)"
    return "NEUTRAL (FAIR VALUE)"

if __name__ == "__main__":
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print("=" * 55)
    print("  WTI CRUDE OIL - LIVE FORWARD CURVE SNAPSHOT")
    print(f"  Time: {now}")
    print("=" * 55)

    prices = {}
    for label, ticker in CONTRACTS.items():
        p = get_price(ticker)
        prices[label] = p
        status = f"${p:.3f}" if p else "UNAVAILABLE"
        print(f"  {label}: {status}")

    print()
    print("-" * 55)
    print("  SPREAD ANALYSIS")
    print("-" * 55)

    m1 = prices.get("M1  (Aug 2026)")
    m2 = prices.get("M2  (Sep 2026)")
    m12 = prices.get("M12 (Aug 2027)")

    if m1 and m2:
        m1_m2 = round(m1 - m2, 3)
        print(f"  M1-M2  Spread : ${m1_m2:+.3f}")
    else:
        m1_m2 = None
        print("  M1-M2  Spread : N/A")

    if m1 and m12:
        m1_m12 = round(m1 - m12, 3)
        print(f"  M1-M12 Spread : ${m1_m12:+.3f}")
        print()
        print("-" * 55)
        print("  REGIME CLASSIFICATION (vs 2-year history)")
        print("-" * 55)
        regime = classify_regime(m1_m12)
        print(f"  Current Regime: {regime}")
    else:
        m1_m12 = None
        print("  M1-M12 Spread : N/A")

    print()
    print("  NOTE: Z-Score signal requires historical context from")
    print("  your engine. Rule of thumb thresholds shown above.")
    print("=" * 55)
