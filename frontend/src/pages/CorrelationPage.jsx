import React, { useMemo, useState } from 'react'
import { correlationMatrix } from '../utils/quantEngine.js'
import { useProductDailyData } from '../hooks/usePhase2Data.js'
import ForceGraph2D from 'react-force-graph-2d'
const ASSETS = ['WTI', 'BRN', 'NG', 'RBOB', 'HO', 'SPX', 'DXY']
const LABELS = { WTI: 'WTI', BRN: 'BRENT', NG: 'NGAS', RBOB: 'RBOB', HO: 'HEAT', SPX: 'SPX', DXY: 'DXY' }

const CONTRACTS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12']
const CONTRACT_LABELS = { c1: 'M1', c2: 'M2', c3: 'M3', c4: 'M4', c5: 'M5', c6: 'M6', c7: 'M7', c8: 'M8', c9: 'M9', c10: 'M10', c11: 'M11', c12: 'M12' }

function getColor(val) {
  if (val >= 0.7) return { bg: 'rgba(0, 196, 143, 0.55)', text: '#fff' }
  if (val >= 0.4) return { bg: 'rgba(0, 196, 143, 0.3)', text: '#e8edf5' }
  if (val >= 0.15) return { bg: 'rgba(0, 196, 143, 0.12)', text: '#e8edf5' }
  if (val > -0.15) return { bg: 'rgba(255, 255, 255, 0.04)', text: '#8899b4' }
  if (val > -0.4) return { bg: 'rgba(255, 71, 87, 0.15)', text: '#e8edf5' }
  if (val > -0.7) return { bg: 'rgba(255, 71, 87, 0.3)', text: '#e8edf5' }
  return { bg: 'rgba(255, 71, 87, 0.55)', text: '#fff' }
}

