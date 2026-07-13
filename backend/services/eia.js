import fetch from 'node-fetch'

export async function fetchEiaSeries(apiKey, seriesList = []) {
  if (!apiKey || !seriesList || !seriesList.length) return null
  const out = {}
  for (const s of seriesList) {
    try {
      // Use EIA API v2 seriesid endpoint (v1 retired)
      const url = `https://api.eia.gov/v2/seriesid/${encodeURIComponent(s)}?api_key=${apiKey}`
      const res = await fetch(url)
      const j = await res.json()

      // Support multiple possible response shapes (v2 vs legacy v1)
      let dataArr = null
      let name = s
      if (j) {
        if (Array.isArray(j.data) && j.data.length) {
          dataArr = j.data
          name = j.description || name
        } else if (j.response && Array.isArray(j.response.data) && j.response.data.length) {
          dataArr = j.response.data
          name = j.response.description || name
        } else if (j.series && Array.isArray(j.series) && j.series[0] && Array.isArray(j.series[0].data)) {
          // legacy shape
          dataArr = j.series[0].data.map(d => ({ period: d[0], value: d[1] }))
          name = j.series[0].name || name
        }
      }

      if (dataArr && dataArr.length) {
        // normalize to [{date, value}, ...]
        const series = dataArr.map(item => {
          if (Array.isArray(item) && item.length >= 2) return { date: item[0], value: item[1] }
          const date = item.period || item.period || item.date || item.period || item.period
          const value = item.value ?? (Array.isArray(item) && item[1])
          return { date, value }
        })
        out[s] = { name, series }
      }
    } catch (e) {
      console.warn('EIA fetch failed for', s, e.message)
    }
  }
  return Object.keys(out).length ? out : null
}
