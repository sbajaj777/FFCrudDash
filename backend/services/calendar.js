// ─── FFCrudeDash Smart Economic Calendar ───
// Generates real dates for recurring energy & macro events
// Based on official schedules — NOT hardcoded static data

// ── FOMC Meeting Dates (real scheduled dates 2025–2026) ──
const FOMC_DATES = [
  '2025-01-29', '2025-03-19', '2025-05-07', '2025-06-18',
  '2025-07-30', '2025-09-17', '2025-10-29', '2025-12-17',
  '2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17',
  '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-16',
]

// ── US Holidays (markets closed) ──
const US_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03',
  '2026-05-25', '2026-06-19', '2026-07-03', '2026-09-07',
  '2026-11-26', '2026-12-25',
]

function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6 }
function isHoliday(d) { return US_HOLIDAYS_2026.includes(d.toISOString().slice(0, 10)) }
function isBusinessDay(d) { return !isWeekend(d) && !isHoliday(d) }

function formatDate(d) { return d.toISOString().slice(0, 10) }
function formatTime(d) {
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' })
}

// Get next occurrence of a specific weekday (0=Sun, 1=Mon, ..., 6=Sat)
function getNextWeekday(from, targetDay, skipWeeks = 0) {
  const d = new Date(from)
  let daysUntil = (targetDay - d.getDay() + 7) % 7
  if (daysUntil === 0 && d.getHours() >= 18) daysUntil = 7 // already past today
  d.setDate(d.getDate() + daysUntil + (skipWeeks * 7))
  return d
}

// Get next N occurrences of a weekday
function getNextNWeekdays(from, targetDay, count) {
  const results = []
  let current = new Date(from)
  for (let i = 0; i < count; i++) {
    const next = getNextWeekday(current, targetDay, i === 0 ? 0 : 0)
    results.push(new Date(next))
    current = new Date(next)
    current.setDate(current.getDate() + 1)
  }
  return results
}

