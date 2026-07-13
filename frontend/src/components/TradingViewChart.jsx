import React, { useEffect, useRef, memo } from 'react'

// Map our internal product keys → TradingView symbols
const TV_SYMBOLS = {
  WTI:   'TVC:USOIL',
  BRENT: 'TVC:UKOIL',
  RBOB:  'NYMEX:RB1!',
  HEAT:  'NYMEX:HO1!',
  GASOL: 'ICEUS:GAS1!',
}

function TradingViewChart({ symbol = 'WTI', height = 480 }) {
  const containerRef = useRef(null)
  const widgetRef    = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    // Remove previous widget
    if (widgetRef.current) {
      widgetRef.current.innerHTML = ''
    }

    const tvSymbol = TV_SYMBOLS[symbol] || 'TVC:USOIL'

    // Create wrapper div for the widget
    const wrapper = document.createElement('div')
    wrapper.className = 'tradingview-widget-container'
    wrapper.style.cssText = 'width:100%;height:100%;'

    const inner = document.createElement('div')
    inner.className = 'tradingview-widget-container__widget'
    inner.style.cssText = 'width:100%;height:100%;'
    wrapper.appendChild(inner)

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.async = true
    script.type = 'text/javascript'
    script.innerHTML = JSON.stringify({
      autosize:            true,
      symbol:              tvSymbol,
      interval:            'D',
      timezone:            'Etc/UTC',
      theme:               'dark',
      colorTheme:          'dark',
      style:               '1',
      locale:              'en',
      backgroundColor:     '#0a0e17',
      gridColor:           'rgba(255,255,255,0.03)',
      hide_top_toolbar:    false,
      hide_legend:         false,
      hide_side_toolbar:   false,
      allow_symbol_change: false,
      withdateranges:      true,
      range:               '12M',
      save_image:          false,
      support_host:        'https://www.tradingview.com',
      overrides: {
        'paneProperties.background':               '#0a0e17',
        'paneProperties.backgroundType':           'solid',
        'paneProperties.vertGridProperties.color': 'rgba(255,255,255,0.03)',
        'paneProperties.horzGridProperties.color': 'rgba(255,255,255,0.03)',
        'mainSeriesProperties.candleStyle.upColor':         '#00c48f',
        'mainSeriesProperties.candleStyle.downColor':       '#ff4757',
        'mainSeriesProperties.candleStyle.borderUpColor':   '#00c48f',
        'mainSeriesProperties.candleStyle.borderDownColor': '#ff4757',
        'mainSeriesProperties.candleStyle.wickUpColor':     '#00c48f',
        'mainSeriesProperties.candleStyle.wickDownColor':   '#ff4757',
      },
    })

    wrapper.appendChild(script)
    containerRef.current.appendChild(wrapper)
    widgetRef.current = containerRef.current

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [symbol])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
    />
  )
}

export default memo(TradingViewChart)
