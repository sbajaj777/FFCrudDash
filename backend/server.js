import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { fetchEiaSeries } from './services/eia.js'
import { fetchLatestCFTCRaw, parseCFTCRaw } from './services/cftc.js'
import { fetchRigCount } from './services/rigCount.js'
import { generateEconomicCalendar } from './services/calendar.js'
import https from 'https'
import { Centrifuge } from 'centrifuge'
import WebSocket from 'ws'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString().slice(11,19)}] ${req.method} ${req.url}`)
  next()
})

const ALPHAVANTAGE_KEY = process.env.ALPHAVANTAGE_KEY
const NEWSAPI_KEY = process.env.NEWSAPI_KEY
const EIA_API_KEY = process.env.EIA_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const OPENAI_KEY = process.env.OPENAI_API_KEY || ''

// ─── Symbol Map ───
const YAHOO_SYMBOLS = {
  WTI:   { symbol: 'CL=F',  name: 'Crude Oil WTI',  unit: '$', decimals: 2, category: 'energy' },
  BRN:   { symbol: 'BZ=F',  name: 'Brent Crude Oil', unit: '$', decimals: 2, category: 'energy' },
  RBOB:  { symbol: 'RB=F',  name: 'RBOB Gasoline',   unit: '$', decimals: 4, category: 'energy' },
  HO:    { symbol: 'HO=F',  name: 'Heating Oil',     unit: '$', decimals: 4, category: 'energy' },
  NG:    { symbol: 'NG=F',  name: 'Natural Gas',     unit: '$', decimals: 4, category: 'energy' },
  GASOIL:{ symbol: 'QS=F',  name: 'Gas Oil',         unit: '$', decimals: 2, category: 'energy' },
  GOLD:  { symbol: 'GC=F',  name: 'Gold',            unit: '$', decimals: 2, category: 'macro' },
  SILVER:{ symbol: 'SI=F',  name: 'Silver',          unit: '$', decimals: 4, category: 'macro' },
  EURUSD:{ symbol: 'EURUSD=X', name: 'EUR/USD',      unit: '',  decimals: 5, category: 'macro' },
  USDJPY:{ symbol: 'JPY=X', name: 'USD/JPY',         unit: '',  decimals: 3, category: 'macro' },
  DXY:   { symbol: 'DX-Y.NYB', name: 'U.S. Dollar Index', unit: '', decimals: 3, category: 'macro' },
  US10Y: { symbol: '^TNX',  name: 'US 10Y Yield',    unit: '',  decimals: 3, category: 'macro' },
  SPX:   { symbol: '^GSPC', name: 'S&P 500',         unit: '',  decimals: 1, category: 'equities' },
  NDX:   { symbol: '^NDX',  name: 'Nasdaq 100',      unit: '',  decimals: 1, category: 'equities' },
  DJI:   { symbol: '^DJI',  name: 'Dow Jones',       unit: '',  decimals: 1, category: 'equities' },
}

// ─── In-memory State ───
let state = {
  prices: {},
  news: [],
  eia: null,
  cftc: null,
  rigCount: null,
  historical: {},
  startTime: Date.now(),
}

// Initialize prices with defaults
for (const [key, cfg] of Object.entries(YAHOO_SYMBOLS)) {
  state.prices[key] = { price: 0, change: 0, pct: 0, open: 0, high: 0, low: 0, prevClose: 0, name: cfg.name, unit: cfg.unit, decimals: cfg.decimals, category: cfg.category, volume: 0 }
}

// Also add crack spread
state.prices.CRACK = { price: 0, change: 0, pct: 0, open: 0, high: 0, low: 0, prevClose: 0, name: '3:2:1 Crack', unit: '$', decimals: 2, category: 'energy', volume: 0 }

// ─── Fetch a single symbol's latest price via v8 chart (reliable) ───
async function fetchPriceViaChart(symbol, key, cfg) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null
    const meta = result.meta || {}
    const closes = result.indicators?.quote?.[0]?.close || []
    const opens = result.indicators?.quote?.[0]?.open || []
    const highs = result.indicators?.quote?.[0]?.high || []
    const lows = result.indicators?.quote?.[0]?.low || []
    const volumes = result.indicators?.quote?.[0]?.volume || []
    const lastIdx = closes.length - 1
    if (lastIdx < 0 || closes[lastIdx] == null) return null

    const price = +closes[lastIdx].toFixed(cfg.decimals)

    // Walk backwards to find the last non-null previous close (handles nulls from holidays/weekends)
    let prevCloseRaw = null
    for (let i = lastIdx - 1; i >= 0; i--) {
      if (closes[i] != null) { prevCloseRaw = closes[i]; break }
    }
    const prevClose = prevCloseRaw != null ? +prevCloseRaw.toFixed(cfg.decimals) : price
    const change = +(price - prevClose).toFixed(cfg.decimals)
    const pct = prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0

    return {
      price, change, pct,
      open: opens[lastIdx] != null ? +opens[lastIdx].toFixed(cfg.decimals) : price,
      high: highs[lastIdx] != null ? +highs[lastIdx].toFixed(cfg.decimals) : price,
      low: lows[lastIdx] != null ? +lows[lastIdx].toFixed(cfg.decimals) : price,
      prevClose,
      volume: volumes[lastIdx] || 0,
    }
  } catch (e) { return null }
}

// ─── Derive prices from already-loaded historical data (instant) ───
function derivePricesFromHistorical() {
  let updated = 0
  for (const [key, cfg] of Object.entries(YAHOO_SYMBOLS)) {
    if (state.prices[key]?.price > 0) continue // already have price
    const hist = state.historical[key]
    if (!hist || hist.length < 2) continue
    const last = hist[hist.length - 1]
    const prev = hist[hist.length - 2]
    const price = +last.close.toFixed(cfg.decimals)
    const prevClose = +prev.close.toFixed(cfg.decimals)
    state.prices[key] = {
      ...state.prices[key],
      price,
      change: +(price - prevClose).toFixed(cfg.decimals),
      pct: prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0,
      open: last.open ? +last.open.toFixed(cfg.decimals) : price,
      high: last.high ? +last.high.toFixed(cfg.decimals) : price,
      low: last.low ? +last.low.toFixed(cfg.decimals) : price,
      prevClose,
      volume: last.volume || 0,
    }
    updated++
  }
  if (updated > 0) console.log(`[PRICES] Derived ${updated} prices from historical data`)
  deriveCrackAndGasOil()
}

function deriveCrackAndGasOil() {
  // Derive 3:2:1 crack spread only — Gas Oil is fetched from real sources
  if (state.prices.RBOB?.price > 0 && state.prices.HO?.price > 0 && state.prices.WTI?.price > 0) {
    const crack = +((state.prices.RBOB.price * 42 * 2 + state.prices.HO.price * 42 - state.prices.WTI.price * 3) / 3).toFixed(2)
    const prevCrack = state.prices.CRACK?.price || crack
    state.prices.CRACK = {
      ...state.prices.CRACK,
      price: crack,
      change: +(crack - prevCrack).toFixed(2),
      pct: prevCrack ? +(((crack - prevCrack) / prevCrack) * 100).toFixed(2) : 0,
    }
  }
}

// ─── Gas Oil: Dedicated multi-source fetcher ───
// ICE Low Sulphur Gasoil — tries Stooq (lf.f), then Yahoo alternate symbols
async function fetchGasOilData() {
  // Source 1: Stooq.com — ICE Low Sulphur Gasoil (symbol: lf.f)
  try {
    const stooqUrl = 'https://stooq.com/q/l/?s=lf.f&f=sd2t2ohlcv&h&e=csv'
    const res = await fetch(stooqUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    const text = await res.text()
    const lines = text.trim().split('\n')
    if (lines.length >= 2) {
      const header = lines[0].split(',')
      const values = lines[1].split(',')
      const data = {}
      header.forEach((h, i) => { data[h.trim().toLowerCase()] = values[i]?.trim() })
      const price = parseFloat(data.close || data.last)
      const open = parseFloat(data.open) || price
      const high = parseFloat(data.high) || price
      const low = parseFloat(data.low) || price
      if (price > 0 && !isNaN(price)) {
        const prevClose = state.prices.GASOIL?.prevClose || open
        state.prices.GASOIL = {
          ...state.prices.GASOIL,
          price: +price.toFixed(2),
          open: +open.toFixed(2),
          high: +high.toFixed(2),
          low: +low.toFixed(2),
          prevClose: +prevClose.toFixed(2),
          change: +(price - prevClose).toFixed(2),
          pct: prevClose ? +(((price - prevClose) / prevClose) * 100).toFixed(2) : 0,
          volume: parseInt(data.volume) || 0,
        }
        console.log(`[GASOIL] ✓ Stooq LF.F (ICE LS Gasoil): $${price.toFixed(2)}`)
        return true
      }
    }
  } catch (e) {
    console.warn('[GASOIL] Stooq failed:', e.message)
  }

  // Source 2: Yahoo Finance QS=F (ICE Gasoil — may not be available)
  const yahooResult = await fetchPriceViaChart('QS=F', 'GASOIL', { decimals: 2 })
  if (yahooResult && yahooResult.price > 0) {
    state.prices.GASOIL = { ...state.prices.GASOIL, ...yahooResult }
    console.log(`[GASOIL] ✓ Yahoo QS=F: $${yahooResult.price}`)
    return true
  }

  // Source 3: Try alternate Yahoo symbols
  for (const altSymbol of ['GAS=F', 'LGO=F']) {
    const altResult = await fetchPriceViaChart(altSymbol, 'GASOIL', { decimals: 2 })
    if (altResult && altResult.price > 0) {
      state.prices.GASOIL = { ...state.prices.GASOIL, ...altResult }
      console.log(`[GASOIL] ✓ Yahoo ${altSymbol}: $${altResult.price}`)
      return true
    }
  }

  console.warn('[GASOIL] ✗ All live sources failed')
  return false
}

// ─── Gas Oil Historical ───
// Stooq doesn't provide historical CSV for lf.f, so we use Heating Oil historical
// with ICE/NYMEX conversion as a proxy. HO and Gasoil track very closely (~95% corr).
// The conversion: Gasoil ($/MT) ≈ HO ($/gal) × 42 (gal/bbl) × 7.45 (bbl/MT)
async function fetchGasOilHistorical() {
  // Try Yahoo QS=F first (unlikely to work but worth trying)
  const yahooData = await fetchHistorical('QS=F', '1y', '1d')
  if (yahooData && yahooData.length > 20) {
    state.historical.GASOIL = yahooData
    console.log(`[HIST] GASOIL (Yahoo QS=F): ${yahooData.length} data points`)
    return
  }

  // Derive from Heating Oil historical with proper conversion
  const hoData = state.historical.HO
  if (hoData && hoData.length > 0) {
    const convFactor = 42 * 7.45 // gal→bbl→MT
    state.historical.GASOIL = hoData.map(d => ({
      date: d.date,
      open: d.open ? +(d.open * convFactor).toFixed(2) : null,
      high: d.high ? +(d.high * convFactor).toFixed(2) : null,
      low: d.low ? +(d.low * convFactor).toFixed(2) : null,
      close: d.close ? +(d.close * convFactor).toFixed(2) : null,
      volume: d.volume || 0,
    }))
    console.log(`[HIST] GASOIL (proxy from HO × conversion): ${state.historical.GASOIL.length} data points`)
    console.log(`[HIST] Note: Gas Oil chart uses HO→Gasoil conversion. Live price is real ICE data from Stooq.`)
    return
  }

  console.warn('[HIST] GASOIL: No historical data available')
}

// ─── Yahoo Finance Price Fetcher (v8 chart per symbol — reliable) ───
async function fetchPricesFromYahoo() {
  const promises = Object.entries(YAHOO_SYMBOLS).map(async ([key, cfg]) => {
    const result = await fetchPriceViaChart(cfg.symbol, key, cfg)
    if (result) {
      state.prices[key] = { ...state.prices[key], ...result }
    }
  })
  await Promise.allSettled(promises)
  deriveCrackAndGasOil()

  const filled = Object.entries(state.prices).filter(([, v]) => v.price > 0).length
  console.log(`[PRICES] Updated ${filled} live prices via Yahoo Finance v8 chart`)
  return filled > 0
}

// ─── Yahoo Historical Data ───
async function fetchHistorical(symbol, range = '1y', interval = '1d') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null

    const timestamps = result.timestamp || []
    const quotes = result.indicators?.quote?.[0] || {}
    const closes = quotes.close || []
    const opens = quotes.open || []
    const highs = quotes.high || []
    const lows = quotes.low || []
    const volumes = quotes.volume || []

    return timestamps.map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      timestamp: ts,
      open: opens[i],
      high: highs[i],
      low: lows[i],
      close: closes[i],
      volume: volumes[i],
    })).filter(d => d.close != null)
  } catch (e) {
    console.warn(`[HIST] Failed to fetch ${symbol}:`, e.message)
    return null
  }
}

async function fetchAllHistorical() {
  console.log('[HIST] Fetching historical data for all symbols...')
  const promises = Object.entries(YAHOO_SYMBOLS).map(async ([key, cfg]) => {
    const data = await fetchHistorical(cfg.symbol, '5y', '1d')
    if (data && data.length > 0) {
      state.historical[key] = data
      console.log(`[HIST] ${key}: ${data.length} data points`)
    }
  })
  await Promise.allSettled(promises)
  console.log(`[HIST] Completed. ${Object.keys(state.historical).length} symbols loaded.`)
}

// ─── Energy keyword filter ───
const ENERGY_KEYWORDS = [
  'oil','crude','brent','wti','opec','petroleum','gasoline','diesel','fuel',
  'refin','rbob','heating oil','gas oil','gasoil','kerosene','jet fuel','naphtha',
  'natural gas','lng','lpg','eia','inventory','stockpile','barrel','mbpd',
  'pipeline','tanker','strait of hormuz','naval mine','oil facility','oil refinery',
  'oil field','oil terminal','oil shipment','oil export','oil import',
  'saudi','aramco','iran','russia oil','ukraine oil','energy market',
  'commodity','commodities','cftc','iea','rig count','baker hughes',
  'opec+','production cut','energy crisis','energy prices','energy supply',
]
function isEnergyRelevant(text) {
  const lower = (text || '').toLowerCase()
  return ENERGY_KEYWORDS.some(kw => lower.includes(kw))
}

// ─── FinBERT Sentiment Fetcher ───
async function fetchFinbertSentiment(text) {
  try {
    const res = await fetch('https://api-inference.huggingface.co/models/ProsusAI/finbert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: text }),
      signal: AbortSignal.timeout(3000)
    })
    if (!res.ok) return null
    const json = await res.json()
    // HuggingFace returns array of arrays for sentiment
    if (json && json[0] && json[0][0]) {
      // Find the highest scoring label
      const sorted = json[0].sort((a,b) => b.score - a.score)
      const best = sorted[0]
      return { label: best.label, score: best.score }
    }
  } catch(e) {
    // silently fail to not pollute logs on timeout/rate limit
  }
  return null
}

// ─── RSS parser helper ───
function parseRSS(xml, sourceName) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  return items.map(m => {
    const block = m[1]
    const title   = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/)   || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim()
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)     || [])[1]?.trim()
    const link    = (block.match(/<link>([\s\S]*?)<\/link>/)           || [])[1]?.trim()
                 || (block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)      || [])[1]?.trim()
    const src     = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/)  || [])[1]?.replace(/<!\[CDATA\[|\]\]>/g,'').trim() || sourceName
    if (!title) return null
    const time = pubDate ? new Date(pubDate) : new Date()
    return { title, time: time.toISOString(), ts: time.getTime(), src, url: link }
  }).filter(Boolean)
}

// ─── News Fetcher — multi-source real-time energy RSS ───
async function fetchNews() {
  const HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; EnergyDashboard/1.0)' }
  const TIMEOUT = 8000

  const SOURCES = [
    // ── Yahoo Finance commodity RSS — near real-time wire (Reuters/AP/DJ) ──
    // These are tagged to specific futures, so every article is energy-relevant
    { url: 'https://finance.yahoo.com/rss/headline?s=CL%3DF',  name: 'YF/WTI',    energyOnly: true },
    { url: 'https://finance.yahoo.com/rss/headline?s=BZ%3DF',  name: 'YF/Brent',  energyOnly: true },
    { url: 'https://finance.yahoo.com/rss/headline?s=NG%3DF',  name: 'YF/NatGas', energyOnly: true },
    { url: 'https://finance.yahoo.com/rss/headline?s=RB%3DF',  name: 'YF/RBOB',   energyOnly: true },
    { url: 'https://finance.yahoo.com/rss/headline?s=HO%3DF',  name: 'YF/HeatOil',energyOnly: true },
    // ── Dedicated energy editorial (supplemental) ──
    { url: 'https://oilprice.com/rss/main',                     name: 'OilPrice',  energyOnly: true },
    { url: 'https://www.rigzone.com/news/rss/rigzone_latest.aspx', name: 'Rigzone', energyOnly: true },
    { url: 'https://www.eia.gov/rss/news.xml',                  name: 'EIA',       energyOnly: true },
  ]

  const allArticles = []

  await Promise.allSettled(SOURCES.map(async src => {
    try {
      const res = await fetch(src.url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT) })
      if (!res.ok) return
      const xml = await res.text()
      const items = parseRSS(xml, src.name)
      const filtered = src.energyOnly ? items : items.filter(a => isEnergyRelevant(a.title))
      allArticles.push(...filtered)
    } catch (e) {
      console.warn(`[NEWS] ${src.name} failed:`, e.message)
    }
  }))

  if (allArticles.length === 0) {
    console.warn('[NEWS] All sources failed — no articles loaded')
    return
  }

  // Deduplicate by title similarity, sort newest first
  const seen = new Set()
  const unique = allArticles
    .filter(a => {
      const key = a.title.slice(0, 60).toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 30)

  // Fetch FinBERT for any missing sentiment
  await Promise.allSettled(unique.map(async a => {
    // Carry over existing finbert score if we already fetched it in a previous cycle
    const existing = state.news.find(old => old.title === a.title)
    if (existing && existing.finbert) {
      a.finbert = existing.finbert
    } else {
      a.finbert = await fetchFinbertSentiment(a.title)
    }
  }))

  state.news = unique
  const bySource = {}
  unique.forEach(a => { bySource[a.src] = (bySource[a.src] || 0) + 1 })
  console.log(`[NEWS] ${unique.length} energy articles (History) — ${JSON.stringify(bySource)}`)
  
  // Broadcast updated news with FinBERT scores to clients
  if (typeof broadcast === 'function') {
    broadcast('news', { ts: Date.now(), news: state.news })
  }
}

// ─── Financial Juice Live WebSocket Scraper ───
let fjCentrifuge = null
let fjSub = null

function connectFinancialJuiceWS() {
  console.log('[FJ-WS] Fetching tokens from Financial Juice...')
  https.get('https://feed.financialjuice.com/widgets/headlines.aspx?wtype=NEWS&mode=dark', (res) => {
    let html = ''
    res.on('data', d => html += d)
    res.on('end', () => {
      const tokenMatch = html.match(/var centrifugoToken = '([^']+)'/)
      const urlMatch = html.match(/var centrifugoUrl = '([^']+)'/)
      if (!tokenMatch || !urlMatch) {
        console.warn('[FJ-WS] Failed to extract tokens. Retrying in 5 mins.')
        setTimeout(connectFinancialJuiceWS, 5 * 60 * 1000)
        return
      }

      if (fjCentrifuge) {
        fjCentrifuge.disconnect()
      }

      console.log('[FJ-WS] Connecting to Live Stream...')
      fjCentrifuge = new Centrifuge(urlMatch[1], {
        token: tokenMatch[1],
        websocket: WebSocket
      })

      fjCentrifuge.on('connected', function(ctx) {
        console.log('[FJ-WS] Connected to Financial Juice Live Stream')
      })

      const channel = 'feed:all'
      fjSub = fjCentrifuge.getSubscription(channel) || fjCentrifuge.newSubscription(channel)
      
      fjSub.on('publication', function(ctx) {
          try {
            const data = ctx.data
            // The structure is usually an object with Headline, Source, Url, etc.
            if (!data || !data.Headline) return
            
            const title = data.Headline.replace(/<!\[CDATA\[|\]\]>/g,'').trim()
            if (isEnergyRelevant(title)) {
              console.log(`[FJ-WS] 🔥 LIVE ENERGY NEWS: ${title}`)
              const newArticle = {
                title,
                time: new Date().toISOString(),
                ts: Date.now(),
                src: data.Source || 'FinancialJuice',
                url: data.Url || `https://www.financialjuice.com`
              }
              
              // Push to front of state.news and deduplicate
              state.news.unshift(newArticle)
              
              const seen = new Set()
              state.news = state.news.filter(a => {
                const key = a.title.slice(0, 60).toLowerCase()
                if (seen.has(key)) return false
                seen.add(key)
                return true
              }).slice(0, 30)
              
              // Broadcast immediately so UI is 0-latency (using Lexicon fallback)
              broadcast('news', { ts: Date.now(), news: state.news })
              
              // Asynchronously fetch FinBERT score and broadcast update when ready
              fetchFinbertSentiment(title).then(finbert => {
                if (finbert) {
                  const target = state.news.find(a => a.ts === newArticle.ts)
                  if (target) {
                    target.finbert = finbert
                    broadcast('news', { ts: Date.now(), news: state.news })
                  }
                }
              })
            }
          } catch(e) {
            console.error('[FJ-WS] Error processing live news', e.message)
          }
        })
        
        fjSub.subscribe()
      fjCentrifuge.on('disconnected', function(ctx) {
        console.warn('[FJ-WS] Disconnected. Reconnecting...')
      })

      fjCentrifuge.connect()
      
      // Tokens expire, so forcibly reconnect every hour to fetch a fresh token
      setTimeout(() => {
        console.log('[FJ-WS] Token refresh cycle...')
        connectFinancialJuiceWS()
      }, 60 * 60 * 1000)
    })
  }).on('error', (e) => {
    console.warn('[FJ-WS] Token fetch error:', e.message)
    setTimeout(connectFinancialJuiceWS, 5 * 60 * 1000)
  })
}

