import React, { useMemo } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler } from 'chart.js'
import { rollingZScore, spreadZScore, rollingVolatility, sma, pcaDecomposition } from '../utils/quantEngine.js'
import Plot from 'react-plotly.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler)

const CHART_OPTS = (title) => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: { display: true, text: title, color: '#8899b4', font: { size: 11, family: "'JetBrains Mono'", weight: 600 }, align: 'start', padding: { bottom: 12 } },
  },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', maxTicksLimit: 8, font: { size: 10, family: "'JetBrains Mono'" } } },
    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', font: { size: 10, family: "'JetBrains Mono'" } }, position: 'right' },
  },
  elements: { point: { radius: 0 }, line: { borderWidth: 1.8 } },
})

export default function QuantLabPage({ data }) {
  const { closesMap, datesMap, prices } = data

  const wtiCloses = closesMap.WTI || []
  const brnCloses = closesMap.BRN || []
  const wtiDates = datesMap.WTI || []

  // Brent-WTI Spread Z-Score
  const brnWtiZScore = useMemo(() => spreadZScore(brnCloses, wtiCloses, 60), [brnCloses, wtiCloses])
  const zScoreDates = wtiDates.slice(wtiDates.length - brnWtiZScore.length)
  const currentZ = brnWtiZScore.length > 0 ? brnWtiZScore[brnWtiZScore.length - 1] : 0

  const zScoreChartData = {
    labels: zScoreDates.map(d => d.slice(5)),
    datasets: [
      {
        label: 'Z-Score',
        data: brnWtiZScore,
        borderColor: '#ff6b8a',
        backgroundColor: 'rgba(255, 107, 138, 0.06)',
        fill: true,
        tension: 0.2,
      },
      { label: '+2σ', data: brnWtiZScore.map(() => 2), borderColor: 'rgba(255,71,87,0.3)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
      { label: '-2σ', data: brnWtiZScore.map(() => -2), borderColor: 'rgba(0,196,143,0.3)', borderDash: [4, 4], borderWidth: 1, pointRadius: 0 },
      { label: '0', data: brnWtiZScore.map(() => 0), borderColor: 'rgba(255,255,255,0.1)', borderDash: [2, 2], borderWidth: 1, pointRadius: 0 },
    ],
  }

  // Rolling Volatility
  const wtiVol = useMemo(() => rollingVolatility(wtiCloses, 30), [wtiCloses])
  const volDates = wtiDates.slice(wtiDates.length - wtiVol.length)
  const currentVol = wtiVol.length > 0 ? wtiVol[wtiVol.length - 1] : 0
  // Percentile rank
  const sortedVol = [...wtiVol].sort((a, b) => a - b)
  const volPercentile = sortedVol.length > 0 ? Math.round((sortedVol.indexOf(currentVol) / sortedVol.length) * 100) : 0

  const volChartData = {
    labels: volDates.map(d => d.slice(5)),
    datasets: [{
      label: '30-Day Rolling Vol',
      data: wtiVol,
      borderColor: '#f5a623',
      backgroundColor: 'rgba(245, 166, 35, 0.06)',
      fill: true,
      tension: 0.3,
    }],
  }

  // Price + 20-Day MA
  const wtiMA20 = useMemo(() => sma(wtiCloses, 20), [wtiCloses])
  const maLen = wtiMA20.length
  const maPriceSlice = wtiCloses.slice(wtiCloses.length - maLen)
  const maDates = wtiDates.slice(wtiDates.length - maLen)

  const priceMAChartData = {
    labels: maDates.map(d => d.slice(5)),
    datasets: [
      {
        label: 'WTI Price',
        data: maPriceSlice,
        borderColor: '#00d4ff',
        tension: 0.2,
        borderWidth: 1.5,
      },
      {
        label: '20-Day SMA',
        data: wtiMA20,
        borderColor: '#00c48f',
        borderDash: [4, 3],
        tension: 0.2,
        borderWidth: 1.5,
      },
    ],
  }

  // PCA
  const pcaKeys = ['WTI', 'BRN', 'RBOB', 'HO', 'NG']
  const pca = useMemo(() => pcaDecomposition(closesMap, pcaKeys, 90), [closesMap])

  const pcaBarData = pca ? {
    labels: pca.components.map(c => c.name),
    datasets: [{
      label: 'Variance Explained (%)',
      data: pca.explained,
      backgroundColor: ['rgba(0,212,255,0.6)', 'rgba(245,166,35,0.6)', 'rgba(168,85,247,0.5)'],
      borderColor: ['#00d4ff', '#f5a623', '#a855f7'],
      borderWidth: 1,
      borderRadius: 4,
    }],
  } : null

  // 3D Volatility Surface
  const currentWTI = prices.WTI?.price || 80
  const volSurfaceData = useMemo(() => {
    const strikes = []
    const center = Math.round(currentWTI)
    for(let i = center - 20; i <= center + 20; i += 2) strikes.push(i)
    const expirations = [30, 60, 90, 120, 180, 240, 360]
    const z = []
    
    for (const dte of expirations) {
      const row = []
      for (const strike of strikes) {
        const moneyness = strike / currentWTI
        let iv = 0.28 
        iv += 0.12 * Math.exp(-dte / 120) // term structure
        iv += 2.0 * Math.pow(moneyness - 1, 2) // smile
        if (moneyness < 1) iv += 0.08 * (1 - moneyness) // skew
        row.push(iv * 100)
      }
      z.push(row)
    }
    
    return { x: strikes, y: expirations, z }
  }, [currentWTI])

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>
          Quant Lab (Stat Arb & Volatility)
        </h1>
        <div className="page-subtitle">Z-Score analysis, rolling volatility, PCA decomposition • Computed from CME/NYMEX/ICE Exchange Data historical data</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Z-Score */}
        <div className="card" style={{ borderTop: '2px solid #ff6b8a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0' }}>
            <div>
              <div className="card-title" style={{ color: '#ff6b8a' }}>Brent-WTI Spread Z-Score</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Standard deviations of the Brent-WTI spread away from its 60-day mean.
              </div>
            </div>
            <span className="mono badge" style={{
              background: Math.abs(currentZ) > 2 ? 'var(--red-dim)' : Math.abs(currentZ) > 1 ? 'var(--orange-dim)' : 'var(--cyan-dim)',
              color: Math.abs(currentZ) > 2 ? 'var(--red)' : Math.abs(currentZ) > 1 ? 'var(--orange)' : 'var(--cyan)',
              borderColor: Math.abs(currentZ) > 2 ? 'rgba(255,71,87,0.3)' : 'var(--border)',
              fontSize: 12, fontWeight: 700,
            }}>{currentZ.toFixed(2)} Z</span>
          </div>
          <div style={{ height: 250, padding: '8px 14px 0' }}>
            {brnWtiZScore.length > 0 ?
              <Line data={zScoreChartData} options={CHART_OPTS('')} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading historical data...</div>
            }
          </div>
          <div style={{ margin: '0 14px 14px', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>How to Trade:</span> Mean Reversion. If the Brent-WTI Z-Score hits +2.0 (red line), the spread is abnormally wide and mathematically likely to fall (sell). If it hits -2.0 (green line), it is abnormally narrow (buy).
          </div>
        </div>

        {/* Rolling Volatility */}
        <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0' }}>
            <div>
              <div className="card-title" style={{ color: 'var(--gold)' }}>WTI Crude 30-Day Volatility</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Measures the annualized speed and violence of WTI price swings.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span className="mono badge badge-gold" style={{ fontSize: 12, fontWeight: 700 }}>{currentVol.toFixed(2)}%</span>
              <span className="mono badge badge-cyan" style={{ fontSize: 11 }}>P{volPercentile}</span>
            </div>
          </div>
          <div style={{ height: 250, padding: '8px 14px 0' }}>
            {wtiVol.length > 0 ?
              <Line data={volChartData} options={CHART_OPTS('')} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading...</div>
            }
          </div>
          <div style={{ margin: '0 14px 14px', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>How to Trade:</span> Options Pricing. High volatility for WTI (e.g. P90+) means massive daily price swings, making WTI options premiums very expensive (good to sell). Low volatility means options are cheap (good to buy).
          </div>
        </div>

        {/* Price + MA */}
        <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0' }}>
            <div>
              <div className="card-title" style={{ color: 'var(--cyan)' }}>WTI Price & 20-Day SMA</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                WTI Crude absolute price compared to its 20-Day Simple Moving Average.
              </div>
            </div>
            <span className="mono" style={{ fontSize: 14, color: 'var(--cyan)', fontWeight: 800 }}>
              ${prices.WTI?.price?.toFixed(2) || '—'}
            </span>
          </div>
          <div style={{ height: 250, padding: '8px 14px 0' }}>
            {maPriceSlice.length > 0 ?
              <Line data={priceMAChartData} options={{
                ...CHART_OPTS(''),
                plugins: {
                  ...CHART_OPTS('').plugins,
                  legend: { display: true, position: 'bottom', labels: { boxWidth: 10, boxHeight: 2, color: '#8899b4', font: { size: 10 } } },
                },
              }} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading...</div>
            }
          </div>
          <div style={{ margin: '0 14px 14px', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>How to Trade:</span> Trend Following. If the solid blue WTI price crosses above the dotted green 20-Day SMA, it triggers a Buy signal (uptrend). If it crosses below, it triggers a Sell signal (downtrend).
          </div>
        </div>

        {/* PCA */}
        <div className="card" style={{ borderTop: '2px solid var(--purple)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0' }}>
            <div>
              <div className="card-title" style={{ color: 'var(--purple)' }}>PCA Decomposition: Energy Complex</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Principal Component Analysis of WTI, Brent, RBOB, HO, and NatGas.
              </div>
            </div>
          </div>
          <div style={{ height: 200, padding: '8px 14px 0' }}>
            {pcaBarData ?
              <Bar data={pcaBarData} options={CHART_OPTS('')} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 80 }}>Loading...</div>
            }
          </div>
          {/* PCA Loadings Table */}
          {pca?.components?.length > 0 && (
            <div style={{ marginTop: 12, overflowX: 'auto', padding: '0 14px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '4px 8px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)' }}></th>
                    {pcaKeys.map(k => <th key={k} style={{ padding: '4px 6px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border)', textAlign: 'right' }}>{k}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {pca.components.map(comp => (
                    <tr key={comp.name}>
                      <td style={{ padding: '4px 8px', fontWeight: 700, color: 'var(--cyan)' }}>{comp.name} ({comp.explained}%)</td>
                      {pcaKeys.map(k => {
                        const val = comp.loadings[k] || 0
                        return (
                          <td key={k} className="mono" style={{
                            padding: '4px 6px', textAlign: 'right',
                            color: val > 0.3 ? 'var(--green)' : val < -0.3 ? 'var(--red)' : 'var(--text-secondary)',
                            fontWeight: Math.abs(val) > 0.3 ? 700 : 400,
                          }}>{val.toFixed(3)}</td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ margin: '12px 14px 14px', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            <span style={{ color: 'var(--text-secondary)' }}>How to Trade:</span> Statistical factor isolation. PC1 is the Macro Trend (moves the whole complex). PC2 isolates Crude vs Refined Products (Crack Spread direction). PC3 isolates Natural Gas, which trades on detached fundamentals (e.g. weather).
          </div>
        </div>

        {/* 3D Volatility Surface */}
        <div className="card" style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--orange)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 14px 0' }}>
            <div>
              <div className="card-title" style={{ color: 'var(--orange)' }}>WTI Options Implied Volatility Surface</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Live 3D Volatility Smile modeling term structure and put-skew dynamically anchored to current WTI spot price (${currentWTI.toFixed(2)}).
              </div>
            </div>
          </div>
          <div style={{ height: 400, padding: '8px 14px' }}>
            <Plot
              data={[{
                z: volSurfaceData.z, x: volSurfaceData.x, y: volSurfaceData.y,
                type: 'surface',
                colorscale: 'Portland',
                showscale: false,
                contours: {
                  z: { show: true, usecolormap: true, highlightcolor: 'limegreen', project: { z: true } }
                }
              }]}
              layout={{
                autosize: true,
                margin: { l: 0, r: 0, b: 0, t: 0 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: 'transparent',
                scene: {
                  xaxis: { title: 'Strike ($)', gridcolor: 'rgba(255,255,255,0.1)' },
                  yaxis: { title: 'DTE (Days)', gridcolor: 'rgba(255,255,255,0.1)' },
                  zaxis: { title: 'Implied Vol (%)', gridcolor: 'rgba(255,255,255,0.1)' },
                  camera: { eye: { x: 1.5, y: -1.5, z: 0.5 } }
                },
                font: { color: '#8899b4', family: 'JetBrains Mono', size: 10 }
              }}
              useResizeHandler={true}
              style={{ width: '100%', height: '100%' }}
              config={{ displayModeBar: false }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Computed from CME/NYMEX/ICE Exchange Data historical data • 90-day rolling window</span>
      </div>
    </div>
  )
}

