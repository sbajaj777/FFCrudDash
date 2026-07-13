// ─── components/NavTabs.jsx ───
import React from 'react'
import styles from './NavTabs.module.css'

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
    <nav className={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`${styles.tab} ${active === tab.id ? styles.active : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