// Start the WS scraper on boot
connectFinancialJuiceWS()

// ─── AI Commentary ───
async function generateAICommentary(marketContext) {
  const recentNews = state.news.slice(0, 20).map(n => `- ${n.title}`).join('\n')
  
  const prompt = `You are an expert energy markets analyst at a major trading house. Based on the current market data and recent news, provide:
1. A concise 3-4 paragraph morning brief covering price action, macro backdrop, spreads, positioning, and key catalysts. Write in a professional trading desk style.
2. An assessment of current Geopolitical Risk scores (0-100) for key regions, evaluating the recent news headlines provided.

Current market snapshot:
${marketContext}

Recent News Headlines:
${recentNews}

You MUST return your response as a valid JSON object matching this exact structure, with no markdown code blocks around it:
{
  "commentary": "Your markdown formatted market brief here...",
  "geoRisks": [
    { "region": "Middle East", "score": 85 },
    { "region": "Iran (Sanctions)", "score": 80 },
    { "region": "Russia / CIS", "score": 75 },
    { "region": "Venezuela", "score": 60 },
    { "region": "Libya", "score": 50 },
    { "region": "West Africa", "score": 45 },
    { "region": "US Gulf Coast", "score": 20 },
    { "region": "Canada / WCSB", "score": 15 }
  ]
}`

  const cleanJSON = (text) => {
    let t = text.trim()
    if (t.startsWith('\`\`\`json')) t = t.slice(7)
    if (t.startsWith('\`\`\`')) t = t.slice(3)
    if (t.endsWith('\`\`\`')) t = t.slice(0, -3)
    return JSON.parse(t.trim())
  }

  if (GEMINI_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        }),
      })
      const json = await res.json()
      console.log('[AI] Gemini response:', JSON.stringify(json).slice(0, 500))
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text
      if (rawText) return cleanJSON(rawText)
      console.warn('[AI] Gemini missing text in response')
    } catch (e) {
      console.warn('[AI] Gemini failed:', e.message)
    }
  }

  if (OPENAI_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          response_format: { type: "json_object" }
        })
      })
      const json = await res.json()
      console.log('[AI] OpenAI response:', JSON.stringify(json).slice(0, 500))
      const rawText = json?.choices?.[0]?.message?.content
      if (rawText) return cleanJSON(rawText)
      console.warn('[AI] OpenAI missing text in response')
    } catch (e) {
      console.warn('[AI] OpenAI failed:', e.message)
    }
  }

    try {
      console.log('[AI] Trying Pollinations (Free public AI)...')
      // Pollinations has strict token limits. We send only the 10 most recent headlines.
      const shortNews = state.news ? state.news.slice(0, 10) : []
      const shortPrompt = `As an expert, output ONLY valid JSON format with a markdown "commentary" string (MUST BE FORMATTED AS A CONCISE BULLETED LIST, no paragraphs) and a "geoRisks" array (regions and scores 0-100) based on these 10 headlines: ${JSON.stringify(shortNews.map(n => n.title))}`
      
      const res = await fetch('https://text.pollinations.ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: shortPrompt }],
          jsonMode: true
        })
      })
      const rawText = await res.text()
      console.log('[AI] Pollinations response length:', rawText.length)
      if (rawText && !rawText.includes('<!DOCTYPE')) {
        const parsed = cleanJSON(rawText)
        if (parsed.error || rawText.includes('Queue full')) {
          throw new Error(parsed.error || 'Pollinations Queue Full')
        }
        return parsed
      }
    } catch (e) {
      console.warn('[AI] Pollinations failed:', e.message)
    }

  return { commentary: null, geoRisks: [], error: 'Free AI tier is currently overloaded. Please add a GEMINI_API_KEY to your backend/.env file for unlimited reliable access.' }
}

