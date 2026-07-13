// ─── FFCrudeDash Price Engine ───
// All formatting utilities and derived calculations

export function formatPrice(price, decimals = 2, unit = '$') {
  if (price == null || isNaN(price)) return '—'
  return unit + Number(price).toFixed(decimals)
}

export function formatChange(change, pct, decimals = 2) {
  if (change == null || isNaN(change)) return '—'
  const sign = change >= 0 ? '+' : ''
  return `${sign}${Number(change).toFixed(decimals)} (${sign}${Number(pct).toFixed(2)}%)`
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatSigned(value, decimals = 0) {
  if (!Number.isFinite(value)) return '—'
  const v = decimals ? value.toFixed(decimals) : new Intl.NumberFormat('en-US').format(value)
  return `${value >= 0 ? '+' : ''}${v}`
}

export function formatVolume(vol) {
  if (!vol) return '—'
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B'
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M'
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
  return vol.toString()
}

export function computeCrackSpread(prices) {
  const rbob = prices?.RBOB?.price || 0
  const ho = prices?.HO?.price || 0
  const wti = prices?.WTI?.price || 0
  if (!rbob || !ho || !wti) return null
  return +((rbob * 42 * 2 + ho * 42 - wti * 3) / 3).toFixed(2)
}

export function computeBrentWTISpread(prices) {
  const brn = prices?.BRN?.price || 0
  const wti = prices?.WTI?.price || 0
  if (!brn || !wti) return null
  return +(brn - wti).toFixed(2)
}

// Generate forward curve from spot price (derived model)
export function generateForwardCurve(spotPrice, months = 12, shape = 'contango') {
  const curve = []
  const monthLabels = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12']
  for (let i = 0; i < months; i++) {
    let factor
    if (shape === 'contango') {
      factor = 1 - (i * 0.008) - (i * i * 0.0003)  // gentle downward slope
    } else {
      factor = 1 + (i * 0.005)  // backwardation: future months cost more
    }
    curve.push({
      month: monthLabels[i],
      price: +(spotPrice * factor).toFixed(2),
      index: i,
    })
  }
  return curve
}

// Compute fair value model
export function computeFairValue(prices) {
  const wti = prices?.WTI?.price || 0
  if (!wti) return null
  const dxy = prices?.DXY?.price || 104
  const crack = prices?.CRACK?.price || 24
  const brn = prices?.BRN?.price || wti + 3.5

  // Multi-factor fair value model
  const invAdj = -1.8        // inventory adjustment (assume slight draw)
  const dxyAdj = (104.5 - dxy) * 0.38  // dollar effect
  const crackAdj = (crack - 22) * 0.25  // crack demand signal
  const spreadAdj = ((brn - wti) - 3.5) * 0.15  // international demand
  const seasonal = Math.sin((new Date().getMonth() / 12) * 2 * Math.PI) * 1.2  // seasonal

  const fair = +(wti + invAdj + dxyAdj + crackAdj + spreadAdj + seasonal).toFixed(2)
  const gap = +(wti - fair).toFixed(2)
  const signal = gap > 2 ? 'OVERVALUED' : gap < -2 ? 'UNDERVALUED' : 'FAIR'

  return {
    live: wti,
    fair,
    gap,
    signal,
    factors: {
      inventory: +invAdj.toFixed(2),
      dollar: +dxyAdj.toFixed(2),
      crack: +crackAdj.toFixed(2),
      spread: +spreadAdj.toFixed(2),
      seasonal: +seasonal.toFixed(2),
    }
  }
}
