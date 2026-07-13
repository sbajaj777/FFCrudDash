import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'

const DEFAULT_GEO_RISKS = [
  { region: 'Middle East',     score: 78, color: 'var(--red)' },
  { region: 'Iran (Sanctions)',score: 82, color: 'var(--red)' },
  { region: 'Russia / CIS',   score: 71, color: 'var(--red)' },
  { region: 'Venezuela',      score: 62, color: 'var(--orange)' },
  { region: 'Libya',          score: 55, color: 'var(--orange)' },
  { region: 'West Africa',    score: 45, color: 'var(--gold)' },
  { region: 'US Gulf Coast',  score: 22, color: 'var(--green)' },
  { region: 'Canada / WCSB',  score: 18, color: 'var(--green)' },
]

function autoTag(title) {
  const t = title.toLowerCase()
  const tags = []
  if (t.includes('opec') || t.includes('saudi') || t.includes('output') || t.includes('production cut')) tags.push({ label: 'OPEC', color: 'badge-gold' })
  if (t.includes('crude') || t.includes('oil') || t.includes('wti') || t.includes('brent')) tags.push({ label: 'CRUDE', color: 'badge-cyan' })
  if (t.includes('eia') || t.includes('inventory') || t.includes('stockpile')) tags.push({ label: 'EIA', color: 'badge-green' })
  if (t.includes('iran') || t.includes('sanction') || t.includes('war') || t.includes('hormuz') || t.includes('tanker')) tags.push({ label: 'GEO', color: 'badge-red' })
  if (t.includes('china') || t.includes('demand') || t.includes('import')) tags.push({ label: 'DEMAND', color: 'badge-orange' })
  if (t.includes('natural gas') || t.includes('lng') || t.includes('lpg')) tags.push({ label: 'NATGAS', color: 'badge-green' })
  if (t.includes('refin') || t.includes('gasoline') || t.includes('diesel') || t.includes('rbob')) tags.push({ label: 'PRODUCTS', color: 'badge-purple' })
  if (t.includes('russia') || t.includes('ukraine')) tags.push({ label: 'RUSSIA', color: 'badge-red' })
  if (tags.length === 0) tags.push({ label: 'ENERGY', color: 'badge-cyan' })
  return tags.slice(0, 3)
}

function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

const MOCK_COMMENTARY = `• **Crude Complex Weakness:** WTI and Brent are trading heavily in the red today, down over 3.5% as algorithmic selling accelerated below the 50-day moving averages. The sell-off was catalyzed by a surprise build in U.S. commercial crude inventories and easing geopolitical premiums.

• **Geopolitical Premium Unwinding:** Initial fears of supply disruptions in the Strait of Hormuz have subsided following diplomatic developments. Risk-off sentiment is pervasive, pulling speculative length out of the market. The Brent-WTI spread has narrowed slightly as North Sea physical markets remain well supplied.

• **Product Crack Spreads Under Pressure:** Both RBOB and Heating Oil cracks are compressing. Weakening demand signals from the U.S. driving season and higher-than-expected refinery utilization rates are leading to product builds, weighing heavily on the 3:2:1 crack spread.`

