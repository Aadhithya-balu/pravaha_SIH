import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  UserCheck,
  Building2,
  FileCheck2,
  X
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

  // Schedule fields
  const [selectedAppId, setSelectedAppId] = useState<number | ''>('');
  const [committeeMembers, setCommitteeMembers] = useState(
    'Prof. S. Ramanujan (Chairperson), Dr. K. Sharma (Subject Expert), AICTE Regional Nominee'
  );
  const [scheduledDate, setScheduledDate] = useState('');
  const [visitMode, setVisitMode] = useState<'PHYSICAL' | 'VIRTUAL' | 'HYBRID'>('PHYSICAL');

  // Report fields
  const [reportSummary, setReportSummary] = useState('');
  const [recommendations, setRecommendations] = useState('');

  async function loadVisits() {
    try {
      const data = await api<EVCVisit[]>('/evc');
      setVisits(data);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  }

  useEffect(() => {
    loadVisits();
  }, []);

  const evcPendingApps = applications.filter((a) => a.current_stage === 'EVC_PENDING' || a.current_stage === 'SCRUTINY');

  const filteredVisits = visits.filter((v) => {
    if (statusFilter === 'ALL') return true;
    return v.status === statusFilter;
  });

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAppId || !scheduledDate) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api('/evc', {
        method: 'POST',
        body: JSON.stringify({
          application_id: Number(selectedAppId),
          committee_members: committeeMembers,
          scheduled_date: scheduledDate,
          visit_mode: visitMode
        })
      });
      setIsScheduleOpen(false);
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReportSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedVisit) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api(`/evc/${selectedVisit.id}/update`, {
        method: 'POST',
        body: JSON.stringify({
          status: 'COMPLETED',
          report_summary: reportSummary,
          recommendations: recommendations
        })
      });
      setIsReportOpen(false);
      setSelectedVisit(null);
      await loadVisits();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Expert Visiting Committee (EVC) Scheduling & Tracking</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Managing on-site & hybrid physical verification visits by statutory inspection panels
            </span>
          </div>

          {user?.role !== 'institution' && (
            <button className="btn-primary" onClick={() => setIsScheduleOpen(true)}>
              <Plus size={15} />
              <span>Schedule New EVC</span>
            </button>
          )}
        </div>

        {errorMsg && <div className="alert-banner danger" style={{ marginBottom: 14 }}>{errorMsg}</div>}

        {/* Filter bar */}
        <div className="filter-bar">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Inspection Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="POSTPONED">Postponed</option>
          </select>
        </div>

        {/* EVC Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {filteredVisits.length === 0 ? (
            <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No EVC inspections found for the selected filter.
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
                    gap: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="badge badge-stage">{v.visit_mode} VISIT</span>
                    <span className={`badge badge-${isCompleted ? 'completed' : 'in_progress'}`}>
                      {v.status}
                    </span>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: 15, fontFamily: 'Manrope', color: 'var(--text-main)' }}>
                      {v.institution_name}
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} />
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
                    </div>
                  )}

                  {/* Actions for EVC Expert / Officer */}
                  {!isCompleted && user?.role !== 'institution' && (
                    <button
                      className="btn-secondary"
                      style={{ marginTop: 'auto', justifyContent: 'center' }}
                      onClick={() => {
                        setSelectedVisit(v);
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
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Schedule Expert Visiting Committee (EVC)</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsScheduleOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSchedule}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Select Application for Inspection *</label>
                  <select
                    required
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(Number(e.target.value))}
                  >
                    <option value="">-- Choose Application --</option>
                    {evcPendingApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.reference} — {a.institution_name} ({a.application_type})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Inspection Scheduled Date *</label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Inspection Mode *</label>
                    <select
                      value={visitMode}
                      onChange={(e) => setVisitMode(e.target.value as any)}
                    >
                      <option value="PHYSICAL">Physical On-Site Inspection</option>
                      <option value="VIRTUAL">Virtual Document / Lab Verification</option>
                      <option value="HYBRID">Hybrid (Physical & Live Streaming)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>EVC Panel Committee Members *</label>
                  <textarea
                    rows={3}
                    required
                    value={committeeMembers}
                    onChange={(e) => setCommitteeMembers(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsScheduleOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Report Findings Modal */}
      {isReportOpen && selectedVisit && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>File EVC Inspection Findings & Report</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsReportOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReportSubmit}>
              <div className="modal-body">
                <div>
                  <b style={{ display: 'block', fontSize: 13 }}>{selectedVisit.institution_name}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Inspection Date: {selectedVisit.scheduled_date} · Mode: {selectedVisit.visit_mode}
                  </span>
                </div>

                <div className="form-group">
                  <label>Physical Infrastructure Observations & Lab Readiness *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="e.g. Inspected 3 computational labs with 180 working systems. High-speed leased line functional. Faculty attendance registers verified..."
                    value={reportSummary}
                    onChange={(e) => setReportSummary(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Committee Recommendations for Approval Bureau</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Recommended for grant of approval with intake of 60 seats in AI & Data Science..."
                    value={recommendations}
                    onChange={(e) => setRecommendations(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsReportOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Filing...' : 'Submit EVC Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
