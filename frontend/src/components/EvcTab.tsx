import React, { useState, useEffect } from 'react';
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
  RotateCcw
} from 'lucide-react';
import { EVCVisit, Application, User } from '../types';
import { api } from '../api';

interface EvcTabProps {
  user: User | null;
  applications: Application[];
  onRefresh: () => void;
}

export const EvcTab: React.FC<EvcTabProps> = ({ user, applications, onRefresh }) => {
  const [visits, setVisits] = useState<EVCVisit[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<EVCVisit | null>(null);
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

  const filteredVisits = visits.filter((v) => {
    if (statusFilter === 'ALL') return true;
    return v.status === statusFilter;
  });

  function handleOpenSchedule() {
    setSelectedAppId(evcPendingApps.length > 0 ? evcPendingApps[0].id : '');
    setScheduledDate(defaultDate);
    setVisitMode('PHYSICAL');
    setCommitteeMembers('Prof. S. Ramanujan (Chairperson), Dr. K. Sharma (Subject Expert), AICTE Regional Nominee');
    setScheduleDirty(false);
    setIsScheduleOpen(true);
  }

  function handleCloseSchedule() {
    if (scheduleDirty && !window.confirm('You have unsaved changes in the scheduling form. Are you sure you want to discard them?')) {
      return;
    }
    setIsScheduleOpen(false);
    setScheduleDirty(false);
  }

  function handleCloseReport() {
    if (reportDirty && !window.confirm('You have unsaved changes in the inspection report. Are you sure you want to discard them?')) {
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
          visit_mode: visitMode
        })
      });
      setIsScheduleOpen(false);
      setScheduleDirty(false);
      setSuccessMsg('Expert Visiting Committee (EVC) scheduled successfully.');
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to schedule EVC visit.');
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
          recommendations: recommendations.trim()
        })
      });
      setIsReportOpen(false);
      setSelectedVisit(null);
      setReportDirty(false);
      setSuccessMsg(`Inspection findings recorded successfully for ${selectedVisit.institution_name}.`);
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
          <span className="badge badge-stage" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={11} /> Physical Visit
          </span>
        );
      case 'VIRTUAL':
        return (
          <span className="badge badge-stage" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' }}>
            <Video size={11} /> Virtual Lab
          </span>
        );
      case 'HYBRID':
        return (
          <span className="badge badge-stage" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
            <MonitorCheck size={11} /> Hybrid Visit
          </span>
        );
      default:
        return <span className="badge badge-stage">{mode}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Expert Visiting Committee (EVC) Scheduling & Tracking</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Managing on-site and hybrid physical verification visits by statutory inspection panels under APH guidelines
            </span>
          </div>

          {user?.role !== 'institution' && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleOpenSchedule}
              id="btn-schedule-evc"
            >
              <Plus size={15} />
              <span>Schedule New EVC</span>
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="alert-banner danger" style={{ marginBottom: 14 }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
            <button
              style={{ background: 'transparent', border: 0, cursor: 'pointer', marginLeft: 'auto', fontWeight: 800 }}
              onClick={() => setErrorMsg('')}
            >
              ×
            </button>
          </div>
        )}

        {successMsg && (
          <div className="alert-banner info" style={{ marginBottom: 14 }}>
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
            <button
              style={{ background: 'transparent', border: 0, cursor: 'pointer', marginLeft: 'auto', fontWeight: 800 }}
              onClick={() => setSuccessMsg('')}
            >
              ×
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-bar">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Filter Status:</span>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter EVC inspections by status"
            >
              <option value="ALL">All Inspection Statuses ({visits.length})</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="POSTPONED">Postponed</option>
            </select>
          </label>

          {statusFilter !== 'ALL' && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => setStatusFilter('ALL')}
            >
              <RotateCcw size={11} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {/* EVC Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {filteredVisits.length === 0 ? (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Calendar size={26} />
                </div>
                <div className="empty-state-title">No EVC Inspections Found</div>
                <div className="empty-state-desc">
                  {statusFilter !== 'ALL'
                    ? `No inspections are currently recorded with status "${statusFilter}". Try selecting a different filter.`
                    : 'There are no Expert Visiting Committee inspections currently scheduled or completed.'}
                </div>
                <div className="empty-state-actions">
                  {statusFilter !== 'ALL' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setStatusFilter('ALL')}
                    >
                      Show All Inspections
                    </button>
                  )}
                  {user?.role !== 'institution' && (
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleOpenSchedule}
                    >
                      <Plus size={14} />
                      <span>Schedule New Inspection</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            filteredVisits.map((v) => {
              const isCompleted = v.status === 'COMPLETED';
              return (
                <div
                  key={v.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '18px',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'box-shadow var(--transition-fast)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {getModeBadge(v.visit_mode)}
                    <span className={`badge badge-${isCompleted ? 'completed' : 'in_progress'}`}>
                      {v.status}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontFamily: 'Manrope', color: 'var(--text-main)' }}>
                      {v.institution_name}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Calendar size={13} color="var(--primary)" />
                      Inspection Date: <b>{v.scheduled_date}</b>
                    </span>
                  </div>

                  <div style={{ fontSize: 12, background: '#f8fafc', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <b style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>
                      Assigned Panel Members
                    </b>
                    <span style={{ color: '#334155' }}>{v.committee_members}</span>
                  </div>

                  {v.report_summary && (
                    <div style={{ fontSize: 12, background: '#f0fdf4', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0' }}>
                      <b style={{ display: 'block', fontSize: 10, color: '#15803d', textTransform: 'uppercase', marginBottom: 2 }}>
                        EVC Report Findings
                      </b>
                      <span style={{ color: '#166534' }}>{v.report_summary}</span>
                      {v.recommendations && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed #bbf7d0', fontSize: 11.5, color: '#14532d' }}>
                          <b>Recommendation:</b> {v.recommendations}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions for EVC Expert / Officer */}
                  {!isCompleted && user?.role !== 'institution' && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ marginTop: 'auto', justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedVisit(v);
                        setReportSummary(v.report_summary || '');
                        setRecommendations(v.recommendations || '');
                        setReportDirty(false);
                        setIsReportOpen(true);
                      }}
                    >
                      <FileCheck2 size={14} color="var(--primary)" />
                      <span>Record Inspection Findings</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Schedule EVC Modal */}
      {isScheduleOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="schedule-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h3 id="schedule-modal-title">Schedule Expert Visiting Committee (EVC)</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Assign physical or virtual inspection panel under AICTE statutory mandate
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={handleCloseSchedule}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSchedule}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Section 1: Target Dossier */}
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-navy)', textTransform: 'uppercase', marginBottom: 6 }}>
                    1. Application Dossier Selection
                  </h4>
                  <div className="form-group">
                    <label htmlFor="evc-app-select">
                      Select Application for Inspection <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      id="evc-app-select"
                      required
                      value={selectedAppId}
                      onChange={(e) => {
                        setSelectedAppId(Number(e.target.value));
                        setScheduleDirty(true);
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
                      <span className="form-field-hint" style={{ color: '#d97706' }}>
                        Notice: No applications are currently flagged in SCRUTINY or EVC_PENDING stage.
                      </span>
                    )}
                  </div>
                </div>

                {/* Section 2: Date & Logistics */}
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-navy)', textTransform: 'uppercase', marginBottom: 6 }}>
                    2. Inspection Schedule & Mode
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label htmlFor="evc-schedule-date">
                        Inspection Scheduled Date <span style={{ color: '#dc2626' }}>*</span>
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
                        aria-required="true"
                      />
                      <span className="form-field-hint">Minimum 48 hours notice mandated</span>
                    </div>

                    <div className="form-group">
                      <label htmlFor="evc-visit-mode">
                        Inspection Mode <span style={{ color: '#dc2626' }}>*</span>
                      </label>
                      <select
                        id="evc-visit-mode"
                        value={visitMode}
                        onChange={(e) => {
                          setVisitMode(e.target.value as any);
                          setScheduleDirty(true);
                        }}
                      >
                        <option value="PHYSICAL">Physical On-Site Inspection</option>
                        <option value="VIRTUAL">Virtual Document / Lab Verification</option>
                        <option value="HYBRID">Hybrid (Physical & Live Streaming)</option>
                      </select>
                      <span className="form-field-hint">Physical mandatory for New Institution</span>
                    </div>
                  </div>
                </div>

                {/* Section 3: Committee Composition */}
                <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-navy)', textTransform: 'uppercase', marginBottom: 6 }}>
                    3. Committee Panel Roster
                  </h4>
                  <div className="form-group">
                    <label htmlFor="evc-panel-members">
                      EVC Panel Committee Members <span style={{ color: '#dc2626' }}>*</span>
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
                      aria-required="true"
                    />
                    <span className="char-count">{committeeMembers.length} characters</span>
                    <span className="form-field-hint">
                      Standard panel requires 1 Chairperson (Senior Academician) + 1 Subject Expert + 1 Council Observer
                    </span>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
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
                >
                  {isSubmitting ? 'Confirming Schedule...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Report Findings Modal */}
      {isReportOpen && selectedVisit && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div>
                <h3 id="report-modal-title">File EVC Inspection Findings & Report</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Statutory submission for {selectedVisit.institution_name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={handleCloseReport}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <b style={{ display: 'block', fontSize: 13, color: 'var(--color-navy)' }}>{selectedVisit.institution_name}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Inspection Date: {selectedVisit.scheduled_date} · Mode: {selectedVisit.visit_mode} · Panel: {selectedVisit.committee_members}
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="evc-report-summary">
                    Physical Infrastructure & Lab Readiness Observations <span style={{ color: '#dc2626' }}>*</span>
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
                    aria-required="true"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="form-field-hint">Must record verified lab, library, faculty, and barrier-free facility findings</span>
                    <span className="char-count">{reportSummary.length} characters (min 10)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="evc-recommendations">
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
                  />
                  <span className="form-field-hint">Conclusive advisory note to Standing Appellate/Hearing Committee</span>
                </div>
              </div>

              <div className="modal-footer">
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
                >
                  {isSubmitting ? 'Filing Report...' : 'Submit EVC Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
