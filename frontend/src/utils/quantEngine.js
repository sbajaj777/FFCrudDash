// ─── FFCrudeDash Quant Engine ───
// Z-Score, Rolling Volatility, PCA, Bollinger Bands, Moving Averages

// ── Rolling Z-Score ──
export function rollingZScore(series, window = 20) {
  if (!series || series.length < window) return []
  const result = []
  for (let i = window - 1; i < series.length; i++) {
    const slice = series.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
    const std = Math.sqrt(variance)
    const z = std > 0 ? (series[i] - mean) / std : 0
    result.push(+z.toFixed(4))
  }
  return result
}

// ── Spread Z-Score (for two series) ──
export function spreadZScore(seriesA, seriesB, window = 60) {
  if (!seriesA || !seriesB) return []
  const len = Math.min(seriesA.length, seriesB.length)
  const spread = []
  for (let i = 0; i < len; i++) {
    spread.push(seriesA[i] - seriesB[i])
  }
  return rollingZScore(spread, window)
}

// ── Rolling Volatility (annualized) ──
export function rollingVolatility(closes, window = 30) {
  if (!closes || closes.length < window + 1) return []
  // Compute log returns
  const returns = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]))
    } else {
      returns.push(0)
    }
  }
  // Rolling std of returns * sqrt(252)
  const result = []
  for (let i = window - 1; i < returns.length; i++) {
    const slice = returns.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (slice.length - 1)
    const annVol = Math.sqrt(variance) * Math.sqrt(252) * 100
    result.push(+annVol.toFixed(2))
  }
  return result
}

// ── Simple Moving Average ──
export function sma(series, window) {
  if (!series || series.length < window) return []
  const result = []
  for (let i = window - 1; i < series.length; i++) {
    const avg = series.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0) / window
    result.push(+avg.toFixed(4))
  }
  return result
}

// ── Exponential Moving Average ──
export function ema(series, window) {
  if (!series || series.length < 1) return []
  const k = 2 / (window + 1)
  const result = [series[0]]
  for (let i = 1; i < series.length; i++) {
    result.push(+(series[i] * k + result[i - 1] * (1 - k)).toFixed(4))
  }
  return result
}

// ── Bollinger Bands ──
export function bollingerBands(series, window = 20, numStd = 2) {
  if (!series || series.length < window) return { upper: [], middle: [], lower: [] }
  const middle = sma(series, window)
  const upper = []
  const lower = []
  for (let i = window - 1; i < series.length; i++) {
    const slice = series.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length
    const std = Math.sqrt(variance)
    upper.push(+(mean + numStd * std).toFixed(4))
    lower.push(+(mean - numStd * std).toFixed(4))
  }
  return { upper, middle, lower }
}

// ── RSI ──
export function rsi(closes, period = 14) {
  if (!closes || closes.length < period + 1) return []
  const result = []
  let gainSum = 0, lossSum = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gainSum += diff; else lossSum -= diff
  }
  let avgGain = gainSum / period
  let avgLoss = lossSum / period
  result.push(avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    const gain = diff > 0 ? diff : 0
    const loss = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    result.push(avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(2))
  }
  return result
}

// ── MACD ──
export function macd(closes, fast = 12, slow = 26, signal = 9) {
  if (!closes || closes.length < slow) return { macd: [], signal: [], histogram: [] }
  const emaFast = ema(closes, fast)
  const emaSlow = ema(closes, slow)
  const macdLine = emaFast.map((v, i) => +(v - emaSlow[i]).toFixed(4))
  const signalLine = ema(macdLine.slice(slow - 1), signal)
  const padded = new Array(slow - 1 + signal - 1).fill(null)
  const histogram = signalLine.map((s, i) => {
    const m = macdLine[slow - 1 + i]
    return m != null && s != null ? +(m - s).toFixed(4) : null
  })
  return { macd: macdLine, signal: [...padded, ...signalLine], histogram: [...padded, ...histogram] }
}

// ── Pearson Correlation ──
export function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length)
  if (n < 3) return 0
  const xSlice = x.slice(-n)
  const ySlice = y.slice(-n)
  const meanX = xSlice.reduce((a, b) => a + b, 0) / n
  const meanY = ySlice.reduce((a, b) => a + b, 0) / n
  let num = 0, denX = 0, denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX
    const dy = ySlice[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : +(num / den).toFixed(4)
}

