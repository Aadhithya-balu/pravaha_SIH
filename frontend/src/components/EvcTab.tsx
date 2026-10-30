import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  FileCheck2,
  X,
  Video,
  MonitorCheck,
  MapPin,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  ArrowRight,
  ShieldCheck,
  ClipboardList,
  Eye,
  CalendarDays,
  ListFilter,
  Camera
} from 'lucide-react';
import { EVCVisit, Application, User, InspectionEvidence } from '../types';
import { api, rescheduleEvcVisit, approveEvcNextStage, fetchVisitEvidences, verifyInspectionEvidence } from '../api';
import { EvcVisitProofModal } from './EvcVisitProofModal';

interface EvcTabProps {
  user: User | null;
  applications: Application[];
  onRefresh: () => void;
  onSelectApplication?: (app: Application) => void;
}

export const EvcTab: React.FC<EvcTabProps> = ({ user, applications, onRefresh, onSelectApplication }) => {
  const [visits, setVisits] = useState<EVCVisit[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'LIST' | 'CALENDAR'>('LIST');

  // Modals
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isViewReportOpen, setIsViewReportOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<EVCVisit | null>(null);
  const [expandedPanelVisitId, setExpandedPanelVisitId] = useState<number | null>(null);
  const [proofModalVisitId, setProofModalVisitId] = useState<number | null>(null);

  // EVC Workflow Enhancements: Location, Reschedule, Evidence, Next Stage Approval
  const [locationDetails, setLocationDetails] = useState('');
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleLocation, setRescheduleLocation] = useState('');
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [currentEvidences, setCurrentEvidences] = useState<InspectionEvidence[]>([]);
  const [isLoadingEvidences, setIsLoadingEvidences] = useState(false);
  const [evidenceRemarks, setEvidenceRemarks] = useState('');

  // Enhanced Report Submission States
  const [visitOccurred, setVisitOccurred] = useState<'OCCURRED' | 'DID_NOT_OCCUR'>('OCCURRED');
  const [missedReason, setMissedReason] = useState('');
  const [inspectionOutcome, setInspectionOutcome] = useState<'RECOMMENDED' | 'DEFICIENCIES_NOTED' | 'REJECTED'>('RECOMMENDED');
  const [evidenceVerificationStatus, setEvidenceVerificationStatus] = useState<'VERIFIED' | 'PENDING' | 'REJECTED'>('VERIFIED');
  const [checklistLand, setChecklistLand] = useState(true);
  const [checklistLabs, setChecklistLabs] = useState(true);
  const [checklistFaculty, setChecklistFaculty] = useState(true);
  const [checklistSafety, setChecklistSafety] = useState(true);

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Default date: 7 days from today
  const defaultDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Schedule fields
  const [selectedAppId, setSelectedAppId] = useState<number | ''>('');
  const [committeeMembers, setCommitteeMembers] = useState(
    'Prof. S. Ramanujan (Chairperson), Dr. K. Sharma (Subject Expert), AICTE Regional Nominee'
  );
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [visitMode, setVisitMode] = useState<'PHYSICAL' | 'VIRTUAL' | 'HYBRID'>('PHYSICAL');
  const [scheduleDirty, setScheduleDirty] = useState(false);

  // Report fields
  const [reportSummary, setReportSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [reportDirty, setReportDirty] = useState(false);

  async function loadVisits() {
    try {
      const data = await api<EVCVisit[]>('/evc');
      setVisits(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load EVC visits.');
    }
  }

  useEffect(() => {
    loadVisits();
  }, []);

  const evcPendingApps = applications.filter(
    (a) => a.current_stage === 'EVC_PENDING' || a.current_stage === 'SCRUTINY' || a.status === 'IN_PROGRESS'
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const today = new Date(todayStr);

  // Metric counts (derived from actual visits)
  const totalVisitsCount = visits.length;
  const scheduledCount = visits.filter(v => v.status === 'SCHEDULED' || v.status === 'IN_PROGRESS').length;
  const completedCount = visits.filter(v => v.status === 'COMPLETED').length;
  const reportsPendingCount = visits.filter(v => v.status !== 'COMPLETED' && (!v.report_summary || v.status === 'PENDING')).length;

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'REPORTS_PENDING') {
          if (v.status === 'COMPLETED' || v.report_summary) return false;
        } else if (statusFilter === 'PROOF_SUBMITTED') {
          if (v.proof_submission_status !== 'SUBMITTED' && v.proof_submission_status !== 'IN_REVIEW') return false;
        } else if (statusFilter === 'PROOF_ACCEPTED') {
          if (v.proof_submission_status !== 'ACCEPTED') return false;
        } else if (statusFilter === 'PROOF_REJECTED') {
          if (v.proof_submission_status !== 'REJECTED') return false;
        } else if (statusFilter === 'PROOF_ADDITIONAL') {
          if (v.proof_submission_status !== 'ADDITIONAL_EVIDENCE_REQUIRED') return false;
        } else if (v.status !== statusFilter) {
          return false;
        }
      }

      // 2. Visit Mode Filter
      if (modeFilter !== 'ALL' && v.visit_mode !== modeFilter) {
        return false;
      }

      // 3. Date Filter
      if (dateFilter !== 'ALL') {
        const visitDate = new Date(v.scheduled_date);
        if (dateFilter === 'UPCOMING') {
          if (visitDate < today && v.status === 'COMPLETED') return false;
        } else if (dateFilter === 'COMPLETED') {
          if (v.status !== 'COMPLETED') return false;
        } else if (dateFilter === 'THIS_MONTH') {
          const now = new Date();
          if (visitDate.getMonth() !== now.getMonth() || visitDate.getFullYear() !== now.getFullYear()) {
            return false;
          }
        }
      }

      // 4. Search Query (Institution, Application Reference, Committee Member)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const app = applications.find(a => a.id === v.application_id);
        const ref = app ? app.reference.toLowerCase() : `app #${v.application_id}`;
        const match =
          v.institution_name.toLowerCase().includes(q) ||
          ref.includes(q) ||
          v.committee_members.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [visits, statusFilter, modeFilter, dateFilter, searchQuery, applications, today]);

  // Upcoming inspections strip (Next 3 visits chronologically)
  const upcomingVisits = useMemo(() => {
    return visits
      .filter(v => v.status === 'SCHEDULED' || v.status === 'IN_PROGRESS')
      .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())
      .slice(0, 4);
  }, [visits]);

  function handleOpenSchedule() {
    setSelectedAppId(evcPendingApps.length > 0 ? evcPendingApps[0].id : '');
    setScheduledDate(defaultDate);
    setVisitMode('PHYSICAL');
    setCommitteeMembers('Prof. S. Ramanujan (Chairperson), Dr. K. Sharma (Subject Expert), AICTE Regional Nominee');
    setScheduleDirty(false);
    setIsScheduleOpen(true);
  }

  function handleCloseSchedule() {
    if (scheduleDirty && !window.confirm('You have unsaved changes in the scheduling form. Discard changes?')) {
      return;
    }
    setIsScheduleOpen(false);
    setScheduleDirty(false);
  }

  function handleCloseReport() {
    if (reportDirty && !window.confirm('You have unsaved changes in the inspection report. Discard changes?')) {
      return;
    }
    setIsReportOpen(false);
    setSelectedVisit(null);
    setReportDirty(false);
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId || !scheduledDate) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api('/evc', {
        method: 'POST',
        body: JSON.stringify({
          application_id: Number(selectedAppId),
          committee_members: committeeMembers.trim(),
          scheduled_date: scheduledDate,
          visit_mode: visitMode,
          location_details: locationDetails.trim() || undefined
        })
      });
      setIsScheduleOpen(false);
      setScheduleDirty(false);
      setSuccessMsg('Expert Visiting Committee (EVC) inspection scheduled successfully.');
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule EVC visit.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Reschedule Handlers
  function handleOpenReschedule(v: EVCVisit) {
    setSelectedVisit(v);
    setRescheduleDate(v.scheduled_date);
    setRescheduleReason('');
    setRescheduleLocation(v.location_details || '');
    setIsRescheduleOpen(true);
  }

  async function handleRescheduleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit || !rescheduleDate || !rescheduleReason.trim()) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await rescheduleEvcVisit(selectedVisit.id, {
        new_date: rescheduleDate,
        reason: rescheduleReason.trim(),
        visit_mode: visitMode
      });
      setIsRescheduleOpen(false);
      setSuccessMsg(`Inspection for ${selectedVisit.institution_name} successfully rescheduled to ${rescheduleDate}.`);
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reschedule inspection.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Approve Next Stage Handlers
  function handleOpenApprove(v: EVCVisit) {
    setSelectedVisit(v);
    setApproveRemarks('Inspection findings verified. Quorum attendance confirmed and geotagged evidence validated.');
    setIsApproveOpen(true);
  }

  async function handleApproveNextStageSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await approveEvcNextStage(selectedVisit.id, {
        remarks: approveRemarks.trim()
      });
      setIsApproveOpen(false);
      setSuccessMsg(`Next stage approved! Application advanced to ${res.current_stage || 'SAC/SHC Committee Review'}.`);
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to approve next stage.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Inspection Evidence Handlers
  async function handleOpenEvidences(v: EVCVisit) {
    setSelectedVisit(v);
    setIsEvidenceModalOpen(true);
    setIsLoadingEvidences(true);
    try {
      const evs = await fetchVisitEvidences(v.id);
      setCurrentEvidences(evs);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load inspection evidences.');
    } finally {
      setIsLoadingEvidences(false);
    }
  }

  async function handleVerifyEvidenceItem(evidenceId: number, status: 'VERIFIED' | 'REJECTED') {
    setIsSubmitting(true);
    try {
      await verifyInspectionEvidence(
        evidenceId,
        status === 'VERIFIED' ? 'VERIFY' : 'REJECT',
        evidenceRemarks.trim() || undefined
      );
      if (selectedVisit) {
        const evs = await fetchVisitEvidences(selectedVisit.id);
        setCurrentEvidences(evs);
      }
      setSuccessMsg(`Evidence successfully marked as ${status}.`);
      await loadVisits();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify evidence.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/evc/${selectedVisit.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'COMPLETED',
          report_summary: reportSummary.trim(),
          recommendations: recommendations.trim(),
          visit_occurred: visitOccurred,
          missed_reason: visitOccurred === 'DID_NOT_OCCUR' ? missedReason.trim() : undefined,
          structured_checklist: JSON.stringify({
            land_verified: checklistLand,
            labs_verified: checklistLabs,
            faculty_verified: checklistFaculty,
            safety_verified: checklistSafety
          }),
          inspection_outcome: inspectionOutcome,
          evidence_verification_status: evidenceVerificationStatus
        })
      });
      setIsReportOpen(false);
      setSelectedVisit(null);
      setReportDirty(false);
      setSuccessMsg(`Inspection findings successfully filed for ${selectedVisit.institution_name}.`);
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit inspection report.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'PHYSICAL':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: '#F1F5F9',
            color: '#1E293B',
            border: '1px solid #E2E8F0',
            fontSize: 11.5,
            fontWeight: 600
          }}>
            <MapPin size={11} color="#475569" />
            <span>Physical Visit</span>
          </span>
        );
      case 'VIRTUAL':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: '#EDE9FE',
            color: '#5B21B6',
            border: '1px solid #C4B5FD',
            fontSize: 11.5,
            fontWeight: 600
          }}>
            <Video size={11} color="#5B21B6" />
            <span>Virtual Lab</span>
          </span>
        );
      case 'HYBRID':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE',
            fontSize: 11.5,
            fontWeight: 600
          }}>
            <MonitorCheck size={11} color="#1D4ED8" />
            <span>Hybrid Visit</span>
          </span>
        );
      default:
        return (
          <span style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: '#F8FAFC',
            fontSize: 11.5,
            fontWeight: 600,
            color: '#64748B'
          }}>
            {mode}
          </span>
        );
    }
  };

  const hasActiveFilters = statusFilter !== 'ALL' || modeFilter !== 'ALL' || dateFilter !== 'ALL' || searchQuery.trim() !== '';

  return (
    <div className="page-container" style={{ maxWidth: 1200, margin: '0 auto', gap: 18 }}>
      {/* ====================================================================
          1. SIMPLIFIED PAGE HEADER & PRIMARY ACTION
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '18px 24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#EFF6FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Calendar size={18} color="#2563EB" />
            </div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              color: '#1E293B',
              letterSpacing: '-0.01em'
            }}>
              EVC Inspections
            </h1>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 600,
              background: '#F1F5F9',
              color: '#475569'
            }}>
              SIH26262
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: '#64748B' }}>
            Schedule visits, track inspections and review findings.
          </p>
        </div>

        {/* Primary Action Button (Desktop Right) */}
        {user?.role !== 'institution' && (
          <button
            type="button"
            onClick={handleOpenSchedule}
            id="btn-schedule-evc"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              background: '#2457C5',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(36, 87, 197, 0.25)',
              transition: 'background-color 0.15s ease'
            }}
          >
            <Plus size={15} />
            <span>Schedule Inspection</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#FDF2F2',
          border: '1px solid #FDE2E2',
          color: '#D64545',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D64545', fontWeight: 700 }}>×</button>
        </div>
      )}
      {successMsg && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#F0FDF4',
          border: '1px solid #DCFCE7',
          color: '#16845B',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16845B', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* ====================================================================
          2. FOUR COMPACT SUMMARY KPI CARDS (Real Application Data)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 14
      }} className="evc-summary-grid">
        {/* Card 1: Total Inspections */}
        <div
          onClick={() => { setStatusFilter('ALL'); setDateFilter('ALL'); }}
          style={{
            background: '#FFFFFF',
            border: `1px solid ${statusFilter === 'ALL' && dateFilter === 'ALL' ? '#2563EB' : '#E2E8F0'}`,
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 104,
            boxSizing: 'border-box',
            transition: 'all 0.15s ease'
          }}
          className="kpi-card-hover"
          title="Click to view all inspection records"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Total Inspections</span>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ClipboardList size={16} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#1E293B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {totalVisitsCount}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>
            All active & archived visits
          </div>
        </div>

        {/* Card 2: Scheduled */}
        <div
          onClick={() => { setStatusFilter('SCHEDULED'); setDateFilter('ALL'); }}
          style={{
            background: '#FFFFFF',
            border: `1px solid ${statusFilter === 'SCHEDULED' ? '#2563EB' : '#E2E8F0'}`,
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 104,
            boxSizing: 'border-box',
            transition: 'all 0.15s ease'
          }}
          className="kpi-card-hover"
          title="Click to filter scheduled visits"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Scheduled</span>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={16} color="#2563EB" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#2563EB', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {scheduledCount}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>
            Upcoming physical & hybrid
          </div>
        </div>

        {/* Card 3: Completed */}
        <div
          onClick={() => { setStatusFilter('COMPLETED'); setDateFilter('ALL'); }}
          style={{
            background: '#FFFFFF',
            border: `1px solid ${statusFilter === 'COMPLETED' ? '#16845B' : '#E2E8F0'}`,
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 104,
            boxSizing: 'border-box',
            transition: 'all 0.15s ease'
          }}
          className="kpi-card-hover"
          title="Click to filter completed inspections with submitted findings"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Completed</span>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#16845B" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#16845B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {completedCount}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>
            Reports filed & verified
          </div>
        </div>

        {/* Card 4: Reports Pending */}
        <div
          onClick={() => { setStatusFilter('REPORTS_PENDING'); setDateFilter('ALL'); }}
          style={{
            background: '#FFFFFF',
            border: `1px solid ${statusFilter === 'REPORTS_PENDING' ? '#D98B16' : '#E2E8F0'}`,
            borderRadius: 10,
            padding: '16px 18px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 104,
            boxSizing: 'border-box',
            transition: 'all 0.15s ease'
          }}
          className="kpi-card-hover"
          title="Click to filter visits awaiting report submission"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#64748B' }}>Reports Pending</span>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: '#FEF7EC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <AlertCircle size={16} color="#D98B16" />
            </div>
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: reportsPendingCount > 0 ? '#D98B16' : '#1E293B', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {reportsPendingCount}
          </div>
          <div style={{ fontSize: 11.5, color: '#64748B' }}>
            Awaiting expert findings
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. UPCOMING INSPECTIONS STRIP & VIEW SWITCHER (List vs Calendar)
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        {/* Left: Upcoming Visits Preview Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Clock size={15} color="#2563EB" />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
              Upcoming Schedule:
            </span>
          </div>

          {upcomingVisits.length === 0 ? (
            <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
              No inspections scheduled in active calendar window.
            </span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {upcomingVisits.map((v) => {
                const isToday = v.scheduled_date === todayStr;
                const isOverdue = new Date(v.scheduled_date) < today && v.status !== 'COMPLETED';
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      setSearchQuery(v.institution_name);
                      setViewMode('LIST');
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: isToday ? '#EFF6FF' : isOverdue ? '#FDF2F2' : '#F8FAFC',
                      border: `1px solid ${isToday ? '#BFDBFE' : isOverdue ? '#FDE2E2' : '#E2E8F0'}`,
                      fontSize: 11.5,
                      cursor: 'pointer',
                      transition: 'all 0.12s ease'
                    }}
                    title={`Click to filter: ${v.institution_name}`}
                  >
                    <b style={{ color: '#1E293B', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {v.institution_name}
                    </b>
                    <span style={{ color: isOverdue ? '#D64545' : '#64748B' }}>
                      {new Date(v.scheduled_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                    {isToday && (
                      <span style={{ background: '#2563EB', color: '#FFFFFF', padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>
                        TODAY
                      </span>
                    )}
                    {isOverdue && (
                      <span style={{ background: '#D64545', color: '#FFFFFF', padding: '1px 5px', borderRadius: 3, fontSize: 9.5, fontWeight: 700 }}>
                        DUE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: View Toggle (List vs Calendar) */}
        <div style={{
          display: 'inline-flex',
          background: '#F1F5F9',
          borderRadius: 6,
          padding: 2,
          border: '1px solid #E2E8F0',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={() => setViewMode('LIST')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'LIST' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'LIST' ? '#2563EB' : '#64748B',
              boxShadow: viewMode === 'LIST' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <ListFilter size={13} />
            <span>Inspection List</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('CALENDAR')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 4,
              border: 'none',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: viewMode === 'CALENDAR' ? '#FFFFFF' : 'transparent',
              color: viewMode === 'CALENDAR' ? '#2563EB' : '#64748B',
              boxShadow: viewMode === 'CALENDAR' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
            }}
          >
            <CalendarDays size={13} />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          4. USEFUL SEARCH & FILTER TOOLBAR
          ==================================================================== */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: 10, top: 9 }} />
            <input
              type="text"
              placeholder="Search by institution name, application ID, or panel member..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 12px 6px 32px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                fontSize: 12.5,
                background: '#FFFFFF',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              fontSize: 12,
              background: '#FFFFFF',
              color: '#1E293B'
            }}
            aria-label="Filter by Status"
          >
            <option value="ALL">All Statuses ({visits.length})</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="REPORTS_PENDING">Reports Pending</option>
            <option value="PROOF_SUBMITTED">Proof Submitted</option>
            <option value="PROOF_ACCEPTED">Proof Accepted</option>
            <option value="PROOF_ADDITIONAL">Additional Evidence Required</option>
            <option value="PROOF_REJECTED">Proof Rejected</option>
            <option value="PENDING">Pending</option>
            <option value="POSTPONED">Postponed</option>
          </select>

          {/* Visit Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              fontSize: 12,
              background: '#FFFFFF',
              color: '#1E293B'
            }}
            aria-label="Filter by Visit Mode"
          >
            <option value="ALL">All Visit Modes</option>
            <option value="PHYSICAL">Physical On-Site</option>
            <option value="HYBRID">Hybrid Inspection</option>
            <option value="VIRTUAL">Virtual Lab</option>
          </select>

          {/* Date Window Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: '1px solid #CBD5E1',
              fontSize: 12,
              background: '#FFFFFF',
              color: '#1E293B'
            }}
            aria-label="Filter by Date"
          >
            <option value="ALL">All Dates</option>
            <option value="UPCOMING">Upcoming & Active</option>
            <option value="THIS_MONTH">This Month</option>
            <option value="COMPLETED">Past / Completed</option>
          </select>

          {/* Reset Action */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setModeFilter('ALL');
                setDateFilter('ALL');
                setSearchQuery('');
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#64748B',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={11} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ====================================================================
          5. CALENDAR VIEW (When user switches view to CALENDAR)
          ==================================================================== */}
      {viewMode === 'CALENDAR' && (
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 10,
          padding: '20px 24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <CalendarDays size={18} color="#2563EB" />
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: 0 }}>
                Inspection Schedule Calendar
              </h2>
            </div>
            <span style={{ fontSize: 12, color: '#64748B' }}>
              Showing {filteredVisits.length} mapped visits
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {filteredVisits.map((v) => {
              const isCompleted = v.status === 'COMPLETED';
              const visitDate = new Date(v.scheduled_date);
              const formattedDate = visitDate.toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              });

              return (
                <div
                  key={v.id}
                  style={{
                    border: '1px solid #E2E8F0',
                    borderRadius: 8,
                    padding: '14px 16px',
                    background: isCompleted ? '#F8FAFC' : '#FFFFFF',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB', fontVariantNumeric: 'tabular-nums' }}>
                        {formattedDate}
                      </span>
                      {getModeBadge(v.visit_mode)}
                    </div>
                    <b style={{ fontSize: 13.5, color: '#1E293B', display: 'block', marginBottom: 4 }}>
                      {v.institution_name}
                    </b>
                    <span style={{ fontSize: 11.5, color: '#64748B' }}>
                      Chair: {v.committee_members.split(',')[0]}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #F1F5F9', paddingTop: 8 }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isCompleted ? '#16845B' : '#2563EB'
                    }}>
                      ● {v.status}
                    </span>

                    {isCompleted ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVisit(v);
                          setIsViewReportOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        View Report →
                      </button>
                    ) : user?.role !== 'institution' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVisit(v);
                          setReportSummary(v.report_summary || '');
                          setRecommendations(v.recommendations || '');
                          setReportDirty(false);
                          setIsReportOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563EB',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        Record Findings →
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ====================================================================
          6. REDESIGNED INSPECTION LIST / CARDS (List Mode)
          ==================================================================== */}
      {viewMode === 'LIST' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredVisits.length === 0 ? (
            <div style={{
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              borderRadius: 10,
              padding: '40px 20px',
              textAlign: 'center',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
            }}>
              <Calendar size={32} color="#94A3B8" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E293B', margin: '0 0 6px' }}>
                No EVC Inspections Found
              </h3>
              <p style={{ fontSize: 13, color: '#64748B', margin: '0 auto 16px', maxWidth: 440 }}>
                {hasActiveFilters
                  ? 'No inspections matched your filter parameters. Try clearing your filters.'
                  : 'There are no Expert Visiting Committee inspections currently recorded in this scope.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setModeFilter('ALL');
                    setDateFilter('ALL');
                    setSearchQuery('');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#2563EB',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            filteredVisits.map((v) => {
              const isCompleted = v.status === 'COMPLETED';
              const app = applications.find(a => a.id === v.application_id);
              const isOverdue = new Date(v.scheduled_date) < today && !isCompleted;
              const isToday = v.scheduled_date === todayStr;
              const isPanelExpanded = expandedPanelVisitId === v.id;

              // Abbreviate panel list
              const panelParts = v.committee_members.split(',').map(m => m.trim());
              const leadChair = panelParts[0] || 'AICTE EVC Panel';
              const otherExpertsCount = panelParts.length - 1;

              // Inspection lifecycle stage calculation
              let lifecycleStep = 1; // Scheduled
              if (isCompleted) {
                lifecycleStep = 4; // Report Submitted & Verified
              } else if (v.report_summary) {
                lifecycleStep = 3; // Findings Recorded
              } else if (new Date(v.scheduled_date) <= today) {
                lifecycleStep = 2; // Visit Conducted, Report Pending
              }

              return (
                <div
                  key={v.id}
                  style={{
                    background: '#FFFFFF',
                    border: `1px solid ${isOverdue ? '#FDE2E2' : '#E2E8F0'}`,
                    borderRadius: 10,
                    padding: '18px 22px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                    transition: 'border-color 0.15s ease'
                  }}
                >
                  {/* Top Header: Institution, Dossier Ref & Badges */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10
                  }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{
                          margin: 0,
                          fontSize: 15.5,
                          fontWeight: 600,
                          color: '#1E293B'
                        }}>
                          {v.institution_name}
                        </h3>

                        {app && (
                          <span style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: 11.5,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE'
                          }}>
                            {app.reference}
                          </span>
                        )}

                        {app?.application_type && (
                          <span style={{
                            fontSize: 11,
                            color: '#64748B',
                            background: '#F8FAFC',
                            padding: '2px 6px',
                            borderRadius: 4,
                            border: '1px solid #E2E8F0'
                          }}>
                            {app.application_type}
                          </span>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginTop: 4,
                        fontSize: 12,
                        color: '#64748B'
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={13} color="#2563EB" />
                          <span>Inspection: </span>
                          <b style={{ color: isOverdue ? '#D64545' : '#1E293B' }}>
                            {new Date(v.scheduled_date).toLocaleDateString('en-IN', {
                              weekday: 'short',
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </b>
                        </span>

                        {isToday && (
                          <span style={{
                            background: '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid #BFDBFE',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700
                          }}>
                            TODAY
                          </span>
                        )}

                        {isOverdue && (
                          <span style={{
                            background: '#FDF2F2',
                            color: '#D64545',
                            border: '1px solid #FDE2E2',
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontSize: 10.5,
                            fontWeight: 700
                          }}>
                            OVERDUE FOR REPORT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Visit Mode & Status Pill */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {getModeBadge(v.visit_mode)}

                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 9px',
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: isCompleted ? '#F0FDF4' : isOverdue ? '#FDF2F2' : '#EFF6FF',
                        border: `1px solid ${isCompleted ? '#DCFCE7' : isOverdue ? '#FDE2E2' : '#BFDBFE'}`,
                        color: isCompleted ? '#16845B' : isOverdue ? '#D64545' : '#2563EB'
                      }}>
                        {isCompleted && <CheckCircle2 size={12} color="#16845B" />}
                        {v.status}
                      </span>
                    </div>
                  </div>

                  {/* Visit Badges: Location, Attendance, Evidence, Outcome */}
                  {(v.location_details || v.proof_submission_status || v.visit_occurred || v.evidence_verification_status || v.inspection_outcome) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '6px 0', borderTop: '1px dashed #E2E8F0' }}>
                      {v.location_details && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#334155' }}>
                          <MapPin size={11} color="#2563EB" />
                          <span>{v.location_details}</span>
                        </span>
                      )}
                      {v.proof_submission_status && v.proof_submission_status !== 'NOT_SUBMITTED' && (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background:
                            v.proof_submission_status === 'ACCEPTED' ? '#ECFDF5' :
                            v.proof_submission_status === 'REJECTED' ? '#FEF2F2' :
                            v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#FFFBEB' :
                            v.proof_submission_status === 'SUBMITTED' ? '#EFF6FF' :
                            v.proof_submission_status === 'AI_COMPLETED' ? '#F5F3FF' : '#F8FAFC',
                          color:
                            v.proof_submission_status === 'ACCEPTED' ? '#047857' :
                            v.proof_submission_status === 'REJECTED' ? '#B91C1C' :
                            v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#B45309' :
                            v.proof_submission_status === 'SUBMITTED' ? '#1D4ED8' :
                            v.proof_submission_status === 'AI_COMPLETED' ? '#6D28D9' : '#475569',
                          border: `1px solid ${
                            v.proof_submission_status === 'ACCEPTED' ? '#A7F3D0' :
                            v.proof_submission_status === 'REJECTED' ? '#FECACA' :
                            v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' ? '#FDE68A' :
                            v.proof_submission_status === 'SUBMITTED' ? '#BFDBFE' :
                            v.proof_submission_status === 'AI_COMPLETED' ? '#DDD6FE' : '#E2E8F0'
                          }`
                        }}>
                          Visit Proof: {v.proof_submission_status.replace(/_/g, ' ')}
                        </span>
                      )}
                      {v.visit_occurred && (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: v.visit_occurred === 'OCCURRED' ? '#ECFDF5' : '#FEF2F2',
                          color: v.visit_occurred === 'OCCURRED' ? '#047857' : '#B91C1C',
                          border: `1px solid ${v.visit_occurred === 'OCCURRED' ? '#A7F3D0' : '#FECACA'}`
                        }}>
                          {v.visit_occurred === 'OCCURRED' ? '✓ Visit Occurred' : `✕ Did Not Occur: ${v.missed_reason || 'Unspecified'}`}
                        </span>
                      )}
                      {v.evidence_verification_status && (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: v.evidence_verification_status === 'VERIFIED' ? '#EFF6FF' : '#FFFBEB',
                          color: v.evidence_verification_status === 'VERIFIED' ? '#1D4ED8' : '#B45309',
                          border: `1px solid ${v.evidence_verification_status === 'VERIFIED' ? '#BFDBFE' : '#FDE68A'}`
                        }}>
                          Evidence: {v.evidence_verification_status}
                        </span>
                      )}
                      {v.inspection_outcome && (
                        <span style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: v.inspection_outcome === 'RECOMMENDED' ? '#ECFDF5' : '#FEF2F2',
                          color: v.inspection_outcome === 'RECOMMENDED' ? '#047857' : '#B91C1C',
                          border: `1px solid ${v.inspection_outcome === 'RECOMMENDED' ? '#A7F3D0' : '#FECACA'}`
                        }}>
                          Outcome: {v.inspection_outcome}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Middle Content: Panel Members & Findings Snippet */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: isCompleted && v.report_summary ? '1fr 1fr' : '1fr',
                    gap: 12
                  }}>
                    {/* Panel Members Box */}
                    <div style={{
                      background: '#F8FAFC',
                      border: '1px solid #E2E8F0',
                      borderRadius: 8,
                      padding: '10px 14px',
                      fontSize: 12
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Assigned EVC Panel
                        </span>
                        <button
                          type="button"
                          onClick={() => setExpandedPanelVisitId(isPanelExpanded ? null : v.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#2563EB',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2
                          }}
                        >
                          <span>{isPanelExpanded ? 'Collapse' : otherExpertsCount > 0 ? `+${otherExpertsCount} more` : 'Details'}</span>
                          {isPanelExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </div>

                      <div style={{ color: '#1E293B', fontWeight: 500 }}>
                        {isPanelExpanded ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
                            {panelParts.map((member, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#2563EB' }} />
                                <span>{member}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span>
                            {leadChair}
                            {otherExpertsCount > 0 && (
                              <span style={{ color: '#64748B', fontWeight: 400 }}>
                                {' '}and {otherExpertsCount} other appointed academic expert(s)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Report Findings Snippet (If completed) */}
                    {isCompleted && v.report_summary && (
                      <div style={{
                        background: '#F0FDF4',
                        border: '1px solid #DCFCE7',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 12
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#16845B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Committee Findings Summary
                          </span>
                          <span style={{ fontSize: 10.5, color: '#16845B', fontWeight: 600 }}>
                            Verified
                          </span>
                        </div>
                        <p style={{
                          margin: 0,
                          color: '#14532D',
                          lineHeight: 1.4,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}>
                          {v.report_summary}
                        </p>
                      </div>
                    )}

                    {/* Awaiting Findings Banner (If scheduled/pending) */}
                    {!isCompleted && !v.report_summary && (
                      <div style={{
                        background: '#FEF7EC',
                        border: '1px solid #FCE6CA',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309' }}>
                          <AlertCircle size={14} />
                          <span>
                            <b>Pending Action: </b>
                            {new Date(v.scheduled_date) <= today
                              ? 'Inspection completed on site. Awaiting formal submission of committee findings.'
                              : 'Inspection scheduled. Committee briefing and dossier verification in progress.'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inspection Lifecycle Stepper */}
                  <div style={{
                    paddingTop: 10,
                    borderTop: '1px solid #F1F5F9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 11.5
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#64748B', fontWeight: 600 }}>Inspection Lifecycle:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontWeight: lifecycleStep >= 1 ? 600 : 400,
                          color: lifecycleStep >= 1 ? '#16845B' : '#94A3B8'
                        }}>
                          1. Scheduled
                        </span>
                        <span style={{ color: '#CBD5E1' }}>→</span>
                        <span style={{
                          fontWeight: lifecycleStep >= 2 ? 600 : 400,
                          color: lifecycleStep >= 2 ? '#16845B' : '#94A3B8'
                        }}>
                          2. Visit Conducted
                        </span>
                        <span style={{ color: '#CBD5E1' }}>→</span>
                        <span style={{
                          fontWeight: lifecycleStep >= 3 ? 600 : 400,
                          color: lifecycleStep >= 3 ? '#16845B' : '#94A3B8'
                        }}>
                          3. Report Submitted
                        </span>
                        <span style={{ color: '#CBD5E1' }}>→</span>
                        <span style={{
                          fontWeight: lifecycleStep >= 4 ? 600 : 400,
                          color: lifecycleStep >= 4 ? '#16845B' : '#94A3B8'
                        }}>
                          4. Order Ready
                        </span>
                      </div>
                    </div>

                    {/* Contextual Action Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {/* EVC Visit Proof & Authenticity Verification */}
                      <button
                        type="button"
                        id={`btn-visit-proof-${v.id}`}
                        onClick={() => setProofModalVisitId(v.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 6,
                          background:
                            v.proof_submission_status === 'ACCEPTED'
                              ? '#ECFDF5'
                              : v.proof_submission_status === 'SUBMITTED' && user?.role !== 'evc_expert'
                              ? '#EFF6FF'
                              : v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' && user?.role === 'evc_expert'
                              ? '#FFFBEB'
                              : '#1E293B',
                          border: `1px solid ${
                            v.proof_submission_status === 'ACCEPTED'
                              ? '#A7F3D0'
                              : v.proof_submission_status === 'SUBMITTED' && user?.role !== 'evc_expert'
                              ? '#3B82F6'
                              : v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' && user?.role === 'evc_expert'
                              ? '#F59E0B'
                              : '#1E293B'
                          }`,
                          color:
                            v.proof_submission_status === 'ACCEPTED'
                              ? '#047857'
                              : v.proof_submission_status === 'SUBMITTED' && user?.role !== 'evc_expert'
                              ? '#1D4ED8'
                              : v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED' && user?.role === 'evc_expert'
                              ? '#B45309'
                              : '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          transition: 'all 0.12s ease'
                        }}
                        title="Upload, screen with AI, or verify physical visit photographs and location"
                      >
                        <Camera size={13} />
                        <span>
                          {user?.role === 'evc_expert'
                            ? (v.proof_submission_status === 'ACCEPTED'
                                ? 'Visit Proof (Accepted)'
                                : v.proof_submission_status === 'SUBMITTED'
                                ? 'Visit Proof (Submitted)'
                                : v.proof_submission_status === 'ADDITIONAL_EVIDENCE_REQUIRED'
                                ? 'Upload Additional Proof (!)'
                                : 'Visit Proof & Photos')
                            : (v.proof_submission_status === 'SUBMITTED'
                                ? 'Review Visit Proof (!)'
                                : v.proof_submission_status === 'ACCEPTED'
                                ? 'Visit Proof (Accepted)'
                                : 'Visit Proof & Verification')}
                        </span>
                      </button>
                      {/* Reschedule Button (When visit pending) */}
                      {!isCompleted && user?.role !== 'institution' && (
                        <button
                          type="button"
                          id={`btn-reschedule-${v.id}`}
                          onClick={() => handleOpenReschedule(v)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            borderRadius: 6,
                            background: '#FFFFFF',
                            border: '1px solid #D97706',
                            color: '#B45309',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <RotateCcw size={13} />
                          <span>Reschedule</span>
                        </button>
                      )}

                      {/* View Report Button */}
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVisit(v);
                            setIsViewReportOpen(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '5px 12px',
                            borderRadius: 6,
                            background: '#FFFFFF',
                            border: '1px solid #2563EB',
                            color: '#2563EB',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <Eye size={13} />
                          <span>View Full Report</span>
                        </button>
                      )}

                      {/* Evidences Button */}
                      <button
                        type="button"
                        id={`btn-evidences-${v.id}`}
                        onClick={() => handleOpenEvidences(v)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 6,
                          background: '#F8FAFC',
                          border: '1px solid #CBD5E1',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer'
                        }}
                      >
                        <ClipboardList size={12} />
                        <span>Evidence</span>
                      </button>

                      {/* Prominent Approve Next Stage Button (for completed inspections) */}
                      {isCompleted && user?.role !== 'institution' && (
                        <button
                          type="button"
                          id={`btn-approve-evc-${v.id}`}
                          onClick={() => handleOpenApprove(v)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 14px',
                            borderRadius: 6,
                            background: '#16845B',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(22, 132, 91, 0.25)',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span>Approve Next Stage</span>
                        </button>
                      )}

                      {/* Record Findings Button for EVC Expert / Officer */}
                      {!isCompleted && user?.role !== 'institution' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedVisit(v);
                            setReportSummary(v.report_summary || '');
                            setRecommendations(v.recommendations || '');
                            setReportDirty(false);
                            setIsReportOpen(true);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '6px 14px',
                            borderRadius: 6,
                            background: '#2457C5',
                            border: 'none',
                            color: '#FFFFFF',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            boxShadow: '0 1px 2px rgba(36, 87, 197, 0.25)',
                            transition: 'all 0.12s ease'
                          }}
                        >
                          <FileCheck2 size={13} />
                          <span>Record Inspection Findings</span>
                        </button>
                      )}

                      {/* Open Application Dossier if available */}
                      {app && onSelectApplication && (
                        <button
                          type="button"
                          onClick={() => onSelectApplication(app)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '5px 10px',
                            borderRadius: 6,
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            color: '#475569',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer'
                          }}
                          title={`Open ${app.reference} dossier`}
                        >
                          <ExternalLink size={12} />
                          <span>Dossier</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ====================================================================
          7. MODALS: SCHEDULE, RECORD REPORT & VIEW FULL REPORT
          ==================================================================== */}

      {/* MODAL 1: Schedule Inspection */}
      {isScheduleOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h3 id="schedule-modal-title" style={{ margin: 0, fontSize: 16 }}>Schedule EVC Inspection</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Assign physical or virtual inspection panel under AICTE statutory mandate
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={handleCloseSchedule}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSchedule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Application Selection */}
                <div>
                  <label htmlFor="evc-app-select" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Select Application for Inspection <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <select
                    id="evc-app-select"
                    required
                    value={selectedAppId}
                    onChange={(e) => {
                      setSelectedAppId(Number(e.target.value));
                      setScheduleDirty(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      background: '#FFFFFF'
                    }}
                    aria-required="true"
                  >
                    <option value="">-- Choose Application Dossier --</option>
                    {evcPendingApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.reference} — {a.institution_name} ({a.application_type} · Stage: {a.current_stage})
                      </option>
                    ))}
                  </select>
                  {evcPendingApps.length === 0 && (
                    <span style={{ display: 'block', fontSize: 11, color: '#D97706', marginTop: 3 }}>
                      Notice: No applications are currently flagged in SCRUTINY or EVC_PENDING stage.
                    </span>
                  )}
                </div>

                {/* Location / Campus Details */}
                <div>
                  <label htmlFor="evc-location-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Campus & Inspection Location Details
                  </label>
                  <input
                    id="evc-location-input"
                    type="text"
                    placeholder="e.g. Main Engineering Block, Mechanical & AI Labs, Pune Campus"
                    value={locationDetails}
                    onChange={(e) => {
                      setLocationDetails(e.target.value);
                      setScheduleDirty(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                    Designated physical campus facility or laboratory zone
                  </span>
                </div>

                {/* Date & Mode Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label htmlFor="evc-schedule-date" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                      Inspection Date <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <input
                      id="evc-schedule-date"
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => {
                        setScheduledDate(e.target.value);
                        setScheduleDirty(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        boxSizing: 'border-box'
                      }}
                      aria-required="true"
                    />
                    <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                      Minimum 48 hours notice mandated
                    </span>
                  </div>

                  <div>
                    <label htmlFor="evc-visit-mode" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                      Inspection Mode <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      id="evc-visit-mode"
                      value={visitMode}
                      onChange={(e) => {
                        setVisitMode(e.target.value as any);
                        setScheduleDirty(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="PHYSICAL">Physical On-Site Inspection</option>
                      <option value="VIRTUAL">Virtual Document / Lab Verification</option>
                      <option value="HYBRID">Hybrid (Physical & Live Streaming)</option>
                    </select>
                    <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                      Physical visit standard for infrastructure
                    </span>
                  </div>
                </div>

                {/* Committee Panel Members */}
                <div>
                  <label htmlFor="evc-panel-members" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    EVC Panel Committee Members <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    id="evc-panel-members"
                    rows={3}
                    required
                    placeholder="Enter Chairperson, Subject Experts, and Regional Nominee names..."
                    value={committeeMembers}
                    onChange={(e) => {
                      setCommitteeMembers(e.target.value);
                      setScheduleDirty(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                    aria-required="true"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2, fontSize: 11, color: '#64748B' }}>
                    <span>Standard panel: 1 Senior Academician Chair + 1 Subject Expert + 1 Observer</span>
                    <span>{committeeMembers.length} chars</span>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseSchedule}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || !selectedAppId || !scheduledDate || committeeMembers.trim().length < 5}
                  style={{ background: '#2457C5', borderColor: '#2457C5' }}
                >
                  {isSubmitting ? 'Confirming...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Report Findings */}
      {isReportOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h3 id="report-modal-title" style={{ margin: 0, fontSize: 16 }}>File EVC Inspection Findings</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Statutory submission for {selectedVisit.institution_name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={handleCloseReport}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                  <b style={{ display: 'block', fontSize: 13, color: '#1E293B' }}>{selectedVisit.institution_name}</b>
                  <span style={{ fontSize: 11.5, color: '#64748B' }}>
                    Inspection Date: {selectedVisit.scheduled_date} · Mode: {selectedVisit.visit_mode} · Panel: {selectedVisit.committee_members.split(',')[0]}
                  </span>
                  {selectedVisit.location_details && (
                    <div style={{ fontSize: 11.5, color: '#2563EB', marginTop: 3 }}>
                      📍 Location: {selectedVisit.location_details}
                    </div>
                  )}
                </div>

                {/* Visit Attendance / Occurrence Verification */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                      Inspection Visit Status <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      id="evc-visit-occurred-select"
                      value={visitOccurred}
                      onChange={(e) => setVisitOccurred(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="OCCURRED">Visit Occurred & Committee Quorum Verified</option>
                      <option value="DID_NOT_OCCUR">Visit Did Not Occur / Postponed</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                      Inspection Outcome <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <select
                      id="evc-outcome-select"
                      value={inspectionOutcome}
                      onChange={(e) => setInspectionOutcome(e.target.value as any)}
                      style={{
                        width: '100%',
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid #CBD5E1',
                        fontSize: 12.5,
                        background: '#FFFFFF'
                      }}
                    >
                      <option value="RECOMMENDED">Recommended for Approval</option>
                      <option value="DEFICIENCIES_NOTED">Deficiencies Noted / Rectification Req.</option>
                      <option value="REJECTED">Not Recommended / Rejected</option>
                    </select>
                  </div>
                </div>

                {visitOccurred === 'DID_NOT_OCCUR' && (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#DC2626', marginBottom: 4 }}>
                      Mandatory Reason for Non-Visit <span style={{ color: '#DC2626' }}>*</span>
                    </label>
                    <textarea
                      id="evc-missed-reason"
                      rows={2}
                      required
                      placeholder="State why the inspection could not take place (e.g. Institution campus closed, panel transport disruption, official adjournment)..."
                      value={missedReason}
                      onChange={(e) => setMissedReason(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: '1px solid #EF4444',
                        fontSize: 12.5,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* Structured Statutory Inspection Checklist */}
                {visitOccurred === 'OCCURRED' && (
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 12px' }}>
                    <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 8 }}>
                      Mandatory Statutory Checklist (AICTE APH Guidelines)
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checklistLand}
                          onChange={(e) => setChecklistLand(e.target.checked)}
                        />
                        <span>Land & Built-up Area Verified</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checklistLabs}
                          onChange={(e) => setChecklistLabs(e.target.checked)}
                        />
                        <span>Labs & High-Speed Bandwidth</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checklistFaculty}
                          onChange={(e) => setChecklistFaculty(e.target.checked)}
                        />
                        <span>Faculty Cadre Ratio & Biometrics</span>
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checklistSafety}
                          onChange={(e) => setChecklistSafety(e.target.checked)}
                        />
                        <span>Fire Safety & Barrier-Free Access</span>
                      </label>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="evc-report-summary" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Infrastructure & Lab Readiness Observations <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    id="evc-report-summary"
                    rows={4}
                    required
                    placeholder="e.g. Inspected 3 computational labs with 180 working systems. High-speed leased line functional. Faculty attendance registers verified..."
                    value={reportSummary}
                    onChange={(e) => {
                      setReportSummary(e.target.value);
                      setReportDirty(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                    aria-required="true"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, fontSize: 11, color: '#64748B' }}>
                    <span>Record verified lab, library, faculty, and barrier-free facility findings</span>
                    <span>{reportSummary.length} chars (min 10)</span>
                  </div>
                </div>

                <div>
                  <label htmlFor="evc-recommendations" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Committee Recommendations for Approval Bureau
                  </label>
                  <textarea
                    id="evc-recommendations"
                    rows={2}
                    placeholder="e.g. Recommended for grant of approval with intake of 60 seats in AI & Data Science..."
                    value={recommendations}
                    onChange={(e) => {
                      setRecommendations(e.target.value);
                      setReportDirty(true);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                    Conclusive advisory note to Standing Hearing / Appellate Committee
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseReport}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || reportSummary.trim().length < 10}
                  style={{ background: '#16845B', borderColor: '#16845B' }}
                >
                  {isSubmitting ? 'Filing Report...' : 'Submit EVC Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: View Full Completed Report */}
      {isViewReportOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="view-report-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 id="view-report-modal-title" style={{ margin: 0, fontSize: 16 }}>EVC Inspection Report</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Official statutory record for {selectedVisit.institution_name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={() => {
                  setIsViewReportOpen(false);
                  setSelectedVisit(null);
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Header Box */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8,
                padding: '12px 16px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <b style={{ fontSize: 14, color: '#1E293B' }}>{selectedVisit.institution_name}</b>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: '#F0FDF4',
                    color: '#16845B',
                    border: '1px solid #DCFCE7'
                  }}>
                    ● COMPLETED
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span>Date: <b>{selectedVisit.scheduled_date}</b></span>
                  <span>Mode: <b>{selectedVisit.visit_mode}</b></span>
                  <span>Assigned By: <b>{selectedVisit.assigned_by}</b></span>
                </div>
              </div>

              {/* Panel Roster */}
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                  Appointed Expert Committee
                </span>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#1E293B' }}>
                  {selectedVisit.committee_members}
                </div>
              </div>

              {/* Findings Summary */}
              <div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                  Inspection Observations & Infrastructure Verification
                </span>
                <div style={{ background: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: 6, padding: '12px 14px', fontSize: 12.5, color: '#14532D', lineHeight: 1.5 }}>
                  {selectedVisit.report_summary || 'Detailed inspection observations filed in council archives.'}
                </div>
              </div>

              {/* Recommendations */}
              {selectedVisit.recommendations && (
                <div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>
                    Committee Recommendation
                  </span>
                  <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 6, padding: '10px 14px', fontSize: 12.5, color: '#1E40AF', lineHeight: 1.45 }}>
                    {selectedVisit.recommendations}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setIsViewReportOpen(false);
                  setSelectedVisit(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL 4: Reschedule Inspection */}
      {isRescheduleOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="reschedule-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <div>
                <h3 id="reschedule-modal-title" style={{ margin: 0, fontSize: 16 }}>Reschedule EVC Inspection</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Update inspection date with mandatory statutory justification
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={() => setIsRescheduleOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#F8FAFC', padding: '10px 14px', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                  <b style={{ display: 'block', fontSize: 13, color: '#1E293B' }}>{selectedVisit.institution_name}</b>
                  <span style={{ fontSize: 11.5, color: '#64748B' }}>
                    Currently Scheduled: {selectedVisit.scheduled_date} ({selectedVisit.visit_mode})
                  </span>
                </div>

                <div>
                  <label htmlFor="evc-new-date" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    New Inspection Date <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <input
                    id="evc-new-date"
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="evc-reschedule-location" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Updated Location / Campus Details
                  </label>
                  <input
                    id="evc-reschedule-location"
                    type="text"
                    value={rescheduleLocation}
                    onChange={(e) => setRescheduleLocation(e.target.value)}
                    placeholder="e.g. Pune Main Campus, Building 2, Lab 4"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="evc-reschedule-reason" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Mandatory Reason for Rescheduling <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea
                    id="evc-reschedule-reason"
                    rows={3}
                    required
                    placeholder="Explain the statutory reason for rescheduling (e.g. Committee expert unavailability, university examination conflict)..."
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                    This reason will be logged in the immutable audit trail and visible in stage history.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsRescheduleOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || !rescheduleDate || rescheduleReason.trim().length < 5}
                  style={{ background: '#D97706', borderColor: '#D97706' }}
                >
                  {isSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Approve Next Stage */}
      {isApproveOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="approve-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h3 id="approve-modal-title" style={{ margin: 0, fontSize: 16 }}>Approve Next Stage (EVC Completion)</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Verify inspection outcome & forward dossier to Standing Committee Review (SAC/SHC)
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={() => setIsApproveOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleApproveNextStageSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                  <b style={{ display: 'block', fontSize: 14, color: '#1E293B', marginBottom: 6 }}>
                    {selectedVisit.institution_name}
                  </b>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#475569' }}>
                    <div>Visit Mode: <b>{selectedVisit.visit_mode}</b></div>
                    <div>Inspection Date: <b>{selectedVisit.scheduled_date}</b></div>
                    <div>Attendance: <b style={{ color: selectedVisit.visit_occurred === 'DID_NOT_OCCUR' ? '#DC2626' : '#16845B' }}>{selectedVisit.visit_occurred || 'OCCURRED'}</b></div>
                    <div>Evidence: <b>{selectedVisit.evidence_verification_status || 'VERIFIED'}</b></div>
                  </div>
                  {selectedVisit.inspection_outcome && (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#1E40AF' }}>
                      Inspection Outcome: <b>{selectedVisit.inspection_outcome}</b>
                    </div>
                  )}
                </div>

                {selectedVisit.visit_occurred === 'DID_NOT_OCCUR' && (
                  <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 6, padding: '10px 12px', color: '#991B1B', fontSize: 12 }}>
                    ⚠️ <b>Regulatory Warning:</b> Visit is recorded as "DID_NOT_OCCUR" ({selectedVisit.missed_reason}). The approval workflow will block progression unless the visit occurred or an authorised override is recorded.
                  </div>
                )}

                <div>
                  <label htmlFor="evc-approve-remarks" style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#1E293B', marginBottom: 4 }}>
                    Officer Endorsement & Transmission Remarks
                  </label>
                  <textarea
                    id="evc-approve-remarks"
                    rows={3}
                    placeholder="Enter endorsement remarks for the Standing Hearing Committee / Approval Bureau..."
                    value={approveRemarks}
                    onChange={(e) => setApproveRemarks(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: '1px solid #CBD5E1',
                      fontSize: 12.5,
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: 11, color: '#64748B', display: 'block', marginTop: 2 }}>
                    Remarks will be permanently recorded in stage history and committee minutes.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsApproveOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting}
                  style={{ background: '#16845B', borderColor: '#16845B' }}
                >
                  {isSubmitting ? 'Advancing Stage...' : 'Approve Next Stage (SAC/SHC)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Inspection Evidences & Geotagged Proofs */}
      {isEvidenceModalOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div>
                <h3 id="evidence-modal-title" style={{ margin: 0, fontSize: 16 }}>Inspection Evidences & Geotagged Files</h3>
                <span style={{ fontSize: 11.5, color: '#64748B' }}>
                  Application #{selectedVisit.application_id} — {selectedVisit.institution_name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#64748B' }}
                onClick={() => setIsEvidenceModalOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {isLoadingEvidences ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748B' }}>Loading inspection evidences...</div>
              ) : currentEvidences.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>No inspection evidences filed yet for this visit.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {currentEvidences.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: '1px solid #E2E8F0',
                        background: '#FFFFFF',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8
                      }}
                    >
                      <div>
                        <b style={{ display: 'block', fontSize: 13, color: '#1E293B' }}>{ev.evidence_type}</b>
                        <span style={{ fontSize: 11.5, color: '#64748B' }}>
                          Uploaded {new Date(ev.created_at).toLocaleString()} · Status: <b style={{ color: ev.verification_status === 'VERIFIED' ? '#16845B' : ev.verification_status === 'REJECTED' ? '#DC2626' : '#D97706' }}>{ev.verification_status || 'PENDING'}</b>
                        </span>
                        {ev.remarks && (
                          <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            Remarks: {ev.remarks}
                          </div>
                        )}
                      </div>

                      {user?.role !== 'institution' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleVerifyEvidenceItem(ev.id, 'VERIFIED')}
                            disabled={isSubmitting}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#ECFDF5',
                              border: '1px solid #A7F3D0',
                              color: '#047857',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✓ Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyEvidenceItem(ev.id, 'REJECTED')}
                            disabled={isSubmitting}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              background: '#FEF2F2',
                              border: '1px solid #FECACA',
                              color: '#B91C1C',
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✕ Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '12px 18px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsEvidenceModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI-Powered EVC Visit Proof & Authenticity Verification Modal */}
      {proofModalVisitId && (
        <EvcVisitProofModal
          visitId={proofModalVisitId}
          user={user}
          onClose={() => setProofModalVisitId(null)}
          onUpdated={loadVisits}
        />
      )}
    </div>
  );
};
