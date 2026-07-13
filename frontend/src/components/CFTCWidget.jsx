import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function CFTCWidget({ cftc }) {
  const parsed = cftc?.parsed
  const history = Array.isArray(cftc?.history) ? cftc.history : []
  const reportDate = parsed?.reportDate || null

  const wtiMarket = parsed?.markets?.find((market) => market.key === 'WTI') || null
  const brentMarket = parsed?.markets?.find((market) => market.key === 'BRENT') || null

  const chartSeries = buildWeeklySeries(wtiMarket, brentMarket, history)
  const canShowChart = chartSeries.length >= 2

  const chartData = canShowChart ? {
    labels: chartSeries.map((entry) => entry.date),
    datasets: [
      {
        label: 'WTI Managed Money Net',
        data: chartSeries.map((entry) => entry.wti),
        borderColor: 'rgba(244, 175, 72, 1)',
        backgroundColor: 'rgba(244, 175, 72, 0.18)',
        tension: 0.28,
        pointRadius: 0,
      },
      {
        label: 'Brent Managed Money Net',
        data: chartSeries.map((entry) => entry.brent),
        borderColor: 'rgba(91, 190, 255, 1)',
        backgroundColor: 'rgba(91, 190, 255, 0.18)',
        tension: 0.28,
        pointRadius: 0,
      },
    ]
  } : null

  const markets = parsed?.markets || []
  const primaryMarkets = markets.slice(0, 3)

  return (
    <div className="card">
      <div className="cardHeader"><span className="cardTitle">CFTC Latest</span></div>
      <div style={{ fontSize: 12 }} className="muted">
        Source: {cftc?.url ? <a href={cftc.url} target="_blank" rel="noreferrer">{cftc.url}</a> : 'CFTC public reporting'}
      </div>
      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {cftc ? 'Weekly official CFTC report, refreshed from the backend.' : 'Waiting for the latest official weekly CFTC report.'}
      </div>
      {parsed && markets.length ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Latest weekly report</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{reportDate || 'Unknown'}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Tracked markets</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{markets.length}</div>
            </div>
          </div>

          {chartData ? (
            <div style={{ height: 190, marginTop: 12, overflow: 'hidden' }}>
              <Line
                data={chartData}
                options={{
                  maintainAspectRatio: false,
                  layout: { padding: { left: 6, right: 8, top: 4, bottom: 0 } },
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: { boxWidth: 10, boxHeight: 10 },
                    },
                  },
                  scales: {
                    x: {
                      ticks: { maxTicksLimit: 6, maxRotation: 0, minRotation: 0, autoSkip: true },
                      grid: { color: 'rgba(255,255,255,0.04)' },
                    },
                    y: {
                      ticks: { maxTicksLimit: 4 },
                      grid: { color: 'rgba(255,255,255,0.04)' },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="muted" style={{ fontSize: 12 }}>
                Weekly chart uses past CFTC reports from the official source.
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            {primaryMarkets.map((market) => {
              const latest = market.latest
              if (!latest) return null
              return (
                <div key={market.key} style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{market.label}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{latest.marketName}</div>
                    </div>
                    <div className="mono" style={{ fontWeight: 800, color: latest.managedMoneyNet >= 0 ? 'var(--accent)' : '#ff8a7a' }}>
                      {formatSigned(latest.managedMoneyNet)}
                    </div>
                  </div>
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 12 }}>
                    <div>
                      <div className="muted">Open interest</div>
                      <div className="mono">{formatNumber(latest.openInterest)}</div>
                    </div>
                    <div>
                      <div className="muted">Producer net</div>
                      <div className="mono">{formatSigned(latest.producerNet)}</div>
                    </div>
                    <div>
                      <div className="muted">Swap net</div>
                      <div className="mono">{formatSigned(latest.swapNet)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ marginBottom: 8 }}>The latest weekly CFTC report is loading or unavailable right now.</div>
          <div className="muted" style={{ fontSize: 12 }}>The widget stays on screen so the positioning section is always visible.</div>
        </div>
      )}
    </div>
  )
}

function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : 'n/a'
}

function formatSigned(value) {
  if (!Number.isFinite(value)) return 'n/a'
  return `${value >= 0 ? '+' : ''}${new Intl.NumberFormat('en-US').format(value)}`
}

function buildWeeklySeries(wtiMarket, brentMarket, history) {
  const fromMarkets = [wtiMarket, brentMarket].some(Boolean)
    ? mergeMarketSeries(wtiMarket?.series || [], brentMarket?.series || [])
    : []

  if (fromMarkets.length >= 2) return fromMarkets

  return history
    .map((entry) => ({
      date: entry.reportDate,
      wti: entry.markets?.WTI?.managedMoneyNet ?? null,
      brent: entry.markets?.BRENT?.managedMoneyNet ?? null,
    }))
    .filter((entry) => entry.date)
}

function mergeMarketSeries(wtiSeries, brentSeries) {
  const merged = new Map()

  for (const entry of wtiSeries) {
    if (!entry?.date) continue
    merged.set(entry.date, {
      date: entry.date,
      wti: entry.managedMoneyNet ?? null,
      brent: null,
    })
  }

  for (const entry of brentSeries) {
    if (!entry?.date) continue
    const existing = merged.get(entry.date) || { date: entry.date, wti: null, brent: null }
    existing.brent = entry.managedMoneyNet ?? null
    merged.set(entry.date, existing)
  }

  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date))
}

