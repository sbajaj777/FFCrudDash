// ─── data/constants.js ───
// All static/seeded data. In production, replace these with API calls:
//   News     → GNews API, Mediastack, or Bloomberg Terminal API
//   EIA data → https://api.eia.gov/v2/ (free key at eia.gov/opendata)
//   CFTC     → https://publicreporting.cftc.gov/
//   Rig Count→ Baker Hughes website (scraped weekly)

export const NEWS_FEED = [
  {
    id: 1, time: 'LIVE 09:47',
    title: 'API survey shows crude draw of -2.8M bbl ahead of Wednesday EIA — bullish pre-release signal',
    tags: [{ label: 'EIA', color: 'badge-green' }, { label: 'BULLISH', color: 'badge-green' }],
    impact: 'high',
  },
  {
    id: 2, time: 'LIVE 09:31',
    title: 'WTI breaks above $78 resistance on lower volume — momentum flagged by signal engine',
    tags: [{ label: 'WTI', color: 'badge-blue' }, { label: 'MOMENTUM', color: 'badge-amber' }],
    impact: 'high',
  },
  {
    id: 3, time: '09:12',
    title: 'OPEC+ sources: Saudi Arabia pushing allies to maintain current production targets at June meeting',
    tags: [{ label: 'OPEC+', color: 'badge-amber' }, { label: 'SUPPLY', color: 'badge-blue' }],
    impact: 'high',
  },
  {
    id: 4, time: '08:55',
    title: 'China crude imports soften for third consecutive month — Asian demand risk remains bearish overhang',
    tags: [{ label: 'CHINA', color: 'badge-red' }, { label: 'BEARISH', color: 'badge-red' }],
    impact: 'medium',
  },
  {
    id: 5, time: '08:30',
    title: 'DXY falls below 104.5 support — dollar weakness provides mechanical tailwind for crude prices',
    tags: [{ label: 'DXY', color: 'badge-green' }, { label: 'MACRO', color: 'badge-blue' }],
    impact: 'medium',
  },
  {
    id: 6, time: '07:55',
    title: 'Baker Hughes: US rig count drops 3 rigs to 488 — lagged production headwind developing over 6-9 months',
    tags: [{ label: 'RIGS', color: 'badge-amber' }, { label: 'SUPPLY', color: 'badge-blue' }],
    impact: 'medium',
  },
  {
    id: 7, time: '07:20',
    title: 'CFTC COT Friday: managed money net long at 312,450 contracts — 87th percentile, crowded flag active',
    tags: [{ label: 'CFTC', color: 'badge-red' }, { label: 'POSITIONING', color: 'badge-amber' }],
    impact: 'high',
  },
  {
    id: 8, time: '06:45',
    title: 'Brent premium to WTI widens to $3.73 — CL-BRN spread at 3-month extreme, reversion trade on watch',
    tags: [{ label: 'SPREAD', color: 'badge-purple' }, { label: 'BRENT', color: 'badge-blue' }],
    impact: 'medium',
  },
  {
    id: 9, time: '06:10',
    title: 'SPR release authorization bill advancing in US Senate — bearish inventory impact if passed',
    tags: [{ label: 'SPR', color: 'badge-red' }, { label: 'POLICY', color: 'badge-amber' }],
    impact: 'high',
  },
  {
    id: 10, time: 'YEST 22:30',
    title: 'Red Sea shipping disruptions ease as Houthi ceasefire discussions reported — VLCC rates soften',
    tags: [{ label: 'LOGISTICS', color: 'badge-green' }, { label: 'FREIGHT', color: 'badge-blue' }],
    impact: 'medium',
  },
]

export const GEO_RISKS = [
  { region: 'Middle East',     score: 78, color: 'var(--red)'   },
  { region: 'Iran (Sanctions)',score: 82, color: 'var(--red)'   },
  { region: 'Russia / CIS',   score: 71, color: 'var(--red)'   },
  { region: 'Venezuela',      score: 62, color: 'var(--amber)'  },
  { region: 'Libya',          score: 55, color: 'var(--amber)'  },
  { region: 'West Africa',    score: 45, color: 'var(--amber)'  },
  { region: 'US Gulf Coast',  score: 22, color: 'var(--green)'  },
  { region: 'Canada / WCSB',  score: 18, color: 'var(--green)'  },
]

