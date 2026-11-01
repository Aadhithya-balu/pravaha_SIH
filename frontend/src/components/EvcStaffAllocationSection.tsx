import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Calendar,
  Building2,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  Info,
  ChevronRight,
  Shield,
  FileText,
  User as UserIcon,
  Phone,
  Mail,
  X
} from 'lucide-react';
import { Application, User } from '../types';
import {
  fetchEvcEligibility,
  fetchEvcStaff,
  autoAssignEvc,
  manualAssignEvc,
  fetchEvcAssignmentHistory,
  updateEvcStaffAvailability
} from '../api';

interface EvcStaffAllocationSectionProps {
  user: User | null;
  applications: Application[];
  onRefresh: () => void;
}

export const EvcStaffAllocationSection: React.FC<EvcStaffAllocationSectionProps> = ({
  user,
  applications,
  onRefresh
}) => {
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin';

  // State
  const [eligibilityCache, setEligibilityCache] = useState<Record<number, any>>({});
  const [checkingAppId, setCheckingAppId] = useState<number | null>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Modals
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [isAutoAssignOpen, setIsAutoAssignOpen] = useState(false);
  const [isManualAssignOpen, setIsManualAssignOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form Fields
  const [proposedDate, setProposedDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [selectedStaffId, setSelectedStaffId] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');
  const [staffFilterRegion, setStaffFilterRegion] = useState('ALL');
  const [staffFilterAvailability, setStaffFilterAvailability] = useState('ALL');

  // Result / Rationale State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [aiRationaleResult, setAiRationaleResult] = useState<{
    staffName: string;
    staffEmail: string;
    rationale: string;
    visitId: number;
    scheduledDate: string;
  } | null>(null);

  // Filter applications that are in or transitioning to EVC inspection
  const candidateApps = applications.filter(
    (a) =>
      a.current_stage === 'EVC_PENDING' ||
      a.current_stage === 'EVC_SCHEDULED' ||
      a.current_stage === 'SCRUTINY' ||
      a.current_stage === 'RE_SCRUTINY'
  );

  // Load staff on mount if officer/admin
  useEffect(() => {
    if (isOfficerOrAdmin) {
      loadStaff();
    }
  }, [isOfficerOrAdmin]);

  // Pre-fetch eligibility for candidate apps
  useEffect(() => {
    if (isOfficerOrAdmin && candidateApps.length > 0) {
      candidateApps.forEach((app) => {
        if (!eligibilityCache[app.id]) {
          fetchEligibility(app.id);
        }
      });
    }
  }, [applications]);

  async function loadStaff() {
    setIsLoadingStaff(true);
    try {
      const data = await fetchEvcStaff();
      setStaffList(data);
    } catch (err) {
      console.error('Failed to load EVC staff list', err);
    } finally {
      setIsLoadingStaff(false);
    }
  }

  async function fetchEligibility(appId: number) {
    try {
      const data = await fetchEvcEligibility(appId);
      setEligibilityCache((prev) => ({ ...prev, [appId]: data }));
    } catch (err) {
      console.error(`Failed to fetch eligibility for app ${appId}`, err);
    }
  }

  // Trigger AI Auto Assignment
  function handleOpenAutoAssign(app: Application) {
    setSelectedApp(app);
    setErrorMsg('');
    setSuccessMsg('');
    setAiRationaleResult(null);
    setProposedDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setRemarks('');
    setIsAutoAssignOpen(true);
  }

  async function executeAutoAssign() {
    if (!selectedApp) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const result = await autoAssignEvc(selectedApp.id, {
        proposed_date: proposedDate,
        remarks: remarks.trim() || undefined
      });
      setAiRationaleResult({
        staffName: result.assigned_staff_name || 'Assigned EVC Expert',
        staffEmail: result.assigned_staff_email || '',
        rationale: result.assignment_reason || 'Allocated based on availability, jurisdiction proximity, and low workload.',
        visitId: result.id,
        scheduledDate: result.scheduled_date
      });
      setSuccessMsg(`AI Auto-Allocation Successful: Visit #${result.id} assigned.`);
      await fetchEligibility(selectedApp.id);
      loadStaff();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'AI Auto-Assignment failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Trigger Manual Assignment
  function handleOpenManualAssign(app: Application) {
    setSelectedApp(app);
    setErrorMsg('');
    setSuccessMsg('');
    setSelectedStaffId('');
    setProposedDate(new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]);
    setRemarks('');
    loadStaff();
    setIsManualAssignOpen(true);
  }

  async function executeManualAssign() {
    if (!selectedApp || !selectedStaffId) {
      setErrorMsg('Please select an available EVC staff member.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const result = await manualAssignEvc(selectedApp.id, {
        staff_id: Number(selectedStaffId),
        proposed_date: proposedDate,
        remarks: remarks.trim() || undefined
      });
      setSuccessMsg(`Manual Assignment Successful: Assigned to ${result.assigned_staff_name}.`);
      setIsManualAssignOpen(false);
      await fetchEligibility(selectedApp.id);
      loadStaff();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Manual Assignment failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Open History Modal
  async function handleOpenHistory(app: Application) {
    setSelectedApp(app);
    setIsHistoryOpen(true);
    setIsLoadingHistory(true);
    try {
      const records = await fetchEvcAssignmentHistory(app.id);
      setHistoryRecords(records);
    } catch (err) {
      console.error('Failed to load assignment history', err);
      setHistoryRecords([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  // Filtered staff list for manual assignment modal
  const filteredStaff = staffList.filter((s) => {
    if (staffFilterRegion !== 'ALL' && s.region && s.region !== staffFilterRegion) return false;
    if (staffFilterAvailability !== 'ALL' && s.availability_status !== staffFilterAvailability) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* SECTION HEADER */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 10,
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF'
          }}>
            <Sparkles size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0F172A' }}>
              EVC Staff Allocation & Inspection Management
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#64748B' }}>
              Officer-controlled AI Auto-Allocation and Manual Staff Assignment adhering strictly to APH scrutiny clearance
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              loadStaff();
              candidateApps.forEach((a) => fetchEligibility(a.id));
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              background: '#F8FAFC',
              border: '1px solid #CBD5E1',
              color: '#475569',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={13} className={isLoadingStaff ? 'spin' : ''} />
            <span>Sync Staff & Eligibility</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {errorMsg && !isAutoAssignOpen && !isManualAssignOpen && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          color: '#B91C1C',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B91C1C', fontWeight: 700 }}>×</button>
        </div>
      )}

      {successMsg && !isAutoAssignOpen && !isManualAssignOpen && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 6,
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          color: '#047857',
          fontSize: 13,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', fontWeight: 700 }}>×</button>
        </div>
      )}

      {/* QUEUE OF APPLICATIONS AWAITING EVC ALLOCATION */}
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1E293B' }}>
              Eligible Scrutiny Applications Queue ({candidateApps.length})
            </h3>
            <span style={{ fontSize: 11.5, color: '#64748B' }}>
              Applications requiring Expert Visiting Committee (EVC) physical or hybrid inspection
            </span>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 4,
            background: '#EFF6FF',
            color: '#1D4ED8',
            border: '1px solid #BFDBFE'
          }}>
            AICTE Regulatory Gate
          </span>
        </div>

        {candidateApps.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
            No applications are currently in the EVC preparation or allocation pipeline.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Application Reference</th>
                  <th>Institution / College Name</th>
                  <th>Region / Type</th>
                  <th>Workflow Stage</th>
                  <th>EVC Allocation Eligibility</th>
                  <th style={{ textAlign: 'right' }}>Officer Allocation Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidateApps.map((app) => {
                  const elig = eligibilityCache[app.id];
                  const isEligible = elig?.eligible === true;

                  return (
                    <tr key={app.id}>
                      <td>
                        <b style={{ color: '#0F172A', fontSize: 13 }}>{app.reference}</b>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748B' }}>
                          ID #{app.id} • AY {app.academic_year || '2026-2027'}
                        </span>
                      </td>

                      <td>
                        <b style={{ fontSize: 13, color: '#1E293B' }}>{app.institution_name}</b>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748B' }}>
                          {app.notes ? (app.notes.length > 50 ? `${app.notes.slice(0, 50)}...` : app.notes) : 'Standard Regulatory Filing'}
                        </span>
                      </td>

                      <td>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                          {app.region || 'National'} Region
                        </span>
                        <span style={{ display: 'block', fontSize: 11, color: '#64748B' }}>
                          {app.application_type}
                        </span>
                      </td>

                      <td>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background: app.current_stage === 'EVC_PENDING' ? '#FEF3C7' : '#EFF6FF',
                          color: app.current_stage === 'EVC_PENDING' ? '#92400E' : '#1D4ED8'
                        }}>
                          {app.current_stage}
                        </span>
                      </td>

                      <td>
                        {elig === undefined ? (
                          <span style={{ fontSize: 11, color: '#94A3B8' }}>Checking eligibility...</span>
                        ) : isEligible ? (
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#DCFCE7',
                              color: '#166534',
                              border: '1px solid #BBF7D0'
                            }}>
                              <CheckCircle2 size={12} />
                              <span>Eligible for EVC</span>
                            </span>
                            <span style={{ display: 'block', fontSize: 10.5, color: '#16A34A', marginTop: 2 }}>
                              Scrutiny cleared • No deficiencies
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#FEE2E2',
                              color: '#991B1B',
                              border: '1px solid #FECACA'
                            }}>
                              <AlertTriangle size={12} />
                              <span>Not Yet Eligible</span>
                            </span>
                            <span style={{
                              display: 'block',
                              fontSize: 10.5,
                              color: '#DC2626',
                              marginTop: 2,
                              maxWidth: 220,
                              whiteSpace: 'normal',
                              lineHeight: 1.3
                            }}>
                              {elig.reasons && elig.reasons[0] ? elig.reasons[0] : 'Pending requirements'}
                            </span>
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          {/* Option 1: AI Auto Assign */}
                          <button
                            type="button"
                            onClick={() => handleOpenAutoAssign(app)}
                            disabled={!isEligible}
                            title={isEligible ? 'Run explainable AI allocation algorithm' : 'Clear pending deficiencies first'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 10px',
                              borderRadius: 6,
                              background: isEligible
                                ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
                                : '#E2E8F0',
                              color: isEligible ? '#FFFFFF' : '#94A3B8',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: isEligible ? 'pointer' : 'not-allowed',
                              boxShadow: isEligible ? '0 1px 2px rgba(37, 99, 235, 0.3)' : 'none'
                            }}
                          >
                            <Sparkles size={12} />
                            <span>AI Auto Assign</span>
                          </button>

                          {/* Option 2: Manual Assign */}
                          <button
                            type="button"
                            onClick={() => handleOpenManualAssign(app)}
                            disabled={!isEligible}
                            title={isEligible ? 'Manually assign an available EVC staff member' : 'Clear pending deficiencies first'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              padding: '5px 10px',
                              borderRadius: 6,
                              background: '#FFFFFF',
                              border: `1px solid ${isEligible ? '#3B82F6' : '#CBD5E1'}`,
                              color: isEligible ? '#1D4ED8' : '#94A3B8',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: isEligible ? 'pointer' : 'not-allowed'
                            }}
                          >
                            <UserCheck size={12} />
                            <span>Manual Assign</span>
                          </button>

                          {/* Option 3: History */}
                          <button
                            type="button"
                            onClick={() => handleOpenHistory(app)}
                            title="View allocation audit history"
                            style={{
                              padding: '5px 8px',
                              borderRadius: 6,
                              background: '#F8FAFC',
                              border: '1px solid #CBD5E1',
                              color: '#475569',
                              fontSize: 11.5,
                              cursor: 'pointer'
                            }}
                          >
                            <Clock size={12} />
                          </button>
                        </div>
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
          MODAL 1: AI AUTO ASSIGNMENT MODAL
          ==================================================================== */}
      {isAutoAssignOpen && selectedApp && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsAutoAssignOpen(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: 560 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  AI EVC Staff Auto-Allocation
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsAutoAssignOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Target Application Summary */}
              <div style={{
                padding: '12px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8
              }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>TARGET APPLICATION</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginTop: 2 }}>
                  {selectedApp.institution_name}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  Reference: <code>{selectedApp.reference}</code> • {selectedApp.region} Region • {selectedApp.application_type}
                </div>
              </div>

              {/* Rationale Result Box (Displayed when allocation finishes) */}
              {aiRationaleResult ? (
                <div style={{
                  padding: '16px',
                  background: '#F0FDF4',
                  border: '1px solid #86EFAC',
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontWeight: 700, fontSize: 14 }}>
                    <CheckCircle2 size={18} color="#16A34A" />
                    <span>Expert Successfully Allocated via AI</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#1E293B' }}>
                    <b>Assigned Expert:</b> {aiRationaleResult.staffName} ({aiRationaleResult.staffEmail})
                  </div>
                  <div style={{ fontSize: 13, color: '#1E293B' }}>
                    <b>Scheduled Date:</b> {aiRationaleResult.scheduledDate} (Visit #{aiRationaleResult.visitId})
                  </div>
                  <div style={{
                    padding: '10px 12px',
                    background: '#FFFFFF',
                    border: '1px solid #BBF7D0',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#15803D',
                    lineHeight: 1.5
                  }}>
                    <b>Explainable Match Rationale:</b><br />
                    {aiRationaleResult.rationale}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#475569' }}>
                    An automated notification with Accept / Decline actions has been delivered to the assigned expert.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    padding: '10px 12px',
                    background: '#EFF6FF',
                    border: '1px solid #BFDBFE',
                    borderRadius: 6,
                    fontSize: 12,
                    color: '#1E40AF',
                    lineHeight: 1.5
                  }}>
                    <strong>Explainable Algorithm Priority:</strong><br />
                    1. Expert confirmed active and marked <code>AVAILABLE</code>.<br />
                    2. Zero scheduling conflicts on proposed inspection date.<br />
                    3. Minimizes active caseload (prefers lower workload).<br />
                    4. Geographical proximity and expertise match with application type.
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Proposed Inspection Date *
                    </label>
                    <input
                      type="date"
                      value={proposedDate}
                      onChange={(e) => setProposedDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        fontSize: 13
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                      Officer Allocation Remarks (Optional)
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="e.g. Expedited EVC allocation following clean scrutiny report."
                      rows={2}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid #CBD5E1',
                        borderRadius: 6,
                        fontSize: 12.5,
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  {errorMsg && (
                    <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 6, fontSize: 12 }}>
                      {errorMsg}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              {aiRationaleResult ? (
                <button
                  type="button"
                  onClick={() => setIsAutoAssignOpen(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 6,
                    background: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer'
                  }}
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAutoAssignOpen(false)}
                    disabled={isSubmitting}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 6,
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      color: '#475569',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeAutoAssign}
                    disabled={isSubmitting || !proposedDate}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '8px 18px',
                      borderRadius: 6,
                      background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)',
                      color: '#FFFFFF',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Sparkles size={14} />
                    <span>{isSubmitting ? 'Allocating Expert...' : 'Execute AI Auto Assign'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: MANUAL ASSIGNMENT MODAL
          ==================================================================== */}
      {isManualAssignOpen && selectedApp && (
        <div className="modal-backdrop" onClick={() => !isSubmitting && setIsManualAssignOpen(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: 720 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  Manual EVC Staff Assignment
                </h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsManualAssignOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Application Summary */}
              <div style={{
                padding: '10px 14px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 8
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                  {selectedApp.institution_name}
                </div>
                <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                  <code>{selectedApp.reference}</code> • Region: <b>{selectedApp.region}</b> • {selectedApp.application_type}
                </div>
              </div>

              {/* Proposed Date Input */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Proposed Inspection Date *
                  </label>
                  <input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                    Filter Roster by Region
                  </label>
                  <select
                    value={staffFilterRegion}
                    onChange={(e) => setStaffFilterRegion(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      border: '1px solid #CBD5E1',
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  >
                    <option value="ALL">All Regions</option>
                    <option value="Northern">Northern</option>
                    <option value="Southern">Southern</option>
                    <option value="Western">Western</option>
                    <option value="Eastern">Eastern</option>
                  </select>
                </div>
              </div>

              {/* Staff Roster Selection Table */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  Select Registered EVC Expert (Only AVAILABLE staff can be selected) *
                </label>

                <div style={{
                  maxHeight: 240,
                  overflowY: 'auto',
                  border: '1px solid #CBD5E1',
                  borderRadius: 6
                }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>Pick</th>
                        <th>Expert Name & Email</th>
                        <th>Region / Expertise</th>
                        <th>Availability</th>
                        <th style={{ textAlign: 'center' }}>Active Workload</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStaff.map((staff) => {
                        const isAvail = staff.availability_status === 'AVAILABLE';
                        const isSelected = selectedStaffId === staff.id;

                        return (
                          <tr
                            key={staff.id}
                            onClick={() => isAvail && setSelectedStaffId(staff.id)}
                            style={{
                              cursor: isAvail ? 'pointer' : 'not-allowed',
                              background: isSelected ? '#EFF6FF' : isAvail ? '#FFFFFF' : '#F8FAFC',
                              opacity: isAvail ? 1 : 0.6
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="radio"
                                name="selectedStaff"
                                checked={isSelected}
                                onChange={() => isAvail && setSelectedStaffId(staff.id)}
                                disabled={!isAvail}
                              />
                            </td>
                            <td>
                              <b style={{ color: '#0F172A', fontSize: 12.5 }}>{staff.name}</b>
                              <span style={{ display: 'block', fontSize: 11, color: '#2563EB' }}>
                                {staff.email}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: 12, color: '#334155' }}>{staff.region || 'National'}</span>
                              <span style={{ display: 'block', fontSize: 10.5, color: '#64748B' }}>
                                {staff.expertise || 'Engineering & Infrastructure'}
                              </span>
                            </td>
                            <td>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontSize: 10.5,
                                fontWeight: 700,
                                background:
                                  staff.availability_status === 'AVAILABLE' ? '#DCFCE7' :
                                  staff.availability_status === 'BUSY' ? '#FEF3C7' : '#FEE2E2',
                                color:
                                  staff.availability_status === 'AVAILABLE' ? '#166534' :
                                  staff.availability_status === 'BUSY' ? '#92400E' : '#991B1B'
                              }}>
                                {staff.availability_status || 'AVAILABLE'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: staff.active_assignments_count > 3 ? '#DC2626' : '#475569'
                              }}>
                                {staff.active_assignments_count || 0} active
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Optional Assignment Remarks */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 4 }}>
                  Assignment Remarks (Optional)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Selected based on senior expertise in autonomous robotics laboratory evaluation."
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    border: '1px solid #CBD5E1',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              {errorMsg && (
                <div style={{ padding: '8px 12px', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 6, fontSize: 12 }}>
                  {errorMsg}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsManualAssignOpen(false)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeManualAssign}
                disabled={isSubmitting || !selectedStaffId || !proposedDate}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 18px',
                  borderRadius: 6,
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: isSubmitting || !selectedStaffId ? 'not-allowed' : 'pointer'
                }}
              >
                <UserCheck size={14} />
                <span>{isSubmitting ? 'Confirming...' : 'Confirm Manual Assignment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: ALLOCATION & CONFIRMATION AUDIT HISTORY
          ==================================================================== */}
      {isHistoryOpen && selectedApp && (
        <div className="modal-backdrop" onClick={() => setIsHistoryOpen(false)}>
          <div
            className="modal-container"
            style={{ maxWidth: 650 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                  EVC Allocation & Response History
                </h3>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsHistoryOpen(false)}>
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: '#475569' }}>
                Application: <b>{selectedApp.institution_name}</b> (<code>{selectedApp.reference}</code>)
              </div>

              {isLoadingHistory ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8' }}>
                  Loading chronological allocation history...
                </div>
              ) : historyRecords.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748B', fontSize: 13 }}>
                  No allocation history records logged yet for this application.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historyRecords.map((h, idx) => (
                    <div
                      key={h.id || idx}
                      style={{
                        padding: '12px 14px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        borderRadius: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          background:
                            h.assignment_status === 'ACCEPTED' ? '#DCFCE7' :
                            h.assignment_status === 'DECLINED' ? '#FEE2E2' : '#EFF6FF',
                          color:
                            h.assignment_status === 'ACCEPTED' ? '#166534' :
                            h.assignment_status === 'DECLINED' ? '#991B1B' : '#1D4ED8'
                        }}>
                          {h.assignment_status}
                        </span>
                        <span style={{ fontSize: 11, color: '#94A3B8' }}>
                          Method: <b>{h.assignment_method}</b> • By: {h.assigned_by || 'Officer'}
                        </span>
                      </div>

                      <div style={{ fontSize: 12.5, color: '#0F172A', marginTop: 2 }}>
                        Expert: <b>{h.staff_name}</b> ({h.staff_email})
                      </div>

                      {h.assignment_reason && (
                        <div style={{ fontSize: 11.5, color: '#475569' }}>
                          <b>Rationale / Notes:</b> {h.assignment_reason}
                        </div>
                      )}

                      {h.decline_reason && (
                        <div style={{
                          fontSize: 11.5,
                          color: '#B91C1C',
                          background: '#FEF2F2',
                          padding: '6px 8px',
                          borderRadius: 4,
                          marginTop: 4
                        }}>
                          <b>Decline Justification:</b> {h.decline_reason}
                        </div>
                      )}

                      <div style={{ fontSize: 10.5, color: '#94A3B8', marginTop: 4 }}>
                        Assigned At: {h.assigned_at ? new Date(h.assigned_at).toLocaleString() : 'N/A'}
                        {h.responded_at && ` • Responded At: ${new Date(h.responded_at).toLocaleString()}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 6,
                  background: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