// ── Correlation Matrix ──
export function correlationMatrix(seriesMap, keys, window = 90) {
  const matrix = {}
  for (const rowKey of keys) {
    matrix[rowKey] = {}
    for (const colKey of keys) {
      if (rowKey === colKey) {
        matrix[rowKey][colKey] = 1.0
      } else {
        const x = (seriesMap[rowKey] || []).slice(-window)
        const y = (seriesMap[colKey] || []).slice(-window)
        matrix[rowKey][colKey] = pearsonCorrelation(x, y)
      }
    }
  }
  return matrix
}

// ── Simple PCA (Power iteration for top-k eigenvectors) ──
export function pcaDecomposition(seriesMap, keys, window = 90) {
  // Standardize returns
  const returnsMap = {}
  for (const key of keys) {
    const closes = (seriesMap[key] || []).slice(-window)
    const rets = []
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > 0 && closes[i - 1] > 0) {
        rets.push((closes[i] - closes[i - 1]) / closes[i - 1])
      } else {
        rets.push(0)
      }
    }
    // Standardize
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length
    const std = Math.sqrt(rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length) || 1
    returnsMap[key] = rets.map(r => (r - mean) / std)
  }

  // Correlation matrix
  const n = keys.length
  const corrMatrix = []
  for (let i = 0; i < n; i++) {
    corrMatrix[i] = []
    for (let j = 0; j < n; j++) {
      corrMatrix[i][j] = pearsonCorrelation(returnsMap[keys[i]], returnsMap[keys[j]])
    }
  }

  // Power iteration for eigenvalues (simplified)
  const eigenvalues = []
  const eigenvectors = []
  const mat = corrMatrix.map(row => [...row])

  for (let k = 0; k < Math.min(3, n); k++) {
    let vec = Array.from({ length: n }, () => Math.random())
    let eigenvalue = 0

    for (let iter = 0; iter < 100; iter++) {
      // Multiply mat * vec
      const newVec = new Array(n).fill(0)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          newVec[i] += mat[i][j] * vec[j]
        }
      }
      // Normalize
      eigenvalue = Math.sqrt(newVec.reduce((a, b) => a + b * b, 0))
      if (eigenvalue === 0) break
      vec = newVec.map(v => v / eigenvalue)
    }

    eigenvalues.push(+eigenvalue.toFixed(4))
    eigenvectors.push(vec.map(v => +v.toFixed(4)))

    // Deflate matrix
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        mat[i][j] -= eigenvalue * vec[i] * vec[j]
      }
    }
  }

  const totalVar = eigenvalues.reduce((a, b) => a + b, 0) || 1
  const explained = eigenvalues.map(e => +((e / totalVar) * 100).toFixed(1))

  return {
    eigenvalues,
    eigenvectors,
    explained,
    keys,
    components: eigenvectors.map((vec, idx) => ({
      name: `PC${idx + 1}`,
      explained: explained[idx],
      loadings: Object.fromEntries(keys.map((k, i) => [k, vec[i]])),
    })),
  }
}

// ── ATR (Average True Range) ──
export function atr(highs, lows, closes, period = 14) {
  if (!highs || highs.length < period + 1) return []
  const tr = [highs[0] - lows[0]]
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1])))
  }
  const result = []
  let sum = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(+sum.toFixed(4))
  for (let i = period; i < tr.length; i++) {
    sum = (sum * (period - 1) + tr[i]) / period
    result.push(+sum.toFixed(4))
  }
  return result
}

// ══════════════════════════════════════════════════════════
// REAL ANALYTICS — Defensible methodologies
// ══════════════════════════════════════════════════════════