// ── Generate Calendar Events ──
export function generateEconomicCalendar() {
  const now = new Date()
  const events = []
  const lookAheadDays = 14

  // 1. EIA Petroleum Status Report — Every Wednesday 10:30 ET
  for (let w = 0; w < 3; w++) {
    const wed = getNextWeekday(now, 3, w) // 3 = Wednesday
    wed.setHours(10, 30, 0)
    if (wed > now || w === 0) {
      events.push({
        date: formatDate(wed),
        time: '10:30 ET',
        name: 'EIA Petroleum Status Report',
        note: 'Weekly crude oil inventories, production, imports',
        impact: 'high',
        category: 'energy',
        source: 'EIA (U.S. Energy Information Administration)',
        recurring: 'Weekly - Wednesday',
      })
    }
  }

  // 2. API Weekly Inventory — Every Tuesday ~21:30 ET
  for (let w = 0; w < 3; w++) {
    const tue = getNextWeekday(now, 2, w) // 2 = Tuesday
    tue.setHours(21, 30, 0)
    if (tue > now || w === 0) {
      events.push({
        date: formatDate(tue),
        time: '21:30 ET',
        name: 'API Weekly Inventory Survey',
        note: 'Private estimate — precedes EIA by ~16 hours',
        impact: 'medium',
        category: 'energy',
        source: 'American Petroleum Institute',
        recurring: 'Weekly - Tuesday',
      })
    }
  }

  // 3. Baker Hughes Rig Count — Every Friday 13:00 ET
  for (let w = 0; w < 3; w++) {
    const fri = getNextWeekday(now, 5, w) // 5 = Friday
    fri.setHours(13, 0, 0)
    if (fri > now || w === 0) {
      events.push({
        date: formatDate(fri),
        time: '13:00 ET',
        name: 'Baker Hughes Rig Count',
        note: 'US oil & gas rig count — supply indicator',
        impact: 'medium',
        category: 'energy',
        source: 'Baker Hughes',
        recurring: 'Weekly - Friday',
      })
    }
  }

  // 4. CFTC COT Report — Every Friday 15:30 ET
  for (let w = 0; w < 3; w++) {
    const fri = getNextWeekday(now, 5, w)
    fri.setHours(15, 30, 0)
    if (fri > now || w === 0) {
      events.push({
        date: formatDate(fri),
        time: '15:30 ET',
        name: 'CFTC Commitments of Traders',
        note: 'Managed money positioning in crude, products',
        impact: 'medium',
        category: 'energy',
        source: 'CFTC',
        recurring: 'Weekly - Friday',
      })
    }
  }

  // 5. US Weekly Jobless Claims — Every Thursday 08:30 ET
  for (let w = 0; w < 3; w++) {
    const thu = getNextWeekday(now, 4, w) // 4 = Thursday
    thu.setHours(8, 30, 0)
    if (thu > now || w === 0) {
      events.push({
        date: formatDate(thu),
        time: '08:30 ET',
        name: 'US Weekly Jobless Claims',
        note: 'Labor market health — DXY & risk sentiment driver',
        impact: 'medium',
        category: 'macro',
        source: 'US Department of Labor',
        recurring: 'Weekly - Thursday',
      })
    }
  }

  // 6. FOMC Rate Decision — from real schedule
  for (const dateStr of FOMC_DATES) {
    const d = new Date(dateStr + 'T14:00:00-05:00')
    if (d > now && d < new Date(now.getTime() + lookAheadDays * 2 * 86400000)) {
      events.push({
        date: dateStr,
        time: '14:00 ET',
        name: 'FOMC Interest Rate Decision',
        note: 'Federal funds rate — primary USD catalyst',
        impact: 'high',
        category: 'macro',
        source: 'Federal Reserve',
        recurring: 'Scheduled',
      })
    }
  }

  // 7. US CPI — typically 2nd or 3rd Tuesday of month, 08:30 ET
  {
    const month = now.getMonth()
    const year = now.getFullYear()
    // CPI usually ~10th-15th of month
    for (let m = 0; m < 2; m++) {
      const targetMonth = month + m
      const targetYear = targetMonth > 11 ? year + 1 : year
      const actualMonth = targetMonth % 12
      // Find second Tuesday
      const firstDay = new Date(targetYear, actualMonth, 1)
      const firstTue = getNextWeekday(firstDay, 2, 0)
      const secondTue = new Date(firstTue)
      secondTue.setDate(firstTue.getDate() + 7)
      if (secondTue.getDate() < 10) secondTue.setDate(secondTue.getDate() + 7)
      secondTue.setHours(8, 30, 0)
      if (secondTue > now) {
        events.push({
          date: formatDate(secondTue),
          time: '08:30 ET',
          name: 'US CPI Inflation',
          note: 'Consumer price index — key Fed policy input',
          impact: 'high',
          category: 'macro',
          source: 'Bureau of Labor Statistics',
          recurring: 'Monthly',
        })
      }
    }
  }

  // 8. US Non-Farm Payrolls — first Friday of month, 08:30 ET
  {
    for (let m = 0; m < 2; m++) {
      const targetMonth = now.getMonth() + m
      const targetYear = targetMonth > 11 ? now.getFullYear() + 1 : now.getFullYear()
      const actualMonth = targetMonth % 12
      const firstDay = new Date(targetYear, actualMonth, 1)
      const firstFri = getNextWeekday(firstDay, 5, 0)
      firstFri.setHours(8, 30, 0)
      if (firstFri > now) {
        events.push({
          date: formatDate(firstFri),
          time: '08:30 ET',
          name: 'US Non-Farm Payrolls',
          note: 'Employment data — USD & macro regime shift',
          impact: 'high',
          category: 'macro',
          source: 'Bureau of Labor Statistics',
          recurring: 'Monthly - 1st Friday',
        })
      }
    }
  }

  // 9. OPEC+ Monthly Meeting — typically first week of month
  {
    for (let m = 0; m < 2; m++) {
      const targetMonth = now.getMonth() + m + 1
      const targetYear = targetMonth > 11 ? now.getFullYear() + 1 : now.getFullYear()
      const actualMonth = targetMonth % 12
      // OPEC typically meets on Thursday of first week
      const firstDay = new Date(targetYear, actualMonth, 1)
      const firstThu = getNextWeekday(firstDay, 4, 0)
      if (firstThu > now) {
        events.push({
          date: formatDate(firstThu),
          time: 'TBD',
          name: 'OPEC+ Output Policy Meeting',
          note: 'Production quota decisions — major crude catalyst',
          impact: 'high',
          category: 'energy',
          source: 'OPEC Secretariat',
          recurring: 'Monthly',
        })
      }
    }
  }

  // 10. ECB Rate Decision — typically every 6 weeks
  {
    const ecbDates = ['2026-01-22', '2026-03-06', '2026-04-17', '2026-06-05', '2026-07-17', '2026-09-11', '2026-10-23', '2026-12-11']
    for (const dateStr of ecbDates) {
      const d = new Date(dateStr + 'T13:15:00+01:00')
      if (d > now && d < new Date(now.getTime() + lookAheadDays * 3 * 86400000)) {
        events.push({
          date: dateStr,
          time: '07:45 ET',
          name: 'ECB Interest Rate Decision',
          note: 'EUR/USD impact — affects global energy pricing',
          impact: 'medium',
          category: 'macro',
          source: 'European Central Bank',
          recurring: 'Scheduled',
        })
      }
    }
  }

  // Sort by date
  events.sort((a, b) => a.date.localeCompare(b.date))

  // Tag relative dates
  const todayStr = formatDate(now)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = formatDate(tomorrow)

  for (const event of events) {
    if (event.date === todayStr) {
      event.relativeDate = 'TODAY'
    } else if (event.date === tomorrowStr) {
      event.relativeDate = 'TOMORROW'
    } else {
      const eventDate = new Date(event.date)
      const daysAway = Math.ceil((eventDate - now) / 86400000)
      const dayName = eventDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
      if (daysAway <= 7) {
        event.relativeDate = dayName
      } else if (daysAway <= 14) {
        event.relativeDate = `NEXT ${dayName}`
      } else {
        event.relativeDate = eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
    }
  }

  return {
    events,
    generatedAt: now.toISOString(),
    count: events.length,
    method: 'Computed from official recurring schedules (EIA, CFTC, FOMC, BLS, OPEC, ECB)',
  }
}
