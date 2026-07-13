import React from 'react'
import { formatPrice, formatChange } from '../utils/priceEngine.js'

const TICKER_KEYS = ['WTI', 'BRN', 'RBOB', 'HO', 'NG', 'GOLD', 'DXY', 'US10Y', 'SPX', 'EURUSD']
const ICONS = {
  WTI: '●', BRN: '●', RBOB: '◆', HO: '■', NG: '●',
  GOLD: '●', DXY: '$', US10Y: '◎', SPX: '▲', EURUSD: '€',
}

export default function MarqueeTicker({ prices }) {
  const items = TICKER_KEYS.map(key => prices[key]).filter(p => p && p.price > 0)
  if (items.length === 0) return null

  const renderItem = (p, key, idx) => {
    const up = p.change >= 0
    return (
      <span key={`${key}-${idx}`} style={styles.item}>
        <span style={{ ...styles.icon, color: up ? 'var(--green)' : 'var(--red)' }}>{ICONS[key] || '●'}</span>
        <span style={styles.name}>{p.name}</span>
        <span className="mono" style={styles.price}>{formatPrice(p.price, p.decimals, p.unit)}</span>
        <span className="mono" style={{ ...styles.change, color: up ? 'var(--green)' : 'var(--red)' }}>
          {formatChange(p.change, p.pct, p.decimals > 2 ? 4 : 2)}
        </span>
      </span>
    )
  }

  // Duplicate items for seamless scroll
  const allKeys = TICKER_KEYS.filter(key => prices[key]?.price > 0)

  return (
    <div style={styles.container}>
      <div style={styles.track}>
        {allKeys.map((key, i) => renderItem(prices[key], key, i))}
        {allKeys.map((key, i) => renderItem(prices[key], key, i + allKeys.length))}
      </div>
    </div>
  )
}

const styles = {
  container: {
    height: 38,
    background: 'rgba(8, 12, 22, 0.9)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    whiteSpace: 'nowrap',
    animation: 'ticker-scroll 45s linear infinite',
    willChange: 'transform',
  },
  item: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 20px',
    fontSize: 12,
    borderRight: '1px solid rgba(255,255,255,0.04)',
    height: 38,
  },
  icon: {
    fontSize: 8,
  },
  name: {
    fontWeight: 600,
    color: 'var(--text-secondary)',
    fontSize: 11,
  },
  price: {
    fontWeight: 700,
    color: 'var(--text-primary)',
    fontSize: 12,
  },
  change: {
    fontSize: 11,
    fontWeight: 500,
  },
}