// ── FUNDAMENTAL ENERGY SENTIMENT ──
// Method: Composite score based on fundamental drivers
// 1. EIA Inventory: Draw = Bullish, Build = Bearish
// 2. CFTC Positioning: Net Long increasing = Bullish, decreasing = Bearish
// 3. Crack Spread: >$20 = Bullish, <$15 = Bearish
export function computeFundamentalSentiment(eia, cftc, prices) {
  let scoreTotal = 0
  const breakdown = {}
  const expectedComponents = 5

  // 1. EIA crude inventory (Max Weight: 30)
  // Normal Draw > 1m bbls, Extreme > 5m bbls
  const eiaKey = Object.keys(eia || {})[0]
  const eiaSeries = eia?.[eiaKey]?.series
  if (eiaSeries && eiaSeries.length >= 2) {
    const latest = eiaSeries[0].value
    const prev = eiaSeries[1].value
    const change = latest - prev
    
    let eiaScore = 0
    let bias = 'NEUTRAL'
    if (change < -5000) { eiaScore = 30; bias = 'BULLISH' } // Massive Draw
    else if (change < -1000) { eiaScore = 20; bias = 'BULLISH' } // Normal Draw
    else if (change < 0) { eiaScore = 10; bias = 'BULLISH' } // Slight Draw
    else if (change > 5000) { eiaScore = -30; bias = 'BEARISH' } // Massive Build
    else if (change > 1000) { eiaScore = -20; bias = 'BEARISH' } // Normal Build
    else if (change > 0) { eiaScore = -10; bias = 'BEARISH' } // Slight Build

    scoreTotal += eiaScore
    breakdown.eia = {
      label: change < 0 ? (change < -5000 ? 'Massive Draw' : 'Drawdown') : (change > 5000 ? 'Massive Build' : 'Build'),
      bias
    }
  } else {
    breakdown.eia = { label: 'No Data', bias: 'NEUTRAL' }
  }

  // 2. Crack Spread (Refinery Demand) (Max Weight: 30)
  const crack = prices?.CRACK?.price
  if (crack !== undefined && crack !== null) {
    let crackScore = 0
    let bias = 'NEUTRAL'
    if (crack >= 30) { crackScore = 30; bias = 'BULLISH' }
    else if (crack >= 22) { crackScore = 20; bias = 'BULLISH' }
    else if (crack >= 18) { crackScore = 10; bias = 'BULLISH' }
    else if (crack <= 10) { crackScore = -30; bias = 'BEARISH' }
    else if (crack <= 15) { crackScore = -20; bias = 'BEARISH' }
    else if (crack < 18) { crackScore = -10; bias = 'BEARISH' }
    
    scoreTotal += crackScore
    breakdown.crack = { label: `$${crack.toFixed(2)}`, bias }
  } else {
    breakdown.crack = { label: 'No Data', bias: 'NEUTRAL' }
  }

  // 3. Global Arbitrage (Brent-WTI Spread) (Max Weight: 20)
  const brent = prices?.BRN?.price
  const wti = prices?.WTI?.price
  if (brent && wti) {
    const spread = brent - wti
    let spreadScore = 0
    let bias = 'NEUTRAL'
    if (spread >= 5.0) { spreadScore = 20; bias = 'BULLISH' }
    else if (spread >= 4.0) { spreadScore = 10; bias = 'BULLISH' }
    else if (spread <= 2.0) { spreadScore = -20; bias = 'BEARISH' }
    else if (spread <= 3.0) { spreadScore = -10; bias = 'BEARISH' }
    
    scoreTotal += spreadScore
    breakdown.arb = { label: `$${spread.toFixed(2)} Spread`, bias }
  } else {
    breakdown.arb = { label: 'No Data', bias: 'NEUTRAL' }
  }

  // 4. CFTC Positioning (Speculative Flows) (Max Weight: 10)
  const wtiMarket = cftc?.parsed?.markets?.find(m => m.key === 'WTI')
  const cftcSeries = wtiMarket?.series
  if (cftcSeries && cftcSeries.length >= 2) {
    const latest = cftcSeries[cftcSeries.length - 1]
    const prev = cftcSeries[cftcSeries.length - 2]
    const latestNet = latest.managedMoneyNet || 0
    const prevNet = prev.managedMoneyNet || 0
    const change = latestNet - prevNet
    
    let cftcScore = 0
    let bias = 'NEUTRAL'
    if (change > 20000) { cftcScore = 10; bias = 'BULLISH' } // Massive Buying
    else if (change > 0) { cftcScore = 5; bias = 'BULLISH' } // Buying
    else if (change < -20000) { cftcScore = -10; bias = 'BEARISH' } // Massive Selling
    else if (change < 0) { cftcScore = -5; bias = 'BEARISH' } // Selling

    scoreTotal += cftcScore
    breakdown.cftc = {
      label: change > 0 ? (change > 20000 ? 'Massive Buying ↑' : 'Net Longs ↑') : (change < -20000 ? 'Massive Selling ↓' : 'Net Longs ↓'),
      bias
    }
  } else {
    breakdown.cftc = { label: 'No Data', bias: 'NEUTRAL' }
  }

  // 5. Macro Environment (DXY - U.S. Dollar) (Max Weight: 10)
  const dxy = prices?.DXY
  if (dxy && dxy.change !== undefined) {
    let dxyScore = 0
    let bias = 'NEUTRAL'
    if (dxy.pct <= -0.5) { dxyScore = 10; bias = 'BULLISH' }
    else if (dxy.pct < 0) { dxyScore = 5; bias = 'BULLISH' }
    else if (dxy.pct >= 0.5) { dxyScore = -10; bias = 'BEARISH' }
    else if (dxy.pct > 0) { dxyScore = -5; bias = 'BEARISH' }

    scoreTotal += dxyScore
    breakdown.dxy = {
      label: dxy.pct < 0 ? 'Dollar Weakening' : dxy.pct > 0 ? 'Dollar Strengthening' : 'Flat',
      bias
    }
  } else {
    breakdown.dxy = { label: 'No Data', bias: 'NEUTRAL' }
  }

  // Normalize: Max possible scoreTotal is theoretically 100, Min is -100
  // So we map [-100, 100] to [0%, 100%]
  // clamp just in case
  scoreTotal = Math.max(-100, Math.min(100, scoreTotal))
  const bullPct = Math.round(((scoreTotal / 100) + 1) / 2 * 100)

  return {
    score: bullPct,
    bull: bullPct,
    bear: 100 - bullPct,
    method: 'Weighted Composite (Physical 60%, Arb 20%, Spec 10%, Macro 10%)',
    productsUsed: expectedComponents,
    breakdown
  }
}

