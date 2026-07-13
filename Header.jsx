// ─── components/Header.jsx ───
import React from 'react'
import { useClock } from '../hooks/usePrices.js'
import styles from './Header.module.css'

export default function Header() {
  const time = useClock()
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <span className={styles.dot} />
        <span className={`${styles.logoText} mono`}>ENERGY DESK</span>
        <span className={styles.version}>v2.0</span>
      </div>
      <div className={styles.right}>
        <span className={`badge badge-green ${styles.liveBadge}`}>● LIVE</span>
        <span className={`${styles.clock} mono`}>{time}</span>
      </div>
    </header>
  )
}