// ─── SSE ───
const sseClients = new Set()

app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (event, data) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  send('prices', { ts: Date.now(), prices: state.prices })
  send('news', { ts: Date.now(), news: state.news })

  sseClients.add(res)
  req.on('close', () => sseClients.delete(res))
})

function broadcast(event, payload) {
  for (const client of sseClients) {
    try {
      client.write(`event: ${event}\n`)
      client.write(`data: ${JSON.stringify(payload)}\n\n`)
    } catch (e) { sseClients.delete(client) }
  }
}

// ─── Polling Loops ───
// Prices: every 5 seconds
setInterval(async () => {
  await fetchPricesFromYahoo()
  broadcast('prices', { ts: Date.now(), prices: state.prices })
}, 5000)

// News: every 60 seconds — broadcast update to all clients
setInterval(async () => {
  await fetchNews()
  broadcast('news', { ts: Date.now(), news: state.news })
}, 60 * 1000)

// Historical: refresh every hour
setInterval(() => fetchAllHistorical(), 60 * 60 * 1000)

// Gas Oil: dedicated poll every 30 seconds (multi-source)
setInterval(async () => {
  await fetchGasOilData()
  broadcast('prices', { ts: Date.now(), prices: state.prices })
}, 30000)

// ─── EIA ───
const EIA_SERIES = process.env.EIA_SERIES ? process.env.EIA_SERIES.split(',').map(s => s.trim()).filter(Boolean) : []
if (EIA_API_KEY && EIA_SERIES.length) {
  const pollEia = async () => {
    const data = await fetchEiaSeries(EIA_API_KEY, EIA_SERIES)
    if (data) {
      state.eia = data
      broadcast('eia', { ts: Date.now(), eia: data })
    }
  }
  pollEia().catch(() => {})
  setInterval(pollEia, 5 * 60 * 1000)
}