// ── HYBRID NLP SENTIMENT ENGINE (FinBERT + Energy Lexicon) ──
// FinBERT understands complex sentence syntax but struggles with commodity jargon.
// The Lexicon acts as a commodity guardrail. We mathematically blend both.
export function computeNewsSentiment(newsArray) {
  if (!newsArray || newsArray.length === 0) return 0;
  
  const bullishWords = ['draw', 'drawdown', 'tension', 'war', 'strike', 'cut', 'opec', 'disruption', 'hurricane', 'tight', 'bullish', 'surge', 'rally', 'escalation', 'rebound', 'shortage', 'attack', 'missile'];
  const bearishWords = ['build', 'recession', 'ceasefire', 'resumes', 'surplus', 'weak', 'bearish', 'inflation', 'plunge', 'drop', 'easing', 'oversupplied', 'tariffs', 'slowdown', 'peace', 'deal'];

  let totalLexiconScore = 0;
  let totalFinbertScore = 0;
  let matches = 0;
  
  newsArray.forEach(article => {
    // 1. Lexicon Pass
    const text = article.title.toLowerCase();
    let lexScore = 0;
    
    bullishWords.forEach(w => { 
      // simple word boundary check to avoid partial matches like 'drawing'
      if (new RegExp(`\\b${w}\\b`).test(text)) lexScore += 1; 
    });
    bearishWords.forEach(w => { 
      if (new RegExp(`\\b${w}\\b`).test(text)) lexScore -= 1; 
    });
    
    // ONLY apply FinBERT if the Lexicon found crude oil relevance.
    // This prevents generic macro news from artificially hiking the sentiment score.
    if (lexScore !== 0) {
      matches++;
      totalLexiconScore += Math.max(-1, Math.min(1, lexScore));

      // 2. FinBERT Pass
      if (article.finbert && article.finbert.label) {
        let fbVal = 0;
        if (article.finbert.label === 'positive') fbVal = article.finbert.score || 0;
        if (article.finbert.label === 'negative') fbVal = -(article.finbert.score || 0);
        if (Math.abs(fbVal) > 1) fbVal = fbVal / 100;
        totalFinbertScore += fbVal;
      }
    }
  });

  const avgLexicon = matches > 0 ? totalLexiconScore / matches : 0;
  const avgFinbert = matches > 0 ? totalFinbertScore / matches : 0;

  // 3. Hybrid Blending (40% FinBERT / 60% Lexicon guardrail)
  let finalScore = 0;
  if (matches > 0) {
    if (totalFinbertScore !== 0) {
      finalScore = (avgFinbert * 0.4) + (avgLexicon * 0.6);
    } else {
      finalScore = avgLexicon;
    }
  }

  return +finalScore.toFixed(3);
}

