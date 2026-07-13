import React from 'react'

export default function RigCountWidget({ rigCount }) {
  const latest = rigCount?.latest || null
  const change = latest?.change ?? null
  const extraFields = [
    { label: 'Oil rigs', value: latest?.oil },
    { label: 'Gas rigs', value: latest?.gas },
  ].filter((field) => Number.isFinite(field.value))

  return (
    <div className="card">
      <div className="cardHeader"><span className="cardTitle">Baker Hughes Rig Count</span></div>
      <div className="muted" style={{ fontSize: 12 }}>Weekly US rig activity</div>

      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
        {rigCount ? 'Showing live backend rig-count data.' : 'Waiting for live Baker Hughes rig-count data.'}
      </div>

      {!latest ? (
        <div className="muted" style={{ marginTop: 10 }}>Waiting for the live rig-count fetch to return.</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
            <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Latest total</div>
              <div style={{ fontWeight: 800, marginTop: 4 }}>{latest.total}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="muted" style={{ fontSize: 11 }}>Weekly change</div>
              <div style={{ fontWeight: 800, marginTop: 4, color: change <= 0 ? 'var(--green)' : 'var(--red)' }}>
                {change >= 0 ? '+' : ''}{change}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8, fontSize: 12 }}>
            {extraFields.map((field) => (
              <div key={field.label}>
                <div className="muted">{field.label}</div>
                <div className="mono">{field.value}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

