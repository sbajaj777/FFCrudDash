import React from 'react'
import { formatPrice, formatChange } from '../utils/priceEngine.js'
import styles from '../styles/ui.module.css'

const TICKER_ORDER = ['WTI', 'BRN', 'RBOB', 'HO', 'GASOIL', 'DXY', 'CRACK']

export default function TickerBar({ prices, activeKey, onSelect }) {
  return (
    <div className={styles.tickerBar}>
      {TICKER_ORDER.map(key => {
        const d = prices[key]
        if (!d) return null
        const up = d.change >= 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(key)}
            aria-pressed={activeKey === key}
            className={`${styles.tickerCard} ${activeKey === key ? styles.tickerActive : ''}`}
          >
            <div className={styles.tickerLabel}>{d.name}</div>
            <div className="mono" style={{ fontWeight: 700 }}>{formatPrice(d.price, d.decimals, d.unit)}</div>
            <div className={`mono ${styles.tickerChange}`} style={{ color: up ? 'var(--green)' : 'var(--red)' }}>{formatChange(d.change, d.pct, d.decimals === 4 ? 4 : 2)}</div>
          </button>
        )
      })}
    </div>
  )
}