// ── FAIR VALUE: OLS Regression WTI ~ DXY + Crack Spread + Sentiment Overlay ──
// Method: Ordinary Least Squares regression using 90-day historical data.
//   E[WTI_ret] = α + β₁×DXY_ret + β₂×Crack_ret
//   Since historical news isn't available for 90 days, Live Sentiment is applied as an Alpha Overlay.
// --- MATRIX UTILITIES ---
function transpose(A) { return A[0].map((_, c) => A.map(r => r[c])); }
function multiply(A, B) {
  const result = new Array(A.length).fill(0).map(() => new Array(B[0].length).fill(0));
  for (let r = 0; r < A.length; r++) {
    for (let c = 0; c < B[0].length; c++) {
      for (let i = 0; i < A[0].length; i++) { result[r][c] += A[r][i] * B[i][c]; }
    }
  }
  return result;
}
function invert(M) {
  const n = M.length;
  const A = M.map(row => [...row]);
  const I = new Array(n).fill(0).map((_, r) => new Array(n).fill(0).map((_, c) => r === c ? 1 : 0));
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++) { if (Math.abs(A[j][i]) > Math.abs(A[pivot][i])) pivot = j; }
    if (Math.abs(A[pivot][i]) < 1e-10) return null;
    [A[i], A[pivot]] = [A[pivot], A[i]];
    [I[i], I[pivot]] = [I[pivot], I[i]];
    const diag = A[i][i];
    for (let j = 0; j < n; j++) { A[i][j] /= diag; I[i][j] /= diag; }
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const factor = A[j][i];
        for (let k = 0; k < n; k++) { A[j][k] -= factor * A[i][k]; I[j][k] -= factor * I[i][k]; }
      }
    }
  }
  return I;
}
function solveOLS(X, Y) {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const invXtX = invert(XtX);
  if (!invXtX) return null;
  const XtY = multiply(Xt, Y);
  return multiply(invXtX, XtY).map(row => row[0]);
}

