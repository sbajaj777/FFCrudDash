// ─── components/TickerBar.jsx ───
import React from 'react'
import { formatPrice, formatChange } from '../utils/priceEngine.js'
import styles from './TickerBar.module.css'

const TICKER_ORDER = ['WTI', 'BRN', 'DXY', 'RBOB', 'NG', 'HO', 'CRACK']

export default function TickerBar({ prices }) {
  return (
    <div className={styles.bar}>
      {TICKER_ORDER.map(key => {
        const d = prices[key]
        if (!d) return null
        const up = d.change >= 0
        return (
          <div key={key} className={`${styles.card} ${up ? styles.up : styles.down}`}>
            <div className={styles.symbol}>{d.name}</div>
            <div className={`${styles.price} mono ${up ? 'green' : 'red'}`}>
              {formatPrice(d.price, d.decimals, d.unit)}
            </div>
            <div className={`${styles.change} mono ${up ? 'green' : 'red'}`}>
              {formatChange(d.change, d.pct, d.decimals === 4 ? 4 : 2)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
