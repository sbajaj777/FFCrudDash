import React, { useState, useEffect } from 'react'

const impactStyle = {
  high:   { color: 'var(--red)',    badge: 'badge-red' },
  medium: { color: 'var(--gold)',   badge: 'badge-gold' },
  low:    { color: 'var(--green)',  badge: 'badge-green' },
}

export default function CalendarPage({ data }) {
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await fetch('http://localhost:4000/api/calendar')
        const json = await res.json()
        if (json.calendar) setCalendar(json.calendar)
      } catch (e) {
        console.warn('[Calendar] Fetch failed:', e.message)
      }
      setLoading(false)
    }
    fetchCalendar()
    // Refresh every 30 minutes
    const interval = setInterval(fetchCalendar, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const energyEvents = calendar?.events?.filter(e => e.category === 'energy') || []
  const macroEvents = calendar?.events?.filter(e => e.category === 'macro') || []

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
          Economic & Energy Calendar
        </h1>
        <div className="page-subtitle">
          {dateStr} • {loading ? 'Loading...' : `${calendar?.count || 0} upcoming events`}
          <span style={{ marginLeft: 12, fontSize: 10, color: 'var(--green)' }}>● LIVE — auto-computed from official schedules</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
        {/* Energy Events */}
        <div className="card" style={{ borderTop: '2px solid var(--cyan)' }}>
          <div className="card-header">
            <span className="card-title">Energy & Commodity Events</span>
            <span className="badge badge-cyan">{energyEvents.length} events</span>
          </div>
          <div style={{ display: 'grid', gap: 0 }}>
            {energyEvents.map((event, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr auto',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--cyan)', fontWeight: 600 }}>
                    {event.relativeDate}
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {event.time}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{event.name}</div>
                  {event.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{event.note}</div>}
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{event.source}</div>
                </div>
                <span className={`badge ${impactStyle[event.impact]?.badge || 'badge-gold'}`}>
                  {event.impact?.toUpperCase()}
                </span>
              </div>
            ))}
            {energyEvents.length === 0 && !loading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No upcoming energy events</div>
            )}
          </div>
        </div>

        {/* Macro Calendar */}
        <div className="card" style={{ borderTop: '2px solid var(--gold)' }}>
          <div className="card-header">
            <span className="card-title">Macro Calendar</span>
            <span className="badge badge-gold">{macroEvents.length} releases</span>
          </div>
          <div style={{ display: 'grid', gap: 0 }}>
            {macroEvents.map((event, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '90px 1fr auto',
                gap: 10,
                padding: '10px 0',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
              }}>
                <div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                    {event.relativeDate}
                  </div>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                    {event.time}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{event.name}</div>
                  {event.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{event.note}</div>}
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{event.source}</div>
                </div>
                <span className={`badge ${impactStyle[event.impact]?.badge || 'badge-gold'}`}>
                  {event.impact?.toUpperCase()}
                </span>
              </div>
            ))}
            {macroEvents.length === 0 && !loading && (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>No upcoming macro events</div>
            )}
          </div>
        </div>

        {/* Trading Session Guide */}
        <div className="card" style={{ gridColumn: '1 / -1', borderTop: '2px solid var(--green)' }}>
          <div className="card-header"><span className="card-title">Global Trading Sessions</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 8 }}>
            {[
              { name: 'Asia/Tokyo', hours: '19:00 – 04:00 ET', status: getSessionStatus('asia'), color: 'var(--cyan)' },
              { name: 'London/ICE', hours: '03:00 – 11:30 ET', status: getSessionStatus('london'), color: 'var(--gold)' },
              { name: 'NYMEX/CME', hours: '09:00 – 14:30 ET', status: getSessionStatus('ny'), color: 'var(--green)' },
              { name: 'Electronic', hours: '18:00 – 17:00 ET', status: 'OPEN', color: 'var(--cyan)' },
            ].map(session => (
              <div key={session.name} style={{
                padding: 14, borderRadius: 8,
                border: `1px solid ${session.status === 'OPEN' ? 'rgba(0,196,143,0.2)' : 'var(--border)'}`,
                background: session.status === 'OPEN' ? 'rgba(0,196,143,0.04)' : 'rgba(255,255,255,0.02)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{session.name}</div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{session.hours}</div>
                <span className={`badge ${session.status === 'OPEN' ? 'badge-green' : 'badge-red'}`} style={{ marginTop: 8 }}>
                  {session.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Method attribution */}
      {calendar && (
        <div style={{ marginTop: 12, textAlign: 'right' }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {calendar.method}
          </span>
        </div>
      )}
    </div>
  )
}

function getSessionStatus(session) {
  const now = new Date()
  const utcHour = now.getUTCHours()
  if (session === 'asia') return (utcHour >= 0 && utcHour < 8) ? 'OPEN' : 'CLOSED'
  if (session === 'london') return (utcHour >= 7 && utcHour < 16) ? 'OPEN' : 'CLOSED'
  if (session === 'ny') return (utcHour >= 13 && utcHour < 19) ? 'OPEN' : 'CLOSED'
  return 'OPEN'
}