// ─── CFTC ───
const pollCFTC = async () => {
  const data = await fetchLatestCFTCRaw()
  if (data?.raw) {
    const prevHistory = Array.isArray(state.cftc?.history) ? state.cftc.history : []
    try {
      const parsed = parseCFTCRaw(data.raw)
      const nextParsed = parsed.parsed || null
      const history = buildCftcHistory(prevHistory, nextParsed)
      state.cftc = { ...data, parsed: nextParsed, history }
    } catch (e) { if (state.cftc) state.cftc.parsed = null }
    broadcast('cftc', { ts: Date.now(), cftc: state.cftc })
  }
}
pollCFTC().catch(() => {})
setInterval(pollCFTC, 6 * 60 * 60 * 1000)

// ─── Rig Count ───
const pollRigCount = async () => {
  const data = await fetchRigCount()
  if (data) {
    state.rigCount = data
    broadcast('rigCount', { ts: Date.now(), rigCount: data })
  }
}
pollRigCount().catch(() => {})
setInterval(pollRigCount, 6 * 60 * 60 * 1000)

// ─── Initial Fetch ───
fetchPricesFromYahoo().then(() => console.log('[BOOT] Initial prices loaded'))
fetchGasOilData().then(() => console.log('[BOOT] Gas Oil price loaded'))
fetchNews().then(() => console.log('[BOOT] Initial news loaded'))
fetchAllHistorical().then(async () => {
  console.log('[BOOT] Historical data loaded')
  await fetchGasOilHistorical()
  derivePricesFromHistorical()
  broadcast('prices', { ts: Date.now(), prices: state.prices })
})

