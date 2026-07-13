const CFTC_API_BASE = 'https://publicreporting.cftc.gov/resource/72hh-3qpy.json'

const CFTC_TARGET_MARKETS = [
  { key: 'WTI', label: 'WTI Crude Oil', query: "upper(market_and_exchange_names) = 'CRUDE OIL, LIGHT SWEET-WTI - ICE FUTURES EUROPE'", color: 'rgba(244, 175, 72, 1)' },
  { key: 'BRENT', label: 'Brent Crude Oil', query: "upper(market_and_exchange_names) = 'BRENT LAST DAY - NEW YORK MERCANTILE EXCHANGE' OR upper(market_and_exchange_names) = 'BRENT CRUDE OIL LAST DAY - NEW YORK MERCANTILE EXCHANGE'", color: 'rgba(91, 190, 255, 1)' },
  { key: 'RBOB', label: 'RBOB Gasoline', query: "upper(market_and_exchange_names) = 'GASOLINE RBOB - NEW YORK MERCANTILE EXCHANGE' OR upper(market_and_exchange_names) = 'GASOLINE BLENDSTOCK (RBOB)  - NEW YORK MERCANTILE EXCHANGE'", color: 'rgba(255, 126, 103, 1)' },
  { key: 'HO', label: 'Heating Oil', query: "upper(market_and_exchange_names) = 'NY HARBOR ULSD - NEW YORK MERCANTILE EXCHANGE' OR upper(market_and_exchange_names) = '#2 HEATING OIL- NY HARBOR-ULSD - NEW YORK MERCANTILE EXCHANGE'", color: 'rgba(160, 118, 255, 1)' },
  { key: 'NATGAS', label: 'Natural Gas', query: "upper(market_and_exchange_names) = 'NAT GAS NYME - NEW YORK MERCANTILE EXCHANGE' OR upper(market_and_exchange_names) = 'NATURAL GAS - NEW YORK MERCANTILE EXCHANGE'", color: 'rgba(74, 192, 120, 1)' },
]

export async function fetchLatestCFTCRaw() {
  try {
    const results = {}

    for (const target of CFTC_TARGET_MARKETS) {
      const rows = await fetchCftcRows(target.query, 26)
      if (rows.length) {
        results[target.key] = rows
      }
    }

    return { url: CFTC_API_BASE, raw: JSON.stringify(results) }
  } catch (error) {
    console.warn('CFTC fetch failed', error.message)
    return { url: null, raw: null }
  }
}

export function parseCFTCRaw(raw) {
  if (!raw) return null

  let payload = null
  try {
    payload = JSON.parse(raw)
  } catch (error) {
    return null
  }

  const markets = []
  const rows = []
  let reportDate = null

  for (const target of CFTC_TARGET_MARKETS) {
    const sourceRows = Array.isArray(payload[target.key]) ? payload[target.key] : []
    if (!sourceRows.length) continue

    const normalized = sourceRows
      .map((row) => normalizeCftcRow(row))
      .filter(Boolean)
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate))

    if (!normalized.length) continue

    rows.push(...normalized)

    const latest = normalized[normalized.length - 1]
    reportDate = reportDate || latest.reportDate

    markets.push({
      key: target.key,
      label: target.label,
      color: target.color,
      found: true,
      latest,
      series: normalized.map((entry) => ({
        date: entry.reportDate,
        openInterest: entry.openInterest,
        managedMoneyNet: entry.managedMoneyNet,
        swapNet: entry.swapNet,
        producerNet: entry.producerNet,
        otherReportablesNet: entry.otherReportablesNet,
      })),
    })
  }

  return {
    parsed: {
      reportDate,
      markets,
      rows,
    },
  }
}

async function fetchCftcRows(whereClause, limit) {
  const params = new URLSearchParams()
  params.set('$select', [
    'market_and_exchange_names',
    'report_date_as_yyyy_mm_dd',
    'open_interest_all',
    'prod_merc_positions_long',
    'prod_merc_positions_short',
    'swap_positions_long_all',
    'swap__positions_short_all',
    'm_money_positions_long_all',
    'm_money_positions_short_all',
    'other_rept_positions_long',
    'other_rept_positions_short',
    'tot_rept_positions_long_all',
    'tot_rept_positions_short',
    'nonrept_positions_long_all',
    'nonrept_positions_short_all',
    'contract_units',
    'cftc_contract_market_code',
    'cftc_market_code',
    'commodity_name',
    'commodity_group_name',
    'futonly_or_combined',
  ].join(','))
  params.set('$where', `${whereClause} AND upper(futonly_or_combined) = 'FUTONLY'`)
  params.set('$order', 'report_date_as_yyyy_mm_dd DESC')
  params.set('$limit', String(limit))

  const url = `${CFTC_API_BASE}?${params.toString()}`
  const res = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = await res.json()
  return Array.isArray(rows) ? rows : []
}

function normalizeCftcRow(row) {
  const marketName = row.market_and_exchange_names || null
  const reportDate = formatReportDate(row.report_date_as_yyyy_mm_dd)
  if (!marketName || !reportDate) return null

  const openInterest = parseNumber(row.open_interest_all)
  const producerLong = parseNumber(row.prod_merc_positions_long)
  const producerShort = parseNumber(row.prod_merc_positions_short)
  const swapLong = parseNumber(row.swap_positions_long_all)
  const swapShort = parseNumber(row.swap__positions_short_all)
  const managedMoneyLong = parseNumber(row.m_money_positions_long_all)
  const managedMoneyShort = parseNumber(row.m_money_positions_short_all)
  const otherReportablesLong = parseNumber(row.other_rept_positions_long)
  const otherReportablesShort = parseNumber(row.other_rept_positions_short)
  const reportableLong = parseNumber(row.tot_rept_positions_long_all)
  const reportableShort = parseNumber(row.tot_rept_positions_short)
  const nonReportableLong = parseNumber(row.nonrept_positions_long_all)
  const nonReportableShort = parseNumber(row.nonrept_positions_short_all)

  return {
    marketName,
    reportDate,
    contractCode: row.cftc_contract_market_code || null,
    exchangeCode: row.cftc_market_code || null,
    commodityName: row.commodity_name || null,
    commodityGroup: row.commodity_group_name || null,
    contractUnits: row.contract_units || null,
    openInterest,
    producerNet: net(producerLong, producerShort),
    swapNet: net(swapLong, swapShort),
    managedMoneyNet: net(managedMoneyLong, managedMoneyShort),
    otherReportablesNet: net(otherReportablesLong, otherReportablesShort),
    reportableNet: net(reportableLong, reportableShort),
    nonReportableNet: net(nonReportableLong, nonReportableShort),
    values: {
      openInterest,
      producerLong,
      producerShort,
      swapLong,
      swapShort,
      managedMoneyLong,
      managedMoneyShort,
      otherReportablesLong,
      otherReportablesShort,
      reportableLong,
      reportableShort,
      nonReportableLong,
      nonReportableShort,
    },
  }
}

function parseNumber(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(String(value).replace(/,/g, '').trim())
  return Number.isFinite(parsed) ? parsed : null
}

function net(longValue, shortValue) {
  if (!Number.isFinite(longValue) || !Number.isFinite(shortValue)) return null
  return longValue - shortValue
}

function formatReportDate(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}
