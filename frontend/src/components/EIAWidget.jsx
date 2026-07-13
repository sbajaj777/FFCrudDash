import React from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

export default function EIAWidget({ eia }) {
  if (!eia || Object.keys(eia).length === 0) return (
    <div className="card">
      <div className="cardHeader"><span className="cardTitle">EIA</span></div>
      <div className="muted">No EIA data configured (add EIA_API_KEY and EIA_SERIES in backend/.env)</div>
    </div>
  )

  const firstKey = Object.keys(eia)[0]
  const payload = eia[firstKey]
  const series = payload && payload.series ? payload.series.slice(0, 52).reverse() : []

  if (!series.length) {
    return (
      <div className="card">
        <div className="cardHeader"><span className="cardTitle">EIA Series</span></div>
        <div style={{ padding: 8 }} className="muted">No series data</div>
      </div>
    )
  }

  const labels = series.map(s => s.date)
  const dataVals = series.map(s => Number(s.value))

  const chartData = {
    labels,
    datasets: [
      {
        label: payload.name || firstKey,
        data: dataVals,
        borderColor: 'rgba(75,192,192,1)',
        backgroundColor: 'rgba(75,192,192,0.2)',
        tension: 0.2,
        pointRadius: 0
      }
    ]
  }

  return (
    <div className="card">
      <div className="cardHeader"><span className="cardTitle">EIA Series</span></div>
      <div style={{ fontSize: 12 }} className="muted">{payload.name || firstKey}</div>
      <div style={{ height: 140, marginTop: 8, overflow: 'hidden' }}>
        <Line
          data={chartData}
          options={{
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            layout: { padding: { left: 6, right: 8, top: 4, bottom: 0 } },
            scales: {
              x: {
                ticks: { maxRotation: 0, minRotation: 0, maxTicksLimit: 6, autoSkip: true },
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
    </div>
  )
}

