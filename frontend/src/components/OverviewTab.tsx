import React from 'react';
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  FileCheck2,
  ArrowRight,
  Bell,
  RotateCcw,
  ShieldCheck,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { DashboardMetrics, User } from '../types';

interface OverviewTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
  onNavigate: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, user, onNavigate }) => {
  if (!metrics) {
    return (
      <div className="page-container">
        <div className="panel-card empty-state">
          <Clock size={24} color="#64748b" />
          <h4>Loading Regulatory Analytics...</h4>
          <p>Retrieving operational metrics from the AICTE workflow engine.</p>
        </div>
      </div>
    );
  }

  // Calculated operational metrics derived strictly from backend response
  const awaitingScrutiny =
    (metrics.by_stage['SUBMITTED'] || 0) +
    (metrics.by_stage['SCRUTINY'] || 0) +
    (metrics.by_stage['RE_SCRUTINY'] || 0);

  const stageOrder = [
    { key: 'SUBMITTED', label: '1. Submitted' },
    { key: 'SCRUTINY', label: '2. Scrutiny' },
    { key: 'RE_SCRUTINY', label: '3. Re-Scrutiny' },
    { key: 'EVC_PENDING', label: '4. EVC Pending' },
    { key: 'EVC_SCHEDULED', label: '5. EVC Scheduled' },
    { key: 'EVC_COMPLETED', label: '6. EVC Completed' },
    { key: 'SAC_SHC_REVIEW', label: '7. SAC / SHC Review' },
    { key: 'COMPLIANCE_PENDING', label: '8. Compliance Pending' },
    { key: 'COMPLETED', label: '9. Completed' },
    { key: 'RETURNED_FOR_CLARIFICATION', label: 'Returned (Deficient)' }
  ];

  return (
    <div className="page-container">
      {/* GovTech Header Banner */}
      <div style={{
        background: '#0f294a',
        border: '1px solid #1e3a8a',
        color: '#ffffff',
        borderRadius: 'var(--radius-md)',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#38bdf8',
              textTransform: 'uppercase'
            }}>
              AICTE Regulatory Operations Console
            </span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>·</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>
              Academic Cycle 2026–2027
            </span>
          </div>
          <h2 style={{ fontFamily: 'Manrope', fontSize: 20, fontWeight: 800, margin: '2px 0 6px', color: '#ffffff' }}>
            {user?.role === 'institution'
              ? `${user.institution_name || 'Institutional Portal'}`
              : `Regional Scrutiny & Approval Desk — ${user?.region || 'HQ'} Region`}
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1' }}>
            {user?.role === 'institution'
              ? 'Real-time regulatory tracking, deficiency rectifications, and compliance monitoring.'
              : `Logged in as ${user?.name} (${user?.designation || user?.role}). Real-time scrutiny pipeline connected.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn-primary" onClick={() => onNavigate('Applications')}>
            <span>Open Applications Register</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Priority Operational Metrics (Deriving strictly from actual backend response) */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <ClipboardList size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Total Applications</span>
            <span className="stat-value">{metrics.total_applications}</span>
            <span className="stat-subtext">Registered across scope</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon amber">
            <Clock size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Awaiting Scrutiny</span>
            <span className="stat-value">{awaitingScrutiny}</span>
            <span className="stat-subtext">Submitted & re-scrutiny</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon orange">
            <RotateCcw size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Returned for Clarification</span>
            <span className="stat-value">{metrics.returned}</span>
            <span className="stat-subtext">Awaiting applicant resubmission</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon red">
            <AlertTriangle size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Overdue Cases</span>
            <span className="stat-value">{metrics.overdue}</span>
            <span className="stat-subtext">Exceeded target timeline</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon blue">
            <Calendar size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Pending EVC Visits</span>
            <span className="stat-value">{metrics.evc_pending_count}</span>
            <span className="stat-subtext">Committee scheduling/visit</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Completed Approvals</span>
            <span className="stat-value">{metrics.completed}</span>
            <span className="stat-subtext">Approved statutory orders</span>
          </div>
        </div>
      </div>

      {/* Stage Distribution Pipeline */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>
              <ClipboardList size={16} color="var(--primary)" />
              Application Stage Distribution Pipeline
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Live lifecycle distribution across AICTE Approval Process Handbook (APH) stages
            </span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)' }}>
            Total in Pipeline: {metrics.total_applications}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
          {stageOrder.map(({ key, label }) => {
            const count = metrics.by_stage[key] || 0;
            const maxVal = Math.max(1, metrics.total_applications);
            const pct = Math.round((count / maxVal) * 100);

            const isReturned = key === 'RETURNED_FOR_CLARIFICATION';
            const isCompleted = key === 'COMPLETED';

            return (
              <div
                key={key}
                style={{
                  padding: '10px 12px',
                  background: isReturned ? '#fff7ed' : (isCompleted ? '#f0fdf4' : '#ffffff'),
                  borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${isReturned ? '#fed7aa' : (isCompleted ? '#bbf7d0' : 'var(--border-subtle)')}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isReturned ? '#c2410c' : (isCompleted ? '#15803d' : '#334155'),
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{count}</span>
                </div>
                <div style={{ width: '100%', height: 5, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isReturned ? '#ea580c' : (isCompleted ? '#10b981' : '#2563eb'),
                      borderRadius: 3
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row: Pending Action Queue & SLA-Risk Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '18px' }}>
        {/* Pending Action Queue */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>
                <AlertCircle size={16} color="var(--primary)" />
                Action Queue & Priority Vectors
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Urgent regulatory items requiring officer disposition or applicant response
              </span>
            </div>
            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onNavigate('Applications')}>
              View All in Register
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <b style={{ fontSize: 12, display: 'block' }}>Initial Document Scrutiny</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Submitted applications requiring primary documentary evaluation
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{metrics.by_stage['SCRUTINY'] || 0}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => onNavigate('Applications')}
                >
                  Scrutinize
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#fff7ed',
              border: '1px solid #fed7aa'
            }}>
              <div>
                <b style={{ fontSize: 12, display: 'block', color: '#9a3412' }}>Returned Deficiency Resubmissions</b>
                <span style={{ fontSize: 11, color: '#c2410c' }}>
                  Cases returned to colleges with cited deficiency memos
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#9a3412' }}>{metrics.returned}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11, borderColor: '#fed7aa', color: '#9a3412' }}
                  onClick={() => onNavigate('Applications')}
                >
                  Review
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <b style={{ fontSize: 12, display: 'block' }}>Expert Visiting Committees (EVC)</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Inspections pending panel constitution or report filing
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{metrics.evc_pending_count}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => onNavigate('EVC Inspections')}
                >
                  Schedule
                </button>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--radius-sm)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)'
            }}>
              <div>
                <b style={{ fontSize: 12, display: 'block' }}>Statutory Compliance Undertakings</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Affidavits, lease tenures and NOC items pending verification
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 800 }}>{metrics.compliance_pending_count}</span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => onNavigate('Compliance')}
                >
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SLA-Risk Summary & Statutory Norms */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>
                <Clock size={16} color="var(--primary)" />
                SLA-Risk & Compliance Summary
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Statutory Approval Process Handbook (APH) turnaround benchmarks
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Live Metrics vs Statutory Benchmark */}
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                  CASES OVERDUE (&gt;SLA)
                </span>
                <span className={`badge ${metrics.overdue > 0 ? 'badge-critical' : 'badge-completed'}`}>
                  {metrics.overdue} Overdue
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                Target timeline: 14 days for initial scrutiny under APH guidelines.
              </span>
            </div>

            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                  APPROACHING DEADLINE (&lt;7 DAYS)
                </span>
                <span className={`badge ${metrics.due_soon > 0 ? 'badge-warning' : 'badge-completed'}`}>
                  {metrics.due_soon} Cases
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                Cases nearing escalation threshold. Automated alerts queued.
              </span>
            </div>

            {/* Official Statutory APH Reference Note */}
            <div style={{
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontSize: 11,
              color: '#1e40af',
              lineHeight: 1.4
            }}>
              <b>Statutory Regulatory Framework:</b>
              <p style={{ margin: '3px 0 0' }}>
                Under AICTE APH Chapter I & II, regional officers must record definitive scrutiny remarks within 14 days. Any returned case requires mandatory cited justification.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Regulatory Alerts */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>
              <Bell size={16} color="#b91c1c" />
              Urgent Regulatory Alerts & Escalation Feeds
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              High-priority notifications triggered by deadline scanner and compliance engines
            </span>
          </div>
          <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onNavigate('Alerts')}>
            View All Alerts
          </button>
        </div>

        {metrics.urgent_alerts.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <CheckCircle2 size={24} color="#047857" />
            <p style={{ margin: 0, fontSize: 12 }}>No critical regulatory alerts currently active.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
            {metrics.urgent_alerts.map((al) => (
              <div
                key={al.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  background: al.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                  borderLeft: `4px solid ${al.severity === 'CRITICAL' ? '#b91c1c' : '#d97706'}`,
                  borderTop: '1px solid var(--border-subtle)',
                  borderRight: '1px solid var(--border-subtle)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <b style={{ fontSize: 12, color: al.severity === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                    {al.title}
                  </b>
                  <span className={`badge ${al.severity === 'CRITICAL' ? 'badge-critical' : 'badge-warning'}`}>
                    {al.severity}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: '#475569', lineHeight: 1.35 }}>{al.message}</span>
                <span style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                  {new Date(al.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
