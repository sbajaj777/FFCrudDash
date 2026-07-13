// ─── hooks/usePrices.js ───
// Manages live price state. Tick interval: 3 seconds.
// To connect real API: replace `tickPrices` with an async fetch inside useEffect.

import { useState, useEffect, useCallback } from 'react'
import { INITIAL_PRICES, tickPrices, computeFairPrice, generateHistory } from '../utils/priceEngine.js'

export function usePrices(tickInterval = 3000) {
  const [prices,    setPrices]    = useState(INITIAL_PRICES)
  const [fairPrice, setFairPrice] = useState(null)
  const [histories, setHistories] = useState({})

  // Build initial price histories on mount
  useEffect(() => {
    const h = {}
    for (const key of ['WTI', 'BRN', 'DXY']) {
      h[key] = generateHistory(INITIAL_PRICES[key].price, 78, key === 'DXY' ? 0.3 : 0.6)
    }
    setHistories(h)
    setFairPrice(computeFairPrice(INITIAL_PRICES))
  }, [])

  // Live price tick
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => {
        const next = tickPrices(prev)
        setFairPrice(computeFairPrice(next))
        // Append latest WTI price to history (rolling window)
        setHistories(h => {
          const wtiHist = [...(h.WTI || []).slice(1), { t: new Date(), y: next.WTI.price }]
          const dxyHist = [...(h.DXY || []).slice(1), { t: new Date(), y: next.DXY.price }]
          return { ...h, WTI: wtiHist, DXY: dxyHist }
        })
        return next
      })
    }, tickInterval)
    return () => clearInterval(id)
  }, [tickInterval])

  return { prices, fairPrice, histories }
}

// ─── hooks/useClock.js (inlined for convenience) ───
export function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000)
      setTime(utc.toISOString().substr(11, 8) + ' UTC')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}
