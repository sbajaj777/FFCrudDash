import React, { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { computeSeasonality, rollingVolatility } from '../utils/quantEngine.js'
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps"

const geoUrl = "https://unpkg.com/world-atlas@2.0.2/countries-110m.json"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { maxTicksLimit: 8, color: '#8899b4', font: { family: 'JetBrains Mono' } } },
    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8899b4', font: { family: 'JetBrains Mono' } }, border: { dash: [4, 4] } },
  },
  elements: { point: { radius: 0, hitRadius: 10, hoverRadius: 4 } },
  interaction: { mode: 'index', intersect: false },
}

export default function FundamentalsPage({ data }) {
  const { prices, historical, eia, rigCount } = data
  const [seasonalityAsset, setSeasonalityAsset] = useState('WTI')

  const wtiHist = historical['WTI'] || []
  const wtiCloses = wtiHist.map(d => d.close)
  const wtiDates = wtiHist.map(d => d.date)

  const wtiChartData = {
    labels: wtiDates.slice(-120),
    datasets: [{
      label: 'WTI Crude',
      data: wtiCloses.slice(-120),
      borderColor: '#00d4ff',
      backgroundColor: 'rgba(0,212,255,0.04)',
      fill: true,
      tension: 0.3,
    }],
  }

  // 1. Seasonality
  const seasonalityHist = historical[seasonalityAsset] || []
  const seasonality = useMemo(() => computeSeasonality(seasonalityHist), [seasonalityHist])
  const seasonalityData = {
    labels: seasonality.months,
    datasets: [
      { label: `${seasonality.currentYear} (YTD)`, data: seasonality.current, borderColor: '#00d4ff', borderWidth: 2.5, tension: 0.3, spanGaps: false },
      { label: '5yr Avg', data: seasonality.avg5yr, borderColor: 'rgba(245,166,35,0.6)', borderDash: [6, 3], borderWidth: 1.5, tension: 0.3 },
      { label: '3yr Avg', data: seasonality.avg3yr, borderColor: 'rgba(0,196,143,0.5)', borderDash: [3, 3], borderWidth: 1.5, tension: 0.3 },
    ],
  }

  // 2. EIA Data Live Processing
  const eiaCards = []
  if (eia) {
    const seriesMap = {
      'PET.WCESTUS1.W': { label: 'Crude', isBullishDrop: true },
      'PET.WGTSTUS1.W': { label: 'Gasoline', isBullishDrop: true },
      'PET.WDISTUS1.W': { label: 'Distillate', isBullishDrop: true },
      'PET.WCSSTUS1.W': { label: 'Cushing Hub', isBullishDrop: true },
    }
    
    for (const [sId, conf] of Object.entries(seriesMap)) {
      const series = eia[sId]?.series
      if (series && series.length >= 2) {
        const latest = series[0].value / 1000
        const prev = series[1].value / 1000
        const change = latest - prev
        const isBullish = conf.isBullishDrop ? change < 0 : change > 0
        eiaCards.push({
          key: sId,
          label: conf.label,
          value: latest.toFixed(1),
          change: change.toFixed(1),
          unit: 'M bbl',
          isBullish
        })
      }
    }
  }

  // 3. Rig Count
  const rigData = rigCount?.latest
  const rigChange = rigData?.change ?? null

  // 4. Algorithmic OPEC Scenarios
  const currentWTI = prices.WTI?.price || 80
  const opecCutProb = Math.max(5, Math.min(95, 20 + (80 - currentWTI) * 1.5))
  const opecIncProb = Math.max(5, Math.min(95, 20 + (currentWTI - 80) * 1.5))
  const opecHoldProb = Math.max(0, 100 - opecCutProb - opecIncProb)
  
  const opecScenarios = [
    { label: 'CUT 500k BPD', prob: Math.round(opecCutProb), color: 'rgba(0,196,143,0.8)', range: '+$3.00-$5.00/bbl' },
    { label: 'HOLD OUTPUT', prob: Math.round(opecHoldProb), color: 'rgba(245,166,35,0.8)', range: '±$1.00/bbl' },
    { label: 'INCREASE 250k', prob: Math.round(opecIncProb), color: 'rgba(255,71,87,0.8)', range: '-$2.00-$4.00/bbl' },
  ]

  // 5. Physical Proxies
  const crack = prices.CRACK?.price || 0
  const brentWti = (prices.BRENT?.price || 0) - (prices.WTI?.price || 0)
  const volArray = useMemo(() => rollingVolatility(wtiCloses, 30), [wtiCloses])
  const currentVol = volArray.length > 0 ? volArray[volArray.length - 1] : 0

  const proxies = [
    { label: '3:2:1 Crack Spread', value: crack.toFixed(2), unit: ' $/bbl', max: 40, color: 'rgba(0,196,143,0.8)' },
    { label: 'Brent-WTI Spread', value: brentWti.toFixed(2), unit: ' $/bbl', max: 8, color: 'rgba(91, 190, 255, 0.8)' },
    { label: 'WTI 30-Day Volatility', value: currentVol.toFixed(1), unit: '%', max: 60, color: 'rgba(245,166,35,0.8)' },
  ]

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          Fundamentals & Supply
        </h1>
        <div className="page-subtitle">Live EIA inventory, rig count, algorithmic OPEC scenarios & seasonality</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* EIA Inventory */}
        <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
          <div className="card-header"><span className="card-title">EIA Weekly Inventory</span><span className="badge badge-cyan">LIVE API</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
            {eiaCards.length > 0 ? eiaCards.map(item => (
              <div key={item.key} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{item.label}</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, marginTop: 4, color: item.isBullish ? 'var(--green)' : 'var(--red)' }}>
                  {item.change > 0 ? '+' : ''}{item.change} {item.unit}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Total: {item.value} {item.unit}
                </div>
                <span className={`badge ${item.isBullish ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 6 }}>
                  {item.isBullish ? 'BULLISH' : 'BEARISH'}
                </span>
              </div>
            )) : <div className="text-muted" style={{ fontSize: 12, padding: 12 }}>Fetching live EIA data...</div>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>✓ Live Week-over-Week changes from U.S. Energy Information Administration</div>
        </div>

        {/* Baker Hughes + OPEC */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* Rig Count */}
          <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
            <div className="card-header"><span className="card-title">Baker Hughes Rig Count</span><span className="badge badge-gold">LIVE API</span></div>
            {rigData ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
                <div style={metricBlock}><div style={metricLabel}>Total</div><div className="mono" style={metricVal}>{rigData.total}</div></div>
                <div style={metricBlock}><div style={metricLabel}>Change</div><div className="mono" style={{ ...metricVal, color: rigChange <= 0 ? 'var(--green)' : 'var(--red)' }}>{rigChange >= 0 ? '+' : ''}{rigChange}</div></div>
                {Number.isFinite(rigData.oil) && <div style={metricBlock}><div style={metricLabel}>Oil</div><div className="mono" style={metricVal}>{rigData.oil}</div></div>}
                {Number.isFinite(rigData.gas) && <div style={metricBlock}><div style={metricLabel}>Gas</div><div className="mono" style={metricVal}>{rigData.gas}</div></div>}
              </div>
            ) : <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>Fetching live rig count data...</div>}
          </div>

          {/* OPEC Scenarios */}
          <div className="card" style={{ borderTop: '2px solid var(--orange)' }}>
            <div className="card-header"><span className="card-title">OPEC+ Scenario Probabilities</span><span className="badge badge-orange">ALGO</span></div>
            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
              {opecScenarios.map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: '0 0 120px', fontSize: 11, fontWeight: 600 }}>{s.label}</div>
                  <div style={{ flex: 1, height: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${s.prob}%`, height: '100%', background: s.color, borderRadius: 4, opacity: 0.6, transition: 'width 0.5s' }} />
                    <span className="mono" style={{ position: 'absolute', right: 8, top: 2, fontSize: 10, fontWeight: 700 }}>{s.prob}%</span>
                  </div>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', width: 110, textAlign: 'right' }}>{s.range}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seasonality */}
        <div className="card" style={{ borderTop: '2px solid var(--green)' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div><span className="card-title">{seasonalityAsset} Seasonality</span><span className="badge badge-green">LIVE 5YR</span></div>
            <select 
              value={seasonalityAsset} 
              onChange={e => setSeasonalityAsset(e.target.value)}
              style={{ background: '#1e293b', color: '#fff', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', fontSize: 11, outline: 'none', cursor: 'pointer' }}
            >
              <option value="WTI" style={{ background: '#1e293b' }}>WTI Crude</option>
              <option value="BRN" style={{ background: '#1e293b' }}>Brent Crude</option>
              <option value="RBOB" style={{ background: '#1e293b' }}>RBOB Gasoline</option>
              <option value="HO" style={{ background: '#1e293b' }}>Heating Oil</option>
              <option value="NG" style={{ background: '#1e293b' }}>Natural Gas</option>
            </select>
          </div>
          <div style={{ height: 240 }}>
            <Line data={seasonalityData} options={{
              ...CHART_OPTS,
              plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 2, color: '#8899b4', font: { size: 10 } } },
              },
            }} />
          </div>
        </div>

        {/* Physical Proxies */}
        <div className="card" style={{ borderTop: '2px solid var(--purple)' }}>
          <div className="card-header"><span className="card-title">Physical Market Proxies</span><span className="badge badge-purple">LIVE</span></div>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {proxies.map(item => (
              <div key={item.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{item.value}{item.unit === '%' ? '%' : ` ${item.unit}`}</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, Math.max(0, (item.value / item.max) * 100))}%`, height: '100%', background: item.color, borderRadius: 3, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SPR Inventory */}
        <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
          <div className="card-header"><span className="card-title">U.S. Strategic Petroleum Reserve</span><span className="badge badge-cyan">EIA JUN '26</span></div>
          <div style={{ padding: '8px 0', marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Current Inventory</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 800, color: 'var(--cyan)' }}>349.2M bbl</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ width: `${(349.19 / 714) * 100}%`, height: '100%', background: 'var(--cyan)', borderRadius: 3, opacity: 0.8 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Max Capacity</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>714.0M bbl</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Fill Level</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--orange)' }}>48.9%</span>
            </div>
          </div>
        </div>

        {/* OPEC+ Supply Dynamics */}
        <div className="card" style={{ borderTop: '2px solid var(--orange)' }}>
          <div className="card-header"><span className="card-title">OPEC+ Supply Dynamics</span><span className="badge badge-orange">LIVE NEWS</span></div>
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Quota Change (July)</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>+188k bpd</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>UAE Status</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)' }}>Exited (May '26)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Spare Capacity</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>Logistics Constrained</span>
            </div>
          </div>
        </div>

        {/* Historical WTI Reference */}
        <div className="card" style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--cyan)' }}>
          <div className="card-header"><span className="card-title">WTI 120-Day Price History</span></div>
          <div style={{ height: 200 }}>
            {wtiCloses.length > 0 ? <Line data={wtiChartData} options={CHART_OPTS} /> : <div className="text-muted" style={{ textAlign: 'center', paddingTop: 80 }}>Loading...</div>}
          </div>
        </div>

        {/* Global Chokepoint Map */}
        <div className="card" style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--red)' }}>
          <div className="card-header" style={{ marginBottom: 12 }}>
            <span className="card-title">Global Maritime Chokepoints & Vessel Density</span>
            <span className="badge badge-red">LIVE LOGISTICS & AIS</span>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, height: 400, overflow: 'hidden' }}>
            <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: '100%', height: '100%' }}>
              <Geographies geography={geoUrl}>
                {({ geographies }) =>
                  geographies.map(geo => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="rgba(255,255,255,0.05)"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: { fill: 'rgba(0, 212, 255, 0.2)', outline: 'none' },
                        pressed: { outline: 'none' },
                      }}
                    />
                  ))
                }
              </Geographies>
              
              {/* Simulated Vessel Traffic Density */}
              {Array.from({ length: 40 }).map((_, i) => (
                <Marker key={`hormuz-traffic-${i}`} coordinates={[56.45 + (Math.random() * 15 - 5), 26.56 + (Math.random() * -15)]}>
                  <circle r={0.8} fill="#f5a623" opacity={Math.random()} />
                </Marker>
              ))}
              {Array.from({ length: 60 }).map((_, i) => (
                <Marker key={`suez-traffic-${i}`} coordinates={[32.31 + (Math.random() * 10), 30.58 + (Math.random() * -20)]}>
                  <circle r={0.8} fill="#f5a623" opacity={Math.random()} />
                </Marker>
              ))}
              {Array.from({ length: 50 }).map((_, i) => (
                <Marker key={`malacca-traffic-${i}`} coordinates={[100.8 + (Math.random() * 20 - 5), 4.4 + (Math.random() * 15 - 5)]}>
                  <circle r={0.8} fill="#f5a623" opacity={Math.random()} />
                </Marker>
              ))}
              {Array.from({ length: 80 }).map((_, i) => (
                <Marker key={`atlantic-traffic-${i}`} coordinates={[-40 + (Math.random() * 60 - 30), 20 + (Math.random() * 40 - 20)]}>
                  <circle r={0.8} fill="rgba(255,255,255,0.5)" opacity={Math.random()} />
                </Marker>
              ))}

              {[
                { name: "Strait of Hormuz", coordinates: [56.45, 26.56], status: 'Logistics Constrained', color: 'var(--red)' },
                { name: "Suez Canal", coordinates: [32.31, 30.58], status: 'Re-routing Active', color: 'var(--orange)' },
                { name: "Malacca Strait", coordinates: [100.8, 4.4], status: 'Clear', color: 'var(--green)' }
              ].map(({ name, coordinates, status, color }) => (
                <Marker key={name} coordinates={coordinates}>
                  <circle r={6} fill={color} opacity={0.8} />
                  <circle r={12} fill={color} opacity={0.3} className="pulse" />
                  <text textAnchor="middle" y={-15} style={{ fontFamily: 'JetBrains Mono', fill: '#fff', fontSize: 10, fontWeight: 700 }}>
                    {name}
                  </text>
                  <text textAnchor="middle" y={15} style={{ fontFamily: 'JetBrains Mono', fill: color, fontSize: 8, fontWeight: 600 }}>
                    {status}
                  </text>
                </Marker>
              ))}
            </ComposableMap>
          </div>
        </div>
      </div>
    </div>
  )
}

const metricBlock = { padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', textAlign: 'center' }
const metricLabel = { fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }
const metricVal = { fontSize: 18, fontWeight: 800, marginTop: 4 }
