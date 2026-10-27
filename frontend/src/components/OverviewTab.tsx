import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  RotateCcw,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Shield,
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  Eye,
  Search,
  Layers,
  Activity,
  FileCheck2,
  Sparkles,
  ChevronRight,
  Plus,
  Compass,
  FileSpreadsheet,
  Info,
  ExternalLink
} from 'lucide-react';
import { DashboardMetrics, User, Application, AlertItem, BottleneckAnalytics, AuditEvent } from '../types';
import { fetchBottleneckAnalytics, fetchRecentAuditEvents } from '../api';

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
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalytics | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Distinct academic years present in user's data
  const availableYears = useMemo(() => {
    const years = Array.from(new Set(applications.map((a) => a.academic_year).filter(Boolean)));
    return years.sort().reverse();
  }, [applications]);

  // Load secondary analytics and audit feed
  useEffect(() => {
    let isMounted = true;
    async function loadAuxiliaryData() {
      try {
        const [bnData, auditsData] = await Promise.allSettled([
          fetchBottleneckAnalytics(),
          fetchRecentAuditEvents(8)
        ]);
        if (isMounted) {
          if (bnData.status === 'fulfilled') setBottlenecks(bnData.value);
          if (auditsData.status === 'fulfilled' && auditsData.value) setRecentAudits(auditsData.value);
          setLastRefreshed(new Date());
        }
      } catch {
        // Soft fail
      }
    }
    loadAuxiliaryData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleManualRefresh() {
    setIsRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      const [bnData, auditsData] = await Promise.allSettled([
        fetchBottleneckAnalytics(),
        fetchRecentAuditEvents(8)
      ]);
      if (bnData.status === 'fulfilled') setBottlenecks(bnData.value);
      if (auditsData.status === 'fulfilled' && auditsData.value) setRecentAudits(auditsData.value);
      setLastRefreshed(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }

  function handleFilterNav(tab: string, stage: string = 'ALL', status: string = 'ALL') {
    if (onNavigateWithFilter) {
      onNavigateWithFilter(tab, stage, status);
    } else {
      onNavigate(tab);
    }
  }

  // Filter applications by selected academic year if chosen
  const filteredApps = useMemo(() => {
    if (selectedYear === 'ALL') return applications;
    return applications.filter((a) => a.academic_year === selectedYear);
  }, [applications, selectedYear]);

  // Calculate accurate, non-duplicated stage breakdown
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {
      SUBMITTED: 0,
      SCRUTINY: 0,
      RETURNED_FOR_CLARIFICATION: 0,
      RE_SCRUTINY: 0,
      EVC_PENDING: 0,
      EVC_SCHEDULED: 0,
      EVC_COMPLETED: 0,
      SAC_SHC_REVIEW: 0,
      COMPLIANCE_PENDING: 0,
      COMPLETED: 0
    };
    filteredApps.forEach((a) => {
      const stg = a.current_stage || 'SUBMITTED';
      counts[stg] = (counts[stg] || 0) + 1;
    });
    return counts;
  }, [filteredApps]);

  // 1. KPI Metrics
  const totalAppsCount = filteredApps.length;
  const pendingScrutinyCount = (stageCounts['SCRUTINY'] || 0) + (stageCounts['RE_SCRUTINY'] || 0);
  const awaitingCorrectionsCount = stageCounts['RETURNED_FOR_CLARIFICATION'] || 0;
  const pendingActionsCount =
    (stageCounts['EVC_PENDING'] || 0) +
    (stageCounts['EVC_SCHEDULED'] || 0) +
    (stageCounts['COMPLIANCE_PENDING'] || 0) +
    (stageCounts['SAC_SHC_REVIEW'] || 0);

  // 2. Regulatory Workflow Stages (Ordered by operational lifecycle)
  const REGULATORY_STAGES = [
    { key: 'SUBMITTED', label: 'Submitted', color: '#2563EB', isCompleted: false },
    { key: 'SCRUTINY', label: 'Primary Scrutiny', color: '#2563EB', isCompleted: false },
    { key: 'RETURNED_FOR_CLARIFICATION', label: 'Returned for Clarification', color: '#B45309', isCompleted: false },
    { key: 'RE_SCRUTINY', label: 'Re-Scrutiny', color: '#2563EB', isCompleted: false },
    { key: 'EVC_PENDING', label: 'EVC Inspection Pending', color: '#7C3AED', isCompleted: false },
    { key: 'EVC_SCHEDULED', label: 'EVC Inspection Scheduled', color: '#7C3AED', isCompleted: false },
    { key: 'EVC_COMPLETED', label: 'EVC Report Completed', color: '#4F46E5', isCompleted: false },
    { key: 'SAC_SHC_REVIEW', label: 'SAC / SHC Review', color: '#475569', isCompleted: false },
    { key: 'COMPLIANCE_PENDING', label: 'Compliance Pending', color: '#0D9488', isCompleted: false },
    { key: 'COMPLETED', label: 'Approved / Completed Orders', color: '#15803D', isCompleted: true }
  ];

  // 3. Work Requiring Attention (strictly calculated from persisted data)
  const today = new Date();
  const overdueApps = filteredApps.filter((a) => {
    if (a.status === 'COMPLETED' || a.status === 'REJECTED') return false;
    if (a.status === 'OVERDUE') return true;
    if (a.due_date) {
      return new Date(a.due_date) < today;
    }
    return false;
  });

  const dueSoonApps = filteredApps.filter((a) => {
    if (!a.due_date || a.status === 'COMPLETED' || a.status === 'REJECTED') return false;
    const due = new Date(a.due_date);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const returnedDeficiencyCount = stageCounts['RETURNED_FOR_CLARIFICATION'] || 0;
  const evcPendingCount = stageCounts['EVC_PENDING'] || 0;
  const evcScheduledCount = stageCounts['EVC_SCHEDULED'] || 0;
  const compliancePendingCount = metrics?.compliance_pending_count || 0;
  const decisionReadyCount = (stageCounts['COMPLIANCE_PENDING'] || 0) + (stageCounts['SAC_SHC_REVIEW'] || 0);

  const attentionItems = [
    {
      id: 'overdue',
      label: 'Overdue Applications',
      description: 'Dossiers that have breached prescribed statutory turnaround time',
      count: overdueApps.length,
      severity: 'danger' as const,
      onClick: () => handleFilterNav('Applications', 'ALL', 'OVERDUE')
    },
    {
      id: 'due_soon',
      label: 'Approaching Scrutiny / SLA Deadlines',
      description: 'Dossiers with statutory deadlines expiring within 7 days',
      count: dueSoonApps.length,
      severity: 'warning' as const,
      onClick: () => handleFilterNav('Applications', 'ALL', 'IN_PROGRESS')
    },
    {
      id: 'returned',
      label: 'Pending Institutional Clarifications',
      description: 'Applications returned for deficiency rectification and proof upload',
      count: returnedDeficiencyCount,
      severity: 'warning' as const,
      onClick: () => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')
    },
    {
      id: 'evc_schedule',
      label: 'Inspections Requiring Committee Scheduling',
      description: 'Scrutiny passed; committee composition and visit date pending',
      count: evcPendingCount,
      severity: 'info' as const,
      onClick: () => onNavigate('EVC Inspections')
    },
    {
      id: 'evc_report',
      label: 'Inspections Awaiting Committee Reports',
      description: 'Physical/virtual visits conducted; formal report submission pending',
      count: evcScheduledCount,
      severity: 'neutral' as const,
      onClick: () => onNavigate('EVC Inspections')
    },
    {
      id: 'compliance',
      label: 'Statutory Compliance Proofs Due',
      description: 'Conditional undertakings and post-approval compliance submissions',
      count: compliancePendingCount,
      severity: 'warning' as const,
      onClick: () => onNavigate('Compliance')
    },
    {
      id: 'decision',
      label: 'Applications Awaiting Final Decision',
      description: 'Compliance verified or SAC hearings concluded; ready for order',
      count: decisionReadyCount,
      severity: 'success' as const,
      onClick: () => handleFilterNav('Applications', 'COMPLIANCE_PENDING', 'ALL')
    }
  ];

  const totalAttentionCount = attentionItems.reduce((acc, item) => acc + item.count, 0);

  // 4. Priority Queue (Sorted by actual urgency)
  const priorityQueue = useMemo(() => {
    const list = [...filteredApps];
    return list
      .sort((a, b) => {
        const aOverdue = a.status === 'OVERDUE' || (a.due_date && new Date(a.due_date) < today);
        const bOverdue = b.status === 'OVERDUE' || (b.due_date && new Date(b.due_date) < today);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        const aUrgent =
          a.next_action?.urgency === 'OVERDUE' ||
          a.next_action?.sla_urgency === 'P0_CRITICAL' ||
          a.current_stage === 'RETURNED_FOR_CLARIFICATION';
        const bUrgent =
          b.next_action?.urgency === 'OVERDUE' ||
          b.next_action?.sla_urgency === 'P0_CRITICAL' ||
          b.current_stage === 'RETURNED_FOR_CLARIFICATION';
        if (aUrgent && !bUrgent) return -1;
        if (!aUrgent && bUrgent) return 1;

        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return b.id - a.id;
      })
      .slice(0, 8);
  }, [filteredApps, today]);

  // Jurisdiction badge text
  const jurisdictionLabel = useMemo(() => {
    if (user?.role === 'institution') {
      return user.institution_name || 'Institution Applicant';
    }
    if (user?.role === 'evc_expert') {
      return `Inspection Panel (${user.region || 'National'})`;
    }
    if (user?.region && user.region !== 'HQ') {
      return `${user.region} Regional Jurisdiction`;
    }
    return 'National HQ — All Jurisdictions';
  }, [user]);

  // Loading skeleton state
  if (!metrics) {
    return (
      <div className="page-container" style={{ gap: 16 }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ height: 16, width: 140, background: '#E2E8F0', borderRadius: 4 }} />
          <div style={{ height: 26, width: 260, background: '#F1F5F9', borderRadius: 4 }} />
          <div style={{ height: 14, width: 440, background: '#F8FAFC', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 104, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ gap: 20 }}>
      {/* ====================================================================
          A. COMPACT APPLICATION HEADER (Government-Grade Enterprise Style)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
      }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#64748B', marginBottom: 2 }}>
            <span>Operations</span>
            <span style={{ color: '#CBD5E1' }}>/</span>
            <span style={{ color: '#172B4D', fontWeight: 600 }}>Dashboard</span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            margin: '2px 0 3px',
            color: '#172B4D',
            letterSpacing: '-0.01em'
          }}>
            Regulatory Operations
          </h1>

          {/* Supporting description */}
          <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
            Monitor application scrutiny, institutional compliance, inspections, and pending decisions.
          </p>
        </div>

        {/* Right header controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Academic Year Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label htmlFor="ay-select" style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
              Academic Year:
            </label>
            <select
              id="ay-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#172B4D',
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Academic Years</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  AY {yr}
                </option>
              ))}
            </select>
          </div>

          {/* Jurisdiction indicator */}
          <div
            title={`Authorized jurisdiction scope for ${user?.email || 'authenticated user'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#F1F5F9',
              border: '1px solid #E2E8F0',
              fontSize: 12,
              fontWeight: 600,
              color: '#1E293B'
            }}
          >
            <Shield size={13} color="#2563EB" />
            <span>{jurisdictionLabel}</span>
          </div>

          {/* Refresh action */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              color: '#172B4D',
              fontSize: 12,
              fontWeight: 600,
              cursor: isRefreshing ? 'wait' : 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Refresh live metrics from backend"
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Last updated timestamp */}
          <span style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ====================================================================
          B. FOUR PRIMARY KPI CARDS (Single Responsive Row)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16
      }}>
        {/* KPI 1: Total Applications */}
        <div
          onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
          title="Click to view full application register"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Total Applications</span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={16} color="#172B4D" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#172B4D', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {totalAppsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748B' }}>
            <span>In authorized jurisdiction</span>
            <span style={{ color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              View <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 2: Pending Scrutiny */}
        <div
          onClick={() => handleFilterNav('Applications', 'SCRUTINY', 'ALL')}
          title="Click to filter applications in Primary or Re-Scrutiny"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Pending Scrutiny</span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={16} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#172B4D', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pendingScrutinyCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748B' }}>
            <span>Primary ({stageCounts['SCRUTINY'] || 0}) · Re-scrutiny ({stageCounts['RE_SCRUTINY'] || 0})</span>
            <span style={{ color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Filter <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 3: Awaiting Institution Response */}
        <div
          onClick={() => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')}
          title="Click to filter applications returned for clarification"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Awaiting Institution Response</span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={16} color="#B45309" />
            </div>
          </div>
          <div style={{
            fontSize: 30,
            fontWeight: 700,
            color: awaitingCorrectionsCount > 0 ? '#B45309' : '#172B4D',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1
          }}>
            {awaitingCorrectionsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748B' }}>
            <span>Deficiency clarification issued</span>
            <span style={{ color: '#B45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Review <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 4: Pending Action / Decisions */}
        <div
          onClick={() => handleFilterNav('Applications', 'COMPLIANCE_PENDING', 'ALL')}
          title="Click to filter applications awaiting inspection, compliance, or decision"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'border-color 0.15s, box-shadow 0.15s',
            boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Pending Action</span>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: '#F5F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={16} color="#7C3AED" />
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, color: '#172B4D', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {pendingActionsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: '#64748B' }}>
            <span>
              EVC ({evcPendingCount + evcScheduledCount}) · Compliance ({stageCounts['COMPLIANCE_PENDING'] || 0}) · SAC ({stageCounts['SAC_SHC_REVIEW'] || 0})
            </span>
            <span style={{ color: '#7C3AED', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Open <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          C. MAIN OPERATIONAL AREA (~60% Left Workflow, ~40% Right Attention)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
        gap: 20
      }} className="main-operational-split">
        {/* Left Panel: Application Workflow */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#172B4D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Layers size={16} color="#2563EB" />
                Application Workflow
              </h2>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Breakdown of applications across statutory regulatory stages
              </span>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: 4,
              background: '#F1F5F9',
              color: '#475569',
              border: '1px solid #E2E8F0'
            }}>
              {totalAppsCount} Active Dossiers
            </span>
          </div>

          {/* Workflow Stage Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REGULATORY_STAGES.map((stg) => {
              const count = stageCounts[stg.key] || 0;
              const pct = totalAppsCount > 0 ? Math.round((count / totalAppsCount) * 100) : 0;
              const isReturned = stg.key === 'RETURNED_FOR_CLARIFICATION';

              return (
                <div
                  key={stg.key}
                  onClick={() => handleFilterNav('Applications', stg.key, 'ALL')}
                  title={`Filter applications in stage: ${stg.label}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: isReturned && count > 0 ? '#FFFBEB' : stg.isCompleted && count > 0 ? '#F0FDF4' : '#F8FAFC',
                    border: `1px solid ${isReturned && count > 0 ? '#FDE68A' : stg.isCompleted && count > 0 ? '#BBF7D0' : '#E2E8F0'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  className="workflow-stage-row"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: count > 0 ? stg.color : '#CBD5E1',
                        display: 'inline-block'
                      }} />
                      <span style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: count > 0 ? '#172B4D' : '#64748B'
                      }}>
                        {stg.label}
                      </span>
                      {stg.isCompleted && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#DCFCE7', color: '#15803D' }}>
                          FINAL ORDER
                        </span>
                      )}
                      {isReturned && count > 0 && (
                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: '#FEF3C7', color: '#B45309' }}>
                          DEFICIENCY
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <b style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums', color: count > 0 ? '#172B4D' : '#94A3B8' }}>
                        {count}
                      </b>
                      <span style={{ fontSize: 11, color: '#94A3B8', width: 34, textAlign: 'right' }}>
                        {pct}%
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Progress Bar */}
                  <div style={{ width: '100%', height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: stg.color,
                        borderRadius: 2,
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Work Requiring Attention */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#172B4D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={16} color="#B45309" />
                Work Requiring Attention
              </h2>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Actionable deadlines and pending supervisory steps
              </span>
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 4,
              background: totalAttentionCount > 0 ? '#FEF2F2' : '#F0FDF4',
              color: totalAttentionCount > 0 ? '#B91C1C' : '#15803D',
              border: `1px solid ${totalAttentionCount > 0 ? '#FECACA' : '#BBF7D0'}`
            }}>
              {totalAttentionCount} Actionable Items
            </span>
          </div>

          {/* Attention Items List */}
          {totalAttentionCount === 0 ? (
            <div style={{
              padding: '28px 16px',
              textAlign: 'center',
              background: '#F0FDF4',
              borderRadius: 6,
              border: '1px solid #BBF7D0',
              margin: 'auto 0'
            }}>
              <CheckCircle2 size={24} color="#15803D" style={{ margin: '0 auto 8px' }} />
              <b style={{ display: 'block', fontSize: 13, color: '#15803D' }}>
                No urgent actions in your current workload
              </b>
              <span style={{ fontSize: 12, color: '#4B5563' }}>
                All applications under your authorized scope are currently within statutory parameters.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {attentionItems.map((item) => {
                const badgeBg =
                  item.severity === 'danger'
                    ? item.count > 0 ? '#FEF2F2' : '#F8FAFC'
                    : item.severity === 'warning'
                    ? item.count > 0 ? '#FFFBEB' : '#F8FAFC'
                    : item.severity === 'success'
                    ? item.count > 0 ? '#F0FDF4' : '#F8FAFC'
                    : '#F1F5F9';

                const badgeColor =
                  item.severity === 'danger'
                    ? item.count > 0 ? '#B91C1C' : '#94A3B8'
                    : item.severity === 'warning'
                    ? item.count > 0 ? '#B45309' : '#94A3B8'
                    : item.severity === 'success'
                    ? item.count > 0 ? '#15803D' : '#94A3B8'
                    : '#475569';

                const badgeBorder =
                  item.severity === 'danger' && item.count > 0
                    ? '#FECACA'
                    : item.severity === 'warning' && item.count > 0
                    ? '#FDE68A'
                    : item.severity === 'success' && item.count > 0
                    ? '#BBF7D0'
                    : '#E2E8F0';

                return (
                  <div
                    key={item.id}
                    onClick={item.onClick}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s'
                    }}
                    className="attention-row-hover"
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#172B4D' }}>
                          {item.label}
                        </span>
                      </div>
                      <small style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 1 }}>
                        {item.description}
                      </small>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: badgeBg,
                        color: badgeColor,
                        border: `1px solid ${badgeBorder}`,
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {item.count}
                      </span>
                      <ChevronRight size={14} color="#94A3B8" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================
          D. PRIORITY APPLICATION QUEUE (Primary Decision Workhorse)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 8,
        padding: '18px 20px',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid #F1F5F9',
          flexWrap: 'wrap',
          gap: 8
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#172B4D', margin: 0 }}>
              Priority Actions
            </h2>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Applications requiring the next action in your authorized workload
            </span>
          </div>
          <button
            onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: '#2563EB',
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              padding: '4px 6px'
            }}
          >
            <span>View all applications ({totalAppsCount})</span>
            <ArrowRight size={13} />
          </button>
        </div>

        {priorityQueue.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No priority applications pending action in current scope.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Priority</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Application ID</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Institution</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Application Type</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Current Stage</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Pending Action</th>
                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: 11 }}>Due Date</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#475569', fontSize: 11 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {priorityQueue.map((app) => {
                  const isOverdue = app.status === 'OVERDUE' || (app.due_date && new Date(app.due_date) < today && app.status !== 'COMPLETED');
                  const isDueSoon = app.due_date && !isOverdue && new Date(app.due_date).getTime() - today.getTime() <= 7 * 86400000;
                  const isReturned = app.current_stage === 'RETURNED_FOR_CLARIFICATION';

                  let priorityBadge = { label: 'Normal', bg: '#F1F5F9', color: '#475569', border: '#E2E8F0' };
                  if (isOverdue) {
                    priorityBadge = { label: 'High', bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' };
                  } else if (isDueSoon || isReturned) {
                    priorityBadge = { label: 'Medium', bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' };
                  }

                  // Context-sensitive action button text
                  let actionText = 'Review Dossier';
                  if (app.current_stage === 'SCRUTINY') actionText = 'Review Scrutiny';
                  else if (app.current_stage === 'RE_SCRUTINY') actionText = 'Review Resubmission';
                  else if (app.current_stage === 'RETURNED_FOR_CLARIFICATION') {
                    actionText = user?.role === 'institution' ? 'Submit Clarification' : 'View Deficiency';
                  } else if (app.current_stage === 'EVC_PENDING') actionText = 'Schedule EVC';
                  else if (app.current_stage === 'EVC_SCHEDULED') actionText = 'Upload Report';
                  else if (app.current_stage === 'COMPLIANCE_PENDING') actionText = 'Verify Proofs';

                  const pendingActionLabel =
                    app.next_action?.action_label ||
                    (app.current_stage === 'SCRUTINY'
                      ? 'Conduct Primary Scrutiny'
                      : app.current_stage === 'RE_SCRUTINY'
                      ? 'Verify Rectified Documents'
                      : app.current_stage === 'RETURNED_FOR_CLARIFICATION'
                      ? 'Awaiting Institutional Response'
                      : app.current_stage === 'EVC_PENDING'
                      ? 'Form Committee & Schedule Visit'
                      : app.current_stage === 'EVC_SCHEDULED'
                      ? 'Conduct Inspection & Submit Report'
                      : app.current_stage === 'COMPLIANCE_PENDING'
                      ? 'Statutory Proof Verification'
                      : 'Regulatory Review');

                  return (
                    <tr
                      key={app.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background 0.1s' }}
                      className="priority-row-hover"
                    >
                      {/* Priority */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: priorityBadge.bg,
                          color: priorityBadge.color,
                          border: `1px solid ${priorityBadge.border}`,
                          textTransform: 'uppercase'
                        }}>
                          {priorityBadge.label}
                        </span>
                      </td>

                      {/* Application ID */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: '#172B4D' }}>
                          {app.reference}
                        </span>
                        <small style={{ display: 'block', fontSize: 11, color: '#94A3B8' }}>
                          AY {app.academic_year}
                        </small>
                      </td>

                      {/* Institution */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 600, color: '#172B4D', display: 'block' }}>
                          {app.institution_name}
                        </span>
                        <small style={{ fontSize: 11, color: '#64748B' }}>
                          {app.region} Region
                        </small>
                      </td>

                      {/* Application Type */}
                      <td style={{ padding: '10px 12px', color: '#475569' }}>
                        {app.application_type}
                      </td>

                      {/* Current Stage */}
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: '#F1F5F9',
                          color: '#334155',
                          border: '1px solid #E2E8F0'
                        }}>
                          {app.current_stage.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Pending Action */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#2563EB', fontSize: 12 }}>
                            {pendingActionLabel}
                          </span>
                          <small style={{ fontSize: 10.5, color: '#64748B' }}>
                            {app.next_action?.assigned_to || app.assigned_to || 'Assigned Officer'}
                          </small>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td style={{ padding: '10px 12px', fontVariantNumeric: 'tabular-nums' }}>
                        {app.due_date ? (
                          <span style={{
                            color: isOverdue ? '#B91C1C' : isDueSoon ? '#B45309' : '#475569',
                            fontWeight: isOverdue || isDueSoon ? 700 : 500
                          }}>
                            {new Date(app.due_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>—</span>
                        )}
                      </td>

                      {/* Row Action */}
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          onClick={() => onSelectApplication && onSelectApplication(app)}
                          style={{
                            padding: '5px 10px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            borderRadius: 5,
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            color: '#172B4D',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5
                          }}
                          className="btn-action-hover"
                        >
                          <Eye size={12} color="#2563EB" />
                          <span>{actionText}</span>
                        </button>
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
          E & F. LOWER SECTION: Recent Regulatory Activity & Regional Workload
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
        gap: 20
      }} className="main-operational-split">
        {/* E. Recent Activity Feed */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: '1px solid #F1F5F9'
          }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 600, color: '#172B4D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={16} color="#2563EB" />
                Recent Regulatory Activity
              </h2>
              <span style={{ fontSize: 12, color: '#64748B' }}>
                Audited workflow milestones, scrutiny transitions, and notifications
              </span>
            </div>
            <button
              onClick={() => onNavigate('Alerts')}
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: '#2563EB',
                background: 'transparent',
                border: 0,
                cursor: 'pointer'
              }}
            >
              View Alerts Log →
            </button>
          </div>

          {/* Activity Feed Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentAudits.length > 0 ? (
              recentAudits.slice(0, 6).map((aud) => {
                const appObj = applications.find((a) => a.id === aud.application_id);
                const ref = aud.application_reference || appObj?.reference || `Application #${aud.application_id}`;

                let actionIcon = <Clock size={14} color="#2563EB" />;
                if (aud.action.includes('DECISION') || aud.action.includes('COMPLIANCE')) {
                  actionIcon = <CheckCircle2 size={14} color="#15803D" />;
                } else if (aud.action.includes('RETURN') || aud.action.includes('DEFICIENCY')) {
                  actionIcon = <RotateCcw size={14} color="#B45309" />;
                } else if (aud.action.includes('EVC')) {
                  actionIcon = <Calendar size={14} color="#7C3AED" />;
                } else if (aud.action.includes('SCRUTINY')) {
                  actionIcon = <Search size={14} color="#2563EB" />;
                }

                return (
                  <div
                    key={aud.id}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10
                    }}
                  >
                    <div style={{ marginTop: 2, flexShrink: 0 }}>
                      {actionIcon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#172B4D' }}>
                            {aud.action.replace(/_/g, ' ')}
                          </span>
                          {appObj && onSelectApplication ? (
                            <button
                              onClick={() => onSelectApplication(appObj)}
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#2563EB',
                                background: '#EFF6FF',
                                border: '1px solid #BFDBFE',
                                borderRadius: 3,
                                padding: '1px 5px',
                                cursor: 'pointer'
                              }}
                              title="Click to view application dossier"
                            >
                              {ref}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748B' }}>({ref})</span>
                          )}
                        </div>
                        <small style={{ fontSize: 11, color: '#94A3B8' }}>
                          {new Date(aud.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </small>
                      </div>

                      <p style={{ margin: '3px 0 0', fontSize: 11.5, color: '#475569', lineHeight: 1.4 }}>
                        {aud.details || 'Workflow transition recorded in tamper-evident audit ledger.'}
                      </p>

                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#64748B' }}>
                        <span>Actor: <b>{aud.actor}</b> ({aud.actor_role})</span>
                        {aud.from_stage && aud.to_stage && (
                          <span>
                            Transition: <span style={{ color: '#2563EB' }}>{aud.from_stage}</span> → <span style={{ color: '#15803D' }}>{aud.to_stage}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : alerts.length > 0 ? (
              alerts.slice(0, 5).map((al) => (
                <div
                  key={al.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 6,
                    background: al.severity === 'CRITICAL' ? '#FEF2F2' : al.severity === 'WARNING' ? '#FFFBEB' : '#F8FAFC',
                    border: `1px solid ${al.severity === 'CRITICAL' ? '#FECACA' : al.severity === 'WARNING' ? '#FDE68A' : '#E2E8F0'}`,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10
                  }}
                >
                  <div style={{ marginTop: 2, flexShrink: 0 }}>
                    {al.severity === 'CRITICAL' ? (
                      <AlertTriangle size={15} color="#B91C1C" />
                    ) : (
                      <Clock size={15} color="#2563EB" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: 12, color: '#172B4D' }}>{al.title}</b>
                      <small style={{ fontSize: 10.5, color: '#94A3B8' }}>
                        {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: '#475569', lineHeight: 1.35 }}>
                      {al.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                No recent regulatory events logged for authorized jurisdiction.
              </div>
            )}
          </div>
        </div>

        {/* F. Regional Jurisdiction Workload or Regional Office Status */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 8,
          padding: '18px 20px',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {user?.role === 'bureau' || user?.role === 'admin' || !user?.region || user?.region === 'HQ' ? (
            // Multi-region National View
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: '1px solid #F1F5F9'
              }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: '#172B4D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Compass size={16} color="#2563EB" />
                    Regional Workload Distribution
                  </h2>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Active applications mapped across AICTE regional offices
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(bottlenecks?.region_workload || {}).length === 0 ? (
                  <div style={{ padding: 18, textAlign: 'center', color: '#64748B', fontSize: 12 }}>
                    Regional distribution metrics updating from regional databases...
                  </div>
                ) : (
                  Object.entries(bottlenecks?.region_workload || {}).map(([region, cnt]) => {
                    const maxVal = Math.max(1, ...Object.values(bottlenecks?.region_workload || {}));
                    const pct = Math.round(((cnt as number) / maxVal) * 100);
                    return (
                      <div key={region} style={{ fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, color: '#172B4D' }}>{region} Region</span>
                          <b style={{ fontVariantNumeric: 'tabular-nums', color: '#172B4D' }}>{cnt as number} dossiers</b>
                        </div>
                        <div style={{ width: '100%', height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: '#2563EB', borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            // Single-Region Officer View
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 14,
                paddingBottom: 10,
                borderBottom: '1px solid #F1F5F9'
              }}>
                <div>
                  <h2 style={{ fontSize: 15, fontWeight: 600, color: '#172B4D', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Shield size={16} color="#2563EB" />
                    Jurisdictional Office Status
                  </h2>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    Operational overview for {user?.region} Regional Office
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{
                  background: '#F8FAFC',
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                      Assigned Applications
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#172B4D', marginTop: 2 }}>
                      {totalAppsCount}
                    </div>
                  </div>
                  <Building2 size={24} color="#94A3B8" />
                </div>

                <div style={{
                  background: '#F8FAFC',
                  padding: '12px 14px',
                  borderRadius: 6,
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                      SLA Compliance Rate
                    </span>
                    <div style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: overdueApps.length > 0 ? '#B45309' : '#15803D',
                      marginTop: 2
                    }}>
                      {totalAppsCount > 0
                        ? `${Math.round(((totalAppsCount - overdueApps.length) / totalAppsCount) * 100)}%`
                        : '100%'}
                    </div>
                  </div>
                  <Activity size={24} color={overdueApps.length > 0 ? '#B45309' : '#15803D'} />
                </div>

                <div style={{ fontSize: 11.5, color: '#64748B', lineHeight: 1.4 }}>
                  Operating under AICTE Approval Process Handbook (APH 2024–2027) norms for {user?.region} regional jurisdiction.
                </div>
              </div>
            </>
          )}

          {/* Quick Nav Actions */}
          <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onNavigate('Compliance')}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 5,
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#172B4D',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <FileCheck2 size={13} color="#2563EB" />
              <span>Compliance</span>
            </button>
            <button
              onClick={() => onNavigate('EVC Inspections')}
              style={{
                flex: 1,
                padding: '7px 10px',
                fontSize: 11.5,
                fontWeight: 600,
                borderRadius: 5,
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                color: '#172B4D',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5
              }}
            >
              <Calendar size={13} color="#7C3AED" />
              <span>EVC Inspections</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
