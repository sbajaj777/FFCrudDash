import React, { useEffect, useRef } from 'react'

// TradingView Ticker Tape — real-time prices for 5 energy products
// Symbols: NYMEX:CL1! (WTI), NYMEX:BB1! (Brent), NYMEX:RB1! (RBOB),
//          NYMEX:HO1! (Heating Oil), NYMEX:NG1! (Natural Gas)

export default function TVTicker() {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    // Clear any previous widget
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js'
    script.async = true
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: 'OANDA:WTIUSD',    title: 'WTI Crude' },
        { proName: 'OANDA:BCOUSD',    title: 'Brent Crude' },
        { proName: 'OANDA:NATGASUSD', title: 'Natural Gas' },
        { proName: 'OANDA:XAUUSD',    title: 'Gold' },
        { proName: 'FX:EURUSD',       title: 'EUR/USD' },
        { proName: 'FX:USDJPY',       title: 'USD/JPY' },
      ],
      showSymbolLogo: false,
      isTransparent: true,
      displayMode: 'adaptive',
      colorTheme: 'dark',
      locale: 'en',
    })

    containerRef.current.appendChild(script)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: 46,
        overflow: 'hidden',
        borderRadius: 8,
        marginBottom: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid var(--border)',
      }}
    />
  )
}
