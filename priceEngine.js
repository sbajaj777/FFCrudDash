// ─── utils/priceEngine.js ───
// Simulates live price feeds. Replace fetchPrice() with real API calls
// (Alpha Vantage, Yahoo Finance, Polygon.io) when you have API keys.

export const INITIAL_PRICES = {
  WTI:  { price: 78.42, change: 0.85,   pct:  1.09, name: 'WTI Crude',   unit: '$', decimals: 2 },
  BRN:  { price: 82.15, change: 0.92,   pct:  1.13, name: 'Brent',       unit: '$', decimals: 2 },
  DXY:  { price: 104.32, change: -0.18, pct: -0.17, name: 'DXY Index',   unit: '',  decimals: 2 },
  RBOB: { price: 2.4821, change: 0.031, pct:  1.27, name: 'RBOB Gas',    unit: '$', decimals: 4 },
  NG:   { price: 2.38,   change: -0.04, pct: -1.65, name: 'Nat Gas',     unit: '$', decimals: 2 },
  HO:   { price: 2.6540, change: 0.022, pct:  0.84, name: 'Heating Oil', unit: '$', decimals: 4 },
  CRACK:{ price: 24.80,  change: 0.42,  pct:  1.72, name: '3:2:1 Crack', unit: '$', decimals: 2 },
}

// Volatility per instrument (% move per tick)
const VOL = {
  WTI: 0.12, BRN: 0.11, DXY: 0.04, RBOB: 0.002,
  NG: 0.025, HO: 0.002, CRACK: 0.15,
}

export function tickPrices(prev) {
  const next = {}
  for (const key of Object.keys(prev)) {
    if (key === 'CRACK') continue // derived below
    const d = prev[key]
    const move = (Math.random() - 0.498) * VOL[key]
    const newPrice = +(d.price + move).toFixed(d.decimals)
    const newChange = +(d.change + move).toFixed(d.decimals)
    const newPct = newChange ? +(newChange / (newPrice - newChange) * 100).toFixed(2) : 0
    next[key] = { ...d, price: newPrice, change: newChange, pct: newPct }
  }
  // Derived: 3:2:1 crack = ((2 * RBOB * 42) + (HO * 42) - (3 * WTI)) / 3
  const rbobContrib = next.RBOB.price * 42 * 2
  const hoContrib   = next.HO.price * 42
  const crudeBase   = next.WTI.price * 3
  const crack321    = +((rbobContrib + hoContrib - crudeBase) / 3).toFixed(2)
  const prevCrack   = prev.CRACK.price
  next.CRACK = {
    ...prev.CRACK,
    price:  crack321,
    change: +(crack321 - prevCrack).toFixed(2),
    pct:    prevCrack ? +((crack321 - prevCrack) / prevCrack * 100).toFixed(2) : 0,
  }
  return next
}

// Generate synthetic intraday history (replace with API call)
export function generateHistory(basePrice, points = 78, vol = 0.6) {
  let price = basePrice - (Math.random() * vol * points * 0.3)
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    price += (Math.random() - 0.47) * vol
    return {
      t: new Date(now - (points - i) * 5 * 60 * 1000),
      y: +price.toFixed(2),
    }
  })
}

// Fair price model: EIA inventory level + DXY adjustment + crack spread signal
export function computeFairPrice(prices) {
  const live    = prices.WTI.price
  const invAdj  = -2.1                              // EIA draw this week
  const dxyAdj  = (104.5 - prices.DXY.price) * 0.42
  const crackAdj= (prices.CRACK.price - 22) * 0.28
  const fair    = +(live + invAdj + dxyAdj + crackAdj).toFixed(2)
  const gap     = +(live - fair).toFixed(2)
  const rallyFlag = Math.abs(prices.WTI.change) > 0.8
  return { live, fair, gap, rallyFlag }
}

export function formatPrice(price, decimals = 2, unit = '$') {
  return unit + price.toFixed(decimals)
}

export function formatChange(change, pct, decimals = 2) {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(decimals)} (${sign}${pct.toFixed(2)}%)`
}