export const GEO_NEWS = [
  {
    id: 1, time: 'TODAY 07:42 UTC',
    title: 'OPEC+ sources suggest consensus forming around output hold at June ministerial meeting',
    tags: [{ label: 'OPEC+', color: 'badge-amber' }, { label: 'SUPPLY', color: 'badge-blue' }],
  },
  {
    id: 2, time: 'TODAY 06:15 UTC',
    title: 'Iran crude exports hold near 1.8mb/d despite renewed sanctions enforcement signals from Washington',
    tags: [{ label: 'IRAN', color: 'badge-red' }, { label: 'SANCTIONS', color: 'badge-red' }],
  },
  {
    id: 3, time: 'YEST 22:30 UTC',
    title: 'Red Sea shipping disruptions ease as Houthi ceasefire talks reported — VLCC rates soften',
    tags: [{ label: 'LOGISTICS', color: 'badge-green' }, { label: 'FREIGHT', color: 'badge-blue' }],
  },
  {
    id: 4, time: 'YEST 18:00 UTC',
    title: 'Russia Urals blend trading at $10.50 discount to Brent — India continuing to absorb flows',
    tags: [{ label: 'RUSSIA', color: 'badge-amber' }, { label: 'SPREADS', color: 'badge-blue' }],
  },
  {
    id: 5, time: 'YEST 14:20 UTC',
    title: 'SPR release authorization bill advancing in US Senate — bearish inventory impact if passed',
    tags: [{ label: 'SPR', color: 'badge-red' }, { label: 'BEARISH', color: 'badge-red' }],
  },
]

export const EVENT_CALENDAR = [
  { date: 'WED 10:30 ET', name: 'EIA Petroleum Status Report',  impact: 'high',   note: 'Consensus: -1.4M bbl crude' },
  { date: 'THU 08:30 ET', name: 'US Weekly Jobless Claims',     impact: 'medium',  note: 'DXY driver' },
  { date: 'FRI 10:00 ET', name: 'Baker Hughes Rig Count',       impact: 'medium',  note: 'Weekly, 15:00 UTC' },
  { date: 'FRI 15:30 ET', name: 'CFTC COT Report',             impact: 'medium',  note: 'Managed money positioning' },
  { date: 'MON',          name: 'OPEC+ Output Policy Review',   impact: 'high',   note: 'Scenario: Hold 55% prob' },
  { date: 'TUE ~21:30',   name: 'API Inventory Survey (private)',impact: 'medium', note: 'Pre-EIA signal' },
  { date: 'NEXT WK',      name: 'FOMC Rate Decision',           impact: 'high',   note: 'Primary DXY catalyst' },
  { date: 'NEXT WK',      name: 'US Non-Farm Payrolls',         impact: 'high',   note: 'USD / macro regime shift' },
]

export const MACRO_CALENDAR = [
  { date: 'TODAY',    name: 'Fed Minutes Release',       impact: 'high'   },
  { date: 'THU',      name: 'US PPI Data',               impact: 'medium' },
  { date: 'FRI',      name: 'NFP + Unemployment Rate',   impact: 'high'   },
  { date: 'NEXT WK',  name: 'FOMC Interest Rate Decision',impact: 'high'  },
  { date: 'NEXT WK',  name: 'US CPI Inflation Print',    impact: 'high'   },
]

export const OPEC_SCENARIOS = [
  { label: 'CUT 500k BPD',   range: '+$4.20–$6.50/bbl', prob: 28, color: 'var(--green)'  },
  { label: 'HOLD OUTPUT',    range: '±$1.50/bbl',        prob: 55, color: 'var(--amber)'  },
  { label: 'INCREASE 250k',  range: '-$3.00–$4.50/bbl',  prob: 17, color: 'var(--red)'    },
]

export const EIA_DATA = {
  crude:    { value: -3.2, consensus: -1.4, label: 'Crude',      unit: 'M bbl' },
  gasoline: { value:  1.1, consensus:  0.5, label: 'Gasoline',   unit: 'M bbl' },
  distillate:{ value:-0.8, consensus: -0.3, label: 'Distillate', unit: 'M bbl' },
  cushing:  { value: -0.4, consensus: -0.2, label: 'Cushing Hub',unit: 'M bbl' },
}

export const LOGISTICS = [
  { label: 'VLCC Freight Rate', unit: '$/MT', value: 14.2, max: 40,  color: 'var(--amber)' },
  { label: 'Cushing Storage Fill', unit: '%', value: 62,   max: 100, color: 'var(--green)' },
  { label: 'Pipeline Utilisation', unit: '%', value: 78,   max: 100, color: 'var(--amber)' },
  { label: 'Terminal Fill Rate',   unit: '%', value: 71,   max: 100, color: 'var(--amber)' },
]

// Seasonality: WTI monthly averages (historical data — use EIA API for live)
export const SEASONALITY = {
  months: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  current: [76.2, 77.4, 79.1, 81.2, 78.4, null, null, null, null, null, null, null],
  avg5yr:  [73.1, 74.8, 76.2, 78.9, 79.4, 80.1, 78.2, 76.5, 74.8, 73.2, 74.1, 75.8],
  avg3yr:  [74.2, 75.9, 77.8, 80.1, 80.8, 81.4, 79.1, 77.4, 75.5, 74.1, 75.2, 76.9],
}

export const PERFORMANCE = {
  mtdPL: '+4.2R',
  winRate: 62,
  avgRR: 2.1,
  trades: 13,
  bySource: {
    labels: ['EIA', 'CFTC', 'FP Engine', 'Pattern', 'Geo'],
    data:   [ 2.1,  -0.4,    1.6,         0.8,       0.1 ],
  }
}
