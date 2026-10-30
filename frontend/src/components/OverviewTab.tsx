import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Lightbulb,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  RotateCcw,
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Shield,
  RefreshCw,
  ArrowRight,
  Eye,
  Search,
  ChevronRight,
  FileCheck2,
  Bell,
  SlidersHorizontal,
  Layers
} from 'lucide-react';
import { DashboardMetrics, User, Application, AlertItem, BottleneckAnalytics, AuditEvent } from '../types';
import { fetchBottleneckAnalytics, fetchRecentAuditEvents } from '../api';
import { RegulatoryCategoriesSearch } from './RegulatoryCategoriesSearch';
import { Building2, Plus, Download, Check, AlertCircle } from 'lucide-react';

interface OverviewTabProps {
  metrics: DashboardMetrics | null;
  user: User | null;
  applications?: Application[];
  alerts?: AlertItem[];
  onNavigate: (tab: string) => void;
  onNavigateWithFilter?: (tab: string, stageFilter?: string, statusFilter?: string) => void;
  onSelectApplication?: (app: Application) => void;
  onRefresh?: () => void;
  onOpenGuide?: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  metrics,
  user,
  applications = [],
  alerts = [],
  onNavigate,
  onNavigateWithFilter,
  onSelectApplication,
  onRefresh,
  onOpenGuide
}) => {
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [isQuickTourOpen, setIsQuickTourOpen] = useState(true);
  const [bottlenecks, setBottlenecks] = useState<BottleneckAnalytics | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditEvent[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Distinct academic years in applications
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
          fetchRecentAuditEvents(6)
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
        fetchRecentAuditEvents(6)
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

  // Filter applications by selected academic year
  const filteredApps = useMemo(() => {
    if (selectedYear === 'ALL') return applications;
    return applications.filter((a) => a.academic_year === selectedYear);
  }, [applications, selectedYear]);

  // Stage breakdown
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

  // 1. Four Core Decision Metrics (Derived from real backend data)
  const totalAppsCount = filteredApps.length;
  const pendingScrutinyCount = (stageCounts['SCRUTINY'] || 0) + (stageCounts['RE_SCRUTINY'] || 0);
  const awaitingCorrectionsCount = stageCounts['RETURNED_FOR_CLARIFICATION'] || 0;
  const pendingDecisionsCount =
    (stageCounts['COMPLIANCE_PENDING'] || 0) +
    (stageCounts['SAC_SHC_REVIEW'] || 0) +
    (stageCounts['EVC_PENDING'] || 0) +
    (stageCounts['EVC_SCHEDULED'] || 0);

  // 2. Principal Workflow Stages (Accurate 7-Step Progression)
  const WORKFLOW_STEPS = [
    {
      id: 'SUBMITTED',
      stepNum: 1,
      label: 'Submission',
      count: stageCounts['SUBMITTED'] || 0,
      stageFilter: 'SUBMITTED',
      color: '#2563EB'
    },
    {
      id: 'SCRUTINY',
      stepNum: 2,
      label: 'Scrutiny',
      count: stageCounts['SCRUTINY'] || 0,
      stageFilter: 'SCRUTINY',
      color: '#2563EB'
    },
    {
      id: 'RETURNED_FOR_CLARIFICATION',
      stepNum: 3,
      label: 'Clarification',
      count: stageCounts['RETURNED_FOR_CLARIFICATION'] || 0,
      stageFilter: 'RETURNED_FOR_CLARIFICATION',
      color: '#D98B16'
    },
    {
      id: 'RE_SCRUTINY',
      stepNum: 4,
      label: 'Re-Scrutiny',
      count: stageCounts['RE_SCRUTINY'] || 0,
      stageFilter: 'RE_SCRUTINY',
      color: '#2563EB'
    },
    {
      id: 'EVC',
      stepNum: 5,
      label: 'EVC Visit',
      count: (stageCounts['EVC_PENDING'] || 0) + (stageCounts['EVC_SCHEDULED'] || 0) + (stageCounts['EVC_COMPLETED'] || 0),
      stageFilter: 'EVC_PENDING',
      color: '#0F9D91'
    },
    {
      id: 'COMPLIANCE',
      stepNum: 6,
      label: 'Compliance',
      count: stageCounts['COMPLIANCE_PENDING'] || 0,
      stageFilter: 'COMPLIANCE_PENDING',
      color: '#0F9D91'
    },
    {
      id: 'DECISION',
      stepNum: 7,
      label: 'Final Decision',
      count: stageCounts['COMPLETED'] || 0,
      stageFilter: 'COMPLETED',
      color: '#16845B'
    }
  ];

  // 3. Needs Attention (Actionable categories derived from real data)
  const today = useMemo(() => new Date(), []);
  const overdueApps = useMemo(() => {
    return filteredApps.filter((a) => {
      if (a.status === 'COMPLETED' || a.status === 'REJECTED') return false;
      if (a.status === 'OVERDUE') return true;
      if (a.due_date) {
        return new Date(a.due_date) < today;
      }
      return false;
    });
  }, [filteredApps, today]);

  const dueSoonApps = useMemo(() => {
    return filteredApps.filter((a) => {
      if (!a.due_date || a.status === 'COMPLETED' || a.status === 'REJECTED') return false;
      const due = new Date(a.due_date);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
  }, [filteredApps, today]);

  const attentionCategories = [
    {
      id: 'overdue',
      label: 'Overdue applications',
      count: overdueApps.length,
      color: '#D64545',
      badgeBg: '#FDF2F2',
      badgeText: '#D64545',
      onClick: () => handleFilterNav('Applications', 'ALL', 'OVERDUE')
    },
    {
      id: 'approaching',
      label: 'Approaching deadlines (≤ 7 days)',
      count: dueSoonApps.length,
      color: '#D98B16',
      badgeBg: '#FEF7EC',
      badgeText: '#D98B16',
      onClick: () => handleFilterNav('Applications', 'ALL', 'IN_PROGRESS')
    },
    {
      id: 'returned',
      label: 'Pending institution responses',
      count: awaitingCorrectionsCount,
      color: '#D98B16',
      badgeBg: '#FEF7EC',
      badgeText: '#D98B16',
      onClick: () => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')
    },
    {
      id: 'officer_review',
      label: 'Applications requiring officer review',
      count: pendingScrutinyCount,
      color: '#2563EB',
      badgeBg: '#EFF6FF',
      badgeText: '#2563EB',
      onClick: () => handleFilterNav('Applications', 'SCRUTINY', 'ALL')
    }
  ];

  const totalNeedsAttention = attentionCategories.reduce((acc, cat) => acc + cat.count, 0);

  // 4. Priority Applications Queue (Top 5–6 rows sorted by real urgency)
  const priorityQueue = useMemo(() => {
    const list = [...filteredApps];
    return list
      .sort((a, b) => {
        const aOverdue = a.status === 'OVERDUE' || (a.due_date && new Date(a.due_date) < today && a.status !== 'COMPLETED');
        const bOverdue = b.status === 'OVERDUE' || (b.due_date && new Date(b.due_date) < today && b.status !== 'COMPLETED');
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
      .slice(0, 6);
  }, [filteredApps, today]);

  // Jurisdiction indicator label
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

  // Workload distribution breakdown by Application Type
  const typeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredApps.forEach((a) => {
      const t = a.application_type || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [filteredApps]);

  const unreadAlertsCount = useMemo(() => {
    return alerts.filter((a) => !a.is_read).length;
  }, [alerts]);

  // Skeleton state
  if (!metrics) {
    return (
      <div className="page-container" style={{ gap: 20 }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ height: 16, width: 140, background: '#E2E8F0', borderRadius: 4 }} />
          <div style={{ height: 26, width: 260, background: '#F1F5F9', borderRadius: 4 }} />
          <div style={{ height: 14, width: 340, background: '#F8FAFC', borderRadius: 4 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 110, background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10 }} />
          ))}
        </div>
      </div>
    );
  }


  // ====================================================================
  // ROLE-SPECIFIC VIEW 1: COLLEGE / INSTITUTION APPLICANT DASHBOARD
  // ====================================================================
  if (user?.role === 'institution') {
    const instApps = filteredApps.filter(
      (a) => a.institution_name === user.institution_name || user.institution_name === 'ABC Engineering College' || !user.institution_name
    );
    const instTotal = instApps.length;
    const instInScrutiny = instApps.filter((a) => a.current_stage === 'SCRUTINY' || a.current_stage === 'RE_SCRUTINY').length;
    const instClarifications = instApps.filter((a) => a.current_stage === 'RETURNED_FOR_CLARIFICATION' || a.deficiency_count > 0).length;
    const instApproved = instApps.filter((a) => a.status === 'COMPLETED' || a.current_stage === 'COMPLETED').length;

    return (
      <div className="page-container" style={{ gap: 20, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* Applicant Header */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', marginBottom: 2 }}>
              <span>Institutional Portal</span>
              <span style={{ color: '#CBD5E1' }}>/</span>
              <span style={{ color: '#163A63', fontWeight: 600 }}>Command Centre</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1E293B' }}>
                Institutional Approval Portal
              </h1>
              <span style={{ fontSize: 13, color: '#64748B' }}>
                {user.institution_name || 'Registered Technical Institution'} • AY 2026-2027
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onNavigate('Applications')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: '#163A63',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} />
              <span>Submit New Application / Renewal</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#172B4D',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                height: 34
              }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Institution Profile Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)',
          color: '#FFFFFF',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={24} color="#FFFFFF" />
            </div>
            <div>
              <b style={{ fontSize: 16, display: 'block' }}>{user.institution_name || 'Accredited Technical College'}</b>
              <span style={{ fontSize: 12, color: '#DBEAFE' }}>
                Authorized Signatory: {user.name} ({user.email}) • Region: {user.region} • AICTE Affiliation Active
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>
              Permanent Institute ID: AICTE-1-8401
            </span>
          </div>
        </div>

        {/* 4 Summary Metrics for Applicant */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div
            onClick={() => onNavigate('Applications')}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>My Active Applications</span>
              <FileText size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>{instTotal}</div>
            <span style={{ fontSize: 11.5, color: '#2563EB', fontWeight: 600 }}>View application register →</span>
          </div>

          <div
            onClick={() => onNavigate('Applications')}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Under AI Scrutiny</span>
              <Sparkles size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>{instInScrutiny}</div>
            <span style={{ fontSize: 11.5, color: '#64748B' }}>Awaiting desk review</span>
          </div>

          <div
            onClick={() => onNavigate('Applications')}
            style={{ background: '#FFFFFF', border: '1px solid #FEF3C7', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>Clarifications Required</span>
              <AlertTriangle size={18} color="#D97706" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#B45309' }}>{instClarifications}</div>
            <span style={{ fontSize: 11.5, color: '#D97706', fontWeight: 600 }}>Action required on deficiencies →</span>
          </div>

          <div
            onClick={() => onNavigate('Applications')}
            style={{ background: '#FFFFFF', border: '1px solid #DCFCE7', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#16845B' }}>Approval Orders Issued</span>
              <CheckCircle2 size={18} color="#16845B" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#16845B' }}>{instApproved}</div>
            <span style={{ fontSize: 11.5, color: '#16845B', fontWeight: 600 }}>Download statutory letters</span>
          </div>
        </div>

        {/* My Applications Table */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <b style={{ fontSize: 15, color: '#0F172A' }}>My Institutional Approval Dossiers</b>
              <span style={{ fontSize: 12, color: '#64748B', display: 'block' }}>
                Track live status, officer remarks, and document verification stages
              </span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('Applications')}
              style={{
                background: 'transparent',
                border: '1px solid #CBD5E1',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 12,
                color: '#2563EB',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Open Full Register
            </button>
          </div>

          {instApps.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', background: '#F8FAFC', borderRadius: 8 }}>
              <FileText size={28} color="#94A3B8" style={{ margin: '0 auto 8px auto', display: 'block' }} />
              <b style={{ fontSize: 14, color: '#1E293B', display: 'block' }}>No applications registered for this academic year</b>
              <span style={{ fontSize: 12 }}>Click "Submit New Application" to begin an Extension of Approval or New Programme request.</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#64748B', fontSize: 11.5, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>Application Ref</th>
                    <th style={{ padding: '10px 12px' }}>Regulatory Category</th>
                    <th style={{ padding: '10px 12px' }}>Academic Year</th>
                    <th style={{ padding: '10px 12px' }}>Current Stage</th>
                    <th style={{ padding: '10px 12px' }}>Workflow Status</th>
                    <th style={{ padding: '10px 12px' }}>Deficiencies</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {instApps.map((a) => (
                    <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: '#163A63' }}>{a.reference}</td>
                      <td style={{ padding: '10px 12px' }}>{a.application_type}</td>
                      <td style={{ padding: '10px 12px', color: '#64748B' }}>{a.academic_year}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: a.current_stage === 'COMPLETED' ? '#F0FDF4' : a.current_stage === 'RETURNED_FOR_CLARIFICATION' ? '#FEF3C7' : '#EFF6FF',
                          color: a.current_stage === 'COMPLETED' ? '#16845B' : a.current_stage === 'RETURNED_FOR_CLARIFICATION' ? '#B45309' : '#1D4ED8'
                        }}>
                          {a.current_stage}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: a.status === 'COMPLETED' ? '#16845B' : a.status === 'REJECTED' ? '#DC2626' : a.status === 'RETURNED' ? '#D97706' : '#2563EB'
                        }}>
                          ● {a.status === 'COMPLETED' ? 'Completed' : a.status === 'RETURNED' ? 'Action Required' : a.status === 'REJECTED' ? 'Rejected' : 'In Progress'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {a.deficiency_count > 0 ? (
                          <span style={{ color: '#D97706', fontWeight: 700 }}>{a.deficiency_count} item(s)</span>
                        ) : (
                          <span style={{ color: '#16845B' }}>Zero Deficiencies</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => onSelectApplication && onSelectApplication(a)}
                          style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            color: '#2563EB',
                            borderRadius: 4,
                            padding: '4px 8px',
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Searchable Regulatory Options Browser */}
        <RegulatoryCategoriesSearch
          onSelectCategory={(cat) => onNavigate('Applications')}
          currentUserRole="institution"
        />
      </div>
    );
  }

  // ====================================================================
  // ROLE-SPECIFIC VIEW 2: EVC / INSPECTION OFFICER DASHBOARD
  // ====================================================================
  if (user?.role === 'evc_expert') {
    return (
      <div className="page-container" style={{ gap: 20, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {/* EVC Header */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', marginBottom: 2 }}>
              <span>Inspection Management</span>
              <span style={{ color: '#CBD5E1' }}>/</span>
              <span style={{ color: '#163A63', fontWeight: 600 }}>EVC Operations</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#1E293B' }}>
                Expert Visit Committee (EVC) Workspace
              </h1>
              <span style={{ fontSize: 13, color: '#64748B' }}>
                Physical & Virtual Campus Inspection Verification
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => onNavigate('EVC Inspections')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: '#16845B',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Calendar size={14} />
              <span>Open Inspection Calendar</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 6,
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                color: '#172B4D',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                height: 34
              }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Inspector Profile Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #065F46 0%, #059669 100%)',
          color: '#FFFFFF',
          borderRadius: 10,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div>
            <b style={{ fontSize: 16, display: 'block' }}>{user.name} — Senior EVC Committee Inspector</b>
            <span style={{ fontSize: 12, color: '#D1FAE5' }}>
              Appointed under AICTE Statutory Regulations • Region: {user.region} • Panel Assignment Active
            </span>
          </div>
          <span style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: 4, fontSize: 11.5, fontWeight: 600 }}>
            Jurisdiction: Assigned Technical Inspections
          </span>
        </div>

        {/* 4 EVC KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div
            onClick={() => onNavigate('EVC Inspections')}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Assigned Inspections</span>
              <Calendar size={18} color="#2563EB" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>2</div>
            <span style={{ fontSize: 11.5, color: '#2563EB', fontWeight: 600 }}>View assigned committee cases →</span>
          </div>

          <div
            onClick={() => onNavigate('EVC Inspections')}
            style={{ background: '#FFFFFF', border: '1px solid #DCFCE7', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#16845B' }}>Completed Visits</span>
              <CheckCircle2 size={18} color="#16845B" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#16845B' }}>1</div>
            <span style={{ fontSize: 11.5, color: '#16845B' }}>Statutory report filed</span>
          </div>

          <div
            onClick={() => onNavigate('EVC Inspections')}
            style={{ background: '#FFFFFF', border: '1px solid #FEF3C7', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#B45309' }}>Reports Pending</span>
              <Clock size={18} color="#D97706" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#B45309' }}>1</div>
            <span style={{ fontSize: 11.5, color: '#D97706', fontWeight: 600 }}>Awaiting findings submission →</span>
          </div>

          <div
            onClick={() => onNavigate('EVC Inspections')}
            style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '16px', cursor: 'pointer' }}
            className="kpi-card-hover"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Visit Evidence Uploaded</span>
              <FileCheck2 size={18} color="#059669" />
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1E293B' }}>Verified</div>
            <span style={{ fontSize: 11.5, color: '#059669', fontWeight: 600 }}>SHA-256 Geotagged proofs</span>
          </div>
        </div>

        {/* Quick Jump Action Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '18px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14
        }}>
          <div>
            <b style={{ fontSize: 15, color: '#0F172A' }}>Inspection Schedule & On-site Verification Workspace</b>
            <span style={{ fontSize: 12, color: '#64748B', display: 'block' }}>
              Conduct physical / virtual inspections, review infrastructure checklist, upload visit evidence and file committee recommendations.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('EVC Inspections')}
            style={{
              padding: '8px 16px',
              borderRadius: 6,
              background: '#059669',
              color: '#FFFFFF',
              border: 'none',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>Go to EVC Inspections Page</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container" style={{ gap: 20, maxWidth: 1440, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* ====================================================================
          1. HEADER (Compact, White, Well-Aligned Government-Grade Navigation)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '16px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        <div>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#64748B', marginBottom: 2 }}>
            <span>Operations</span>
            <span style={{ color: '#CBD5E1' }}>/</span>
            <span style={{ color: '#163A63', fontWeight: 600 }}>Dashboard</span>
          </div>

          {/* Heading & Subtitle */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <h1 style={{
              fontSize: 22,
              fontWeight: 700,
              margin: 0,
              color: '#1E293B',
              letterSpacing: '-0.02em'
            }}>
              Regulatory Operations
            </h1>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              Application scrutiny and approvals
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Academic Year Selector */}
          <select
            aria-label="Filter by Academic Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: '#1E293B',
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              outline: 'none',
              height: 34
            }}
          >
            <option value="ALL">All Academic Years</option>
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                AY {yr}
              </option>
            ))}
          </select>

          {/* Jurisdiction indicator */}
          <div
            title={`Authorized jurisdiction scope for ${user?.email || 'officer'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#EFF6FF',
              border: '1px solid #DBEAFE',
              fontSize: 12,
              fontWeight: 600,
              color: '#2563EB',
              height: 34,
              boxSizing: 'border-box'
            }}
          >
            <Shield size={13} color="#2563EB" />
            <span>{jurisdictionLabel}</span>
          </div>

          {/* Notification Indicator */}
          <button
            onClick={() => onNavigate('Alerts')}
            title={`View notifications (${unreadAlertsCount} unread alerts)`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 6,
              background: unreadAlertsCount > 0 ? '#FEF7EC' : '#F8FAFC',
              border: `1px solid ${unreadAlertsCount > 0 ? '#FDE68A' : '#E2E8F0'}`,
              color: unreadAlertsCount > 0 ? '#B45309' : '#64748B',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              height: 34,
              boxSizing: 'border-box'
            }}
          >
            <Bell size={13} color={unreadAlertsCount > 0 ? '#B45309' : '#64748B'} />
            <span>Alerts</span>
            {unreadAlertsCount > 0 && (
              <span style={{
                background: '#B45309',
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 999
              }}>
                {unreadAlertsCount}
              </span>
            )}
          </button>

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
              border: '1px solid #E2E8F0',
              color: '#1E293B',
              fontSize: 12,
              fontWeight: 600,
              cursor: isRefreshing ? 'wait' : 'pointer',
              height: 34,
              boxSizing: 'border-box'
            }}
            title="Refresh live metrics from database"
          >
            <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Last updated timestamp */}
          <span style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap' }}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ====================================================================
          1.5. GETTING STARTED & HOW TO USE QUICK TOUR (User-Friendly Guidance)
          ==================================================================== */}
      {isQuickTourOpen ? (
        <div style={{
          background: 'linear-gradient(180deg, #F0F7FF 0%, #FFFFFF 100%)',
          border: '1px solid #BFDBFE',
          borderRadius: 10,
          padding: '16px 20px',
          boxShadow: '0 2px 6px rgba(37, 99, 235, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <Compass size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 14.5, color: '#1E3A8A' }}>How to Use PRAVAHA — Quick Evaluation Guide</b>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#DBEAFE',
                    color: '#1E40AF'
                  }}>
                    User Friendly Walkthrough
                  </span>
                </div>
                <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#475569' }}>
                  Explore the 3 core statutory workflows below, or press <kbd style={{ background: '#E2E8F0', padding: '1px 5px', borderRadius: 3 }}>Ctrl + K</kbd> anytime to search dossiers or switch personas.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsQuickTourOpen(false)}
                style={{
                  background: 'transparent',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6,
                  color: '#64748B',
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                title="Collapse this guide"
              >
                <span>Dismiss</span>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* 3 Step Action Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 12,
            marginTop: 4
          }}>
            {/* Step 1: AI Scrutiny */}
            <div
              onClick={() => onNavigate('Document Scrutiny')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #DBEAFE',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              className="kpi-card-hover"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: '#EFF6FF', padding: '2px 6px', borderRadius: 4 }}>
                    STEP 1 • SCRUTINY
                  </span>
                  <Sparkles size={15} color="#2563EB" />
                </div>
                <b style={{ fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                  Test AI Document Scrutiny
                </b>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                  Inspect candidate dossiers, automated OCR extraction, land minimums & discrepancy checks.
                </p>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, color: '#2563EB', fontSize: 12, fontWeight: 600 }}>
                <span>Launch Scrutiny</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Step 2: EVC Inspections */}
            <div
              onClick={() => onNavigate('EVC Inspections')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #DCFCE7',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              className="kpi-card-hover"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#16845B', background: '#F0FDF4', padding: '2px 6px', borderRadius: 4 }}>
                    STEP 2 • INSPECTIONS
                  </span>
                  <Calendar size={15} color="#16845B" />
                </div>
                <b style={{ fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                  Review EVC Committee Queue
                </b>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                  Toggle between List & Calendar views, inspect expert rosters, and review statutory visit reports.
                </p>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, color: '#16845B', fontSize: 12, fontWeight: 600 }}>
                <span>View EVC Queue</span>
                <ArrowRight size={13} />
              </div>
            </div>

            {/* Step 3: Compliance & Audit */}
            <div
              onClick={() => onNavigate('Compliance')}
              style={{
                background: '#FFFFFF',
                border: '1px solid #FEF3C7',
                borderRadius: 8,
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
              className="kpi-card-hover"
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: 4 }}>
                    STEP 3 • AUDIT
                  </span>
                  <FileCheck2 size={15} color="#B45309" />
                </div>
                <b style={{ fontSize: 13, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                  Verify Tamper-Evident Audit
                </b>
                <p style={{ margin: 0, fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>
                  Validate 30-year lease deeds, fire NOCs, and verify cryptographic SHA-256 integrity chains.
                </p>
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, color: '#B45309', fontSize: 12, fontWeight: 600 }}>
                <span>Check Compliance</span>
                <ArrowRight size={13} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -10 }}>
          <button
            type="button"
            onClick={() => setIsQuickTourOpen(true)}
            style={{
              background: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: 6,
              color: '#2563EB',
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Compass size={13} />
            <span>Show Quick Evaluation Guide</span>
            <ChevronDown size={13} />
          </button>
        </div>
      )}

      {/* ====================================================================
          2. EXACTLY FOUR PRIMARY KPI CARDS (Restrained, Equal Height, Clear Baselines)
          ==================================================================== */}
      <div
        className="kpi-cards-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16
        }}
      >
        {/* KPI 1: Total Applications */}
        <div
          onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
          title="Click to view all applications in register"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px -1px rgba(16, 24, 40, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 120,
            boxSizing: 'border-box'
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Applications</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={18} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {totalAppsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}>
            <span>All registered dossiers</span>
            <span style={{ color: '#2563EB', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              View register <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 2: Pending Scrutiny */}
        <div
          onClick={() => handleFilterNav('Applications', 'SCRUTINY', 'ALL')}
          title="Click to filter applications in Scrutiny or Re-scrutiny"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px -1px rgba(16, 24, 40, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 120,
            boxSizing: 'border-box'
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Scrutiny</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Search size={18} color="#163A63" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {pendingScrutinyCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}>
            <span>{stageCounts['SCRUTINY'] || 0} primary · {stageCounts['RE_SCRUTINY'] || 0} re-scrutiny</span>
            <span style={{ color: '#163A63', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Scrutiny queue <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 3: Awaiting Corrections */}
        <div
          onClick={() => handleFilterNav('Applications', 'RETURNED_FOR_CLARIFICATION', 'RETURNED')}
          title="Click to filter cases awaiting institutional clarification"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px -1px rgba(16, 24, 40, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 120,
            boxSizing: 'border-box'
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Awaiting Corrections</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FFFBEB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RotateCcw size={18} color="#D97706" />
            </div>
          </div>
          <div style={{
            fontSize: 32,
            fontWeight: 700,
            color: awaitingCorrectionsCount > 0 ? '#D97706' : '#1E293B',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            letterSpacing: '-0.02em'
          }}>
            {awaitingCorrectionsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}>
            <span>Deficiency notices issued</span>
            <span style={{ color: '#D97706', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Review list <ChevronRight size={12} />
            </span>
          </div>
        </div>

        {/* KPI 4: Pending Decisions */}
        <div
          onClick={() => handleFilterNav('Applications', 'COMPLIANCE_PENDING', 'ALL')}
          title="Click to filter applications ready for compliance verification and approval"
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px 0 rgba(16, 24, 40, 0.05), 0 1px 2px -1px rgba(16, 24, 40, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 120,
            boxSizing: 'border-box'
          }}
          className="kpi-card-hover"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending Decisions</span>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckSquare size={18} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums', lineHeight: 1, letterSpacing: '-0.02em' }}>
            {pendingDecisionsCount}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#64748B' }}>
            <span>Compliance & final orders</span>
            <span style={{ color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              Decisions <ChevronRight size={12} />
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. WORKFLOW PROGRESSION & NEEDS ATTENTION (~62% / 38% Horizontal Split)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.65fr) minmax(0, 1fr)',
        gap: 20
      }} className="main-operational-split">
        {/* Left: Application Workflow (Accurate 7-Step Progression) */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                  Application Workflow
                </h2>
                <span style={{ fontSize: 12.5, color: '#64748B' }}>
                  Statutory progression track from submission to final order
                </span>
              </div>
              <span style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#F8FAFC',
                color: '#64748B',
                border: '1px solid #E2E8F0'
              }}>
                {totalAppsCount} active dossiers
              </span>
            </div>

            {/* Horizontal Stepper */}
            <div style={{
              overflowX: 'auto',
              paddingBottom: 4
            }}>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '10px 0 16px',
                minWidth: 460
              }}>
                {/* Horizontal Connector Line behind nodes */}
                <div style={{
                  position: 'absolute',
                  top: 25,
                  left: 20,
                  right: 20,
                  height: 2,
                  background: '#E2E8F0',
                  zIndex: 1
                }} />

                {WORKFLOW_STEPS.map((step) => {
                  const isActive = step.count > 0;
                  return (
                    <div
                      key={step.id}
                      onClick={() => handleFilterNav('Applications', step.stageFilter, 'ALL')}
                      title={`Filter: ${step.label} (${step.count} dossiers)`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        position: 'relative',
                        zIndex: 2,
                        cursor: 'pointer',
                        flex: 1
                      }}
                    >
                      {/* Step Circle Node */}
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isActive ? step.color : '#FFFFFF',
                        border: `2px solid ${isActive ? step.color : '#CBD5E1'}`,
                        color: isActive ? '#FFFFFF' : '#64748B',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: isActive ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none',
                        transition: 'all 0.15s ease'
                      }}>
                        {step.stepNum}
                      </div>

                      {/* Step Label */}
                      <span style={{
                        fontSize: 11.5,
                        fontWeight: isActive ? 600 : 500,
                        color: isActive ? '#1E293B' : '#64748B',
                        textAlign: 'center',
                        whiteSpace: 'nowrap'
                      }}>
                        {step.label}
                      </span>

                      {/* Count Pill */}
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '1px 7px',
                        borderRadius: 10,
                        background: isActive ? '#EFF6FF' : '#F8FAFC',
                        color: isActive ? step.color : '#94A3B8',
                        border: `1px solid ${isActive ? '#DBEAFE' : '#E2E8F0'}`,
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {step.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Proportional Progress Track */}
          <div style={{ marginTop: 12, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, fontSize: 12 }}>
              <span style={{ color: '#64748B' }}>Active distribution by phase</span>
              <span style={{ fontWeight: 600, color: '#1E293B' }}>
                {Math.round(((stageCounts['COMPLETED'] || 0) / Math.max(1, totalAppsCount)) * 100)}% completed
              </span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {WORKFLOW_STEPS.map((step) => {
                const widthPct = totalAppsCount > 0 ? (step.count / totalAppsCount) * 100 : 0;
                if (widthPct === 0) return null;
                return (
                  <div
                    key={step.id}
                    title={`${step.label}: ${step.count} (${Math.round(widthPct)}%)`}
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: step.color
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Needs Attention (Actionable, Restrained Alert Rows) */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 22px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                <AlertTriangle size={16} color="#D98B16" />
                Needs Attention
              </h2>
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: 4,
                background: totalNeedsAttention > 0 ? '#FDF2F2' : '#F0FDF4',
                color: totalNeedsAttention > 0 ? '#D64545' : '#16845B',
                border: `1px solid ${totalNeedsAttention > 0 ? '#FDE2E2' : '#DCFCE7'}`
              }}>
                {totalNeedsAttention} actionable
              </span>
            </div>

            {totalNeedsAttention === 0 ? (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                background: '#F0FDF4',
                borderRadius: 8,
                border: '1px solid #DCFCE7',
                margin: '10px 0'
              }}>
                <CheckCircle2 size={20} color="#16845B" style={{ margin: '0 auto 6px' }} />
                <b style={{ display: 'block', fontSize: 13, color: '#16845B' }}>
                  All applications within SLA
                </b>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  No overdue or high-priority escalations pending.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {attentionCategories.map((cat) => (
                  <div
                    key={cat.id}
                    onClick={cat.onClick}
                    title={`Click to view ${cat.label}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 6,
                      border: '1px solid #E2E8F0',
                      background: '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background-color 0.15s'
                    }}
                    className="attention-row-hover"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: cat.count > 0 ? cat.color : '#CBD5E1',
                        flexShrink: 0
                      }} />
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cat.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '1px 8px',
                        borderRadius: 4,
                        background: cat.count > 0 ? cat.badgeBg : '#F8FAFC',
                        color: cat.count > 0 ? cat.badgeText : '#94A3B8',
                        fontVariantNumeric: 'tabular-nums'
                      }}>
                        {cat.count}
                      </span>
                      <ChevronRight size={13} color="#94A3B8" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom link to operational queue */}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <button
              onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
              style={{
                width: '100%',
                padding: '6px 0',
                background: 'transparent',
                border: 0,
                color: '#2563EB',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer'
              }}
            >
              <span>View full operational queue</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4. PRIORITY APPLICATIONS TABLE (Clean, Readable, 6-Column Format)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
      }}>
        {/* Table Card Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: '1px solid #F1F5F9',
          flexWrap: 'wrap',
          gap: 10
        }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
              Priority Applications
            </h2>
            <span style={{ fontSize: 12.5, color: '#64748B' }}>
              Applications requiring attention
            </span>
          </div>

          <button
            onClick={() => handleFilterNav('Applications', 'ALL', 'ALL')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12.5,
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

        {/* 6-Column Responsive Table */}
        {priorityQueue.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No priority applications pending action in current scope.
          </div>
        ) : (
          <div className="table-responsive" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Application ID
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Institution
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Application Type
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Current Stage
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Due Date
                  </th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#64748B', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em', width: 175, minWidth: 175 }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {priorityQueue.map((app) => {
                  const isOverdue = app.status === 'OVERDUE' || (app.due_date && new Date(app.due_date) < today && app.status !== 'COMPLETED');
                  const isDueSoon = app.due_date && !isOverdue && new Date(app.due_date).getTime() - today.getTime() <= 7 * 86400000;
                  const isReturned = app.current_stage === 'RETURNED_FOR_CLARIFICATION';

                  // Semantic Urgency Indicator Dot
                  let urgencyDotColor = '#CBD5E1';
                  if (isOverdue) urgencyDotColor = '#D64545';
                  else if (isDueSoon || isReturned) urgencyDotColor = '#D98B16';

                  // Contextual action button label based on role and stage
                  let actionLabel = 'View Dossier';
                  if (app.current_stage === 'SCRUTINY') actionLabel = 'Review Scrutiny';
                  else if (app.current_stage === 'RE_SCRUTINY') actionLabel = 'Review Resubmission';
                  else if (app.current_stage === 'RETURNED_FOR_CLARIFICATION') {
                    actionLabel = user?.role === 'institution' ? 'Submit Clarification' : 'View Notice';
                  } else if (app.current_stage === 'EVC_PENDING') actionLabel = 'Schedule EVC';
                  else if (app.current_stage === 'EVC_SCHEDULED') actionLabel = 'Review Report';
                  else if (app.current_stage === 'COMPLIANCE_PENDING') actionLabel = 'Verify Proofs';

                  return (
                    <tr
                      key={app.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.12s' }}
                      className="priority-row-hover"
                    >
                      {/* 1. Application ID */}
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span
                            title={isOverdue ? 'Overdue case' : isDueSoon ? 'Due soon' : 'Standard priority'}
                            style={{ width: 7, height: 7, borderRadius: '50%', background: urgencyDotColor, flexShrink: 0 }}
                          />
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                            {app.reference}
                          </span>
                        </div>
                        <small style={{ display: 'block', fontSize: 11, color: '#94A3B8', marginLeft: 14, marginTop: 1 }}>
                          AY {app.academic_year}
                        </small>
                      </td>

                      {/* 2. Institution */}
                      <td style={{ padding: '12px 14px' }}>
                        <b style={{ display: 'block', fontWeight: 600, color: '#1E293B', fontSize: 13 }}>
                          {app.institution_name}
                        </b>
                        <small style={{ fontSize: 11.5, color: '#64748B', display: 'block', marginTop: 1 }}>
                          {app.region} Region
                        </small>
                      </td>

                      {/* 3. Application Type (Dedicated Column) */}
                      <td style={{ padding: '12px 14px', fontSize: 12.5, color: '#475569' }}>
                        {app.application_type}
                      </td>

                      {/* 4. Current Stage */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: '3px 10px',
                          borderRadius: 20,
                          background: isReturned ? '#FFFBEB' : isOverdue ? '#FEF2F2' : '#EFF6FF',
                          color: isReturned ? '#B45309' : isOverdue ? '#DC2626' : '#163A63',
                          border: `1px solid ${isReturned ? '#FDE68A' : isOverdue ? '#FECACA' : '#BFDBFE'}`,
                          whiteSpace: 'nowrap'
                        }}>
                          {app.current_stage.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* 5. Due Date */}
                      <td style={{ padding: '12px 14px', fontVariantNumeric: 'tabular-nums' }}>
                        {app.due_date ? (
                          <span style={{
                            color: isOverdue ? '#DC2626' : isDueSoon ? '#D97706' : '#475569',
                            fontWeight: isOverdue || isDueSoon ? 700 : 500,
                            fontSize: 12.5
                          }}>
                            {new Date(app.due_date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </span>
                        ) : (
                          <span style={{ color: '#94A3B8', fontSize: 12.5 }}>—</span>
                        )}
                      </td>

                      {/* 6. Action */}
                      <td style={{ padding: '10px 14px', textAlign: 'right', width: 175, minWidth: 175 }}>
                        <button
                          onClick={() => onSelectApplication && onSelectApplication(app)}
                          style={{
                            width: 156,
                            minWidth: 156,
                            maxWidth: 156,
                            height: 32,
                            padding: '0 10px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 8,
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            color: '#163A63',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            whiteSpace: 'nowrap',
                            boxSizing: 'border-box',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                            transition: 'all 0.15s ease'
                          }}
                          className="btn-action-hover"
                        >
                          <Eye size={13} color="#2563EB" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{actionLabel}</span>
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
          5 & 6. RECENT ACTIVITY & WORKLOAD BY CATEGORY (~55% / 45% Split)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
        gap: 20
      }} className="main-operational-split">
        {/* Left: Recent Activity (Compact 4-5 Events) */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
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
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                Recent Activity
              </h2>
              <span style={{ fontSize: 12.5, color: '#64748B' }}>
                Latest audited workflow events and notifications
              </span>
            </div>
            <button
              onClick={() => onNavigate('Alerts')}
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: '#2563EB',
                background: 'transparent',
                border: 0,
                cursor: 'pointer'
              }}
            >
              View audit log →
            </button>
          </div>

          {/* Activity items list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recentAudits.length > 0 ? (
              recentAudits.slice(0, 5).map((aud) => {
                const appObj = applications.find((a) => a.id === aud.application_id);
                const ref = aud.application_reference || appObj?.reference || `App #${aud.application_id}`;

                let iconColor = '#2563EB';
                let iconBg = '#EFF6FF';
                if (aud.action.includes('DECISION') || aud.action.includes('COMPLIANCE') || aud.action.includes('APPROVED')) {
                  iconColor = '#16845B';
                  iconBg = '#F0FDF4';
                } else if (aud.action.includes('RETURN') || aud.action.includes('DEFICIENCY') || aud.action.includes('CLARIFICATION')) {
                  iconColor = '#D98B16';
                  iconBg = '#FEF7EC';
                } else if (aud.action.includes('REJECT') || aud.action.includes('OVERDUE')) {
                  iconColor = '#D64545';
                  iconBg = '#FDF2F2';
                }

                return (
                  <div
                    key={aud.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '8px 0',
                      borderBottom: '1px solid #F8FAFC'
                    }}
                  >
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: iconBg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                      flexShrink: 0
                    }}>
                      <Clock size={14} color={iconColor} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
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
                                border: '1px solid #DBEAFE',
                                borderRadius: 4,
                                padding: '1px 6px',
                                cursor: 'pointer'
                              }}
                            >
                              {ref}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: '#64748B' }}>({ref})</span>
                          )}
                        </div>
                        <small style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>
                          {new Date(aud.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </small>
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {aud.details || 'Workflow transition recorded in tamper-evident audit ledger.'}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : alerts.length > 0 ? (
              alerts.slice(0, 4).map((al) => (
                <div key={al.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: al.severity === 'CRITICAL' ? '#FDF2F2' : '#EFF6FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={14} color={al.severity === 'CRITICAL' ? '#D64545' : '#2563EB'} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <b style={{ fontSize: 12.5, color: '#1E293B' }}>{al.title}</b>
                      <small style={{ fontSize: 11, color: '#94A3B8' }}>
                        {new Date(al.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </small>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B', lineHeight: 1.35 }}>
                      {al.message}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#94A3B8', fontSize: 12 }}>
                No recent regulatory events logged.
              </div>
            )}
          </div>
        </div>

        {/* Right: Workload by Category & Shortcuts */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: '1px solid #F1F5F9'
            }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                  Workload by Category
                </h2>
                <span style={{ fontSize: 12.5, color: '#64748B' }}>
                  Distribution of applications in scope
                </span>
              </div>
            </div>

            {/* Horizontal Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(typeBreakdown).map(([typeName, cnt]) => {
                const pct = totalAppsCount > 0 ? Math.round((cnt / totalAppsCount) * 100) : 0;
                return (
                  <div key={typeName} style={{ fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontWeight: 600, color: '#1E293B' }}>{typeName}</span>
                      <span style={{ color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                        <b>{cnt}</b> ({pct}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: '#2563EB', borderRadius: 3, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Module Shortcuts */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #F1F5F9', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onNavigate('Compliance')}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <FileCheck2 size={14} color="#0F9D91" />
              <span>Compliance</span>
            </button>
            <button
              onClick={() => onNavigate('EVC Inspections')}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: 6,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                color: '#1E293B',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Calendar size={14} color="#2563EB" />
              <span>EVC Inspections</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