export function computeRegressionFairValue(closesMap, datesMap, liveNews = [], livePrices = {}) {
  const wti = closesMap.WTI || []
  const dxy = closesMap.DXY || []
  const rbob = closesMap.RBOB || []
  const ho = closesMap.HO || []
  const spx = closesMap.SPX || []
  
  const wDates = datesMap?.WTI || []
  const dDates = datesMap?.DXY || []
  const rDates = datesMap?.RBOB || []
  const hDates = datesMap?.HO || []

  if (!wDates.length || !dDates.length || !rDates.length || !hDates.length) return null

  // 1. Build lookup maps by date to ensure perfect alignment
  const dxyMap = {}, rbobMap = {}, hoMap = {}
  dDates.forEach((d, i) => dxyMap[d] = dxy[i])
  rDates.forEach((d, i) => rbobMap[d] = rbob[i])
  hDates.forEach((d, i) => hoMap[d] = ho[i])

  // 2. Inner join into aligned array
  const aligned = []
  wDates.forEach((d, i) => {
    const wVal = wti[i]
    const dVal = dxyMap[d]
    const rVal = rbobMap[d]
    const hVal = hoMap[d]
    if (wVal != null && dVal != null && rVal != null && hVal != null) {
      aligned.push({ date: d, wti: wVal, dxy: dVal, crack: (rVal * 42 * 2 + hVal * 42 - wVal * 3) / 3 })
    }
  })

  // Force append the TRUE live prices from the WebSocket feed
  if (livePrices && livePrices.WTI && livePrices.DXY && livePrices.RBOB && livePrices.HO) {
    aligned.push({ 
      date: 'LIVE', 
      wti: livePrices.WTI.price, 
      dxy: livePrices.DXY.price, 
      crack: (livePrices.RBOB.price * 42 * 2 + livePrices.HO.price * 42 - livePrices.WTI.price * 3) / 3 
    })
  }

  if (aligned.length < 2) return null
  const window = 90
  const recent = aligned.slice(-window - 1)
  if (recent.length < 30) return null

  // 3. Compute stationary daily returns
  const yRets = [], x1Rets = [], x2Rets = []
  for (let i = 1; i < recent.length; i++) {
    yRets.push((recent[i].wti - recent[i-1].wti) / recent[i-1].wti)
    x1Rets.push((recent[i].dxy - recent[i-1].dxy) / recent[i-1].dxy)
    x2Rets.push((recent[i].crack - recent[i-1].crack) / recent[i-1].crack)
  }

  // 4. Solve 3-Factor OLS using Generic Matrix Inversion
  // Model: y = alpha + beta1*x1 + beta2*x2
  const X = []
  const Y = []
  for (let i = 0; i < yRets.length; i++) {
    X.push([1, x1Rets[i], x2Rets[i]])
    Y.push([yRets[i]])
  }
  
  const betas = solveOLS(X, Y)
  if (!betas) return null
  
  const [alpha, beta1, beta2] = betas

  // 5. Compute R²
  const meanY = yRets.reduce((a, b) => a + b, 0) / yRets.length
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < yRets.length; i++) {
    const predicted = alpha + beta1 * x1Rets[i] + beta2 * x2Rets[i]
    ssRes += (yRets[i] - predicted) ** 2
    ssTot += (yRets[i] - meanY) ** 2
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 0

  // 6. Calculate Current Fair Value using the expected return applied to yesterday's close
  const current = recent[recent.length - 1]
  const prev = recent[recent.length - 2]
  
  const dxyRet = (current.dxy - prev.dxy) / prev.dxy
  const crackRet = (current.crack - prev.crack) / prev.crack
  
  const expectedWtiRet = alpha + beta1 * dxyRet + beta2 * crackRet
  const olsFairValue = prev.wti * (1 + expectedWtiRet)
  
  // 7. Apply NLP News Sentiment Alpha Overlay
  const sentimentScore = computeNewsSentiment(liveNews)
  const sentimentAlpha = prev.wti * (sentimentScore * 0.015) 
  
  const finalFairValue = olsFairValue + sentimentAlpha
  const residual = current.wti - finalFairValue

  return {
    live: +current.wti.toFixed(2),
    fair: +finalFairValue.toFixed(2),
    gap: +residual.toFixed(2),
    signal: residual > 2 ? 'OVERVALUED' : residual < -2 ? 'UNDERVALUED' : 'FAIR',
    sentiment: sentimentScore,
    coefficients: {
      intercept: +alpha.toFixed(5),
      dxy: +beta1.toFixed(3),
      crackSpread: +beta2.toFixed(3),
    },
    rSquared: +rSquared.toFixed(3),
    window: yRets.length,
    method: `3-Factor Return-OLS + Hybrid NLP`,
  }
}

