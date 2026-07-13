import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
  LineChart, Line
} from 'recharts';
import { useEngineStatus, useRegressionResults, useRollingRegression } from '../hooks/usePhase2Data';

export default function RegressionLabPage() {
  const [product, setProduct] = useState('CL');
  const [structure, setStructure] = useState('m1_m6');
  const [regime, setRegime] = useState('ALL');
  
  const { data: status } = useEngineStatus();
  const { data: results, loading } = useRegressionResults(product, structure, regime);
  
  const isReady = status?.status === 'ready';

  if (!isReady) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f1f5f9' }}>Phase 2 Engine Initializing</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px' }}>Training regression models across regimes...</p>
      </div>
    );
  }

  const structures = [
    'm1_m2', 'm1_m3', 'm1_m6', 'm1_m12',
    'fly_1_3_5', 'fly_1_6_12', 'fly_2_4_6', 'fly_3_6_9'
  ];
  
  const regimes = ['ALL', 'R1_DEEP_CONTANGO', 'R2_CONTANGO', 'R3_FLAT', 'R4_BACKWARDATION', 'R5_EXTREME_BACKWARDATION'];

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.pageTitle}>Regression Lab</h1>
          <p style={styles.pageSubtitle}>Multi-model linear regression and feature selection</p>
        </div>
        
        <div style={styles.selectors}>
          <select 
            value={product} 
            onChange={(e) => setProduct(e.target.value)}
            style={styles.select}
          >
            {['CL', 'LCO', 'HO', 'LGO'].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          
          <select 
            value={structure} 
            onChange={(e) => setStructure(e.target.value)}
            style={{ ...styles.select, textTransform: 'uppercase' }}
          >
            {structures.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          
          <select 
            value={regime} 
            onChange={(e) => setRegime(e.target.value)}
            style={styles.select}
          >
            {regimes.map(r => <option key={r} value={r}>{r.replace(/R\d_/, '').replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ height: '256px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
          Loading regression results...
        </div>
      ) : results?.error ? (
        <div style={styles.errorBox}>
          {results.error}
        </div>
      ) : results ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={styles.gridColumns}>
            
            {/* Model Comparison Table */}
            <div style={{ ...styles.card, flex: 2, padding: 0 }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Model Comparison</h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  <span style={{ fontWeight: '600', color: '#cbd5e1' }}>{results.train_obs}</span> Train / <span style={{ fontWeight: '600', color: '#cbd5e1' }}>{results.test_obs}</span> Test Obs
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.tableHeaderRow}>
                      <th style={styles.th}>Model</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Train R²</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Test R²</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Test RMSE</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>CV Mean R²</th>
                      <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(results.models).map((model) => (
                      <tr key={model.model_type} style={model.is_best ? styles.trBest : styles.tr}>
                        <td style={{ ...styles.td, fontWeight: '500', color: '#fff', textTransform: 'capitalize' }}>{model.model_type}</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#cbd5e1' }}>{model.train_r2.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#fff' }}>{model.test_r2.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#cbd5e1' }}>{model.test_rmse.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8' }}>{model.cv_r2_mean.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          {model.is_best ? (
                            <span style={styles.badgeBest}>★ Best</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#34d399', fontWeight: '600' }}>Automatic Model Selection Explained</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                  The engine selected <strong><span style={{textTransform: 'capitalize'}}>{results.best_model}</span></strong> for production scoring because it achieved the highest Out-of-Sample Test R² ({Object.values(results.models).find(m => m.is_best)?.test_r2.toFixed(3)}), indicating the strongest predictive power on unseen data without overfitting.
                </p>
              </div>
            </div>

            {/* Feature Importance (Lasso) */}
            <div style={{ ...styles.card, flex: 1, padding: 0, display: 'flex', flexDirection: 'column' }}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>Feature Selection</h3>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>Lasso L1 Regularization Shrinkage</p>
              </div>
              <div style={{ padding: '20px', flex: 1, overflowY: 'auto', maxHeight: '300px' }}>
                {results.feature_importance?.selected?.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {results.feature_importance.selected.map((feat, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#cbd5e1' }}>{feat.feature}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '96px', height: '6px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden', display: 'flex', justifyContent: 'flex-end' }}>
                            <div 
                              style={{ 
                                height: '100%', 
                                backgroundColor: feat.coefficient > 0 ? '#10b981' : '#f43f5e',
                                width: `${Math.min(Math.abs(feat.coefficient) * 100, 100)}%` 
                              }}
                            ></div>
                          </div>
                          <span style={{ fontSize: '12px', color: '#94a3b8', width: '48px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {feat.coefficient > 0 ? '+' : ''}{feat.coefficient.toFixed(3)}
                          </span>
                        </div>
                      </div>
                    ))}
                    {results.feature_importance.ignored?.length > 0 && (
                      <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #334155' }}>
                        <h4 style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', margin: 0 }}>Dropped to Zero</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                          {results.feature_importance.ignored.map((feat, i) => (
                            <span key={i} style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#0f172a', color: '#64748b', textDecoration: 'line-through' }}>
                              {feat.feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                    Lasso model dropped all features or failed to converge.
                  </div>
                )}
              </div>
              <div style={{ padding: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', borderTop: '1px solid #334155', fontSize: '12px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                <span>Selected: {results.feature_importance?.selected_count || 0}</span>
                <span>Dropped: {results.feature_importance?.ignored?.length || 0}</span>
              </div>
            </div>

          </div>
          
          <RollingAnalyticsChart product={product} structure={structure} />
          
        </div>
      ) : null}
    </div>
  );
}

function RollingAnalyticsChart({ product, structure }) {
  const { data: rolling, loading } = useRollingRegression(product, structure);

  if (loading) {
    return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>Loading rolling analytics...</div>;
  }

  if (rolling?.error || !rolling?.data || rolling.data.length === 0) {
    return null;
  }

  // Get the two most important features from the latest row for plotting
  const latestRow = rolling.data[rolling.data.length - 1];
  const featureCols = Object.keys(latestRow).filter(k => k !== 'date' && k !== 'r2');
  
  // Sort features by absolute coefficient value in the latest row
  const topFeatures = [...featureCols].sort((a, b) => Math.abs(latestRow[b]) - Math.abs(latestRow[a])).slice(0, 2);

  return (
    <div style={{ ...styles.card, padding: 0 }}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>Rolling Regression Analytics</h3>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '4px 0 0 0' }}>252-Day Window Model Stability (ALL Regimes)</p>
      </div>
      <div style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
        <div style={{ flex: '1 1 400px' }}>
          <h4 style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '12px', textAlign: 'center' }}>Rolling Explanatory Power (R²)</h4>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rolling.data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(str) => str.substring(5)} minTickGap={30} />
                <YAxis domain={[0, 'dataMax + 0.1']} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                />
                <Line type="monotone" dataKey="r2" stroke="#8b5cf6" strokeWidth={2} dot={false} name="R-Squared" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {topFeatures.length > 0 && (
          <div style={{ flex: '1 1 400px' }}>
            <h4 style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '12px', textAlign: 'center' }}>Top Drivers Coefficient Stability</h4>
            <div style={{ height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rolling.data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="date" tick={{fontSize: 10, fill: '#94a3b8'}} tickFormatter={(str) => str.substring(5)} minTickGap={30} />
                  <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                  />
                  {topFeatures.map((feat, i) => (
                    <Line 
                      key={feat}
                      type="monotone" 
                      dataKey={feat} 
                      stroke={i === 0 ? '#10b981' : '#f59e0b'} 
                      strokeWidth={2} 
                      dot={false} 
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '8px' }}>
              {topFeatures.map((feat, i) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: i === 0 ? '#10b981' : '#f59e0b' }}></div>
                  {feat}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
    alignItems: 'center',
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
  selectors: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
  },
  select: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    color: '#fff',
    borderRadius: '8px',
    padding: '8px 16px',
    outline: 'none',
    fontSize: '14px',
    cursor: 'pointer',
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
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
    border: '1px solid rgba(244, 63, 94, 0.5)',
    borderRadius: '12px',
    padding: '24px',
    color: '#fb7185',
  },
  gridColumns: {
    display: 'flex',
    gap: '24px',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  cardHeader: {
    padding: '20px',
    borderBottom: '1px solid #334155',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#fff',
    margin: 0,
  },
  table: {
    width: '100%',
    textAlign: 'left',
    borderCollapse: 'collapse',
  },
  tableHeaderRow: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    color: '#94a3b8',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  th: {
    padding: '16px',
    fontWeight: '500',
  },
  td: {
    padding: '16px',
  },
  tr: {
    borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
  },
  trBest: {
    borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  badgeBest: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: '9999px',
    fontSize: '12px',
    fontWeight: '500',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    color: '#34d399',
  }
};
