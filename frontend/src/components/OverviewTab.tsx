import React, { useState, useEffect } from 'react';
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
  Building2,
  Activity,
  Layers,
  Compass,
  Users,
  Eye,
  RefreshCw,
  Plus,
  PlayCircle,
  FileSpreadsheet,
  Check,
  Sparkles
} from 'lucide-react';
import { DashboardMetrics, User, Application, AlertItem, BottleneckAnalytics } from '../types';
import { fetchBottleneckAnalytics } from '../api';

interface OverviewTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
  applications?: Application[];
  alerts?: AlertItem[];
  onNavigate: (tab: string) => void;
  onNavigateWithFilter?: (tab: string, stageFilter?: string, statusFilter?: string) => void;
  onSelectApplication?: (app: Application) => void;
  onRefresh?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  metrics,
  user,
  applications = [],
  alerts = [],
  onNavigate,
  onNavigateWithFilter,
  onSelectApplication,
  onRefresh
}) => {
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Load bottleneck intelligence
  useEffect(() => {
    async function loadBottlenecks() {
      setLoadingAnalytics(true);
      try {
        const data = await fetchBottleneckAnalytics();
        setBottlenecks(data);
        setLastRefreshed(new Date());
      } catch (err) {
        // Soft fail
      } finally {
        setLoadingAnalytics(false);
      }
    }
    loadBottlenecks();
  }, []);

  function handleFilterNav(tab: string, stage: string = 'ALL', status: string = 'ALL') {
    if (onNavigateWithFilter) {
      onNavigateWithFilter(tab, stage, status);
    } else {
      onNavigate(tab);
    }
  }

  // Loading skeleton state
  if (!metrics) {
    return (
      <div className="page-container" style={{ gap: 16 }}>
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ height: 20, width: 240, background: '#e2e8f0', borderRadius: 4 }} />
          <div style={{ height: 14, width: 420, background: '#f1f5f9', borderRadius: 4 }} />
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="stat-card" style={{ height: 96, background: '#ffffff' }}>
              <div style={{ width: 42, height: 42, background: '#f1f5f9', borderRadius: 'var(--radius-sm)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                <div style={{ height: 12, width: '60%', background: '#e2e8f0', borderRadius: 3 }} />
                <div style={{ height: 22, width: '40%', background: '#f1f5f9', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 1. Specific decision KPI metrics calculated from actual persisted data
  const totalAppsCount = metrics.total_applications;
  const pendingScrutinyCount = (metrics.by_stage['SCRUTINY'] || 0) + (metrics.by_stage['RE_SCRUTINY'] || 0);
  const awaitingCorrectionsCount = metrics.by_stage['RETURNED_FOR_CLARIFICATION'] || metrics.returned || 0;
  const evcPendingCount = (metrics.by_stage['EVC_PENDING'] || 0) + (metrics.by_stage['EVC_SCHEDULED'] || 0);
  const awaitingDecisionCount = (metrics.by_stage['COMPLIANCE_PENDING'] || 0) + (metrics.by_stage['SAC_SHC_REVIEW'] || 0);

  // 2. Stage distribution ordering
  const stageOrder = [
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'SCRUTINY', label: 'Primary Scrutiny' },
    { key: 'RE_SCRUTINY', label: 'Re-Scrutiny' },
    { key: 'EVC_PENDING', label: 'EVC Pending' },
    { key: 'EVC_SCHEDULED', label: 'EVC Scheduled' },
    { key: 'EVC_COMPLETED', label: 'EVC Completed' },
    { key: 'SAC_SHC_REVIEW', label: 'SAC / SHC Review' },
    { key: 'COMPLIANCE_PENDING', label: 'Compliance Pending' },
    { key: 'COMPLETED', label: 'Completed Orders' },
    { key: 'RETURNED_FOR_CLARIFICATION', label: 'Returned for Clarification' }
  ];

  // 3. Priority Queue: Applications requiring urgent officer action
  const priorityQueue = applications.filter((app) => {
    if (user?.role === 'institution') {
      return app.current_stage === 'RETURNED_FOR_CLARIFICATION' || app.status === 'OVERDUE' || app.status === 'DRAFT';
    }
    return (
      app.status === 'OVERDUE' ||
      app.next_action?.urgency === 'OVERDUE' ||
      app.next_action?.urgency === 'APPROACHING_DEADLINE' ||
      app.next_action?.sla_urgency === 'P0_CRITICAL' ||
      app.next_action?.sla_urgency === 'P1_HIGH' ||
      app.current_stage === 'SCRUTINY' ||
      app.current_stage === 'EVC_PENDING'
    );
  }).slice(0, 6);

  // 4. Regional distribution map from real analytics
  const regionalWorkload = bottlenecks?.regional_workload || bottlenecks?.region_workload || {};
  const maxRegionCount = Math.max(1, ...Object.values(regionalWorkload));

  // Current session formatting
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="page-container" style={{ gap: 18 }}>
      {/* ====================================================================
          1. PAGE HEADER: Approval Operations (with date & jurisdictional context)
          ==================================================================== */}
      <div style={{
        background: 'var(--color-navy)',
        color: '#FFFFFF',
        borderRadius: 'var(--radius-md)',
        padding: '18px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle Indian Tricolor top ribbon */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: 'linear-gradient(90deg, #FF9933 0%, #FF9933 33.3%, #FFFFFF 33.3%, #FFFFFF 66.6%, #138808 66.6%, #138808 100%)'
        }} />

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: '0.08em',
              color: '#93C5FD',
              textTransform: 'uppercase',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-xs)',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}>
              AICTE APPROVAL OPERATIONS CONSOLE
            </span>
            <span style={{ fontSize: 10, color: '#94A3B8' }}>SIH26262 Decision Command Center</span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '2px 0 3px', color: '#FFFFFF' }}>
            Approval Operations — {user?.name}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: '#CBD5E1' }}>
            <span><b>Academic Year:</b> 2026–2027</span>
            <span>•</span>
            <span><b>Session Date:</b> {todayFormatted}</span>
            <span>•</span>
            <span>
              <b>Jurisdiction:</b> {user?.role === 'institution' ? user.institution_name : `${user?.region || 'National HQ'} Region`}
            </span>
            <span>•</span>
            <span>
              <b>Status:</b> Live Data ({lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onRefresh && (
            <button
              className="btn-secondary"
              style={{ background: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', borderColor: 'rgba(255, 255, 255, 0.2)', fontSize: 11 }}
              onClick={onRefresh}
              title="Refresh live metrics"
            >
              <RefreshCw size={13} className={loadingAnalytics ? 'spin' : ''} />
              <span>Refresh Metrics</span>
            </button>
          )}

          <button
            className="btn-primary"
            style={{ background: 'var(--color-action-blue)', borderColor: 'var(--color-action-blue)', fontSize: 11, padding: '7px 14px' }}
            onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
          >
            <span>Open Application Register</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. KPI ROW (5 Specific Decision Metrics - Navigates on click)
          ==================================================================== */}
      <div className="stats-grid">
        {/* Metric 1: Total Applications */}
        <div
          className="stat-card clickable"
          onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
          title="Click to view all registered applications"
        >
          <div className="stat-card-icon navy">
            <ClipboardList size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Total Applications</span>
            <span className="stat-value">{totalAppsCount}</span>
            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Registered under scope</small>
          </div>
        </div>

        {/* Metric 2: Pending Scrutiny */}
        <div
          className="stat-card clickable"
          onClick={() => handleFilterNav('Applications', 'SCRUTINY', 'ALL')}
          title="Click to filter applications currently in Primary or Re-Scrutiny"
        >
          <div className="stat-card-icon blue">
            <Clock size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Pending Scrutiny</span>
            <span className="stat-value">{pendingScrutinyCount}</span>
            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Primary ({metrics.by_stage['SCRUTINY'] || 0}) · Re-scrutiny ({metrics.by_stage['RE_SCRUTINY'] || 0})
            </small>
          </div>
        </div>

        {/* Metric 3: Awaiting Institution Corrections */}
        <div
          className="stat-card clickable"
          onClick={() => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')}
          title="Click to filter cases returned for institutional clarification"
        >
          <div className="stat-card-icon amber">
            <RotateCcw size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Awaiting Corrections</span>
            <span className="stat-value" style={{ color: awaitingCorrectionsCount > 0 ? '#b45309' : 'inherit' }}>
              {awaitingCorrectionsCount}
            </span>
            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Deficiency notices issued</small>
          </div>
        </div>

        {/* Metric 4: EVC Inspections Pending */}
        <div
          className="stat-card clickable"
          onClick={() => onNavigate('EVC Inspections')}
          title="Click to navigate to EVC Committee operations"
        >
          <div className="stat-card-icon purple">
            <Calendar size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">EVC Inspections Pending</span>
            <span className="stat-value">{evcPendingCount}</span>
            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Unscheduled ({metrics.by_stage['EVC_PENDING'] || 0}) · Scheduled ({metrics.by_stage['EVC_SCHEDULED'] || 0})
            </small>
          </div>
        </div>

        {/* Metric 5: Applications Awaiting Decision */}
        <div
          className="stat-card clickable"
          onClick={() => handleFilterNav('Applications', 'COMPLIANCE_PENDING', 'ALL')}
          title="Click to filter applications ready for formal approval orders"
        >
          <div className="stat-card-icon green">
            <CheckCircle2 size={20} />
          </div>
          <div className="stat-card-data">
            <span className="stat-label">Awaiting Decision</span>
            <span className="stat-value" style={{ color: '#047857' }}>{awaitingDecisionCount}</span>
            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              Compliance ({metrics.by_stage['COMPLIANCE_PENDING'] || 0}) · SAC ({metrics.by_stage['SAC_SHC_REVIEW'] || 0})
            </small>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. WORKLOAD & BOTTLENECK ANALYTICS (Stage Pipeline & Regional Balance)
          ==================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Left: Application Distribution by Workflow Stage */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>
                <Layers size={16} color="var(--color-navy)" />
                Workload Distribution by Regulatory Stage
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Click any stage bar to filter the application queue immediately
              </span>
            </div>
            <span className="badge badge-pending" style={{ fontSize: 10 }}>
              {totalAppsCount} Active Lifecycle Cases
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {stageOrder.map((stg) => {
              const count = metrics.by_stage[stg.key] || 0;
              const maxVal = Math.max(1, totalAppsCount);
              const pct = Math.round((count / maxVal) * 100);

              const isReturned = stg.key === 'RETURNED_FOR_CLARIFICATION';
              const isCompleted = stg.key === 'COMPLETED';
              const isBottleneck = count >= 2 && (stg.key === 'SCRUTINY' || stg.key === 'EVC_PENDING');

              return (
                <div
                  key={stg.key}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    background: isReturned ? '#FFFBEB' : (isCompleted ? '#ECFDF5' : '#F8FAFC'),
                    border: `1px solid ${isReturned ? '#FDE68A' : (isCompleted ? '#A7F3D0' : 'var(--border-subtle)')}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => handleFilterNav('Applications', stg.key, 'ALL')}
                  title={`Filter applications by stage: ${stg.label}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isReturned ? '#92400E' : (isCompleted ? '#065F46' : 'var(--text-primary)')
                      }}>
                        {stg.label}
                      </span>
                      {isBottleneck && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#FEF2F2', color: '#991B1B' }}>
                          BOTTLENECK
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <b style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{count}</b>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>({pct}%)</span>
                    </div>
                  </div>

                  <div style={{ width: '100%', height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: isReturned ? '#D97706' : (isCompleted ? '#059669' : 'var(--color-action-blue)'),
                        borderRadius: 3,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Regional Workload & Bottleneck Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Regional Workload */}
          <div className="panel-card" style={{ flex: 1 }}>
            <div className="panel-header">
              <div>
                <h3>
                  <Compass size={16} color="var(--color-navy)" />
                  Pending Workload by Region
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Jurisdictional application allocation across regional offices
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {Object.entries(regionalWorkload).length === 0 ? (
                <div style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  All current applications mapped to primary jurisdictional office.
                </div>
              ) : (
                Object.entries(regionalWorkload).map(([region, cnt]) => {
                  const pct = Math.round(((cnt as number) / maxRegionCount) * 100);
                  return (
                    <div key={region} style={{ fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 600 }}>{region} Region</span>
                        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{cnt as number} cases</b>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--color-navy)', borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ageing Applications & SLA Health */}
          <div className="panel-card" style={{ flex: 1 }}>
            <div className="panel-header">
              <div>
                <h3>
                  <Activity size={16} color="#DC2626" />
                  SLA Compliance & Ageing Intelligence
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Automated deadline adherence metrics under APH guidelines
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  SLA Compliance Rate
                </span>
                <div style={{ fontSize: 20, fontWeight: 700, color: (bottlenecks?.sla_compliance_rate || 0) < 90 ? '#D97706' : '#059669', marginTop: 2 }}>
                  {bottlenecks?.sla_compliance_rate ? `${bottlenecks.sla_compliance_rate}%` : '100%'}
                </div>
                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Target: ≥95.0%</small>
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                  SLA Breached Cases
                </span>
                <div style={{ fontSize: 20, fontWeight: 700, color: (metrics.overdue || 0) > 0 ? '#DC2626' : '#059669', marginTop: 2 }}>
                  {metrics.overdue || 0}
                </div>
                <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>Overdue for resolution</small>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. PRIORITY QUEUE: Applications Requiring Urgent Officer Action
          ==================================================================== */}
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>
              <AlertTriangle size={16} color="#D97706" />
              Priority Action Queue — Urgent Decision Attention
            </h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Cases with approaching deadlines, deficiency rectifications, or pending committee actions
            </span>
          </div>
          <button
            className="btn-secondary"
            style={{ fontSize: 11, padding: '5px 10px' }}
            onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
          >
            <span>View Full Queue ({applications.length})</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {priorityQueue.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#166534', background: '#F0FDF4', borderRadius: 'var(--radius-sm)', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={24} style={{ margin: '0 auto 6px' }} />
            <b style={{ display: 'block', fontSize: 13 }}>No urgent regulatory escalations pending</b>
            <span style={{ fontSize: 11, color: '#4B5563' }}>
              All applications under your jurisdiction are currently operating within prescribed SLA limits.
            </span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Reference</th>
                  <th>Institution & Region</th>
                  <th>Current Stage</th>
                  <th>Next Best Action</th>
                  <th>Ageing / Due</th>
                  <th style={{ textAlign: 'right' }}>Dossier</th>
                </tr>
              </thead>
              <tbody>
                {priorityQueue.map((app) => {
                  const isOverdue = app.status === 'OVERDUE' || app.next_action?.urgency === 'OVERDUE';
                  const isReturned = app.current_stage === 'RETURNED_FOR_CLARIFICATION';

                  return (
                    <tr key={app.id}>
                      <td>
                        <span style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 3,
                          background: isOverdue ? '#FEF2F2' : (isReturned ? '#FFFBEB' : '#EFF6FF'),
                          color: isOverdue ? '#991B1B' : (isReturned ? '#92400E' : '#1E40AF'),
                          border: `1px solid ${isOverdue ? '#FECACA' : (isReturned ? '#FDE68A' : '#BFDBFE')}`
                        }}>
                          {isOverdue ? 'CRITICAL SLA' : (isReturned ? 'DEFICIENCY NOTICE' : 'ACTION REQUIRED')}
                        </span>
                      </td>
                      <td>
                        <b style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-navy)', fontSize: 12 }}>
                          {app.reference}
                        </b>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>AY {app.academic_year}</small>
                      </td>
                      <td>
                        <b style={{ display: 'block', color: 'var(--text-primary)' }}>{app.institution_name}</b>
                        <small style={{ color: 'var(--text-muted)' }}>{app.region} Region · {app.application_type}</small>
                      </td>
                      <td>
                        <span className="badge badge-stage" style={{ fontSize: 9.5 }}>
                          {app.current_stage.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td>
                        {app.next_action ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-action-blue)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Sparkles size={11} /> {app.next_action.action_label}
                            </span>
                            <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              Assigned: {app.next_action.assigned_to}
                            </small>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Standard review</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: isOverdue ? '#DC2626' : 'var(--text-primary)', fontWeight: isOverdue ? 700 : 500 }}>
                          {app.due_date ? `Due: ${app.due_date}` : 'Within SLA'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {onSelectApplication && (
                          <button
                            className="btn-secondary"
                            style={{ padding: '5px 10px', fontSize: 11 }}
                            onClick={() => onSelectApplication(app)}
                          >
                            <Eye size={12} />
                            <span>Inspect</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ====================================================================
          5 & 6. LOWER TWO-COLUMN ROW: Recent Activity Stream + Quick Actions
          ==================================================================== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Recent Regulatory Activity Stream */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>
                <Clock size={16} color="var(--color-navy)" />
                Recent Regulatory Activity & Notifications
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Audited workflow milestones, scrutiny transitions, and alert events
              </span>
            </div>
            <button
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 8px' }}
              onClick={() => onNavigate('Alerts')}
            >
              <span>View All</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alerts.slice(0, 5).map((al) => (
              <div
                key={al.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: al.severity === 'CRITICAL' ? '#FEF2F2' : (al.severity === 'WARNING' ? '#FFFBEB' : '#F8FAFC'),
                  border: `1px solid ${al.severity === 'CRITICAL' ? '#FECACA' : (al.severity === 'WARNING' ? '#FDE68A' : 'var(--border-subtle)')}`,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10
                }}
              >
                <div style={{ marginTop: 2, flexShrink: 0 }}>
                  {al.severity === 'CRITICAL' ? (
                    <AlertTriangle size={15} color="#DC2626" />
                  ) : (
                    <Bell size={15} color="var(--color-action-blue)" />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <b style={{ fontSize: 12, color: 'var(--text-primary)' }}>{al.title}</b>
                    <small style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {al.message}
                  </p>
                </div>
              </div>
            ))}

            {alerts.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                No recent regulatory activity logged.
              </div>
            )}
          </div>
        </div>

        {/* Role-Aware Quick Actions */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <h3>
                <ShieldCheck size={16} color="var(--color-navy)" />
                Role-Aware Quick Operations
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Authorized regulatory actions for <b>{user?.role}</b> persona
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {user?.role === 'institution' && (
              <>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
                >
                  <Plus size={15} />
                  <span>Create Extension of Approval (EoA) Application</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('Compliance')}
                >
                  <FileCheck2 size={15} />
                  <span>Submit Statutory Compliance Proofs</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')}
                >
                  <RotateCcw size={15} />
                  <span>Address Scrutiny Deficiencies ({awaitingCorrectionsCount})</span>
                </button>
              </>
            )}

            {user?.role === 'officer' && (
              <>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => handleFilterNav('Applications', 'SCRUTINY', 'ALL')}
                >
                  <Clock size={15} />
                  <span>Review Pending Scrutiny Backlog ({pendingScrutinyCount} cases)</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('EVC Inspections')}
                >
                  <Calendar size={15} />
                  <span>Schedule Pending Committee Visits ({evcPendingCount})</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('Compliance')}
                >
                  <FileCheck2 size={15} />
                  <span>Verify Institutional Compliance Submissions</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('AI Assistant')}
                >
                  <Sparkles size={15} />
                  <span>Open AI Document Scrutiny Laboratory</span>
                </button>
              </>
            )}

            {user?.role === 'bureau' && (
              <>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => handleFilterNav('Applications', 'COMPLIANCE_PENDING', 'ALL')}
                >
                  <CheckCircle2 size={15} />
                  <span>Issue Statutory Approval Orders ({awaitingDecisionCount} ready)</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => handleFilterNav('Applications', 'SAC_SHC_REVIEW', 'ALL')}
                >
                  <Layers size={15} />
                  <span>Conduct Standing Appellate (SAC/SHC) Hearings</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('Reports')}
                >
                  <FileSpreadsheet size={15} />
                  <span>Export National Regulatory Compliance CSV</span>
                </button>
              </>
            )}

            {user?.role === 'evc_expert' && (
              <>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('EVC Inspections')}
                >
                  <Calendar size={15} />
                  <span>Inspect Assigned Inspection Portfolios</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('EVC Inspections')}
                >
                  <FileCheck2 size={15} />
                  <span>Submit Committee Inspection Recommendations</span>
                </button>
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <button
                  className="btn-primary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('Reports')}
                >
                  <Activity size={15} />
                  <span>Inspect Regulatory Bottleneck Intelligence</span>
                </button>
                <button
                  className="btn-secondary"
                  style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
                  onClick={() => onNavigate('Role Matrix')}
                >
                  <ShieldCheck size={15} />
                  <span>Review RBAC Jurisdictional Access Matrix</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
