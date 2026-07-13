import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useEngineStatus, useRankedSignals } from '../hooks/usePhase2Data';

export default function OpportunityPage() {
  const { data: status } = useEngineStatus();
  const { data: signalData, loading } = useRankedSignals();
  const [selectedOpp, setSelectedOpp] = useState(null);

  const isReady = status?.status === 'ready';

  if (!isReady) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#f1f5f9' }}>Phase 2 Engine Initializing</h2>
        <p style={{ color: '#94a3b8', marginTop: '8px' }}>Scanning market for regime-based opportunities...</p>
      </div>
    );
  }

  const opportunities = signalData?.opportunities || [];

  const getSignalColors = (signal) => {
    switch(signal) {
      case 'RICH': return { color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.2)' };
      case 'SLIGHTLY_RICH': return { color: '#fb7185', bg: 'rgba(251, 113, 133, 0.1)', border: 'rgba(251, 113, 133, 0.2)' };
      case 'CHEAP': return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.2)' };
      case 'SLIGHTLY_CHEAP': return { color: '#34d399', bg: 'rgba(52, 211, 153, 0.1)', border: 'rgba(52, 211, 153, 0.2)' };
      default: return { color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.2)' };
    }
  };

  const getZScoreColor = (z) => {
    if (z > 2) return '#f43f5e';
    if (z > 1) return '#fb7185';
    if (z < -2) return '#10b981';
    if (z < -1) return '#34d399';
    return '#94a3b8';
  };

  return (
    <div style={styles.pageContainer}>
      <div style={styles.header}>
        <h1 style={styles.pageTitle}>Opportunity Scanner</h1>
        <p style={styles.pageSubtitle}>Cross-asset statistical arbitrage signals based on current regime</p>
      </div>

      <div style={styles.mainLayout}>
        
        {/* Signal Table */}
        <div style={{ ...styles.card, flex: 1, display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Top Ranked Opportunities</h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>{opportunities.length} active signals</span>
          </div>
          
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && opportunities.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Scanning markets...</div>
            ) : opportunities.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>No active signals found.</div>
            ) : (
              <table style={styles.table}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a', zIndex: 10 }}>
                  <tr style={styles.tableHeaderRow}>
                    <th style={styles.th}>Rank</th>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Structure</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Actual</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Expected</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>Z-Score</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {opportunities.map((opp, idx) => {
                    const isSelected = selectedOpp?.product === opp.product && selectedOpp?.structure === opp.structure;
                    return (
                      <tr 
                        key={`${opp.product}-${opp.structure}`} 
                        onClick={() => setSelectedOpp(opp)}
                        style={{
                          ...styles.tr,
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                        }}
                      >
                        <td style={{ ...styles.td, color: '#64748b', fontWeight: '500' }}>{idx + 1}</td>
                        <td style={{ ...styles.td, fontWeight: 'bold', color: '#fff' }}>{opp.product}</td>
                        <td style={{ ...styles.td, color: '#cbd5e1', textTransform: 'uppercase' }}>{opp.structure.replace(/_/g, ' ')}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#fff' }}>{opp.actual > 0 ? '+' : ''}{opp.actual.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#94a3b8' }}>{opp.expected > 0 ? '+' : ''}{opp.expected.toFixed(3)}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', fontVariantNumeric: 'tabular-nums', color: getZScoreColor(opp.z_score) }}>
                          {opp.z_score > 0 ? '+' : ''}{opp.z_score.toFixed(2)}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 12px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            border: `1px solid ${getSignalColors(opp.signal).border}`,
                            backgroundColor: getSignalColors(opp.signal).bg,
                            color: getSignalColors(opp.signal).color,
                          }}>
                            {opp.signal.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Explainability Panel */}
        <div style={{ ...styles.card, width: '384px', flexShrink: 0, display: 'flex', flexDirection: 'column', padding: 0 }}>
          {selectedOpp ? (
            <>
              <div style={styles.cardHeader}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                    {selectedOpp.product} <span style={{ color: '#94a3b8', fontSize: '18px', textTransform: 'uppercase' }}>{selectedOpp.structure.replace(/_/g, ' ')}</span>
                  </h3>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    border: `1px solid ${getSignalColors(selectedOpp.signal).border}`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: getSignalColors(selectedOpp.signal).color,
                  }}>
                    {selectedOpp.signal.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '14px', color: '#94a3b8' }}>Score: {selectedOpp.score} / 100</div>
              </div>
              
              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                <div>
                  <h4 style={styles.sectionHeader}>Fair Value Diagnostics</h4>
                  <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', borderRadius: '8px', padding: '16px', border: '1px solid #334155' }}>
                    
                    {/* Current Spread section */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Actual Spread</span>
                      <span style={{ color: '#fff', fontWeight: '500' }}>{selectedOpp.actual.toFixed(3)}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Model Fair Value (Expected)</span>
                      <span style={{ color: '#cbd5e1', fontWeight: '500' }}>{selectedOpp.expected.toFixed(3)}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', marginTop: '8px', borderTop: '1px solid rgba(51, 65, 85, 0.5)' }}>
                      <span style={{ color: '#94a3b8', fontSize: '14px' }}>Residual Deviation</span>
                      <span style={{ fontWeight: 'bold', color: getZScoreColor(selectedOpp.z_score) }}>
                        {selectedOpp.residual > 0 ? '+' : ''}{selectedOpp.residual.toFixed(3)}
                      </span>
                    </div>

                    {/* Historical Regime Context */}
                    {(selectedOpp.hist_regime_mean !== undefined && selectedOpp.hist_regime_mean !== 0) && (
                      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed #334155' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                          Historical Regime Context
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Historical Regime Mean</span>
                          <span style={{ color: '#cbd5e1', fontSize: '13px' }}>{selectedOpp.hist_regime_mean.toFixed(3)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '13px' }}>Historical Regime Std Dev</span>
                          <span style={{ color: '#cbd5e1', fontSize: '13px' }}>±{selectedOpp.hist_regime_std.toFixed(3)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0f172a', padding: '8px', borderRadius: '4px', marginTop: '8px' }}>
                          <span style={{ color: '#94a3b8', fontSize: '12px' }}>Current vs Historical Mean</span>
                          <span style={{ 
                            fontSize: '13px', 
                            fontWeight: 'bold', 
                            color: selectedOpp.actual > selectedOpp.hist_regime_mean ? '#f43f5e' : '#10b981'
                          }}>
                            {selectedOpp.actual > selectedOpp.hist_regime_mean ? '+' : ''}{(selectedOpp.actual - selectedOpp.hist_regime_mean).toFixed(3)}
                          </span>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <div>
                  <h4 style={styles.sectionHeader}>Why this Regime?</h4>
                  <div style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }}>
                    Currently in <strong style={{ color: '#fff', textTransform: 'capitalize' }}>{selectedOpp.regime.replace(/R\d_/, '').replace(/_/g, ' ')}</strong>.
                    <br/><br/>
                    The <span style={{ color: '#34d399' }}>{selectedOpp.best_model}</span> model was automatically selected as the best fit for this specific regime.
                  </div>
                </div>

                <div>
                  <h4 style={styles.sectionHeader}>Composite Score Breakdown</h4>
                  <div style={{ height: '180px', marginTop: '16px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={[{
                          name: 'Score',
                          'Z-Score (40%)': selectedOpp.score_decomposition?.z_score || 0,
                          'Regime Confidence (25%)': selectedOpp.score_decomposition?.regime_confidence || 0,
                          'Direction (20%)': selectedOpp.score_decomposition?.direction || 0,
                          'Best Model (15%)': selectedOpp.score_decomposition?.best_model || 0
                        }]} 
                        layout="vertical"
                        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                        barSize={32}
                      >
                        <XAxis type="number" hide domain={[0, 100]} />
                        <YAxis type="category" dataKey="name" hide />
                        <RechartsTooltip 
                          cursor={{fill: 'transparent'}}
                          contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc', fontSize: '12px' }}
                          formatter={(value, name) => [`${value.toFixed(1)} pts`, name]}
                        />
                        <Bar dataKey="Z-Score (40%)" stackId="a" fill="#3b82f6" radius={[4, 0, 0, 4]} />
                        <Bar dataKey="Regime Confidence (25%)" stackId="a" fill="#8b5cf6" />
                        <Bar dataKey="Direction (20%)" stackId="a" fill="#10b981" />
                        <Bar dataKey="Best Model (15%)" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginTop: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></div> Z-Score
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#8b5cf6' }}></div> Confidence
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#10b981' }}></div> Direction
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f59e0b' }}></div> Best Model
                    </div>
                  </div>
                </div>

              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'rgba(51, 65, 85, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <svg style={{ width: '32px', height: '32px', color: '#64748b' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p style={{ color: '#94a3b8' }}>Select an opportunity from the table to view the explainability breakdown.</p>
            </div>
          )}
        </div>

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
    display: 'flex',
    flexDirection: 'column',
    height: 'calc(100vh - 100px)',
  },
  header: {
    marginBottom: '24px',
    flexShrink: 0,
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
  mainLayout: {
    display: 'flex',
    gap: '24px',
    minHeight: 0,
    flex: 1,
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
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '16px',
    borderBottom: '1px solid #334155',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  cardTitle: {
    fontSize: '16px',
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
  sectionHeader: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '12px',
    margin: 0,
  }
};
