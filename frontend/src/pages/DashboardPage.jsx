import React, { useMemo, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import ReactMarkdown from 'react-markdown'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js'
import { formatPrice, formatChange, computeBrentWTISpread } from '../utils/priceEngine.js'
import { computeFundamentalSentiment, computeRegressionFairValue, computeConfluenceScore } from '../utils/quantEngine.js'
import { useClock } from '../hooks/usePrices.js'
import TradingViewChart from '../components/TradingViewChart.jsx'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const CHART_OPTS = {
  responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', maxTicksLimit: 8, font: { size: 10, family: "'JetBrains Mono'" } } },
    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', font: { size: 10, family: "'JetBrains Mono'" } }, position: 'right' },
  },
  elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
}

const PRODUCTS = [
  { key: 'WTI',    color: '#00d4ff', label: 'WTI' },
  { key: 'BRN',    color: '#f5a623', label: 'BRENT' },
  { key: 'RBOB',   color: '#ff6b8a', label: 'RBOB' },
  { key: 'HO',     color: '#a855f7', label: 'HEAT OIL' },
  { key: 'GASOIL', color: '#00c48f', label: 'GAS OIL' },
]
const ENERGY_KEYS = ['WTI', 'BRN', 'RBOB', 'HO', 'NG']

export default function DashboardPage({ data }) {
  const { prices, news, closesMap, datesMap, connected, eia, cftc } = data
  const clock = useClock()
  const [selectedProduct, setSelectedProduct] = useState('WTI')
  const [chartRange, setChartRange] = useState('3M')
  const [crackRange, setCrackRange] = useState('3M')


  // REAL analytics from fundamental data
  const sentiment = useMemo(() => computeFundamentalSentiment(eia, cftc, prices), [eia, cftc, prices])
  const fairValue = useMemo(() => computeRegressionFairValue(closesMap, datesMap, news, prices), [closesMap, datesMap, news, prices])
  // Confluence: compute for all 5 energy products, aggregate
  const allConfluence = useMemo(() => {
    const results = {}
    let totalScore = 0, count = 0
    for (const key of ENERGY_KEYS) {
      const c = computeConfluenceScore(closesMap, key)
      if (c) { results[key] = c; totalScore += c.score; count++ }
    }
    if (count === 0) return null
    const avgScore = Math.round(totalScore / count)
    return {
      aggregate: avgScore,
      bias: avgScore > 60 ? 'BULLISH' : avgScore < 40 ? 'BEARISH' : 'NEUTRAL',
      products: results,
      count,
    }
  }, [closesMap])
  const brnWtiSpread = useMemo(() => computeBrentWTISpread(prices), [prices])

  const RANGE_MAP = { '1W': 5, '1M': 21, '3M': 63, '6M': 126, '1Y': 252, 'ALL': 9999 }
  const rangeDays = RANGE_MAP[chartRange] || 63
  const selCloses = (closesMap[selectedProduct] || []).slice(-rangeDays)
  const selDates = (datesMap[selectedProduct] || []).slice(-rangeDays)
  const selProduct = PRODUCTS.find(p => p.key === selectedProduct)
  const selPrice = prices[selectedProduct]

  const mainChartData = {
    labels: selDates.map(d => rangeDays <= 21 ? d.slice(5) : d.slice(2, 7)),
    datasets: [{
      label: selProduct?.label || selectedProduct,
      data: selCloses,
      borderColor: selProduct?.color || '#00d4ff',
      backgroundColor: (selProduct?.color || '#00d4ff') + '10',
      fill: true, tension: 0.3,
      pointRadius: rangeDays <= 21 ? 2 : 0,
    }],
  }

  // Crack Spread from historical
  const crackRangeDays = RANGE_MAP[crackRange] || 63
  const rbobC = closesMap.RBOB || [], hoC = closesMap.HO || [], wtiC = closesMap.WTI || []
  const crLen = Math.min(rbobC.length, hoC.length, wtiC.length)
  const crackData = [], crackDates = []
  for (let i = Math.max(0, crLen - crackRangeDays); i < crLen; i++) {
    if (rbobC[i] && hoC[i] && wtiC[i]) {
      crackData.push(+((rbobC[i] * 42 * 2 + hoC[i] * 42 - wtiC[i] * 3) / 3).toFixed(2))
      crackDates.push((datesMap.WTI || [])[i]?.slice(crackRangeDays <= 21 ? 5 : 2, crackRangeDays <= 21 ? 10 : 7) || '')
    }
  }

  const crackChartData = {
    labels: crackDates,
    datasets: [{
      label: '3:2:1 Crack', data: crackData,
      borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.08)', fill: true, tension: 0.3,
      pointRadius: crackRangeDays <= 21 ? 2 : 0,
    }],
  }

  const MOCK_COMMENTARY = `• **Crude Complex Weakness:** WTI and Brent are trading heavily in the red today, down over 3.5% as algorithmic selling accelerated below the 50-day moving averages. The sell-off was catalyzed by a surprise build in U.S. commercial crude inventories and easing geopolitical premiums.

• **Geopolitical Premium Unwinding:** Initial fears of supply disruptions in the Strait of Hormuz have subsided following diplomatic developments. Risk-off sentiment is pervasive, pulling speculative length out of the market. The Brent-WTI spread has narrowed slightly as North Sea physical markets remain well supplied.

• **Product Crack Spreads Under Pressure:** Both RBOB and Heating Oil cracks are compressing.`

  const [aiCommentary, setAiCommentary] = useState(MOCK_COMMENTARY)
  const [aiLoading, setAiLoading] = useState(false)

  const fetchAI = async () => {
    setAiLoading(true)
    setTimeout(() => {
      setAiCommentary(MOCK_COMMENTARY)
      setAiLoading(false)
    }, 600)
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          <h1 className="page-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            FFCrudeDash Command Center
          </h1>
          <div className="page-subtitle">Real-time energy complex • CME/ICE exchange data • {clock}</div>
        </div>
        <span className={`badge ${connected ? 'badge-live' : 'badge-red'}`}>● {connected ? 'LIVE' : 'OFFLINE'}</span>
      </div>

      {/* ═══ PRODUCT STRIP ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 20 }}>
        {PRODUCTS.map(prod => {
          const p = prices[prod.key]
          const isActive = selectedProduct === prod.key
          const up = (p?.change || 0) >= 0
          return (
            <button key={prod.key} onClick={() => setSelectedProduct(prod.key)} style={{
              minWidth: 0, overflow: 'hidden',
              background: isActive ? prod.color + '12' : 'var(--bg-card)',
              border: `1px solid ${isActive ? prod.color + '40' : 'rgba(255,255,255,0.06)'}`,
              borderTop: `2px solid ${isActive ? prod.color : 'transparent'}`,
              borderRadius: 8, padding: '7px 8px', cursor: 'pointer', textAlign: 'left',
              transition: 'all 150ms ease', color: 'inherit',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: isActive ? prod.color : 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 3 }}>{prod.label}</div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p?.price > 0 ? formatPrice(p.price, p.decimals, p.unit) : '—'}
              </div>
              <div className="mono" style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>
                {p?.price > 0 ? `${up ? '+' : ''}${p.pct}%` : '—'}
              </div>
            </button>
          )
        })}
      </div>

      {/* ═══ MAIN GRID ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>
        {/* Left: Charts */}
        <div style={{ display: 'grid', gap: 10, minWidth: 0 }}>
          {/* Selected Product — TradingView Advanced Chart */}
          <div className="card" style={{ borderTop: `2px solid ${selProduct?.color || 'var(--cyan)'}`, padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
              <div>
                <span className="card-title">{selProduct?.label} — Advanced Chart</span>
                <span className="mono" style={{ fontSize: 16, fontWeight: 800, marginLeft: 12 }}>
                  {selPrice?.price > 0 ? formatPrice(selPrice.price, selPrice.decimals, selPrice.unit) : '—'}
                  <span style={{ fontSize: 11, marginLeft: 6, color: (selPrice?.change || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {selPrice?.price > 0 ? formatChange(selPrice.change, selPrice.pct, selPrice.decimals > 2 ? 4 : 2) : ''}
                  </span>
                </span>
              </div>
              <span className="badge badge-cyan" style={{ fontSize: 9 }}>Powered by TradingView</span>
            </div>
            <TradingViewChart symbol={selectedProduct} height={560} />
          </div>

          {/* Crack Spread */}
          <div className="card" style={{ borderTop: '2px solid var(--gold)', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <span className="card-title">3:2:1 Crack Spread — {crackRange === 'ALL' ? 'All History' : crackRange}</span>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: 'var(--gold)' }}>
                  {prices.CRACK?.price > 0 ? `$${prices.CRACK.price.toFixed(2)}` : crackData.length > 0 ? `$${crackData[crackData.length - 1]}` : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {Object.keys(RANGE_MAP).map(r => (
                  <button key={r} onClick={() => setCrackRange(r)} style={{
                    padding: '3px 7px', fontSize: 9, fontWeight: 700, borderRadius: 4, cursor: 'pointer',
                    border: crackRange === r ? '1px solid var(--gold)' : '1px solid var(--border)',
                    background: crackRange === r ? 'rgba(245,166,35,0.12)' : 'transparent',
                    color: crackRange === r ? 'var(--gold)' : 'var(--text-muted)',
                    transition: 'all 120ms ease', letterSpacing: '0.04em',
                  }}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 170 }}>
              {crackData.length > 0 ? <Line data={crackChartData} options={CHART_OPTS} /> :
                <div className="text-muted" style={{ textAlign: 'center', paddingTop: 60 }}>Loading...</div>}
            </div>
          </div>

          {/* EIA & CFTC Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 10 }}>
            {/* EIA Crude Oil Inventory */}
            <div className="card" style={{ borderTop: '2px solid var(--cyan)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span className="card-title">EIA Crude Oil Inventory</span>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>US Commercial Crude Stocks (Weekly)</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Source: EIA</span>
              </div>
              <div style={{ height: 170 }}>
                {(() => {
                  const eiaKey = Object.keys(eia || {})[0]
                  const series = eia?.[eiaKey]?.series
                  if (!series || series.length === 0) return <div className="text-muted" style={{ textAlign: 'center', paddingTop: 60, fontSize: 11 }}>No EIA data — set EIA_API_KEY in .env</div>
                  const sorted = [...series].reverse().slice(-20)
                  const values = sorted.map(d => +(d.value / 1000).toFixed(1))
                  const changes = values.map((v, i) => i === 0 ? 0 : +(v - values[i - 1]).toFixed(1))
                  return <Bar data={{
                    labels: sorted.map(d => d.date.slice(5)),
                    datasets: [{
                      label: 'Inventory (M bbl)',
                      data: values,
                      backgroundColor: changes.map(c => c > 0 ? 'rgba(255,71,87,0.6)' : 'rgba(0,196,143,0.6)'),
                      borderColor: changes.map(c => c > 0 ? 'rgba(255,71,87,0.8)' : 'rgba(0,196,143,0.8)'),
                      borderWidth: 1,
                      borderRadius: 2,
                    }],
                  }} options={{
                    ...CHART_OPTS,
                    plugins: { ...CHART_OPTS.plugins, tooltip: { callbacks: { label: (ctx) => `${ctx.raw}M bbl` } } },
                    scales: {
                      ...CHART_OPTS.scales,
                      y: { ...CHART_OPTS.scales.y, ticks: { ...CHART_OPTS.scales.y.ticks, callback: v => `${v}M` } },
                    },
                  }} />
                })()}
              </div>
              {(() => {
                const eiaKey = Object.keys(eia || {})[0]
                const series = eia?.[eiaKey]?.series
                if (!series || series.length < 2) return null
                const latest = series[0].value / 1000
                const prev = series[1].value / 1000
                const chg = latest - prev
                return <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Latest: <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latest.toFixed(1)}M bbl</span>
                  <span style={{ marginLeft: 8, color: chg > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {chg > 0 ? '+' : ''}{chg.toFixed(1)}M ({chg > 0 ? 'Build' : 'Draw'})
                  </span>
                </div>
              })()}
            </div>

            {/* CFTC Net Positioning */}
            <div className="card" style={{ borderTop: '2px solid var(--purple)', padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span className="card-title">CFTC Managed Money Positioning</span>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>Net Long/Short — Commitments of Traders</div>
                </div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{cftc?.parsed?.reportDate || ''}</span>
              </div>
              <div style={{ height: 170 }}>
                {(() => {
                  const markets = cftc?.parsed?.markets
                  if (!markets || markets.length === 0) return <div className="text-muted" style={{ textAlign: 'center', paddingTop: 60, fontSize: 11 }}>No CFTC data available</div>
                  const labels = markets.map(m => m.label || m.key)
                  const netData = markets.map(m => m.latest?.managedMoneyNet || 0)
                  const colors = netData.map(v => v >= 0 ? 'rgba(0,196,143,0.7)' : 'rgba(255,71,87,0.7)')
                  return <Bar data={{
                    labels,
                    datasets: [{
                      label: 'Managed Money Net',
                      data: netData,
                      backgroundColor: colors,
                      borderColor: colors.map(c => c.replace('0.7', '1')),
                      borderWidth: 1,
                      borderRadius: 3,
                    }],
                  }} options={{
                    ...CHART_OPTS,
                    indexAxis: 'y',
                    scales: {
                      x: { ...CHART_OPTS.scales.x, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', font: { size: 9, family: "'JetBrains Mono'" }, callback: v => v >= 1000 || v <= -1000 ? `${(v/1000).toFixed(0)}K` : v } },
                      y: { grid: { display: false }, ticks: { color: '#8899b4', font: { size: 10, family: "'JetBrains Mono'", weight: 600 } } },
                    },
                  }} />
                })()}
              </div>
              {(() => {
                const markets = cftc?.parsed?.markets
                if (!markets) return null
                const totalNet = markets.reduce((s, m) => s + (m.latest?.managedMoneyNet || 0), 0)
                return <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Aggregate Net: <span style={{ fontWeight: 700, color: totalNet >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString()} contracts
                  </span>
                  <span style={{ marginLeft: 6 }}>({totalNet >= 0 ? 'NET LONG' : 'NET SHORT'})</span>
                </div>
              })()}
            </div>
          </div>
          {/* Spreads + Macro row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 16, marginTop: 10 }}>
            <div className="card" style={{ padding: '16px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>BRN-WTI</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: (brnWtiSpread || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>{brnWtiSpread !== null ? `$${brnWtiSpread}` : '—'}</div>
            </div>
            {['NG', 'DXY', 'GOLD'].map(key => {
              const p = prices[key]
              const up = (p?.change || 0) >= 0
              return (
                <div key={key} className="card" style={{ padding: '16px 10px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em' }}>{p?.name || key}</div>
                  <div className="mono" style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{p?.price > 0 ? formatPrice(p.price, Math.min(p.decimals, 2), p.unit) : '—'}</div>
                  <div className="mono" style={{ fontSize: 10, color: up ? 'var(--green)' : 'var(--red)' }}>{p?.price > 0 ? `${up ? '+' : ''}${p.pct}%` : ''}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Analytics Sidebar */}
        <div style={{ display: 'grid', gap: 20, minWidth: 0 }}>

          {/* AI */}
          <div className="card card-gold" style={{ padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="card-title">AI Brief</span>
              <button onClick={fetchAI} disabled={aiLoading} style={{
                background: 'var(--gold-dim)', border: '1px solid rgba(245,166,35,0.2)',
                borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontSize: 9,
                color: 'var(--gold)', fontWeight: 600,
              }}>{aiLoading ? '⏳' : '✨ Gen'}</button>
            </div>
            <div className="ai-commentary-box" style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)', maxHeight: 160, overflowY: 'auto' }}>
              {aiCommentary ? (
                <ReactMarkdown>{aiCommentary}</ReactMarkdown>
              ) : (
                'Click Gen for AI analysis.\\nNeeds GEMINI_API_KEY in .env'
              )}
            </div>
          </div>

          {/* News */}
          <div className="card card-accent" style={{ padding: 12, maxHeight: 220, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="card-title">Flash Headlines</span>
              <span className="badge badge-cyan" style={{ fontSize: 9 }}>{news.length}</span>
            </div>
            {news.slice(0, 4).map((item, i) => (
              <div key={i} style={{ paddingBottom: 5, borderBottom: '1px solid var(--border-subtle)', marginBottom: 5, fontSize: 11 }}>
                <div style={{ color: 'var(--cyan)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                  {item.src} • {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontWeight: 500, lineHeight: 1.3, marginTop: 1 }}>{item.title}</div>
              </div>
            ))}
            {news.length === 0 && <div className="text-muted" style={{ fontSize: 11 }}>Connecting...</div>}
          </div>

          {/* ── SENTIMENT (FUNDAMENTAL) ── */}
          <div className="card card-accent" style={{ padding: 12 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>Energy Sentiment (Fundamental)</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6, border: '1px solid rgba(0,196,143,0.2)', background: 'var(--green-dim)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)' }}>{sentiment.bull}%</div>
                <div style={{ fontSize: 8, color: 'var(--green)', fontWeight: 700 }}>BULL</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '6px 4px', borderRadius: 6, border: '1px solid rgba(255,71,87,0.2)', background: 'var(--red-dim)' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--red)' }}>{sentiment.bear}%</div>
                <div style={{ fontSize: 8, color: 'var(--red)', fontWeight: 700 }}>BEAR</div>
              </div>
            </div>
            
            {/* Fundamental Breakdown */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}>
              {sentiment.breakdown && Object.entries(sentiment.breakdown).map(([key, data]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, fontSize: 10 }}>
                  <span style={{ color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{key}</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{data.label}</span>
                    <span className={`badge ${data.bias === 'BULLISH' ? 'badge-green' : data.bias === 'BEARISH' ? 'badge-red' : 'badge-gold'}`} style={{ fontSize: 8, padding: '2px 4px' }}>
                      {data.bias}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 8 }}>
              Method: {sentiment.method}
            </div>
          </div>

          {/* ── FAIR VALUE (REAL OLS REGRESSION) ── */}
          <div className="card card-accent" style={{ padding: 12 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>WTI Fair Value — OLS Regression</div>
            {fairValue ? (
              <div className="mono" style={{ fontSize: 11 }}>
                <Row label="Live" value={`$${fairValue.live}`} />
                <Row label="Model Fair" value={`$${fairValue.fair}`} color="var(--gold)" />
                <Row label="Residual" value={`${fairValue.gap > 0 ? '+' : ''}${fairValue.gap}`} color={fairValue.gap > 0 ? 'var(--red)' : 'var(--green)'} />
                <div style={{ textAlign: 'center', margin: '6px 0' }}>
                  <span className={`badge ${fairValue.signal === 'OVERVALUED' ? 'badge-red' : fairValue.signal === 'UNDERVALUED' ? 'badge-green' : 'badge-cyan'}`}>{fairValue.signal}</span>
                </div>
                {/* Regression coefficients */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--font-ui)', marginBottom: 3 }}>REGRESSION</div>
                  <Row label="β DXY" value={fairValue.coefficients.dxy} small />
                  <Row label="β Crack" value={fairValue.coefficients.crackSpread} small />
                  <Row label="Intercept" value={fairValue.coefficients.intercept} small />
                  <Row label="R²" value={fairValue.rSquared} color={fairValue.rSquared > 0.5 ? 'var(--green)' : 'var(--orange)'} small />
                </div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-ui)', lineHeight: 1.3 }}>
                  {fairValue.window}-day OLS: WTI ~ DXY + Crack Spread
                </div>
              </div>
            ) : <div className="text-muted" style={{ fontSize: 11 }}>Loading regression data...</div>}
          </div>

          {/* ── CONFLUENCE (ALL 5 ENERGY PRODUCTS) ── */}
          <div className="card card-gold" style={{ padding: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Energy Technical Confluence</div>
            {allConfluence ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: 16 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: '50%', margin: '0 auto',
                    border: `3px solid ${allConfluence.aggregate > 60 ? 'var(--green)' : allConfluence.aggregate < 40 ? 'var(--red)' : 'var(--gold)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: allConfluence.aggregate > 60 ? 'var(--green-dim)' : allConfluence.aggregate < 40 ? 'var(--red-dim)' : 'rgba(245,166,35,0.05)',
                  }}>
                    <span className="mono" style={{ fontSize: 17, fontWeight: 800, color: allConfluence.aggregate > 60 ? 'var(--green)' : allConfluence.aggregate < 40 ? 'var(--red)' : 'var(--gold)' }}>
                      {allConfluence.aggregate}%
                    </span>
                  </div>
                  <span className={`badge ${allConfluence.bias === 'BULLISH' ? 'badge-green' : allConfluence.bias === 'BEARISH' ? 'badge-red' : 'badge-gold'}`} style={{ marginTop: 6 }}>
                    {allConfluence.bias}
                  </span>
                </div>
                {/* Per-product scores */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>PER PRODUCT</div>
                  {Object.entries(allConfluence.products).map(([key, c]) => (
                    <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{key}</span>
                      <span style={{ fontWeight: 600, color: c.score > 60 ? 'var(--green)' : c.score < 40 ? 'var(--red)' : 'var(--gold)' }}>
                        {c.score}% {c.bias}
                      </span>
                    </div>
                  ))}
                </div>
                {/* WTI indicators detail */}
                {allConfluence.products.WTI && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 4 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.1em', fontFamily: 'var(--font-ui)', marginBottom: 4 }}>WTI SIGNALS</div>
                    {allConfluence.products.WTI.indicators.map((ind, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: 10 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{ind.name}</span>
                        <span style={{ color: ind.signal > 0 ? 'var(--green)' : ind.signal < 0 ? 'var(--red)' : 'var(--text-muted)', fontWeight: 600 }}>
                          {ind.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

              </>
            ) : <div className="text-muted" style={{ fontSize: 11 }}>Loading...</div>}
          </div>

          {/* Macro */}
          <div className="card" style={{ padding: 10 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>Macro</div>
            {['SPX', 'US10Y', 'EURUSD'].map(key => {
              const p = prices[key]
              const up = (p?.change || 0) >= 0
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border-subtle)', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{p?.name || key}</span>
                  <span className="mono" style={{ fontWeight: 600 }}>
                    {p?.price > 0 ? formatPrice(p.price, Math.min(p.decimals, 2), p.unit) : '—'}
                    <span style={{ color: up ? 'var(--green)' : 'var(--red)', marginLeft: 6, fontSize: 10 }}>{p?.price > 0 ? `${up ? '+' : ''}${p.pct}%` : ''}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, color, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: small ? '1px 0' : '2px 0' }}>
      <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontSize: small ? 10 : 11 }}>{label}</span>
      <span style={{ fontWeight: 600, color: color || 'var(--text-primary)', fontSize: small ? 10 : 11 }}>{value}</span>
    </div>
  )
}