// ─── REST Endpoints ───
app.get('/api/prices', (req, res) => res.json({ ts: Date.now(), prices: state.prices }))
app.get('/api/news', (req, res) => res.json({ ts: Date.now(), news: state.news }))
app.get('/api/eia', (req, res) => res.json({ ts: Date.now(), eia: state.eia }))
app.get('/api/cftc', (req, res) => res.json({ ts: Date.now(), cftc: state.cftc }))
app.get('/api/cftc/parsed', (req, res) => res.json({ ts: Date.now(), parsed: state.cftc?.parsed || null }))
app.get('/api/rig-count', (req, res) => res.json({ ts: Date.now(), rigCount: state.rigCount }))
app.get('/api/calendar', (req, res) => res.json({ ts: Date.now(), calendar: generateEconomicCalendar() }))

app.get('/api/historical', (req, res) => {
  res.json({ ts: Date.now(), historical: state.historical })
})

app.get('/api/historical/:symbol', (req, res) => {
  const key = req.params.symbol.toUpperCase()
  res.json({ ts: Date.now(), symbol: key, data: state.historical[key] || null })
})

app.get('/api/status', (req, res) => {
  const hasData = Object.values(state.prices).some(p => p.price > 0)
  res.json({
    ts: Date.now(),
    uptime: Math.floor((Date.now() - state.startTime) / 1000),
    connected: hasData,
    sseClients: sseClients.size,
    symbols: Object.keys(state.prices).length,
    historicalSymbols: Object.keys(state.historical).length,
    newsCount: state.news.length,
    hasEia: !!state.eia,
    hasCftc: !!state.cftc,
    hasRigCount: !!state.rigCount,
  })
})

