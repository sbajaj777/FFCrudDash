import { useState, useEffect } from 'react';

const ENGINE_API_URL = 'http://localhost:5000/api/v2';

export function usePaperTrader() {
  const [signals, setSignals] = useState([]);
  const [positions, setPositions] = useState({ open_count: 0, total_unrealized_pnl: 0, positions: [] });
  const [trades, setTrades] = useState({ trade_count: 0, total_realized_pnl: 0, trades: [] });
  const [loading, setLoading] = useState(true);

  const fetchPaperData = async () => {
    try {
      const [sigRes, posRes, trdRes] = await Promise.all([
        fetch(`${ENGINE_API_URL}/paper/signals`),
        fetch(`${ENGINE_API_URL}/paper/positions`),
        fetch(`${ENGINE_API_URL}/paper/trades`)
      ]);
      
      if (sigRes.ok) setSignals(await sigRes.json());
      if (posRes.ok) setPositions(await posRes.json());
      if (trdRes.ok) setTrades(await trdRes.json());
      
      setLoading(false);
    } catch (e) {
      console.error("Error fetching paper trader data:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaperData();
    const interval = setInterval(fetchPaperData, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const forceTick = async () => {
    try {
      await fetch(`${ENGINE_API_URL}/paper/force_tick`, { method: 'POST' });
      await fetchPaperData();
    } catch (e) {
      console.error("Error forcing tick:", e);
    }
  };

  const resetTrades = async () => {
    try {
      await fetch(`${ENGINE_API_URL}/paper/reset`, { method: 'POST' });
      await fetchPaperData();
    } catch (e) {
      console.error("Error resetting trades:", e);
    }
  };

  return { signals, positions, trades, loading, forceTick, resetTrades };
}
