import React, { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import { useBacktest } from '../hooks/useBacktest'
import { useEngineStatus } from '../hooks/usePhase2Data'
import { usePaperTrader } from '../hooks/usePaperTrader'

/* ─── Constants ─────────────────────────────────────────── */
const PRODUCTS   = ['CL', 'LCO', 'HO', 'LGO']
const STRUCTURES = ['m1_m2', 'm1_m3', 'm1_m6', 'm1_m12']
const REGIMES    = [
  { value: 'backwardation', label: 'Backwardation + Extreme Backwardation' },
  { value: 'contango',      label: 'Contango + Deep Contango' },
  { value: 'all',           label: 'All Regimes' },
]

/* ─── Helpers ────────────────────────────────────────────── */
const fmt  = (n, d = 2) => (n == null ? '—' : Number(n).toFixed(d))
const fmtK = (n) => n == null ? '—' : n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${Number(n).toFixed(0)}`

const metricColor = (val, good = 'positive') => {
  if (val == null) return '#94a3b8'
  if (good === 'positive') return val >= 0 ? '#00c48f' : '#f43f5e'
  return val <= 0 ? '#00c48f' : '#f43f5e'
}

const exitBadgeColor = (reason) => ({
  PROFIT_TARGET: '#00c48f',
  STOP_LOSS:     '#f43f5e',
  TIMEOUT:       '#f5a623',
  OPEN_AT_END:   '#94a3b8',
}[reason] || '#94a3b8')

/* ─── Sub-components ────────────────────────────────────── */
function MetricCard({ label, value, sub, color }) {
  return (
    <div style={s.metricCard}>
      <div style={s.metricLabel}>{label}</div>
      <div style={{ ...s.metricValue, color: color || '#f1f5f9' }}>{value}</div>
      {sub && <div style={s.metricSub}>{sub}</div>}
    </div>
  )
}

function SliderRow({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={s.paramLabel}>{label}</span>
        <span style={{ ...s.paramLabel, color: '#00d4ff', fontWeight: 700 }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#00d4ff' }}
      />
    </div>
  )
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function StrategyLabPage() {
  const { data: status } = useEngineStatus()
  const isReady = status?.status === 'ready'

  // Controls
  const [product,      setProduct]      = useState('CL')
  const [structure,    setStructure]    = useState('m1_m2')
  const [regimeFilter, setRegimeFilter] = useState('backwardation')
  const [rollWindow,   setRollWindow]   = useState(60)
  const [entryZ,       setEntryZ]       = useState(2.0)
  const [exitZ,        setExitZ]        = useState(0.3)
  const [stopCushion,  setStopCushion]  = useState(0.5)
  const [maxHold,      setMaxHold]      = useState(30)
  const [tab,          setTab]          = useState('equity')   // equity | trades | zscore
  const [mode,         setMode]         = useState('paper')    // backtest | paper
  const [strategyType, setStrategyType] = useState('fair_value_residual') // fair_value_residual | basic_rolling

  const { data, loading, error } = useBacktest(product, structure, {
    roll_window: rollWindow,
    entry_z: entryZ,
    exit_z: exitZ,
    stop_cushion: stopCushion,
    max_hold: maxHold,
    regime_filter: regimeFilter,
    strategy_type: strategyType,
  }, isReady)

  const { signals, positions, trades: paperTrades, loading: paperLoading, forceTick, resetTrades } = usePaperTrader()

  if (!isReady) {
    return (
      <div style={s.loading}>
        <div style={s.spinner} />
        <h2 style={{ color: '#f1f5f9', fontSize: 20 }}>Phase 2 Engine Initializing…</h2>
        <p style={{ color: '#94a3b8', marginTop: 8 }}>Processing historical data…</p>
      </div>
    )
  }

  const m   = data?.metrics
  const trades = data?.trades || []

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div>
          <h1 style={s.pageTitle}>Strategy Lab</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: 4, borderRadius: 8 }}>
              <button onClick={() => { setMode('backtest'); if(product === 'ALL') setProduct('CL'); }} style={{ ...s.modeBtn, ...(mode === 'backtest' ? s.modeBtnActive : {}) }}>Backtester</button>
              <button onClick={() => setMode('paper')} style={{ ...s.modeBtn, ...(mode === 'paper' ? s.modeBtnActive : {}) }}>Live Paper Trading</button>
            </div>
            <p style={s.pageSub}>
              {mode === 'backtest' ? 'Calendar spread mean-reversion backtester' : 'Real-time forward curve signal monitor and virtual execution'}
            </p>
          </div>
        </div>

        {/* Product buttons */}
        <div style={s.btnGroup}>
          {mode === 'paper' && (
            <button 
              onClick={() => setProduct('ALL')}
              style={{ ...s.btn, ...(product === 'ALL' ? s.btnActive : {}) }}>
              ALL
            </button>
          )}
          {PRODUCTS.map(p => (
            <button key={p}
              onClick={() => {
                setProduct(p)
              }}
              style={{ ...s.btn, ...(product === p ? s.btnActive : {}) }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mode: Backtest ── */}
      {mode === 'backtest' && (
        <>
          {/* ── Controls ── */}
          <div style={s.controlRow}>
            {/* Structure */}
            <div style={s.controlCard}>
              <div style={s.controlTitle}>STRUCTURE</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STRUCTURES.map(st => (
                  <button key={st}
                    onClick={() => setStructure(st)}
                    style={{ ...s.chip, ...(structure === st ? s.chipActive : {}) }}>
                    {st.replace('_', ' ').toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Regime filter & Strategy */}
            <div style={s.controlCard}>
              <div style={s.controlTitle}>STRATEGY & REGIME</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="strategy" value="fair_value_residual"
                    checked={strategyType === 'fair_value_residual'}
                    onChange={() => setStrategyType('fair_value_residual')}
                    style={{ accentColor: '#00d4ff' }} />
                  <span style={{ color: '#cbd5e1', fontSize: 12 }}>ML Fair Value Residual</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="radio" name="strategy" value="basic_rolling"
                    checked={strategyType === 'basic_rolling'}
                    onChange={() => setStrategyType('basic_rolling')}
                    style={{ accentColor: '#00d4ff' }} />
                  <span style={{ color: '#cbd5e1', fontSize: 12 }}>Basic Rolling Z-Score</span>
                </label>
              </div>
              <div style={s.controlTitle}>REGIME FILTER</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {REGIMES.map(r => (
                  <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <input type="radio" name="regime" value={r.value}
                      checked={regimeFilter === r.value}
                      onChange={() => setRegimeFilter(r.value)}
                      style={{ accentColor: '#00d4ff' }} />
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>{r.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sliders */}
            <div style={{ ...s.controlCard, flex: 2 }}>
              <div style={s.controlTitle}>STRATEGY PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                <SliderRow label="Rolling Window (days)" value={rollWindow} min={20} max={252} step={5}  onChange={setRollWindow} />
                <SliderRow label="Base Entry (Z)"          value={entryZ}    min={1.0} max={4.0} step={0.1} onChange={setEntryZ} />
                <SliderRow label="Exit Z-Score (PT)"      value={exitZ}     min={0.0} max={1.5} step={0.1} onChange={setExitZ} />
                <SliderRow label="Risk Cushion (Z)"       value={stopCushion} min={0.2} max={2.0} step={0.1} onChange={setStopCushion} />
                <SliderRow label="Max Hold (days)"        value={maxHold}   min={5}   max={90}  step={1}   onChange={setMaxHold} />
              </div>
            </div>
          </div>

          {/* ── Loading / Error ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
              <div style={s.spinner} />
              <p style={{ marginTop: 12 }}>Running backtest on {product} {structure.toUpperCase()}…</p>
            </div>
          )}
          {error && (
            <div style={{ ...s.card, borderColor: '#f43f5e', color: '#f43f5e', padding: 20 }}>
              ⚠ Backtest error: {error}. Ensure the Python engine is running.
            </div>
          )}

          {/* ── Metric Cards ── */}
          {m && (
            <div style={s.metricsRow}>
              <MetricCard label="Total PnL"     value={fmtK(m.total_pnl)}   color={metricColor(m.total_pnl)} />
              <MetricCard label="Sharpe Ratio"  value={fmt(m.sharpe_ratio, 3)} color={metricColor(m.sharpe_ratio)} sub="Annualised" />
              <MetricCard label="Win Rate"      value={`${fmt(m.win_rate)}%`}  color={metricColor(m.win_rate - 50)} />
              <MetricCard label="Total Trades"  value={m.total_trades} />
              <MetricCard label="Profit Factor" value={fmt(m.profit_factor, 2)} color={metricColor(m.profit_factor - 1)} />
              <MetricCard label="Max Drawdown"  value={fmtK(m.max_drawdown)}  color="#f43f5e" />
              <MetricCard label="Avg Days Held" value={fmt(m.avg_days_held, 1)} sub="per trade" />
              <MetricCard label="Best Trade"    value={fmtK(m.best_trade)}    color="#00c48f" />
              <MetricCard label="Worst Trade"   value={fmtK(m.worst_trade)}   color="#f43f5e" />
            </div>
          )}

          {/* ── Chart Tabs ── */}
          {data && !loading && (
            <div style={s.card}>
              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
                {[['equity', 'Equity Curve'], ['pnl_dist', 'PnL Distribution'], ['zscore', 'Z-Score History']].map(([id, label]) => (
                  <button key={id} onClick={() => setTab(id)}
                    style={{ ...s.tabBtn, ...(tab === id ? s.tabBtnActive : {}) }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Equity Curve */}
              {tab === 'equity' && (
                <div>
                  <div style={s.chartTitle}>Cumulative PnL — {product} {structure.toUpperCase()}</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={data.equity_curve}>
                      <defs>
                        <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={d => d.slice(2, 7)} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                      <Tooltip
                        contentStyle={{ background: '#0f1929', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}
                        formatter={v => [`$${Number(v).toFixed(0)}`, 'Cumulative PnL']} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                      <Area type="monotone" dataKey="cum_pnl" stroke="#00d4ff" strokeWidth={2}
                        fill="url(#eqGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* PnL Distribution */}
              {tab === 'pnl_dist' && (
                <div>
                  <div style={s.chartTitle}>Per-Trade PnL Distribution</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={trades}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="entry_date" tick={{ fontSize: 9, fill: '#64748b' }}
                        tickFormatter={d => d.slice(2, 7)} interval={Math.floor(trades.length / 12)} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                      <Tooltip
                        contentStyle={{ background: '#0f1929', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}
                        formatter={v => [`$${Number(v).toFixed(0)}`, 'Trade PnL']} />
                      <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                      <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
                        {trades.map((t, i) => (
                          <Cell key={i} fill={t.pnl >= 0 ? '#00c48f' : '#f43f5e'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Z-Score History */}
              {tab === 'zscore' && (
                <div>
                  <div style={s.chartTitle}>Rolling {rollWindow}-Day Z-Score — {structure.toUpperCase()}</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={data.zscore_series}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }}
                        tickFormatter={d => d.slice(2, 7)} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} domain={[-5, 5]} />
                      <Tooltip
                        contentStyle={{ background: '#0f1929', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}
                        formatter={v => [Number(v).toFixed(3), 'Z-Score']} />
                      <ReferenceLine y={entryZ}  stroke="#f43f5e" strokeDasharray="4 4" label={{ value: `SELL +${entryZ}`, fill: '#f43f5e', fontSize: 10 }} />
                      <ReferenceLine y={-entryZ} stroke="#00c48f" strokeDasharray="4 4" label={{ value: `BUY -${entryZ}`,  fill: '#00c48f', fontSize: 10 }} />
                      <ReferenceLine y={0}       stroke="rgba(255,255,255,0.15)" />
                      <Line type="monotone" dataKey="z" stroke="#a78bfa" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Trade Log ── */}
          {trades.length > 0 && (
            <div style={s.card}>
              <div style={{ ...s.chartTitle, marginBottom: 14 }}>
                Full Trade Log &nbsp;
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>
                  {trades.length} trades total
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['#', 'Entry Date', 'Exit Date', 'Direction', 'Entry Price', 'Exit Price',
                        'Entry Z', 'Exit Z', 'Days', 'Exit Reason', 'Regime', 'PnL'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={s.td}>{i + 1}</td>
                        <td style={s.td}>{t.entry_date}</td>
                        <td style={s.td}>{t.exit_date}</td>
                        <td style={{ ...s.td, color: t.direction === 'BUY' ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>
                          {t.direction}
                        </td>
                        <td style={s.td}>{fmt(t.entry_price, 3)}</td>
                        <td style={s.td}>{fmt(t.exit_price, 3)}</td>
                        <td style={s.td}>{fmt(t.entry_z, 3)}</td>
                        <td style={s.td}>{fmt(t.exit_z, 3)}</td>
                        <td style={s.td}>{t.days_held}</td>
                        <td style={s.td}>
                          <span style={{
                            background: exitBadgeColor(t.exit_reason) + '25',
                            color: exitBadgeColor(t.exit_reason),
                            padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          }}>
                            {t.exit_reason.replace('_', ' ')}
                          </span>
                        </td>
                        <td style={{ ...s.td, fontSize: 10, color: '#64748b' }}>
                          {t.regime?.replace('R\\d_', '')?.replace(/_/g, ' ')}
                        </td>
                        <td style={{ ...s.td, color: t.pnl >= 0 ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>
                          {t.pnl >= 0 ? '+' : ''}{fmtK(t.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Mode: Paper Trading ── */}
      {mode === 'paper' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={forceTick} style={{ ...s.btn, background: '#00d4ff', color: '#000', borderColor: '#00d4ff' }}>Force Tick (Fetch Live Prices)</button>
              <button onClick={resetTrades} style={{ ...s.btn, color: '#f43f5e', borderColor: '#f43f5e' }}>Reset All Trades</button>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {signals?.is_running ? '🟢 Engine Running (Polling every 5m)' : '🔴 Engine Stopped'} &nbsp;|&nbsp; Last Update: {signals?.last_update ? new Date(signals.last_update).toLocaleTimeString() : 'N/A'}
            </div>
          </div>

          <div style={s.metricsRow}>
            <MetricCard label="Open Positions" value={positions?.open_count || 0} />
            <MetricCard label="Unrealized PnL" value={fmtK(positions?.total_unrealized_pnl)} color={metricColor(positions?.total_unrealized_pnl)} />
            <MetricCard label="Closed Trades" value={paperTrades?.trade_count || 0} />
            <MetricCard label="Realized PnL" value={fmtK(paperTrades?.total_realized_pnl)} color={metricColor(paperTrades?.total_realized_pnl)} />
            <MetricCard label="Win Rate" value={`${fmt(paperTrades?.win_rate)}%`} color={metricColor(paperTrades?.win_rate - 50)} />
          </div>

          <div style={s.card}>
            <div style={s.chartTitle}>Live Signals Monitor {product !== 'ALL' && `(${product})`}</div>
            {signals?.signals?.filter(s => product === 'ALL' || s.product === product).map(s => (
              <div key={`${s.product}_${s.structure}`} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  <div><div style={s.paramLabel}>Product</div><div>{s.product} {s.structure.toUpperCase()}</div></div>
                  <div><div style={s.paramLabel}>Live Spread</div><div>${fmt(s.live_spread, 3)}</div></div>
                  <div><div style={s.paramLabel}>Current Z-Score</div><div style={{ color: Math.abs(s.z_score) > 2 ? (s.z_score > 0 ? '#f43f5e' : '#00c48f') : '#f1f5f9', fontWeight: 'bold' }}>{fmt(s.z_score, 3)}</div></div>
                  <div><div style={s.paramLabel}>Regime</div><div style={{ fontSize: 11 }}>{s.current_regime?.replace('R\\d_', '')}</div></div>
                  <div><div style={s.paramLabel}>Signal</div><div style={{ color: s.signal.includes('BUY') ? '#00c48f' : s.signal.includes('SELL') ? '#f43f5e' : '#94a3b8', fontWeight: 'bold' }}>{s.signal}</div></div>
                </div>
                {s.efv !== undefined && (
                  <div style={{ display: 'flex', gap: 24, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div><span style={s.paramLabel}>Expected Fair Value (EFV): </span> <span style={{ color: '#a78bfa' }}>${fmt(s.efv, 3)}</span></div>
                    <div><span style={s.paramLabel}>Residual (Live - EFV): </span> <span style={{ color: '#cbd5e1' }}>${fmt(s.live_spread - s.efv, 3)}</span></div>
                    <div><span style={s.paramLabel}>Model RMSE (1 Std Dev): </span> <span style={{ color: '#cbd5e1' }}>${fmt(s.rmse, 3)}</span></div>
                  </div>
                )}
              </div>
            ))}
            {(!signals?.signals || signals.signals.length === 0) && <div style={{ color: '#64748b', fontSize: 13 }}>No live signals available. Waiting for next tick...</div>}
          </div>

          <div style={s.card}>
            <div style={s.chartTitle}>Open Positions</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['ID', 'Date', 'Product', 'Dir', 'Entry', 'Current', 'Entry Z', 'Current Z', 'Days', 'PnL'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {positions?.positions?.filter(p => product === 'ALL' || p.product === product).map((p, i) => (
                    <tr key={p.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={s.td}>{p.id}</td>
                      <td style={s.td}>{new Date(p.entry_date).toLocaleString()}</td>
                      <td style={s.td}>{p.product} {p.structure}</td>
                      <td style={{ ...s.td, color: p.direction === 'BUY' ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>{p.direction}</td>
                      <td style={s.td}>{fmt(p.entry_spread, 3)}</td>
                      <td style={s.td}>{fmt(p.current_spread, 3)}</td>
                      <td style={s.td}>{fmt(p.entry_z, 3)}</td>
                      <td style={s.td}>{fmt(p.current_z, 3)}</td>
                      <td style={s.td}>{p.days_held}</td>
                      <td style={{ ...s.td, color: p.current_pnl >= 0 ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>{p.current_pnl >= 0 ? '+' : ''}{fmtK(p.current_pnl)}</td>
                    </tr>
                  ))}
                  {(!positions?.positions || positions.positions.length === 0) && (
                    <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#64748b' }}>No open positions.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.chartTitle}>Closed Trades</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {['ID', 'Entry Date', 'Exit Date', 'Dir', 'Entry', 'Exit', 'Entry Z', 'Exit Z', 'Reason', 'PnL'].map(h => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {paperTrades?.trades?.filter(t => product === 'ALL' || t.product === product).map((t, i) => (
                    <tr key={t.id} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                      <td style={s.td}>{t.id}</td>
                      <td style={s.td}>{new Date(t.entry_date).toLocaleString()}</td>
                      <td style={s.td}>{new Date(t.exit_date).toLocaleString()}</td>
                      <td style={{ ...s.td, color: t.direction === 'BUY' ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>{t.direction}</td>
                      <td style={s.td}>{fmt(t.entry_spread, 3)}</td>
                      <td style={s.td}>{fmt(t.exit_spread, 3)}</td>
                      <td style={s.td}>{fmt(t.entry_z, 3)}</td>
                      <td style={s.td}>{fmt(t.exit_z, 3)}</td>
                      <td style={s.td}>
                        <span style={{ background: exitBadgeColor(t.exit_reason) + '25', color: exitBadgeColor(t.exit_reason), padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
                          {t.exit_reason.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: t.final_pnl >= 0 ? '#00c48f' : '#f43f5e', fontWeight: 700 }}>{t.final_pnl >= 0 ? '+' : ''}{fmtK(t.final_pnl)}</td>
                    </tr>
                  ))}
                  {(!paperTrades?.trades || paperTrades.trades.length === 0) && (
                    <tr><td colSpan={10} style={{ ...s.td, textAlign: 'center', color: '#64748b' }}>No closed trades yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Styles ─────────────────────────────────────────────── */
const s = {
  page:        { display: 'flex', flexDirection: 'column', gap: 20 },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 },
  pageTitle:   { fontSize: 26, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  pageSub:     { color: '#64748b', fontSize: 13, marginTop: 4 },

  loading: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '3px solid rgba(0,212,255,0.2)',
    borderTopColor: '#00d4ff',
    animation: 'spin 0.8s linear infinite',
  },

  btnGroup: { display: 'flex', gap: 4 },
  btn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, transition: 'all 150ms',
  },
  btnActive: { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', borderColor: '#00d4ff' },

  modeBtn: {
    padding: '6px 16px', borderRadius: 6, border: 'none', background: 'transparent', color: '#94a3b8',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 150ms',
  },
  modeBtnActive: { background: 'rgba(255,255,255,0.1)', color: '#fff' },

  controlRow:  { display: 'flex', gap: 16, flexWrap: 'wrap' },
  controlCard: {
    flex: 1, minWidth: 200,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
  },
  controlTitle: { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.1em' },
  paramLabel:   { fontSize: 11, color: '#94a3b8' },

  chip: {
    padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 11, fontWeight: 600,
    transition: 'all 150ms',
  },
  chipActive: { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', borderColor: '#00d4ff' },

  metricsRow: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12,
  },
  metricCard: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 10, padding: '14px 16px',
  },
  metricLabel: { fontSize: 10, fontWeight: 700, color: '#64748b', letterSpacing: '0.08em', marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: 700 },
  metricSub:   { fontSize: 11, color: '#475569', marginTop: 2 },

  card: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '20px 24px',
  },
  chartTitle: { fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 16 },

  tabBtn: {
    padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)',
    background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12, fontWeight: 600,
    transition: 'all 150ms',
  },
  tabBtnActive: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa', borderColor: '#a78bfa' },

  table:  { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th:     { textAlign: 'left', padding: '8px 10px', color: '#64748b', fontSize: 10, fontWeight: 700,
            borderBottom: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.06em' },
  td:     { padding: '8px 10px', color: '#cbd5e1', borderBottom: '1px solid rgba(255,255,255,0.04)' },
}
