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
  RotateCcw
} from 'lucide-react';
import { DashboardMetrics, User } from '../types';

interface OverviewTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
  onNavigate: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ metrics, user, onNavigate }) => {
  if (!metrics) {
    return <div className="page-container"><p>Loading dashboard analytics...</p></div>;
  }

  const stageOrder = [
    'SUBMITTED',
    'SCRUTINY',
    'RE_SCRUTINY',
    'EVC_PENDING',
    'EVC_SCHEDULED',
    'EVC_COMPLETED',
    'SAC_SHC_REVIEW',
    'COMPLIANCE_PENDING',
    'COMPLETED',
    'RETURNED_FOR_CLARIFICATION'
  ];

  return (
    <div className="page-container">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0c2340 0%, #1a3a60 100%)',
        color: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#38bdf8', textTransform: 'uppercase' }}>
            REGULATORY CONTROL CENTRE
          </span>
          <h2 style={{ fontFamily: 'Manrope', fontSize: 22, fontWeight: 800, margin: '6px 0 4px', color: '#ffffff' }}>
            Welcome back, {user?.name}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>
            {user?.role === 'institution'
              ? `Tracking applications and compliance submissions for ${user.institution_name}.`
              : `Active AICTE regulatory operations across ${user?.region || 'All'} Region.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-primary" onClick={() => onNavigate('Applications')}>
            <span>View Applications</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-icon blue">
            <ClipboardList size={22} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Total Applications</span>
            <span className="stat-value">{metrics.total_applications}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon blue">
            <Clock size={22} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">In Scrutiny / Active</span>
            <span className="stat-value">{metrics.in_progress}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon amber">
            <Clock size={22} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Approaching Deadline (&lt;7d)</span>
            <span className="stat-value">{metrics.due_soon}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon red">
            <AlertTriangle size={22} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Overdue Cases</span>
            <span className="stat-value">{metrics.overdue}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-icon green">
            <CheckCircle2 size={22} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Completed Approvals</span>
            <span className="stat-value">{metrics.completed}</span>
          </div>
        </div>
      </div>

      {/* Stage Pipeline Breakdown */}
      <div className="panel-card">
        <div className="panel-header">
          <h3>
            <ClipboardList size={18} color="var(--primary)" />
            Application Stage Distribution Pipeline
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Real-time stage counts from database
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {stageOrder.map((stage) => {
            const count = metrics.by_stage[stage] || 0;
            const maxVal = Math.max(1, metrics.total_applications);
            const pct = Math.round((count / maxVal) * 100);

            const isReturned = stage === 'RETURNED_FOR_CLARIFICATION';
            const isCompleted = stage === 'COMPLETED';

            return (
              <div
                key={stage}
                style={{
                  padding: '12px 14px',
                  background: isReturned ? '#fff7ed' : (isCompleted ? '#f0fdf4' : '#f8fafc'),
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${isReturned ? '#fed7aa' : (isCompleted ? '#bbf7d0' : 'var(--border-subtle)')}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: isReturned ? '#c2410c' : (isCompleted ? '#15803d' : '#334155'),
                    textTransform: 'uppercase'
                  }}>
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{count}</span>
                </div>
                <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: isReturned ? '#ea580c' : (isCompleted ? '#10b981' : '#2563eb'),
                      borderRadius: 4
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row: Urgent Alerts + Compliance & EVC Quick Access */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        {/* Urgent Alerts */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>
              <Bell size={18} color="#dc2626" />
              Urgent Regulatory Alerts
            </h3>
            <button className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => onNavigate('Alerts')}>
              View All Alerts
            </button>
          </div>

          {metrics.urgent_alerts.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '14px 0' }}>
              No critical or high-severity alerts at this moment.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {metrics.urgent_alerts.map((al) => (
                <div
                  key={al.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background: al.severity === 'CRITICAL' ? '#fef2f2' : '#fffbeb',
                    borderLeft: `4px solid ${al.severity === 'CRITICAL' ? '#dc2626' : '#d97706'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <b style={{ fontSize: 12, color: al.severity === 'CRITICAL' ? '#991b1b' : '#92400e' }}>
                      {al.title}
                    </b>
                    <span className={`badge badge-${al.severity.toLowerCase()}`}>{al.severity}</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#475569' }}>{al.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Operations Summary */}
        <div className="panel-card">
          <div className="panel-header">
            <h3>Operations Summary</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Calendar size={20} color="#2563eb" />
                <div>
                  <b style={{ fontSize: 13, display: 'block' }}>EVC Inspections</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending or Scheduled visits</span>
                </div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{metrics.evc_pending_count}</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileCheck2 size={20} color="#059669" />
                <div>
                  <b style={{ fontSize: 13, display: 'block' }}>Compliance Shortfalls</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending verification or overdue</span>
                </div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800 }}>{metrics.compliance_pending_count}</span>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: '#fff7ed',
              border: '1px solid #ffedd5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <RotateCcw size={20} color="#ea580c" />
                <div>
                  <b style={{ fontSize: 13, display: 'block', color: '#9a3412' }}>Returned for Clarification</b>
                  <span style={{ fontSize: 11, color: '#c2410c' }}>Awaiting applicant resubmission</span>
                </div>
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#9a3412' }}>{metrics.returned}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
