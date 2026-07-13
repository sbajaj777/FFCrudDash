// ─── components/ui/index.jsx ───
// Shared primitive UI components used throughout the dashboard.

import React from 'react'
import styles from './ui.module.css'

/** Card wrapper with optional glow border */
export function Card({ children, className = '', glow = false }) {
  return (
    <div className={`${styles.card} ${glow ? styles.glow : ''} ${className}`}>
      {children}
    </div>
  )
}

/** Card header row: title left, badge right */
export function CardHeader({ title, badge, badgeColor = 'badge-blue' }) {
  return (
    <div className={styles.cardHeader}>
      <span className={styles.cardTitle}>{title}</span>
      {badge && <span className={`badge ${badgeColor}`}>{badge}</span>}
    </div>
  )
}

/** Metric stat tile */
export function StatTile({ label, value, color = '' }) {
  return (
    <div className={styles.statTile}>
      <div className={styles.statLabel}>{label}</div>
      <div className={`${styles.statValue} mono ${color}`}>{value}</div>
    </div>
  )
}

/** Progress bar meter */
export function Meter({ label, value, max, unit = '', color = 'var(--amber)' }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className={styles.meter}>
      <div className={styles.meterHeader}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={`${styles.meterValue} mono`} style={{ color }}>{value}{unit}</span>
      </div>
      <div className={styles.meterOuter}>
        <div className={styles.meterInner} style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

/** Loading dots spinner */
export function LoadingDots({ text = 'Loading...' }) {
  return (
    <div className={styles.loadingState}>
      {[0, 1, 2].map(i => (
        <span key={i} className={styles.loadingDot} style={{ animationDelay: `${i * 0.18}s` }} />
      ))}
      <span className={styles.loadingText}>{text}</span>
    </div>
  )
}

/** News item */
export function NewsItem({ item }) {
  return (
    <div className={styles.newsItem}>
      <div className={styles.newsTime}>{item.time}</div>
      <div className={styles.newsTitle}>{item.title}</div>
      <div className={styles.newsTags}>
        {item.tags.map((t, i) => (
          <span key={i} className={`badge ${t.color}`}>{t.label}</span>
        ))}
      </div>
    </div>
  )
}

/** Event calendar row */
export function EventRow({ date, name, impact, note }) {
  const badgeColor = impact === 'high' ? 'badge-red' : 'badge-amber'
  const impactLabel = impact === 'high' ? 'HIGH' : 'MED'
  return (
    <div className={styles.eventRow}>
      <span className={styles.eventDate}>{date}</span>
      <div className={styles.eventName}>
        {name}
        {note && <span className={styles.eventNote}>{note}</span>}
      </div>
      <span className={`badge ${badgeColor}`}>{impactLabel}</span>
    </div>
  )
}

/** Section header with decorative line */
export function SectionLine({ title }) {
  return <div className={styles.sectionLine}><span>{title}</span></div>
}

/** Geo risk row */
export function GeoRiskRow({ region, score, color }) {
  return (
    <div className={styles.geoRow}>
      <span className={styles.geoRegion}>{region}</span>
      <div className={styles.geoBarWrap}>
        <div className={styles.geoBar} style={{ width: `${score}%`, background: color }} />
      </div>
      <span className={`mono ${styles.geoScore}`} style={{ color }}>{score}</span>
    </div>
  )
}

/** Signal / alert item */
export function SignalItem({ type, text, time }) {
  return (
    <div className={`${styles.signalItem} ${styles[type]}`}>
      <span className={`${styles.signalType} ${styles[`st_${type}`]}`}>
        {type.toUpperCase()}
      </span>
      <span className={styles.signalText}>{text}</span>
      <span className={styles.signalTime}>{time}</span>
    </div>
  )
}
