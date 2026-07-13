const RIG_COUNT_URL = 'https://rigcount.bakerhughes.com/'

export async function fetchRigCount() {
  try {
    const res = await fetch(RIG_COUNT_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0',
      },
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const html = await res.text()
    const latestRow = html.match(/<tr>\s*<td>\s*U\.S\.\s*<\/td>([\s\S]*?)<\/tr>/i)

    if (!latestRow) throw new Error('Unable to parse rig count')

    const cells = extractTableCells(latestRow[1])
    const total = parseNumber(cells[1])
    const change = parseNumber(cells[2])
    const priorDateText = normalizeDateText(cells[3])

    return {
      url: RIG_COUNT_URL,
      source: 'Baker Hughes Rig Count Overview & Summary Count',
      latest: {
        region: 'U.S.',
        date: normalizeDateText(cells[0]) || inferCurrentDate(html) || null,
        priorDate: priorDateText,
        total,
        change,
        oil: null,
        gas: null,
      },
      raw: null,
    }
  } catch (error) {
    console.warn('Rig count fetch failed', error.message)
    return { url: RIG_COUNT_URL, source: null, latest: null, raw: null }
  }
}

function extractTableCells(rowHtml) {
  const cells = []
  const cellPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
  let match

  while ((match = cellPattern.exec(rowHtml)) !== null) {
    cells.push(cleanText(match[1]))
  }

  return cells
}

function cleanText(value) {
  if (!value) return ''
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDateText(value) {
  if (!value) return null
  return String(value).replace(/\s+/g, ' ').trim()
}

function inferCurrentDate(html) {
  const match = html.match(/Last Count\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{4})/i)
  return match ? match[1] : null
}