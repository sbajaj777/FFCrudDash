import React, { useEffect, useRef } from 'react'

const ENERGY_KEYWORDS = [
  'oil','crude','brent','wti','opec','petroleum','gasoline','diesel','fuel',
  'refin','rbob','heating oil','gas oil','gasoil','kerosene','jet fuel',
  'natural gas','lng','lpg','eia','inventory','stockpile','barrel',
  'pipeline','tanker','hormuz','suez','oil facility','oil refinery',
  'oil field','oil terminal','oil shipment','oil export','oil import',
  'saudi','aramco','iran','russia oil','ukraine oil','energy market',
  'commodity','commodities','cftc','iea','rig count','baker hughes',
  'opec+','production cut','energy crisis','energy prices','energy supply',
  'offshore','onshore','upstream','downstream','midstream','petrochemi',
  'distillate','crack spread','contango','backwardation','prompt',
]

function isEnergyRelevant(text) {
  const lower = (text || '').toLowerCase()
  return ENERGY_KEYWORDS.some(kw => lower.includes(kw))
}

// ── Brute-force DOM filter ────────────────────────────────────────────────
// FJ widget renders directly in the DOM (not sandboxed iframe).
// We walk ALL descendants, find elements that look like news rows,
// and hide ones that aren't energy-relevant.
function filterFJWidget(container) {
  if (!container) return

  // Collect direct children of the innermost news list wrapper
  // Strategy: find all elements whose innerText is 30–500 chars (headline length)
  // and whose parent has many siblings (i.e., it's inside a list)
  const all = container.querySelectorAll('*')
  const candidates = new Set()

  for (const el of all) {
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue
    const text = (el.innerText || el.textContent || '').trim()
    // Headline-length text, not too nested, not a wrapper
    if (text.length >= 25 && text.length <= 400 && el.children.length <= 4) {
      // Check it's not a button/input
      if (['BUTTON','INPUT','SELECT','TEXTAREA','A'].includes(el.tagName)) continue
      // Skip FJ branding text
      if (text.toLowerCase().includes('financialjuice') || text.toLowerCase().includes('powered by')) continue
      candidates.add(el)
    }
  }

  for (const el of candidates) {
    const text = (el.innerText || el.textContent || '').trim()
    if (!isEnergyRelevant(text)) {
      // Walk up to find the "row" — the highest ancestor that is a sibling of many similar elements
      let row = el
      while (row.parentElement && row.parentElement !== container) {
        // If parent has many children like this, the row is row itself
        if (row.parentElement.children.length >= 3) break
        row = row.parentElement
      }
      row.style.setProperty('display', 'none', 'important')
    }
  }
}

export default function FinancialJuiceWidget({ height = 700 }) {
  const containerRef = useRef(null)
  const filterTimerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    const scriptId = 'FJ-Widgets-Script'

    const startFiltering = () => {
      // Run filter every 1.5 seconds to catch new incoming items
      filterTimerRef.current = setInterval(() => {
        filterFJWidget(document.getElementById('fj-news-container'))
      }, 1500)
    }

    const initWidget = () => {
      if (window.FJWidgets && containerRef.current) {
        containerRef.current.innerHTML = ''
        new window.FJWidgets.createWidget({
          container: 'fj-news-container',
          widgetType: 'NEWS',
          width: '100%',
          height: `${height}px`,
          mode: 'dark',
          theme: 'dark',
          backColor: '#0a0e17',
        })
        // Wait for widget to paint before starting filter
        setTimeout(startFiltering, 4000)
      }
    }

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.id = scriptId
      script.src = `https://feed.financialjuice.com/widgets/widgets.js?r=${Math.floor(Math.random() * 9999)}`
      script.onload = initWidget
      document.body.appendChild(script)
    } else {
      setTimeout(initWidget, 500)
    }

    return () => {
      if (filterTimerRef.current) clearInterval(filterTimerRef.current)
    }
  }, [height])

  return (
    <div
      id="fj-news-container"
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, borderRadius: 8, overflow: 'hidden' }}
    />
  )
}
