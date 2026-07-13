import React, { useState } from 'react'
import { useMarketData } from './hooks/usePrices.js'
import Sidebar from './components/Sidebar.jsx'
import MarqueeTicker from './components/MarqueeTicker.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MarketWatchPage from './pages/MarketWatchPage.jsx'
import CalendarPage from './pages/CalendarPage.jsx'
import CurvesPage from './pages/CurvesPage.jsx'
import QuantLabPage from './pages/QuantLabPage.jsx'
import CorrelationPage from './pages/CorrelationPage.jsx'
import FundamentalsPage from './pages/FundamentalsPage.jsx'
import NewsPage from './pages/NewsPage.jsx'
import RegimePage from './pages/RegimePage.jsx'
import RegressionLabPage from './pages/RegressionLabPage.jsx'
import OpportunityPage from './pages/OpportunityPage.jsx'
import EiaEventPage from './pages/EiaEventPage.jsx'
import Chatbot from './components/Chatbot.jsx'
import AlertToast from './components/AlertToast.jsx'
import StrategyLabPage from './pages/StrategyLabPage.jsx'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const data = useMarketData()

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage data={data} />
      case 'market-watch': return <MarketWatchPage data={data} />
      case 'calendar': return <CalendarPage data={data} />
      case 'curves': return <CurvesPage data={data} />
      case 'quant': return <QuantLabPage data={data} />
      case 'regime': return <RegimePage />
      case 'regression': return <RegressionLabPage />
      case 'eia': return <EiaEventPage data={data} />
      case 'opportunities': return <OpportunityPage />
      case 'correlation': return <CorrelationPage data={data} />
      case 'fundamentals': return <FundamentalsPage data={data} />
      case 'news': return <NewsPage data={data} />
      case 'strategy': return <StrategyLabPage />
      default: return <DashboardPage data={data} />
    }
  }

  return (
    <div style={styles.shell}>
      <Sidebar active={activePage} onChange={setActivePage} />
      <div style={styles.main}>
        <MarqueeTicker prices={data.prices} />
        <div style={styles.content}>
          {renderPage()}
        </div>
        {/* Status Bar */}
        <div style={styles.statusBar}>
          <div style={styles.statusLeft}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: data.connected ? 'var(--green)' : 'var(--red)',
              fontSize: 11, fontWeight: 600,
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: data.connected ? 'var(--green)' : 'var(--red)',
                boxShadow: data.connected ? '0 0 8px rgba(0,196,143,0.5)' : 'none',
                animation: data.connected ? 'pulse-glow 2s ease-in-out infinite' : 'none',
              }} />
              {data.connected ? 'LIVE' : 'OFFLINE'}
            </span>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              CME/NYMEX/ICE Exchange Data → SSE
            </span>
          </div>
          <div style={styles.statusRight}>
            <span className="mono" style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              FFCrudeDash v1.0 — Futures First
            </span>
          </div>
        </div>
      </div>
      <AlertToast prices={data.prices} news={data.news} />
      <Chatbot />
    </div>
  )
}

const styles = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    width: '100%',
  },
  main: {
    flex: 1,
    marginLeft: 56,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    minWidth: 0,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto',
    overflowX: 'hidden',
    minWidth: 0,
  },
  statusBar: {
    height: 30,
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: 'rgba(8, 12, 22, 0.95)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 16px',
    flexShrink: 0,
  },
  statusLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  statusRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
}