// ── CONFLUENCE: Multi-indicator technical composite ──
// Method: 5 independent technical signals from real historical data.
//   1. RSI(14): <30 = oversold/bullish(+1), >70 = overbought/bearish(-1), else 0
//   2. Price vs SMA(20): above = bullish(+1), below = bearish(-1)
//   3. Price vs SMA(50): above = bullish(+1), below = bearish(-1)
//   4. MACD histogram: >0 = bullish(+1), <0 = bearish(-1)
//   5. Volatility rank: current vol < 50th percentile = low vol/bullish(+1), else (-1)
// Final score: average of signals scaled to 0–100
export function computeConfluenceScore(closesMap, key = 'WTI') {
  const closes = closesMap[key]
  if (!closes || closes.length < 60) return null

  const n = closes.length
  const current = closes[n - 1]
  const indicators = []

  // 1. RSI
  const rsiVals = rsi(closes, 14)
  const curRSI = rsiVals.length > 0 ? rsiVals[rsiVals.length - 1] : 50
  const rsiSig = curRSI < 30 ? 1 : curRSI > 70 ? -1 : 0
  indicators.push({ name: 'RSI(14)', value: +curRSI.toFixed(1), signal: rsiSig, label: rsiSig > 0 ? 'Oversold' : rsiSig < 0 ? 'Overbought' : 'Neutral' })

  // 2. Price vs SMA(20)
  const sma20 = sma(closes, 20)
  const curSMA20 = sma20.length > 0 ? sma20[sma20.length - 1] : current
  const ma20Sig = current > curSMA20 ? 1 : -1
  indicators.push({ name: 'SMA(20)', value: +curSMA20.toFixed(2), signal: ma20Sig, label: ma20Sig > 0 ? 'Above' : 'Below' })

  // 3. Price vs SMA(50)
  const sma50 = sma(closes, 50)
  const curSMA50 = sma50.length > 0 ? sma50[sma50.length - 1] : current
  const ma50Sig = current > curSMA50 ? 1 : -1
  indicators.push({ name: 'SMA(50)', value: +curSMA50.toFixed(2), signal: ma50Sig, label: ma50Sig > 0 ? 'Above' : 'Below' })

  // 4. MACD
  const macdResult = macd(closes, 12, 26, 9)
  const hist = macdResult.histogram.filter(h => h !== null)
  const curHist = hist.length > 0 ? hist[hist.length - 1] : 0
  const macdSig = curHist > 0 ? 1 : curHist < 0 ? -1 : 0
  indicators.push({ name: 'MACD', value: +curHist.toFixed(4), signal: macdSig, label: macdSig > 0 ? 'Bullish' : macdSig < 0 ? 'Bearish' : 'Flat' })

  // 5. Volatility Percentile
  const vol = rollingVolatility(closes, 20)
  if (vol.length > 0) {
    const curVol = vol[vol.length - 1]
    const sorted = [...vol].sort((a, b) => a - b)
    const pctile = Math.round((sorted.indexOf(curVol) / sorted.length) * 100)
    const volSig = pctile < 50 ? 1 : -1  // low vol = trend-following environment
    indicators.push({ name: 'Vol Rank', value: `P${pctile}`, signal: volSig, label: volSig > 0 ? 'Low Vol' : 'High Vol' })
  }

  const avgSignal = indicators.reduce((a, b) => a + b.signal, 0) / indicators.length  // -1 to +1
  const score = Math.round((avgSignal + 1) / 2 * 100)  // 0–100
  const bullish = indicators.filter(i => i.signal > 0).length
  const bearish = indicators.filter(i => i.signal < 0).length

  return {
    score: Math.max(0, Math.min(100, score)),
    bias: score > 60 ? 'BULLISH' : score < 40 ? 'BEARISH' : 'NEUTRAL',
    indicators,
    bullishCount: bullish,
    bearishCount: bearish,
    total: indicators.length,
    method: 'RSI + SMA(20) + SMA(50) + MACD + Vol Percentile',
  }
}

// ── WTI Seasonality (Live 5-year calculation) ──
export function computeSeasonality(historicalData) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const current = new Array(12).fill(null)
  const avg5yr = new Array(12).fill(0)
  const avg3yr = new Array(12).fill(0)
  
  if (!historicalData || historicalData.length < 252 * 3) {
    return { months, current, avg5yr, avg3yr }
  }

  // Get current year
  const currentYear = new Date(historicalData[historicalData.length - 1].date).getFullYear()
  
  // Group data by year and month
  const grouped = {}
  historicalData.forEach(d => {
    const [y, m] = d.date.split('-')
    const year = parseInt(y)
    const month = parseInt(m) - 1
    if (!grouped[year]) grouped[year] = Array(12).fill().map(() => [])
    grouped[year][month].push(d.close)
  })

  // Calculate monthly averages per year
  const yearlyAverages = {}
  Object.keys(grouped).forEach(year => {
    yearlyAverages[year] = grouped[year].map(monthData => {
      if (!monthData.length) return null
      return monthData.reduce((a, b) => a + b, 0) / monthData.length
    })
  })

  // Populate current year YTD
  if (yearlyAverages[currentYear]) {
    for (let i = 0; i < 12; i++) {
      if (yearlyAverages[currentYear][i] !== null) {
        current[i] = +yearlyAverages[currentYear][i].toFixed(2)
      }
    }
  }

  // Compute 3yr and 5yr averages (excluding current year)
  for (let m = 0; m < 12; m++) {
    let sum3 = 0, count3 = 0
    let sum5 = 0, count5 = 0
    
    for (let i = 1; i <= 5; i++) {
      const targetYear = currentYear - i
      if (yearlyAverages[targetYear] && yearlyAverages[targetYear][m] !== null) {
        sum5 += yearlyAverages[targetYear][m]
        count5++
        if (i <= 3) {
          sum3 += yearlyAverages[targetYear][m]
          count3++
        }
      }
    }
    avg3yr[m] = count3 > 0 ? +(sum3 / count3).toFixed(2) : null
    avg5yr[m] = count5 > 0 ? +(sum5 / count5).toFixed(2) : null
  }

  return { months, current, avg5yr, avg3yr, currentYear }
}
