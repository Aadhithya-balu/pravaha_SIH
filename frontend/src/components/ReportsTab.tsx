import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  PieChart,
  Activity,
  Clock,
  ShieldAlert,
  Users,
  Compass,
  ArrowRight
} from 'lucide-react';
import { DashboardMetrics, User, BottleneckAnalytics } from '../types';
import { downloadCsv, fetchBottleneckAnalytics } from '../api';

interface ReportsTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ metrics, user }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState('');
  const [downloadError, setDownloadError] = useState('');

  // Bottleneck & SLA Risk Analytics State (Part 14 Feature C)
  const [analytics, setAnalytics] = useState<BottleneckAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  useEffect(() => {
    async function loadBottlenecks() {
      setLoadingAnalytics(true);
      try {
        const data = await fetchBottleneckAnalytics();
        setAnalytics(data);
      } catch (err) {
        // Fallback silently if offline
      } finally {
        setLoadingAnalytics(false);
      }
    }
    loadBottlenecks();
  }, []);

  async function handleExport(type: 'applications' | 'compliance') {
    setIsExporting(true);
    setDownloadSuccess('');
    setDownloadError('');
    try {
      await downloadCsv(type);
      setDownloadSuccess(`Successfully generated and downloaded ${type} CSV report.`);
    } catch (err: any) {
      setDownloadError(err.message || 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="page-container" style={{ gap: 20 }}>
      {/* CSV Export Panel */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Official Regulatory Reports & Data Export</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Generate RFC-4180 compliant CSV reports sanitized against formula injection vulnerabilities
            </span>
          </div>
        </div>

        {downloadSuccess && (
          <div className="alert-banner info" style={{ marginBottom: 14 }}>
            <CheckCircle2 size={16} />
            <span>{downloadSuccess}</span>
            <button
              type="button"
              style={{ background: 'transparent', border: 0, cursor: 'pointer', marginLeft: 'auto', fontWeight: 800 }}
              onClick={() => setDownloadSuccess('')}
            >
              ×
            </button>
          </div>
        )}
        {downloadError && (
          <div className="alert-banner danger" style={{ marginBottom: 14 }}>
            <AlertTriangle size={16} />
            <span>{downloadError}</span>
            <button
              type="button"
              style={{ background: 'transparent', border: 0, cursor: 'pointer', marginLeft: 'auto', fontWeight: 800 }}
              onClick={() => setDownloadError('')}
            >
              ×
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={22} color="#059669" />
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>All Applications Register</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Complete registry with reference, stage, status, due dates and regions
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 'auto', justifyContent: 'center' }}
              disabled={isExporting}
              onClick={() => handleExport('applications')}
            >
              <Download size={14} />
              <span>Export Applications CSV</span>
            </button>
          </div>

          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileSpreadsheet size={22} color="#2563eb" />
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>Compliance & Expiry Register</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Statutory undertakings, lease validity, and safety NOC verifications
                </span>
              </div>
            </div>
            <button
              className="btn-primary"
              style={{ marginTop: 'auto', justifyContent: 'center', background: '#059669', borderColor: '#059669' }}
              disabled={isExporting}
              onClick={() => handleExport('compliance')}
            >
              <Download size={14} />
              <span>Export Compliance CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* BOTTLENECK & SLA RISK INTELLIGENCE (Part 14 Feature C) */}
      {analytics && (
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color="#dc2626" />
                Operational Bottlenecks & SLA Risk Intelligence
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Deterministic pipeline analysis identifying regulatory choke points, processing ageing, and workload distribution
              </span>
            </div>
            <span className="badge badge-pending" style={{ fontSize: 11 }}>
              Active Cases: {analytics.total_active_cases ?? analytics.total_active_applications}
            </span>
          </div>

          {/* Identified Critical Bottlenecks */}
          {(analytics.critical_bottlenecks && analytics.critical_bottlenecks.length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
              {analytics.critical_bottlenecks.map((b: any) => (
                <div
                  key={b.stage}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-sm)',
                    background: b.bottleneck_severity === 'CRITICAL' ? '#fef2f2' : '#fff7ed',
                    border: `1px solid ${b.bottleneck_severity === 'CRITICAL' ? '#fca5a5' : '#fdba74'}`,
                    borderLeft: `5px solid ${b.bottleneck_severity === 'CRITICAL' ? '#dc2626' : '#ea580c'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: 999,
                        background: b.bottleneck_severity === 'CRITICAL' ? '#dc2626' : '#ea580c',
                        color: '#ffffff'
                      }}>
                        {b.bottleneck_severity} BOTTLENECK
                      </span>
                      <b style={{ fontSize: 13, color: '#1e293b' }}>
                        Stage: {b.stage.replace(/_/g, ' ')}
                      </b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Backlog: <b>{b.backlog_count} cases</b> · Avg Ageing: <b>{b.avg_ageing_days}d</b> (SLA Limit: {b.sla_limit_days}d)
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
                      <b>Recommendation:</b> {b.recommendation}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-sm)',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: '#166534'
            }}>
              <CheckCircle2 size={16} />
              <span>All active workflow stages are currently operating within prescribed SLA ageing thresholds.</span>
            </div>
          )}

          {/* Regional & Officer Workload Distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Regional Workload */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Compass size={15} color="#2563eb" />
                <b style={{ fontSize: 12, textTransform: 'uppercase', color: '#1e293b' }}>Regional Jurisdictional Workload</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(analytics.regional_workload || analytics.region_workload || {}).length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No regional applications active</span>
                ) : (
                  Object.entries(analytics.regional_workload || analytics.region_workload || {}).map(([region, cnt]) => (
                    <div key={region} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{region} Region</span>
                      <b style={{ color: '#2563eb' }}>{String(cnt)} cases</b>
                    </div>
                  ))
                )}
              </div>
            </div>


            {/* Officer Assignment Balance */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Users size={15} color="#059669" />
                <b style={{ fontSize: 12, textTransform: 'uppercase', color: '#1e293b' }}>Officer Case Allocation</b>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(analytics.officer_workload).length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No officers currently assigned</span>
                ) : (
                  Object.entries(analytics.officer_workload).map(([officer, cnt]) => (
                    <div key={officer} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                        {officer}
                      </span>
                      <b style={{ color: '#059669' }}>{cnt} active</b>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aggregate Visuals */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Applications by Type */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>
                <PieChart size={17} color="var(--primary)" />
                Distribution by Application Type
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(metrics.by_type || {}).map(([type, count]) => {
                const pct = Math.round((count / Math.max(1, metrics.total_applications)) * 100);
                return (
                  <div key={type} style={{ fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600 }}>{type}</span>
                      <b>{count} ({pct}%)</b>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2563eb', borderRadius: 4 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regulatory Throughput Overview */}
          <div className="panel-card">
            <div className="panel-header">
              <h3>
                <BarChart3 size={17} color="var(--primary)" />
                Regulatory Operations Throughput
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Active In Scrutiny Cases</span>
                <b>{metrics.in_progress}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Overdue Cases Requiring Escalation</span>
                <b style={{ color: '#dc2626' }}>{metrics.overdue}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>Cases Awaiting Applicant Clarification</span>
                <b style={{ color: '#d97706' }}>{metrics.returned}</b>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0' }}>
                <span>Formal Approvals Issued</span>
                <b style={{ color: '#059669' }}>{metrics.completed}</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
