import React, { useState, useEffect, useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { computeRegressionFairValue } from '../utils/quantEngine.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Utility: Alpha Decay Engine (2-hour linear fade from Wed 10:30 AM EST)
function getDecayState() {
  const now = new Date();
  const nyTimeString = now.toLocaleString('en-US', {timeZone: 'America/New_York'});
  const nyNow = new Date(nyTimeString); 

  let target = new Date(nyNow);
  let daysSinceWed = nyNow.getDay() - 3;
  if (daysSinceWed < 0) daysSinceWed += 7;
  
  target.setDate(target.getDate() - daysSinceWed);
  target.setHours(10, 30, 0, 0);
  
  if (daysSinceWed === 0 && nyNow.getTime() < target.getTime()) {
    target.setDate(target.getDate() - 7);
  }
  
  const elapsedMinutes = (nyNow.getTime() - target.getTime()) / 60000;
  
  if (elapsedMinutes < 0 || elapsedMinutes > 120) {
    return { multiplier: 0, text: 'Decayed (0%)', active: false };
  } else {
    const remaining = 1 - (elapsedMinutes / 120);
    return { multiplier: remaining, text: `Active (${Math.round(remaining * 100)}%)`, active: true };
  }
}

export default function EiaEventPage({ data }) {
  const { prices, eia, closesMap, datesMap, news } = data
  
  // 1. Autonomous Base Fair Value from Real-Time Regression (3-Factor: DXY, Crack, News NLP)
  const fairValueData = useMemo(() => computeRegressionFairValue(closesMap, datesMap, news, prices), [closesMap, datesMap, news, prices])
  const baseFairValue = fairValueData?.fair || (prices.WTI?.price ? prices.WTI.price : 78.0)
  
  // 2. Autonomous Regime Detection (using Brent - WTI physical tightness proxy)
  const regimeData = useMemo(() => {
    if (!prices.WTI?.price || !prices.BRN?.price) return { id: 'R3_FLAT', label: 'Flat', desc: 'Awaiting data' }
    const spread = prices.BRN.price - prices.WTI.price
    
    if (spread > 5.00) return { id: 'R5_EXTREME_BACKWARDATION', label: 'Extreme Backwardation', desc: `Physical markets critically tight (Spread: $${spread.toFixed(2)})` }
    if (spread > 3.00) return { id: 'R4_BACKWARDATION', label: 'Backwardation', desc: `Supply constrained (Spread: $${spread.toFixed(2)})` }
    if (spread > 1.00) return { id: 'R3_FLAT', label: 'Flat / Slight Back', desc: `Balanced market (Spread: $${spread.toFixed(2)})` }
    return { id: 'R2_CONTANGO', label: 'Contango', desc: `Oversupplied market (Spread: $${spread.toFixed(2)})` }
  }, [prices.WTI?.price, prices.BRN?.price])

  // 3. Autonomous EIA Processing
  const eiaMetrics = useMemo(() => {
    if (!eia) return null
    const eiaKey = Object.keys(eia)[0]
    const series = eia[eiaKey]?.series
    if (!series || series.length < 5) return null
    
    // Process series into M bbls
    const values = series.map(d => d.value / 1000)
    
    // Calculate weekly changes
    const changes = []
    for(let i=0; i < values.length - 1; i++) {
      changes.push(values[i] - values[i+1])
    }
    
    // Latest Actual Print
    const actual = changes[0]
    
    // Auto-derive Consensus (4-week moving average of previous changes)
    const recentChanges = changes.slice(1, 5)
    const consensus = recentChanges.reduce((a, b) => a + b, 0) / recentChanges.length
    
    // Calculate Z-Score
    const zScore = (actual - consensus) / 2.8 // Approx historical standard dev
    
    // Directional Engine Rules: Continuous Linear Function
    let bps = 0
    let signal = 'NEUTRAL'
    
    if (Math.abs(zScore) > 0.1) {
      // Base continuous linear multiplier: 1 Z-Score = 150 bps
      // e.g. Z=-0.3 -> +45 bps (Draw), Z=0.3 -> -45 bps (Build)
      bps = -150 * zScore
      
      if (zScore < 0) {
        signal = 'BULLISH'
        // Dynamic Regime Amplification (Tight market + Supply shock = Nonlinear explosion)
        if (regimeData.id.includes('BACKWARDATION')) bps *= 1.66 // 45 bps scales to ~75 bps
      } else {
        signal = 'BEARISH'
        // Dynamic Regime Amplification (Oversupplied market + Supply glut = Dump)
        if (regimeData.id.includes('CONTANGO')) bps *= 1.66 // -45 bps scales to ~-75 bps
      }
      
      // Institutional Risk-Cap: Cap extreme outlier shocks at +/- 300 bps (~$2.15)
      bps = Math.max(-300, Math.min(300, bps))
    }
    bps = Math.round(bps)
    
    const decay = getDecayState()
    const finalBps = Math.round(bps * decay.multiplier)
    
    const priceImpact = (prices.WTI?.price || 78.0) * (finalBps / 10000)
    
    return {
      actual: actual.toFixed(2),
      consensus: consensus.toFixed(2),
      zScore: zScore.toFixed(2),
      signal,
      rawBps: bps,
      bpsMove: finalBps,
      decayState: decay,
      priceImpact,
      date: new Date(series[0].date).toLocaleDateString()
    }
  }, [eia, regimeData.id, prices.WTI?.price])

  // 4. Live Charting state (Persistent across refreshes)
  const [chartData, setChartData] = useState(() => {
    try {
      const saved = localStorage.getItem('eiaChartData')
      if (saved) return JSON.parse(saved)
    } catch(e) {}
    return { labels: [], live: [], fair: [] }
  })
  
  useEffect(() => {
    if (!prices.WTI?.price) return
    
    setChartData(prev => {
      const now = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' })
      // Prevent duplicate time entries on fast renders
      if (prev.labels.length > 0 && prev.labels[prev.labels.length - 1] === now) return prev;

      const labels = [...prev.labels, now].slice(-30)
      
      const currentLive = prices.WTI.price
      const fvOffset = eiaMetrics ? eiaMetrics.priceImpact : 0
      const currentFair = baseFairValue + fvOffset
      
      const liveSeries = [...prev.live, currentLive].slice(-30)
      const fairSeries = [...prev.fair, currentFair].slice(-30)
      
      const newData = { labels, live: liveSeries, fair: fairSeries }
      localStorage.setItem('eiaChartData', JSON.stringify(newData))
      return newData
    })
  }, [prices.WTI?.price, baseFairValue, eiaMetrics])
  
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 className="page-title">EIA Event Intelligence (Fully Automated)</h1>
          <div className="page-subtitle">Real-time Data Pipes • OLS Fair Value • Autonomous Regime Detection</div>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>
        
        {/* Left: Live Chart */}
        <div className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
            <span className="card-title">Live WTI Price vs Event-Adjusted Fair Value</span>
            <span className="badge badge-cyan pulse-glow">AUTONOMOUS MODE ACTIVE</span>
          </div>
          
          <div style={{ height: 400 }}>
            {chartData.labels.length > 0 ? (
              <Line data={{
                labels: chartData.labels,
                datasets: [
                  {
                    label: 'Live WTI Price',
                    data: chartData.live,
                    borderColor: '#00d4ff',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0
                  },
                  {
                    label: 'Event-Adjusted Fair Value',
                    data: chartData.fair,
                    borderColor: '#f5a623',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.1,
                    pointRadius: 0
                  }
                ]
              }} options={{
                responsive: true, maintainAspectRatio: false,
                animation: { duration: 0 },
                scales: {
                  y: { position: 'right', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8899b4', font: { family: 'monospace' } } },
                  x: { grid: { display: false }, ticks: { color: '#8899b4', maxTicksLimit: 10 } }
                },
                plugins: { legend: { display: true, position: 'top', labels: { color: '#fff' } } }
              }} />
            ) : <div style={{ textAlign: 'center', paddingTop: 100, color: '#8899b4' }}>Awaiting data streams...</div>}
          </div>
          
          <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
            <strong>Autonomous Architecture:</strong> The base fair value uses a 3-Factor Model: Real-time DXY and Crack Spread quotes run through a 90-day stationary Return-OLS regression, augmented by a live Hybrid NLP Engine (HuggingFace FinBERT Deep Learning blended with an Energy Lexicon) scanning the news feed. The engine autonomously tracks the physical curve structure (Brent-WTI physical proxy) to assign Regimes. When the U.S. backend ingests a new EIA Inventory release, it auto-calculates the deviation from a 4-week moving average consensus proxy, and fires the Event shock modifier directly into the Fair Value pricing system.
          </div>
        </div>
        
        {/* Right: Telemetry Panel */}
        <div style={{ display: 'grid', gap: 16 }}>
          
          {/* Base Fair Value Engine Status */}
          <div className="card" style={{ borderTop: '2px solid var(--purple)' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Continuous Regression Engine</div>
            
            {fairValueData ? (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Base Fair Value (OLS)</span>
                  <span className="mono" style={{ color: '#fff', fontWeight: 'bold' }}>${fairValueData.fair.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Regression R²</span>
                  <span className="mono" style={{ color: 'var(--gold)' }}>{fairValueData.rSquared.toFixed(3)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <span>Active Variables</span>
                  <span className="mono">WTI ~ DXY + Crack</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 4 }}>
                  <span>Hybrid NLP (FinBERT) Alpha</span>
                  <span className="mono" style={{ color: fairValueData.sentiment > 0 ? 'var(--green)' : fairValueData.sentiment < 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {fairValueData.sentiment > 0 ? '+' : ''}{fairValueData.sentiment.toFixed(2)}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '2px dashed rgba(255,255,255,0.1)', marginTop: 8 }}>
                  <span style={{ color: '#f5a623', fontWeight: 'bold' }}>Event-Adjusted Target (Chart Line)</span>
                  <span className="mono" style={{ color: '#f5a623', fontWeight: 'bold', fontSize: 13 }}>
                    ${(baseFairValue + (eiaMetrics ? eiaMetrics.priceImpact : 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            ) : <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Initializing OLS regression...</div>}
          </div>
          
          {/* Autonomous Regime Tracker */}
          <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Autonomous Regime Tracker</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span className={`badge ${regimeData.id.includes('BACKWARDATION') ? 'badge-green' : regimeData.id.includes('CONTANGO') ? 'badge-red' : 'badge-gold'}`}>
                {regimeData.label}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{regimeData.desc}</div>
          </div>
          
          {/* Live EIA API Telemetry */}
          <div className="card" style={{ borderTop: eiaMetrics?.bpsMove > 0 ? '2px solid var(--green)' : eiaMetrics?.bpsMove < 0 ? '2px solid var(--red)' : '2px solid var(--gold)' }}>
            <div className="card-title" style={{ marginBottom: 12 }}>EIA Reaction Matrix — {eiaMetrics?.date || '...'}</div>
            
            {eiaMetrics ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Auto-Consensus</div>
                    <div className="mono" style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{eiaMetrics.consensus}M</div>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actual Print</div>
                    <div className="mono" style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{eiaMetrics.actual}M</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inv Z-Score</div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>{eiaMetrics.zScore}</div>
                  </div>
                  <div style={{ padding: '8px', background: 'rgba(0,0,0,0.2)', borderRadius: 6, textAlign: 'center' }}>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Signal</div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 'bold', color: eiaMetrics.bpsMove > 0 ? 'var(--green)' : eiaMetrics.bpsMove < 0 ? 'var(--red)' : 'var(--gold)' }}>{eiaMetrics.signal}</div>
                  </div>
                </div>
                
                <div style={{ padding: '12px', background: eiaMetrics.bpsMove > 0 ? 'var(--green-dim)' : eiaMetrics.bpsMove < 0 ? 'var(--red-dim)' : 'rgba(245,166,35,0.05)', borderRadius: 6, border: `1px solid ${eiaMetrics.bpsMove > 0 ? 'rgba(0,196,143,0.3)' : eiaMetrics.bpsMove < 0 ? 'rgba(255,71,87,0.3)' : 'rgba(245,166,35,0.3)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 'bold' }}>Event Alpha Target:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="badge" style={{ background: eiaMetrics.decayState.active ? 'rgba(245, 166, 35, 0.2)' : 'rgba(255,255,255,0.1)', color: eiaMetrics.decayState.active ? 'var(--gold)' : 'var(--text-muted)' }}>
                        {eiaMetrics.decayState.text}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 'bold', color: eiaMetrics.bpsMove > 0 ? '#00c48f' : eiaMetrics.bpsMove < 0 ? '#ff4757' : '#f5a623' }}>
                        {eiaMetrics.bpsMove > 0 ? '+' : ''}{eiaMetrics.bpsMove} bps
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Awaiting EIA data connection...</div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  )
}
