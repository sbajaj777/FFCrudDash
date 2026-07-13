import React from 'react'
import styles from '../styles/ui.module.css'

export const TABS = [
  { id: 'overview',       label: 'Overview'         },
  { id: 'morning-brief',  label: 'Morning Brief'    },
  { id: 'fundamentals',   label: 'Fundamentals'     },
  { id: 'macro',          label: 'Macro & CFTC'     },
  { id: 'geopolitical',   label: 'Geopolitical'     },
  { id: 'signals',        label: 'Signals & Alerts' },
  { id: 'risk',           label: 'Risk & Money'     },
]

export default function NavTabs({ active, onChange }) {
  return (
    <nav className={styles.tabs}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`${styles.tabButton} ${active === tab.id ? styles.tabActive : ''}`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}

