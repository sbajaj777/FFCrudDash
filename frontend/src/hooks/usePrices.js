import { useState, useEffect, useRef, useMemo } from 'react'

const BACKEND = 'http://localhost:4000'

export function useMarketData() {
  const [prices, setPrices] = useState({})
  const [news, setNews] = useState([])
  const [historical, setHistorical] = useState({})
  const [eia, setEia] = useState(null)
  const [cftc, setCftc] = useState(null)
  const [rigCount, setRigCount] = useState(null)
  const [connected, setConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const esRef = useRef(null)

  // Fetch initial data + historical
  useEffect(() => {
    const init = async () => {
      try {
        const [priceRes, newsRes, histRes, eiaRes, cftcRes, rigRes] = await Promise.allSettled([
          fetch(`${BACKEND}/api/prices`).then(r => r.json()),
          fetch(`${BACKEND}/api/news`).then(r => r.json()),
          fetch(`${BACKEND}/api/historical`).then(r => r.json()),
          fetch(`${BACKEND}/api/eia`).then(r => r.json()),
          fetch(`${BACKEND}/api/cftc`).then(r => r.json()),
          fetch(`${BACKEND}/api/rig-count`).then(r => r.json()),
        ])
        if (priceRes.status === 'fulfilled' && priceRes.value.prices) setPrices(priceRes.value.prices)
        if (newsRes.status === 'fulfilled' && newsRes.value.news) setNews(newsRes.value.news)
        if (histRes.status === 'fulfilled' && histRes.value.historical) setHistorical(histRes.value.historical)
        if (eiaRes.status === 'fulfilled') setEia(eiaRes.value.eia)
        if (cftcRes.status === 'fulfilled') setCftc(cftcRes.value.cftc)
        if (rigRes.status === 'fulfilled') setRigCount(rigRes.value.rigCount)
      } catch (e) {
        console.warn('[FFCrudeDash] Initial fetch failed:', e.message)
      }
    }
    init()

    // Refresh historical every 10 min
    const histInterval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND}/api/historical`)
        const json = await res.json()
        if (json.historical) setHistorical(json.historical)
      } catch (e) {}
    }, 10 * 60 * 1000)

    return () => clearInterval(histInterval)
  }, [])

  // SSE for real-time updates
  useEffect(() => {
    let es
    let reconnectTimeout

    const connect = () => {
      try {
        es = new EventSource(`${BACKEND}/sse`)
        esRef.current = es

        es.addEventListener('prices', e => {
          try {
            const data = JSON.parse(e.data)
            if (data?.prices) {
              setPrices(data.prices)
              setLastUpdate(data.ts)
              setConnected(true)
            }
          } catch (err) {}
        })

        es.addEventListener('news', e => {
          try {
            const data = JSON.parse(e.data)
            if (data?.news) setNews(data.news)
          } catch (err) {}
        })

        es.addEventListener('eia', e => {
          try { setEia(JSON.parse(e.data).eia) } catch (err) {}
        })

        es.addEventListener('cftc', e => {
          try { setCftc(JSON.parse(e.data).cftc) } catch (err) {}
        })

        es.addEventListener('rigCount', e => {
          try { setRigCount(JSON.parse(e.data).rigCount) } catch (err) {}
        })

        es.onerror = () => {
          setConnected(false)
          es.close()
          reconnectTimeout = setTimeout(connect, 5000)
        }

        es.onopen = () => setConnected(true)
      } catch (e) {
        setConnected(false)
        reconnectTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      if (es) es.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [])

  // Compute historical close arrays for quant functions
  const closesMap = useMemo(() => {
    const map = {}
    for (const [key, data] of Object.entries(historical)) {
      if (Array.isArray(data)) {
        map[key] = data.map(d => d.close).filter(c => c != null)
      }
    }
    return map
  }, [historical])

  const datesMap = useMemo(() => {
    const map = {}
    for (const [key, data] of Object.entries(historical)) {
      if (Array.isArray(data)) {
        map[key] = data.filter(d => d.close != null).map(d => d.date)
      }
    }
    return map
  }, [historical])

  return {
    prices,
    news,
    historical,
    closesMap,
    datesMap,
    eia,
    cftc,
    rigCount,
    connected,
    lastUpdate,
  }
}

export function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const utc = now.toISOString().slice(11, 19) + ' UTC'
      setTime(utc)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}