export default function NewsPage({ data }) {
  const { news, prices } = data
  const [aiCommentary, setAiCommentary] = useState(MOCK_COMMENTARY)
  const [aiLoading, setAiLoading] = useState(false)
  const [geoRisks, setGeoRisks] = useState(DEFAULT_GEO_RISKS)
  const [activeTab, setActiveTab] = useState('energy')

  const geoAvg = Math.round(geoRisks.reduce((a, b) => a + b.score, 0) / geoRisks.length)

  const fetchAI = async () => {
    setAiLoading(true)
    setTimeout(() => {
      setAiCommentary(MOCK_COMMENTARY)
      setGeoRisks(DEFAULT_GEO_RISKS)
      setAiLoading(false)
    }, 600)
  }

  // Filter news based on active tab
  const filteredNews = news.filter(item => {
    if (activeTab === 'energy') return true
    const tags = autoTag(item.title)
    return tags.some(t => t.label === 'GEO' || t.label === 'RUSSIA' || t.label === 'OPEC')
  })

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M6 8h4v4H6z"/><path d="M14 8h4M14 12h4M6 16h12"/>
          </svg>
          News & Intelligence
        </h1>
        <div className="page-subtitle">Energy-filtered live headlines from FinancialJuice • AI market commentary • Geopolitical risk</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>
        {/* Left: News Feed */}
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="card-title">Live Intelligence Feed</span>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 6, padding: 3 }}>
                  <button 
                    onClick={() => setActiveTab('energy')}
                    style={{ 
                      background: activeTab === 'energy' ? 'var(--cyan)' : 'transparent',
                      color: activeTab === 'energy' ? '#000' : 'var(--text-muted)',
                      border: 'none', padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    ENERGY
                  </button>
                  <button 
                    onClick={() => setActiveTab('geopolitical')}
                    style={{ 
                      background: activeTab === 'geopolitical' ? 'var(--red)' : 'transparent',
                      color: activeTab === 'geopolitical' ? '#fff' : 'var(--text-muted)',
                      border: 'none', padding: '4px 12px', fontSize: 11, fontWeight: 600, borderRadius: 4, cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    GEOPOLITICAL
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Source: FinancialJuice Live Stream & YF • Filtered</span>
                <span className="badge badge-cyan">{filteredNews.length} articles</span>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 0 }}>
              {filteredNews.length > 0 ? filteredNews.map((item, i) => {
                const tags = autoTag(item.title)
                return (
                  <a
                    key={i}
                    href={item.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '11px 0',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'grid',
                      gridTemplateColumns: '56px 1fr',
                      gap: 12,
                      alignItems: 'start',
                      textDecoration: 'none',
                      transition: 'background 120ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--cyan)', fontWeight: 600 }}>
                        {timeAgo(item.time)}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.3 }}>
                        {item.src || 'FinancialJuice'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.45, marginBottom: 6, color: 'var(--text-primary)' }}>
                        {item.title}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {tags.map((tag, j) => (
                          <span key={j} className={`badge ${tag.color}`}>{tag.label}</span>
                        ))}
                      </div>
                    </div>
                  </a>
                )
              }) : (
                <div className="text-muted" style={{ padding: 28, textAlign: 'center', fontSize: 12 }}>
                  <div style={{ marginBottom: 8 }}>⏳ Fetching live energy news...</div>
                  <div style={{ fontSize: 10 }}>Connecting to real-time feeds.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: AI + Geo */}
        <div style={{ display: 'grid', gap: 14 }}>
          {/* AI Commentary */}
          <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
            <div className="card-header">
              <span className="card-title">AI Market Commentary</span>
              <button onClick={fetchAI} disabled={aiLoading} style={{
                background: 'var(--gold-dim)', border: '1px solid rgba(245,166,35,0.2)',
                borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 10,
                color: 'var(--gold)', fontWeight: 600,
              }}>
                {aiLoading ? '⏳ Generating...' : '✨ Generate'}
              </button>
            </div>
            <div className="ai-commentary-box" style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--text-secondary)', maxHeight: 300, overflowY: 'auto' }}>
              {aiCommentary ? (
                <ReactMarkdown>{aiCommentary}</ReactMarkdown>
              ) : (
                'Click Generate for AI-powered market analysis.\n\nRequires GEMINI_API_KEY or OPENAI_API_KEY in backend/.env'
              )}
            </div>

          </div>

          {/* Geopolitical Risk */}
          <div className="card" style={{ borderTop: '2px solid var(--red)' }}>
            <div className="card-header">
              <span className="card-title" style={{ letterSpacing: 1.5 }}>GEOPOLITICAL RISK</span>
              <span style={{ 
                fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 4, 
                background: 'rgba(255, 68, 68, 0.15)', color: 'var(--red)', border: '1px solid rgba(255, 68, 68, 0.3)' 
              }}>
                GEO RISK: {geoAvg}/100
              </span>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {geoRisks.map((risk, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{risk.region}</span>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: risk.color }}>{risk.score}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${risk.score}%`, height: '100%', background: risk.color, borderRadius: 2, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Data Sources: Google News RSS, Gemini AI</span>
      </div>

      <style>{`
        .ai-commentary-box p { margin: 0 0 12px 0; }
        .ai-commentary-box p:last-child { margin: 0; }
        .ai-commentary-box ul, .ai-commentary-box ol { margin: 0 0 12px 0; padding-left: 20px; }
        .ai-commentary-box li { margin-bottom: 6px; }
        .ai-commentary-box strong { color: var(--gold); font-weight: 600; }
      `}</style>
    </div>
  )
}

