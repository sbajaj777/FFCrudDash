import React from 'react'
import styles from '../../styles/ui.module.css'

export function Card({ children, className = '', glow = false }) {
  return (
    <div className={`${styles.card} ${glow ? styles.glow : ''} ${className}`}>
      {children}
    </div>
  )
}

export function CardHeader({ title, badge }) {
  return (
    <div className={styles.cardHeader}>
      <span className={styles.cardTitle}>{title}</span>
      {badge && <span className={`badge`}>{badge}</span>}
    </div>
  )
}

