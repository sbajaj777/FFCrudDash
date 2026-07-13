import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', font: { size: 10, family: "'JetBrains Mono'" }, maxTicksLimit: 12 } },
    y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#4a5d7a', font: { size: 10, family: "'JetBrains Mono'" } }, position: 'right' },
  },
  elements: { point: { radius: 0 }, line: { borderWidth: 2 } },
}

export default function CurvesPage({ data }) {
  const { prices, closesMap, datesMap } = data

  // ── Brent-WTI Spread (real historical) ──
  const brnCloses = closesMap.BRN || []
  const wtiCloses = closesMap.WTI || []
  const wtiDates = datesMap.WTI || []
  const spreadLen = Math.min(brnCloses.length, wtiCloses.length)
  const spreadData = [], spreadDates = []
  for (let i = 0; i < spreadLen; i++) {
    if (brnCloses[i] && wtiCloses[i]) {
      spreadData.push(+(brnCloses[i] - wtiCloses[i]).toFixed(2))
      spreadDates.push(wtiDates[i] || '')
    }
  }

  const spreadMean = spreadData.length > 0 ? spreadData.reduce((a, b) => a + b, 0) / spreadData.length : 0
  const spreadStd = spreadData.length > 0 ? Math.sqrt(spreadData.reduce((a, b) => a + (b - spreadMean) ** 2, 0) / spreadData.length) : 1

  const brnWtiChartData = {
    labels: spreadDates.map(d => d.slice(2, 7)),
    datasets: [
      { label: 'Brent-WTI Spread', data: spreadData, borderColor: '#f5a623', backgroundColor: 'rgba(245,166,35,0.06)', fill: true, tension: 0.2 },
      { label: 'Mean', data: spreadData.map(() => +spreadMean.toFixed(2)), borderColor: 'rgba(255,255,255,0.2)', borderDash: [5, 5], borderWidth: 1, pointRadius: 0 },
      { label: '+1\u03c3', data: spreadData.map(() => +(spreadMean + spreadStd).toFixed(2)), borderColor: 'rgba(255,71,87,0.3)', borderDash: [3, 3], borderWidth: 1, pointRadius: 0 },
      { label: '-1\u03c3', data: spreadData.map(() => +(spreadMean - spreadStd).toFixed(2)), borderColor: 'rgba(0,196,143,0.3)', borderDash: [3, 3], borderWidth: 1, pointRadius: 0 },
    ],
  }

  // ── 3:2:1 Crack Spread (real historical) ──
  const rbobCloses = closesMap.RBOB || []
  const hoCloses = closesMap.HO || []
  const crackLen = Math.min(rbobCloses.length, hoCloses.length, wtiCloses.length)
  const crackData = [], crackDates = []
  for (let i = 0; i < crackLen; i++) {
    if (rbobCloses[i] && hoCloses[i] && wtiCloses[i]) {
      crackData.push(+((rbobCloses[i] * 42 * 2 + hoCloses[i] * 42 - wtiCloses[i] * 3) / 3).toFixed(2))
      crackDates.push(wtiDates[i] || '')
    }
  }

  const crackChartData = {
    labels: crackDates.map(d => d.slice(2, 7)),
    datasets: [{ label: '3:2:1 Crack Spread', data: crackData, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.06)', fill: true, tension: 0.2 }],
  }

  // ── HO-RBOB Spread (real historical) ──
  const hoRbobData = []
  const hoRbobLen = Math.min(hoCloses.length, rbobCloses.length)
  for (let i = 0; i < hoRbobLen; i++) {
    if (hoCloses[i] && rbobCloses[i]) {
      hoRbobData.push(+((hoCloses[i] - rbobCloses[i]).toFixed(4)))
    }
  }

  const hoRbobChartData = {
    labels: (datesMap.HO || []).slice(0, hoRbobData.length).map(d => d.slice(2, 7)),
    datasets: [{ label: 'HO-RBOB Spread', data: hoRbobData, borderColor: '#00c48f', backgroundColor: 'rgba(0,196,143,0.06)', fill: true, tension: 0.2 }],
  }

  // Calculate live real-time values from tick data
  const liveWti = prices?.WTI?.price
  const liveBrn = prices?.BRN?.price
  const liveRbob = prices?.RBOB?.price
  const liveHo = prices?.HO?.price

  const latestSpread = (liveBrn != null && liveWti != null) 
    ? +(liveBrn - liveWti).toFixed(2) 
    : spreadData.length > 0 ? spreadData[spreadData.length - 1] : null

  const latestCrack = (liveRbob != null && liveHo != null && liveWti != null)
    ? +((liveRbob * 42 * 2 + liveHo * 42 - liveWti * 3) / 3).toFixed(2)
    : crackData.length > 0 ? crackData[crackData.length - 1] : null

  const latestHoRbob = (liveHo != null && liveRbob != null)
    ? +(liveHo - liveRbob).toFixed(4)
    : hoRbobData.length > 0 ? hoRbobData[hoRbobData.length - 1] : null

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 20Q8 4 21 8"/><path d="M3 16Q10 12 21 14" strokeDasharray="3 2"/></svg>
          Curves & Spreads Analytics
        </h1>
        <div className="page-subtitle">Inter-product spreads and crack analysis • All data from real CME/NYMEX/ICE historical closes</div>
      </div>

      {/* Brent-WTI Spread — full width */}
      <div className="card" style={{ borderTop: '2px solid var(--gold)', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px 0' }}>
          <div>
            <div className="card-title">Brent–WTI Spread</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Formula: <span className="mono" style={{ color: 'var(--text-secondary)' }}>Brent Crude (ICE BZ=F) - WTI Crude (NYMEX CL=F)</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              Measures the premium of international Brent over US WTI • Driven by regional supply/demand, export flows & logistics
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: 'var(--gold)' }}>
              {latestSpread != null ? `$${latestSpread}` : '—'}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Mean: ${spreadMean.toFixed(2)} • σ: ${spreadStd.toFixed(2)}
            </div>
          </div>
        </div>
        <div style={{ height: 260, padding: '8px 14px 14px' }}>
          {spreadData.length > 0 ?
            <Line data={brnWtiChartData} options={CHART_OPTS} /> :
            <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading historical data...</div>
          }
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* 3:2:1 Crack Spread */}
        <div className="card" style={{ borderTop: '2px solid var(--purple)' }}>
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">3:2:1 Crack Spread</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--purple)' }}>
                {latestCrack != null ? `$${latestCrack}` : '—'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Formula: <span className="mono" style={{ color: 'var(--text-secondary)' }}>(RBOB×42×2 + HO×42 - WTI×3) / 3</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              Refining profit margin — 3 bbl crude → 2 bbl gasoline + 1 bbl distillate
            </div>
          </div>
          <div style={{ height: 250, padding: '8px 14px 14px' }}>
            {crackData.length > 0 ?
              <Line data={crackChartData} options={CHART_OPTS} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading...</div>
            }
          </div>
        </div>

        {/* HO-RBOB Spread */}
        <div className="card" style={{ borderTop: '2px solid var(--green)' }}>
          <div style={{ padding: '12px 14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">HO–RBOB Gasoline Spread</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: 'var(--green)' }}>
                {latestHoRbob != null ? `$${latestHoRbob.toFixed(4)}` : '—'}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Formula: <span className="mono" style={{ color: 'var(--text-secondary)' }}>Heating Oil (HO=F $/gal) - RBOB Gasoline (RB=F $/gal)</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
              Distillate vs gasoline relative value • Widens in winter (heating), narrows in summer (driving)
            </div>
          </div>
          <div style={{ height: 250, padding: '8px 14px 14px' }}>
            {hoRbobData.length > 0 ?
              <Line data={hoRbobChartData} options={CHART_OPTS} /> :
              <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading...</div>
            }
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>All spreads computed from real CME/NYMEX/ICE historical closing prices via Yahoo Finance v8</span>
      </div>
    </div>
  )
}
