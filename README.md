# Energy Trading Dashboard — Internship Project

This workspace contains a Vite + React frontend and a minimal Express backend scaffold. The frontend currently uses a simulated live feed (in `usePrices`) and sample news. The backend exposes simple placeholder endpoints for `/api/prices` and `/api/news`.

Quick start:

1. Frontend

```bash
cd "f:\dashboard 2\frontend"
npm install
npm run dev
```

2. Backend (optional)

```bash
cd "f:\dashboard 2\backend"
npm install
npm start
```

Next steps I will implement on request:
- Wire backend to real free APIs (NewsAPI, EIA, AlphaVantage) using env keys.
- Add websocket or SSE live push and proxy endpoints.
- Add alerts, signal generation, and more visual polish.

Current real-time behaviour
- The backend polls available free APIs when keys are provided and broadcasts updates to connected frontends via Server-Sent Events (SSE) at `http://localhost:4000/sse`.
- The frontend attempts to connect to the SSE stream; if unavailable it falls back to simulated ticks.

Environment variables
- Copy `.env.example` to `.env` in the `backend/` folder and set any API keys you have:

```
NEWSAPI_KEY=your_newsapi_key
EIA_API_KEY=your_eia_key
ALPHAVANTAGE_KEY=your_alphavantage_key

EIA series configuration
- To fetch specific EIA series, set `EIA_SERIES` in `backend/.env` to a comma-separated list of series IDs. Example:

```
EIA_API_KEY=YOURKEY
EIA_SERIES=PET.WCESTUS1.W,PET.RWTC.D
```

The backend will poll those series and broadcast `eia` events on the SSE stream.
```

SSE usage (browser)
Connect to: `http://localhost:4000/sse` and listen for `prices` and `news` events. The frontend `usePrices` hook already handles this.

