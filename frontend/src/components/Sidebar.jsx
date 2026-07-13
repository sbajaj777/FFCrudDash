import React from 'react'

const PAGES = [
  { id: 'dashboard',     icon: 'grid',        label: 'Dashboard' },
  { id: 'market-watch',  icon: 'trending',    label: 'Market Watch' },
  { id: 'calendar',      icon: 'calendar',    label: 'Calendar' },
  { id: 'curves',        icon: 'curves',      label: 'Curves & Spreads' },
  { id: 'quant',         icon: 'quant',       label: 'Quant Lab' },
  { id: 'regime',        icon: 'regime',      label: 'Regime Intelligence' },
  { id: 'regression',    icon: 'regression',  label: 'Regression Lab' },
  { id: 'eia',           icon: 'opportunities', label: 'EIA Event Intel' },
  { id: 'opportunities', icon: 'opportunities',label: 'Opportunities' },
  { id: 'correlation',   icon: 'correlation', label: 'Correlation' },
  { id: 'fundamentals',  icon: 'fundament',   label: 'Fundamentals' },
  { id: 'news',          icon: 'news',        label: 'News & Intel' },
  { id: 'strategy',      icon: 'strategy',    label: 'Strategy Lab' },
]

const ICONS = {
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  trending: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>,
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  curves: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 20Q8 4 21 8"/><path d="M3 16Q10 12 21 14" strokeDasharray="3 2"/></svg>,
  quant: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>,
  regime: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>,
  regression: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  opportunities: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  correlation: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="1"/><rect x="5" y="5" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/><rect x="10" y="5" width="4" height="4" fill="currentColor" opacity="0.15" rx="0.5"/><rect x="15" y="5" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/><rect x="5" y="10" width="4" height="4" fill="currentColor" opacity="0.15" rx="0.5"/><rect x="10" y="10" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/><rect x="15" y="10" width="4" height="4" fill="currentColor" opacity="0.15" rx="0.5"/><rect x="5" y="15" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/><rect x="10" y="15" width="4" height="4" fill="currentColor" opacity="0.15" rx="0.5"/><rect x="15" y="15" width="4" height="4" fill="currentColor" opacity="0.3" rx="0.5"/></svg>,
  fundament: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  news: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z"/><path d="M6 8h4v4H6z"/><path d="M14 8h4M14 12h4M6 16h12"/></svg>,
  strategy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"/></svg>,
}

export default function Sidebar({ active, onChange }) {
  return (
    <nav style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoWrap}>
        <div style={styles.logo}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke="url(#lg)" strokeWidth="1.5"/>
            <path d="M8 14l3-4 2 2 3-4" stroke="url(#lg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <defs>
              <linearGradient id="lg" x1="2" y1="2" x2="22" y2="22">
                <stop offset="0%" stopColor="#00d4ff"/>
                <stop offset="100%" stopColor="#f5a623"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span style={styles.logoText}>FF</span>
      </div>

      <div style={styles.divider} />

      {/* Nav Items */}
      <div style={styles.navItems}>
        {PAGES.map(page => {
          const isActive = active === page.id
          return (
            <button
              key={page.id}
              onClick={() => onChange(page.id)}
              title={page.label}
              style={{
                ...styles.navBtn,
                ...(isActive ? styles.navBtnActive : {}),
              }}
            >
              <span style={{
                ...styles.iconWrap,
                ...(isActive ? styles.iconActive : {}),
              }}>
                {ICONS[page.icon]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Bottom: Settings */}
      <div style={{ marginTop: 'auto', paddingBottom: 12 }}>
        <div style={styles.divider} />
        <button style={styles.navBtn} title="Settings">
          <span style={styles.iconWrap}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </span>
        </button>
      </div>
    </nav>
  )
}

const styles = {
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: 56,
    background: 'rgba(8, 12, 22, 0.97)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 10,
    zIndex: 100,
    backdropFilter: 'blur(16px)',
  },
  logoWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    padding: '4px 0 8px',
  },
  logo: {
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.15em',
    color: '#00d4ff',
    fontFamily: "'Inter', sans-serif",
  },
  divider: {
    width: 28,
    height: 1,
    background: 'rgba(255,255,255,0.06)',
    margin: '4px 0 8px',
  },
  navItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    alignItems: 'center',
  },
  navBtn: {
    width: 42,
    height: 42,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
    transition: 'all 150ms ease',
    color: '#4a5d7a',
    padding: 0,
  },
  navBtnActive: {
    background: 'linear-gradient(90deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 212, 255, 0.0) 100%)',
    color: '#00d4ff',
    borderLeft: '2px solid #00d4ff',
    boxShadow: 'inset 2px 0 10px rgba(0, 212, 255, 0.1)',
  },
  iconWrap: {
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 200ms ease',
  },
  iconActive: {
    color: '#00d4ff',
    filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.6))',
    transform: 'scale(1.1)',
  },
}

