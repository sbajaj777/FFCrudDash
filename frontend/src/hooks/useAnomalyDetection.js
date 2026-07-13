import { useEffect, useRef } from 'react'

export function useAnomalyDetection(prices, news, addAlert) {
  const prevPrices = useRef({})
  const prevNewsIds = useRef(new Set())
  const isFirstRenderNews = useRef(true)

  // Price Anomaly Detection (1.5% instantaneous jump)
  useEffect(() => {
    if (!prices || Object.keys(prices).length === 0) return

    Object.entries(prices).forEach(([symbol, data]) => {
      const currentPrice = data.price
      const prevPrice = prevPrices.current[symbol]

      if (prevPrice && currentPrice) {
        const jump = (currentPrice - prevPrice) / prevPrice
        
        if (Math.abs(jump) > 0.015) {
          const type = jump > 0 ? 'surge' : 'crash'
          addAlert({
            id: `price-${symbol}-${Date.now()}`,
            type,
            title: `Flash ${jump > 0 ? 'Surge' : 'Crash'} Detected!`,
            message: `${symbol} just moved ${(jump * 100).toFixed(2)}% instantly to $${currentPrice.toFixed(2)}.`,
          })
        }
      }
      prevPrices.current[symbol] = currentPrice
    })
  }, [prices, addAlert])

  // News Anomaly Detection
  useEffect(() => {
    if (!news || news.length === 0) return

    if (isFirstRenderNews.current) {
      news.forEach(item => prevNewsIds.current.add(item.id || item.url))
      isFirstRenderNews.current = false
      return
    }

    news.forEach(item => {
      const id = item.id || item.url
      if (!prevNewsIds.current.has(id)) {
        prevNewsIds.current.add(id)
        
        const titleLower = item.title.toLowerCase()
        const isBreaking = titleLower.includes('breaking') || 
                           titleLower.includes('urgent') || 
                           titleLower.includes('emergency') || 
                           titleLower.includes('attack') ||
                           titleLower.includes('opec')

        const sentimentScore = item.sentimentScore || 0
        const isExtremeSentiment = Math.abs(sentimentScore) > 0.80

        if (isBreaking || isExtremeSentiment) {
          addAlert({
            id: `news-${id}-${Date.now()}`,
            type: 'news',
            title: '⚠️ Breaking News Alert',
            message: item.title,
            link: item.url
          })
        }
      }
    })
  }, [news, addAlert])
}
