import { useState, useEffect } from 'react';

const ENGINE_API_URL = 'http://localhost:5000/api/v2';
const cache = {}; // Global in-memory cache

export function usePhase2Data(endpoint, interval = null) {
  const [data, setData] = useState(cache[endpoint] || null);
  const [loading, setLoading] = useState(!cache[endpoint]);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let timer = null;

    const fetchData = async () => {
      try {
        if (!cache[endpoint]) {
          setLoading(true);
        }
        const response = await fetch(`${ENGINE_API_URL}${endpoint}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        
        cache[endpoint] = result;
        
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (isMounted) {
          setError(e.message);
          console.error(`Error fetching Phase 2 data from ${endpoint}:`, e);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    if (interval) {
      timer = setInterval(fetchData, interval);
    }

    return () => {
      isMounted = false;
      if (timer) clearInterval(timer);
    };
  }, [endpoint, interval]);

  return { data, loading, error };
}

// Specific hooks for convenience
export function useEngineStatus() {
  return usePhase2Data('/status', 10000); // Poll every 10s
}

export function useDataSummary() {
  return usePhase2Data('/data/summary');
}

export function useRankedSignals() {
  return usePhase2Data('/signals/ranked', 30000); // Poll every 30s
}

export function useRegimeHistory(product) {
  return usePhase2Data(`/regime/history/${product}`);
}

export function useCurrentRegime(product) {
  return usePhase2Data(`/regime/current/${product}`, 30000); // Poll every 30s
}

export function useRegressionResults(product, structure, regime = 'ALL') {
  return usePhase2Data(`/regression/${product}/${structure}?regime=${regime}`);
}

export function useRegimeDrivers(product) {
  return usePhase2Data(`/regime/drivers/${product}`);
}

export function useRollingRegression(product, structure) {
  return usePhase2Data(`/regression/rolling/${product}/${structure}`);
}

export function useProductDailyData(product, limit = 252) {
  return usePhase2Data(`/data/daily/${product}?limit=${limit}`);
}
