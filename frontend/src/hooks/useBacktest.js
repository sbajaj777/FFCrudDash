import { useState, useEffect } from 'react';

const ENGINE_API_URL = 'http://localhost:5000/api/v2';

export function useBacktest(product, structure, params = {}, enabled = true) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const {
    roll_window    = 60,
    entry_z        = 2.0,
    exit_z         = 0.3,
    stop_cushion   = 0.5,
    max_hold       = 30,
    regime_filter  = 'backwardation',
  } = params;

  useEffect(() => {
    if (!product || !structure || !enabled) return;
    let isMounted = true;
    setLoading(true);
    setData(null);
    setError(null);

    const query = new URLSearchParams({
      roll_window, entry_z, exit_z, stop_cushion, max_hold, regime_filter,
    }).toString();

    fetch(`${ENGINE_API_URL}/backtest/${product}/${structure}?${query}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(result => {
        if (isMounted) { setData(result); setLoading(false); }
      })
      .catch(e => {
        if (isMounted) { setError(e.message); setLoading(false); }
      });

    return () => { isMounted = false; };
  }, [product, structure, roll_window, entry_z, exit_z, stop_cushion, max_hold, regime_filter, enabled]);

  return { data, loading, error };
}