app.post('/api/ai/commentary', async (req, res) => {
  try {
    const marketContext = Object.entries(state.prices)
      .filter(([, v]) => v.price > 0)
      .map(([k, v]) => `${v.name}: ${v.unit}${v.price} (${v.change >= 0 ? '+' : ''}${v.change}, ${v.pct >= 0 ? '+' : ''}${v.pct}%)`)
      .join('\n')

    const aiResponse = await generateAICommentary(marketContext)
    if (aiResponse) {
      res.json({ ts: Date.now(), ...aiResponse, source: GEMINI_KEY ? 'Gemini' : 'OpenAI' })
    } else {
      res.json({ ts: Date.now(), commentary: null, geoRisks: [], error: 'No AI API key configured.' })
    }
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages } = req.body
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'Invalid messages array' })

    const marketContext = Object.entries(state.prices)
      .filter(([, v]) => v.price > 0)
      .map(([k, v]) => `${v.name}: ${v.unit}${v.price} (${v.change >= 0 ? '+' : ''}${v.change}, ${v.pct >= 0 ? '+' : ''}${v.pct}%)`)
      .join(', ')
    const recentNews = state.news ? state.news.slice(0, 5).map(n => n.title).join(' | ') : 'No recent news.'

    const systemMessage = {
      role: 'system',
      content: `You are an elite, highly assertive quantitative energy market analyst and crude oil trader. 
You must directly answer all questions with confidence. If asked for price predictions, market sentiment, suggestions, or whether the market is bullish or bearish, you MUST provide a bold, calculated opinion based on current data. DO NOT refuse to give financial advice or predictions; this is a simulated trading desk environment.
Current Prices: ${marketContext}
Latest News: ${recentNews}`
    }

    const resPol = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [systemMessage, ...messages],
        jsonMode: false
      })
    })

    const text = await resPol.text()
    if (resPol.status !== 200 || text.includes('Queue full') || text.includes('error')) {
      return res.json({ reply: 'Sorry, the free public AI tier is currently overloaded. Please add a GEMINI_API_KEY to your backend/.env file for unlimited private access.' })
    }
    
    // Parse json if it happened to return error json
    try {
      const parsed = JSON.parse(text)
      if (parsed.error) return res.json({ reply: 'Free AI tier error. Add a GEMINI_API_KEY to backend/.env for access.' })
    } catch(e) {}

    res.json({ reply: text })
  } catch (e) {
    console.error('[AI Chat] Failed:', e.message)
    res.status(500).json({ error: e.message })
  }
})

function buildCftcHistory(previousHistory, parsed) {
  if (!parsed) return previousHistory
  const reportDate = parsed.reportDate || new Date().toISOString().slice(0, 10)
  const snapshot = { reportDate, markets: {} }
  for (const market of parsed.markets || []) {
    if (!market.latest) continue
    snapshot.markets[market.key] = {
      label: market.label,
      marketName: market.latest.marketName,
      openInterest: market.latest.openInterest,
      managedMoneyNet: market.latest.managedMoneyNet,
      swapNet: market.latest.swapNet,
      producerNet: market.latest.producerNet,
      otherReportablesNet: market.latest.otherReportablesNet,
    }
  }
  const next = [...previousHistory]
  const idx = next.findIndex(i => i.reportDate === reportDate)
  if (idx >= 0) next[idx] = snapshot; else next.push(snapshot)
  return next.slice(-26)
}

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════╗`)
  console.log(`║  FFCrudeDash Backend — port ${PORT}     ║`)
  console.log(`║  SSE: http://localhost:${PORT}/sse      ║`)
  console.log(`║  API: http://localhost:${PORT}/api/*    ║`)
  console.log(`╚══════════════════════════════════════╝\n`)
})
