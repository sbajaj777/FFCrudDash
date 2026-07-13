import React from 'react'
import { useClock } from '../hooks/usePrices.js'
import './Header.module.css'
import styles from '../styles/ui.module.css'

export default function Header() {
  const time = useClock()
  return (
    <header className={styles.headerShell}>
      <div className={styles.headerBrand}>
        <div className={styles.headerOrb} />
        <div>
          <div className={styles.headerTitle}>Energy Desk</div>
          <div className={styles.headerMeta}>Live prices, eco data, seasonality, inventories, macro, news, and sentiment</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="badge badge-green">● LIVE</span>
        <span className="mono muted">{time}</span>
      </div>
    </header>
  )
}

