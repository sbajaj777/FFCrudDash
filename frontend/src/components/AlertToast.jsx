import React, { useState, useEffect, useCallback } from 'react'
import { useAnomalyDetection } from '../hooks/useAnomalyDetection'

export default function AlertToast({ prices, news }) {
  const [alerts, setAlerts] = useState([])

  const addAlert = useCallback((alert) => {
    setAlerts(prev => [...prev, alert])
  }, [])

  useAnomalyDetection(prices, news, addAlert)

  useEffect(() => {
    if (alerts.length > 0) {
      const timer = setTimeout(() => {
        setAlerts(prev => prev.slice(1)) // remove oldest alert after 10s
      }, 10000)
      return () => clearTimeout(timer)
    }
  }, [alerts])

  if (alerts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(120%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div style={styles.container}>
        {alerts.map((alert) => (
          <div key={alert.id} style={{ ...styles.alert, ...getStyle(alert.type) }}>
            <div style={styles.header}>
              <span style={styles.title}>{alert.title}</span>
              <button onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))} style={styles.closeBtn}>×</button>
            </div>
            <div style={styles.message}>{alert.message}</div>
            {alert.link && <a href={alert.link} target="_blank" rel="noreferrer" style={styles.link}>Read Article ↗</a>}
          </div>
        ))}
      </div>
    </>
  )
}

const getStyle = (type) => {
  if (type === 'surge') return { borderLeft: '4px solid var(--green)', background: 'rgba(0,196,143,0.15)' }
  if (type === 'crash') return { borderLeft: '4px solid var(--red)', background: 'rgba(255,71,87,0.15)' }
  return { borderLeft: '4px solid var(--gold)', background: 'rgba(245,166,35,0.15)' } // news
}

const styles = {
  container: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    pointerEvents: 'none',
  },
  alert: {
    pointerEvents: 'auto',
    width: 320,
    padding: '14px 16px',
    borderRadius: 8,
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
    color: '#fff',
    animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontWeight: 800,
    fontSize: 13,
    letterSpacing: '0.2px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.6)',
    cursor: 'pointer',
    fontSize: 18,
    padding: 0,
    lineHeight: 1,
    marginTop: -2,
    marginRight: -4,
  },
  message: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 1.5,
  },
  link: {
    display: 'inline-block',
    marginTop: 10,
    fontSize: 11,
    color: 'var(--cyan)',
    textDecoration: 'none',
    fontWeight: 600,
  }
}
