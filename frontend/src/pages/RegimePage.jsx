import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts';
import { 
  useEngineStatus, 
  useCurrentRegime, 
  useRegimeHistory,
  useRegimeDrivers
} from '../hooks/usePhase2Data';

// Reusable stat card
const StatCard = ({ title, value, subtitle, trend, color = '#3b82f6' }) => (
  <div style={styles.statCard}>
    <h3 style={styles.statTitle}>{title}</h3>
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
      <span style={styles.statValue}>{value}</span>
      {trend && (
        <span style={{ 
          fontSize: '12px', 
          fontWeight: '500', 
          marginBottom: '4px',
          color: trend > 0 ? '#10b981' : '#f43f5e' 
        }}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    {subtitle && <p style={styles.statSubtitle}>{subtitle}</p>}
  </div>
);

// Format regime name for display
const formatRegimeName = (regime) => {
  if (!regime) return 'Unknown';
  return regime.replace(/R\d_/, '').replace(/_/g, ' ');
};

// Get color for regime
const getRegimeColor = (regime) => {
  const colors = {
    'R1_DEEP_CONTANGO': '#ff4757',
    'R2_CONTANGO': '#ff6b8a',
    'R3_FLAT': '#f5a623',
    'R4_BACKWARDATION': '#00c48f',
    'R5_EXTREME_BACKWARDATION': '#00d4ff',
  };
  return colors[regime] || '#64748b';
};

export default function RegimePage() {
  const [product, setProduct] = useState('CL');
  
  // Fetch data
  const { data: status } = useEngineStatus();
  const { data: current, loading: currentLoading } = useCurrentRegime(product);
  const { data: history, loading: historyLoading } = useRegimeHistory(product);
  const { data: drivers, loading: driversLoading } = useRegimeDrivers(product);
  
  const isReady = status?.status === 'ready';

  if (!isReady) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f1f5f9' }}>Phase 2 Engine Initializing</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px' }}>Processing historical curve data and classifying regimes...</p>
      </div>
    );
  }

  // Process history data for charts
  const historyData = history?.timeline || [];
  const distribution = [];
  
  if (history?.stats) {
    Object.keys(history.stats).forEach(regime => {
      if (regime !== 'transitions') {
        distribution.push({
          name: formatRegimeName(regime),
          rawName: regime,
          value: history.stats[regime].frequency_pct
        });
      }
    });
  }

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Regime Intelligence</h1>
          <p style={styles.pageSubtitle}>Percentile-based market structure classification</p>
        </div>
        
        <div style={styles.productSelector}>
          {['CL', 'LCO', 'HO', 'LGO'].map(p => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              style={{
                ...styles.productBtn,
                ...(product === p ? styles.productBtnActive : {})
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {currentLoading && !current?.regime ? (
        <div style={{ height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Loading current regime...
        </div>
      ) : current?.regime ? (
        <>
          <div style={styles.gridTop}>
            <div style={{ ...styles.card, ...styles.mainRegimeCard }}>
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '128px', height: '128px',
                borderRadius: '50%', filter: 'blur(40px)', opacity: 0.15, pointerEvents: 'none',
                backgroundColor: getRegimeColor(current.regime.regime)
              }}></div>
              
              <h2 style={{ color: '#94a3b8', fontWeight: 500, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}>Current Regime</h2>
              <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '8px', color: getRegimeColor(current.regime.regime) }}>
                {formatRegimeName(current.regime.regime)}
              </div>
              
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '32px', marginTop: '24px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Confidence Score: <span style={{ color: '#fff', fontWeight: 'bold' }}>{current.regime.confidence}%</span></div>
                  
                  {/* Confidence Decomposition Bar */}
                  {current.regime.confidence_decomposition && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', marginBottom: '8px' }}>
                        <div style={{ width: `${current.regime.confidence_decomposition.curve_structure}%`, backgroundColor: '#3b82f6' }} title="Curve Structure"></div>
                        <div style={{ width: `${current.regime.confidence_decomposition.inventory_consistency}%`, backgroundColor: '#10b981' }} title="Inventory Consistency"></div>
                        <div style={{ width: `${current.regime.confidence_decomposition.volatility_consistency}%`, backgroundColor: '#f59e0b' }} title="Volatility Consistency"></div>
                        <div style={{ width: `${100 - current.regime.confidence}%`, backgroundColor: '#334155' }}></div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div> Curve Structure</span>
                          <span>{current.regime.confidence_decomposition.curve_structure.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }}></div> Inventory</span>
                          <span>{current.regime.confidence_decomposition.inventory_consistency.toFixed(1)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div> Volatility</span>
                          <span>{current.regime.confidence_decomposition.volatility_consistency.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div style={{ width: '1px', height: '100%', backgroundColor: '#334155', minHeight: '80px' }}></div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '4px' }}>Primary Driver (M1-M12)</div>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
                    {current.regime.primary_driver.value?.toFixed(2)}
                  </div>
                  
                  {/* Classification Breakdown Gauge */}
                  {current.regime.classification_thresholds && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '4px' }}>
                        <span>Historical Pctl: {current.regime.primary_driver.percentile?.toFixed(0)}%</span>
                        <span>{current.regime.classification_thresholds.lower}-{current.regime.classification_thresholds.upper}% Band</span>
                      </div>
                      <div style={{ position: 'relative', height: '6px', borderRadius: '3px', backgroundColor: '#334155', overflow: 'hidden' }}>
                        {/* The active band */}
                        <div style={{ 
                          position: 'absolute', 
                          left: `${current.regime.classification_thresholds.lower}%`, 
                          width: `${current.regime.classification_thresholds.upper - current.regime.classification_thresholds.lower}%`, 
                          height: '100%', 
                          backgroundColor: 'rgba(255,255,255,0.1)' 
                        }}></div>
                        
                        {/* The percentile marker */}
                        <div style={{ 
                          position: 'absolute', 
                          left: `${current.regime.primary_driver.percentile}%`, 
                          top: 0,
                          width: '4px', 
                          marginLeft: '-2px',
                          height: '100%', 
                          backgroundColor: getRegimeColor(current.regime.regime),
                          boxShadow: `0 0 4px ${getRegimeColor(current.regime.regime)}`
                        }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div style={styles.enrichmentCards}>
              {current.regime.enrichment?.map((item, i) => (
                <StatCard 
                  key={i}
                  title={item.metric}
                  value={item.value !== 'N/A' ? item.value : `${item.percentile.toFixed(0)}th pctl`}
                  subtitle={`Context: ${item.context}`}
                />
              ))}
            </div>
          </div>
          
          <div style={styles.gridBottom}>
            <div style={{ ...styles.card, flex: 2 }}>
              <h3 style={styles.cardTitle}>Historical Regime Timeline</h3>
              <div style={{ height: '256px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historyData.slice(-252).map(d => ({...d, height: 1}))} barGap={0} barCategoryGap={0}>
                    <YAxis type="number" hide domain={[0, 1]} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                      formatter={(value, name, props) => [formatRegimeName(props.payload.regime), 'Regime']}
                      labelFormatter={(label, props) => props[0]?.payload?.date || ''}
                    />
                    <Bar dataKey="height" isAnimationActive={false}>
                      {historyData.slice(-252).map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={getRegimeColor(entry.regime)} 
                          stroke={getRegimeColor(entry.regime)} 
                          strokeWidth={1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748b', marginTop: '8px' }}>Past 252 Trading Days</p>
            </div>
            
            <div style={{ ...styles.card, flex: 1 }}>
              <h3 style={styles.cardTitle}>Regime Distribution</h3>
              <div style={{ height: '256px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distribution} layout="vertical" margin={{ left: 40, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} />
                    <Tooltip cursor={{fill: '#334155', opacity: 0.4}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}/>
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {distribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getRegimeColor(entry.rawName)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ ...styles.card, marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ ...styles.cardTitle, margin: 0 }}>Historical Regime Characteristics</h3>
              <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                Mean / Std Dev by Structure
              </div>
            </div>
            
            {history?.stats?.[current.regime.regime]?.structures ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8', textAlign: 'left' }}>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Structure</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Mean</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Median</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Std Dev</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Min</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>Max</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>10th Pctl</th>
                      <th style={{ padding: '12px 8px', fontWeight: '500' }}>90th Pctl</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(history.stats[current.regime.regime].structures)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([struct, stats]) => (
                      <tr key={struct} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '12px 8px', fontWeight: '500', color: '#e2e8f0', textTransform: 'uppercase' }}>{struct.replace(/_/g, ' ')}</td>
                        <td style={{ padding: '12px 8px', color: '#f8fafc' }}>{stats.mean.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{stats.median.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#3b82f6' }}>{stats.std.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#f43f5e' }}>{stats.min.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#10b981' }}>{stats.max.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{stats.q10.toFixed(3)}</td>
                        <td style={{ padding: '12px 8px', color: '#94a3b8' }}>{stats.q90.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>No historical characteristics available</div>
            )}
          </div>

          <div style={{ ...styles.card, marginTop: '24px' }}>
            <h3 style={styles.cardTitle}>Regime Driver Analysis (Lasso Selection)</h3>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
              Identifies which fundamental factors are statistically significant for the curve structure during different regimes.
            </p>
            
            {driversLoading ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Analyzing drivers...</div>
            ) : drivers?.drivers ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {Object.entries(drivers.drivers).map(([regime, data]) => (
                  <div key={regime} style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                    <div style={{ color: getRegimeColor(regime), fontWeight: 'bold', fontSize: '14px', marginBottom: '12px' }}>
                      {formatRegimeName(regime)}
                    </div>
                    
                    <div style={{ fontSize: '13px' }}>
                      <div style={{ color: '#cbd5e1', marginBottom: '8px', fontWeight: '500' }}>Primary Drivers:</div>
                      {data.most_important?.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '20px', color: '#34d399', marginBottom: '16px' }}>
                          {data.most_important.map(feat => (
                            <li key={feat.feature} style={{ marginBottom: '4px' }}>
                              {feat.feature} <span style={{ color: '#64748b', fontSize: '11px' }}>({feat.coefficient.toFixed(3)})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div style={{ color: '#64748b', marginBottom: '16px' }}>No clear drivers identified</div>
                      )}
                      
                      <div style={{ color: '#cbd5e1', marginBottom: '8px', fontWeight: '500' }}>Ignored (Noise):</div>
                      <div style={{ color: '#64748b', fontSize: '12px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {data.ignored?.slice(0, 5).map(feat => (
                          <span key={feat} style={{ backgroundColor: '#1e293b', padding: '2px 6px', borderRadius: '4px' }}>{feat}</span>
                        ))}
                        {data.ignored?.length > 5 && <span style={{ alignSelf: 'center' }}>+{data.ignored.length - 5} more</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '24px 0' }}>Driver analysis not available</div>
            )}
          </div>
        </>
      ) : (
        <div style={{ ...styles.card, textAlign: 'center', padding: '32px' }}>
          <p style={{ color: '#94a3b8' }}>No regime data available for this product yet.</p>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    padding: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: "'Inter', sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#fff',
    margin: 0,
    letterSpacing: '-0.025em',
  },
  pageSubtitle: {
    color: '#94a3b8',
    marginTop: '4px',
    fontSize: '14px',
  },
  productSelector: {
    display: 'flex',
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '4px',
    border: '1px solid #334155',
  },
  productBtn: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#94a3b8',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  productBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: 'calc(100vh - 100px)',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid rgba(16, 185, 129, 0.2)',
    borderTopColor: '#10b981',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: '16px',
  },
  gridTop: {
    display: 'flex',
    gap: '16px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  mainRegimeCard: {
    flex: '2 1 400px',
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  enrichmentCards: {
    flex: '1 1 300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  statCard: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    padding: '16px',
    border: '1px solid #334155',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  statTitle: {
    color: '#94a3b8',
    fontSize: '14px',
    fontWeight: '500',
    marginBottom: '4px',
    margin: 0,
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
  },
  statSubtitle: {
    color: '#64748b',
    fontSize: '12px',
    marginTop: '4px',
    margin: 0,
  },
  gridBottom: {
    display: 'flex',
    gap: '24px',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    padding: '20px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '16px',
    margin: 0,
  }
};