export default function CorrelationPage({ data }) {
  const { closesMap } = data
  const [product, setProduct] = useState('CL')
  const { data: dailyDataResponse } = useProductDailyData(product, 252)

  // Build returns for correlation (use daily log returns)
  const returnsMap = useMemo(() => {
    const map = {}
    for (const key of ASSETS) {
      const closes = closesMap[key] || []
      const returns = []
      for (let i = 1; i < closes.length; i++) {
        if (closes[i] > 0 && closes[i - 1] > 0) {
          returns.push(Math.log(closes[i] / closes[i - 1]))
        }
      }
      map[key] = returns
    }
    return map
  }, [closesMap])

  const matrix = useMemo(() => correlationMatrix(returnsMap, ASSETS, 90), [returnsMap])
  const hasData = Object.keys(closesMap).length > 0

  const contractReturnsMap = useMemo(() => {
    if (!dailyDataResponse?.data) return {}
    const records = dailyDataResponse.data
    const map = {}
    for (const key of CONTRACTS) {
      const returns = []
      for (let i = 1; i < records.length; i++) {
        const prev = records[i - 1][key]
        const curr = records[i][key]
        if (prev > 0 && curr > 0) {
          returns.push(Math.log(curr / prev))
        }
      }
      map[key] = returns
    }
    return map
  }, [dailyDataResponse])

  const contractMatrix = useMemo(() => correlationMatrix(contractReturnsMap, CONTRACTS, 90), [contractReturnsMap])
  const hasContractData = Object.keys(contractReturnsMap).length > 0 && contractReturnsMap.c1?.length > 0

  const graphData = useMemo(() => {
    if (!matrix || !hasData) return { nodes: [], links: [] }
    const nodes = ASSETS.map(id => ({ id, name: LABELS[id] }))
    const links = []
    for (let i = 0; i < ASSETS.length; i++) {
      for (let j = i + 1; j < ASSETS.length; j++) {
        const source = ASSETS[i]
        const target = ASSETS[j]
        const val = matrix[source]?.[target] ?? 0
        if (Math.abs(val) > 0.3) {
          links.push({
            source, target,
            value: Math.abs(val),
            color: val > 0 ? 'rgba(0, 196, 143, 0.8)' : 'rgba(255, 71, 87, 0.8)',
            width: Math.abs(val) * 4
          })
        }
      }
    }
    return { nodes, links }
  }, [matrix, hasData])

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="3" width="18" height="18" rx="1"/>
            <rect x="5" y="5" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/>
            <rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/>
            <rect x="15" y="15" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/>
          </svg>
          Cross-Asset Correlation Matrix
        </h1>
        <div className="page-subtitle">Rolling 90-Day Pearson Correlation • Computed from CME/NYMEX/ICE Exchange Data daily returns</div>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {/* Cross-Asset Card */}
        <div className="card" style={{ padding: 24, flex: 1, minWidth: 500 }}>
          {hasData ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: 'auto' }}>
                <thead>
                  <tr>
                    <th style={cellStyle.header}></th>
                    {ASSETS.map(col => (
                      <th key={col} style={cellStyle.header}>{LABELS[col]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ASSETS.map(row => (
                    <tr key={row}>
                      <td style={cellStyle.rowLabel}>{LABELS[row]}</td>
                      {ASSETS.map(col => {
                        const val = matrix[row]?.[col] ?? 0
                        const { bg, text } = row === col
                          ? { bg: 'rgba(0, 212, 255, 0.2)', text: '#00d4ff' }
                          : getColor(val)
                        return (
                          <td key={col} style={{
                            ...cellStyle.cell,
                            background: bg,
                            color: text,
                            fontWeight: Math.abs(val) > 0.6 || row === col ? 700 : 500,
                          }}>
                            {val.toFixed(2)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>
              Loading historical data for correlation calculations...
            </div>
          )}
        </div>

        {/* Term Structure Card */}
        <div className="card" style={{ padding: 24, flex: 1, minWidth: 600 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
             <h2 style={{ fontSize: 14, color: '#f8fafc', fontWeight: 600, margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Term Structure Matrix</h2>
             <select 
               value={product} 
               onChange={e => setProduct(e.target.value)}
               style={{ background: 'rgba(15, 23, 42, 0.8)', color: '#fff', border: '1px solid #334155', padding: '6px 12px', borderRadius: 6, outline: 'none', fontSize: 13, fontFamily: "'Inter', sans-serif" }}
             >
               <option value="CL">WTI Crude (CL)</option>
               <option value="LCO">Brent Crude (LCO)</option>
               <option value="RBOB">RBOB Gasoline (RBOB)</option>
               <option value="HO">Heating Oil (HO)</option>
               <option value="LGO">Gas Oil (LGO)</option>
             </select>
          </div>

          {hasContractData ? (
             <div style={{ overflowX: 'auto' }}>
               <table style={{ borderCollapse: 'collapse', width: 'auto' }}>
                 <thead>
                   <tr>
                     <th style={cellStyle.header}></th>
                     {CONTRACTS.map(col => (
                       <th key={col} style={{...cellStyle.header, padding: '8px', minWidth: 46}}>{CONTRACT_LABELS[col]}</th>
                     ))}
                   </tr>
                 </thead>
                 <tbody>
                   {CONTRACTS.map(row => (
                     <tr key={row}>
                       <td style={{...cellStyle.rowLabel, padding: '8px'}}>{CONTRACT_LABELS[row]}</td>
                       {CONTRACTS.map(col => {
                         const val = contractMatrix[row]?.[col]
                         const displayVal = val != null ? val : 0
                         const { bg, text } = row === col
                           ? { bg: 'rgba(0, 212, 255, 0.2)', text: '#00d4ff' }
                           : getColor(displayVal)
                         return (
                           <td key={col} style={{
                             ...cellStyle.cell,
                             padding: '8px',
                             minWidth: 46,
                             fontSize: 12,
                             background: bg,
                             color: text,
                             fontWeight: Math.abs(displayVal) > 0.6 || row === col ? 700 : 500,
                           }}>
                             {val != null ? val.toFixed(2) : '-'}
                           </td>
                         )
                       })}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          ) : (
            <div className="text-muted" style={{ textAlign: 'center', padding: 40 }}>
              Loading contract data...
            </div>
          )}
        </div>


        {/* Network Graph */}
        <div className="card" style={{ padding: 24, flex: '1 1 100%', height: 500, display: 'flex', flexDirection: 'column' }}>
          <div className="card-header" style={{ marginBottom: 16 }}>
            <span className="card-title">Cross-Asset Network Physics</span>
            <span className="badge badge-cyan">LIVE FORCE GRAPH</span>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
            {hasData && graphData.nodes.length > 0 ? (
              <ForceGraph2D
                graphData={graphData}
                backgroundColor="transparent"
                nodeLabel="name"
                nodeRelSize={8}
                linkColor="color"
                linkWidth="width"
                nodeColor={() => '#00d4ff'}
                nodeCanvasObject={(node, ctx, globalScale) => {
                  const label = node.name;
                  const fontSize = 12/globalScale;
                  ctx.font = `${fontSize}px JetBrains Mono`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                  ctx.fillStyle = '#00d4ff';
                  ctx.fill();
                  ctx.fillStyle = '#fff';
                  ctx.fillText(label, node.x, node.y + 12);
                }}
              />
            ) : <div className="text-muted" style={{ textAlign: 'center', paddingTop: 180 }}>Loading network data...</div>}
          </div>
          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            Nodes dynamically cluster based on real-time Pearson correlations (Threshold {'>'} |0.3|). Green links indicate strong positive correlation, red indicates negative. You can drag nodes to interact.
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(255, 71, 87, 0.5)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Strong Negative</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(255, 255, 255, 0.06)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Near Zero</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(0, 196, 143, 0.5)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Strong Positive</span>
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data Source: CME/NYMEX/ICE Exchange Data & computed returns</span>
      </div>
    </div>
  )
}

const cellStyle = {
  header: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8899b4',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  rowLabel: {
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: '#8899b4',
    textAlign: 'left',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  },
  cell: {
    padding: '12px 14px',
    textAlign: 'center',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    minWidth: 70,
    border: '1px solid rgba(255,255,255,0.03)',
    transition: 'all 150ms ease',
    cursor: 'default',
  },
}

