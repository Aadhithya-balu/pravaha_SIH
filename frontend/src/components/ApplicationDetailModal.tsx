import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  Calendar,
  Building2,
  ShieldCheck,
  Send,
  Upload,
  PlayCircle,
  FileSearch,
  Check,
  AlertCircle,
  FileSpreadsheet,
  Gavel,
  History,
  FileCode2,
  UserCheck
} from 'lucide-react';
import {
  Application,
  AuditEvent,
  DocumentRecord,
  EVCVisit,
  AvailableTransition,
  User,
  ScrutinyRun,
  ScrutinyFinding,
  CorrectionRequest,
  ApplicationDetailResponse
} from '../types';
import { api, apiUpload, submitApplication } from '../api';

interface ApplicationDetailModalProps {
  application: Application;
  user: User | null;
  onClose: () => void;
  onRefresh: () => void;
}

export const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  application,
  user,
  onClose,
  onRefresh
}) => {
  const [details, setDetails] = useState<Application>(application);
  const [transitions, setTransitions] = useState<AvailableTransition[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [evcVisit, setEvcVisit] = useState<EVCVisit | null>(null);
  const [scrutinyRuns, setScrutinyRuns] = useState<ScrutinyRun[]>([]);
  const [scrutinyFindings, setScrutinyFindings] = useState<ScrutinyFinding[]>([]);
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);

  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'SCRUTINY' | 'DEFICIENCIES' | 'DOCUMENTS' | 'EVC' | 'AUDIT'
  >('OVERVIEW');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Dialog states
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitReason, setResubmitReason] = useState('');

  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [decisionVerdict, setDecisionVerdict] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [orderReference, setOrderReference] = useState('');

  // Document upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('LEASE_DEED');

  // EVC schedule state
  const [isScheduleEvcOpen, setIsScheduleEvcOpen] = useState(false);
  const [evcMembers, setEvcMembers] = useState(
    'Prof. S. Ramanujan (Chairperson), Dr. K. Sharma (Subject Expert), AICTE Regional Nominee'
  );
  const [evcDate, setEvcDate] = useState('');
  const [evcMode, setEvcMode] = useState<'PHYSICAL' | 'VIRTUAL' | 'HYBRID'>('PHYSICAL');

  const stageList = [
    'SUBMITTED',
    'SCRUTINY',
    'RE_SCRUTINY',
    'EVC_PENDING',
    'EVC_SCHEDULED',
    'EVC_COMPLETED',
    'SAC_SHC_REVIEW',
    'COMPLIANCE_PENDING',
    'COMPLETED'
  ];

  async function loadDetails() {
    setLoading(true);
    try {
      const data: ApplicationDetailResponse = await api(`/applications/${application.id}`);
      setDetails(data.application);
      setTransitions(data.available_transitions || []);
      setAuditEvents(data.audit_history || []);
      setDocuments(data.documents || []);
      setEvcVisit(data.evc_visit || null);
      setScrutinyRuns(data.scrutiny_runs || []);
      setScrutinyFindings(data.scrutiny_findings || []);
      setCorrectionRequests(data.correction_requests || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [application.id]);

  // Execute workflow transition
  async function handleTransition(action: string, reason: string = '') {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/applications/${details.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, reason })
      });
      setIsReturnOpen(false);
      setIsResubmitOpen(false);
      setReturnReason('');
      setResubmitReason('');
      setSuccessMsg(`Workflow successfully transitioned via ${action}.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Transition failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Formal submit from draft
  async function handleFormalSubmit() {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await submitApplication(details.id);
      setSuccessMsg('Application formally submitted for regulatory scrutiny.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Institution formal resubmit with clarification
  async function handleResubmit() {
    if (!resubmitReason.trim()) return;
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/v1/applications/${details.id}/resubmit`, {
        method: 'POST',
        body: JSON.stringify({ response_text: resubmitReason.trim() })
      });
      setIsResubmitOpen(false);
      setResubmitReason('');
      setSuccessMsg('Clarification response submitted. Application transitioned to Re-Scrutiny.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Resubmission failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Officer run automated scrutiny pipeline
  async function handleRunScrutiny(runType: 'INITIAL' | 'RE_SCRUTINY' = 'INITIAL') {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const result = await api(`/v1/officer/applications/${details.id}/scrutiny`, {
        method: 'POST',
        body: JSON.stringify({ run_type: runType })
      });
      setSuccessMsg(
        `Scrutiny evaluation completed: ${result.deficiency_count} deficiencies identified across ${result.rules_evaluated} rules.`
      );
      await loadDetails();
      setActiveTab('SCRUTINY');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Scrutiny pipeline execution failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Officer request corrections with deficiency memo
  async function handleOfficerRequestCorrections() {
    if (returnReason.trim().length < 5) return;
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const defs = scrutinyFindings
        .filter((f) => f.severity === 'DEFICIENCY')
        .map((f) => ({
          rule_id: f.rule_id,
          description: f.description,
          severity: f.severity
        }));

      await api(`/v1/officer/applications/${details.id}/request-corrections`, {
        method: 'POST',
        body: JSON.stringify({
          reason: returnReason.trim(),
          deficiencies: defs
        })
      });
      setIsReturnOpen(false);
      setReturnReason('');
      setSuccessMsg('Application returned to institution with mandatory deficiency memo.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to return application.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Officer re-scrutiny disposition (Clear / Deficient)
  async function handleCompleteRescrutiny(decision: 'CLEARED' | 'DEFICIENT', remarks: string) {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/v1/officer/applications/${details.id}/complete-rescrutiny`, {
        method: 'POST',
        body: JSON.stringify({ decision, remarks })
      });
      setSuccessMsg(`Re-scrutiny disposition recorded: ${decision}.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Re-scrutiny action failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Record final statutory decision (Approve/Reject)
  async function handleRecordDecision(e: React.FormEvent) {
    e.preventDefault();
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/v1/officer/applications/${details.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          decision: decisionVerdict,
          remarks: decisionRemarks.trim() || `Statutory order issued by ${user?.name}.`,
          approval_order_reference: orderReference.trim() || undefined
        })
      });
      setIsDecisionOpen(false);
      setSuccessMsg(`Statutory decision recorded: ${decisionVerdict}. Approval order issued.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Decision failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Upload document linked to this application
  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) return;
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('document_type', uploadDocType);

      await apiUpload(`/v1/applications/${details.id}/documents`, formData);
      setIsUploadOpen(false);
      setUploadFile(null);
      setSuccessMsg('Document successfully ingested and analyzed by AI compliance pipeline.');
      await loadDetails();
      setActiveTab('DOCUMENTS');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Document upload failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Review document (Accept / Correction Required)
  async function handleReviewDocument(did: number, reviewStatus: 'ACCEPTED' | 'CORRECTION_REQUIRED', notes: string = '') {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/documents/${did}/review`, {
        method: 'POST',
        body: JSON.stringify({
          review_status: reviewStatus,
          reviewer_notes: notes || `Marked ${reviewStatus} during scrutiny.`
        })
      });
      setSuccessMsg(`Document disposition updated: ${reviewStatus}.`);
      await loadDetails();
    } catch (err: any) {
      setErrorMsg(err.message || 'Review action failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Schedule EVC inspection
  async function handleScheduleEvc(e: React.FormEvent) {
    e.preventDefault();
    if (!evcDate) return;
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api('/evc', {
        method: 'POST',
        body: JSON.stringify({
          application_id: details.id,
          committee_members: evcMembers,
          scheduled_date: evcDate,
          visit_mode: evcMode
        })
      });
      setIsScheduleEvcOpen(false);
      setSuccessMsg('EVC Inspection committee constituted and scheduled.');
      await loadDetails();
      setActiveTab('EVC');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'EVC scheduling failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  const currentStageIndex = stageList.indexOf(details.current_stage);
  const isReturned = details.current_stage === 'RETURNED_FOR_CLARIFICATION' || details.status === 'RETURNED';
  const isDraft = details.status === 'DRAFT';
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'bureau' || user?.role === 'admin';
  const isInstitution = user?.role === 'institution';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="dossier-title">
      <div className="modal-dialog" style={{ width: 'min(1150px, 97%)' }}>
        {/* Dossier Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: '#0f294a',
              border: '1px solid #1e3a8a',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 id="dossier-title" style={{ margin: 0, fontSize: 16 }}>
                  {details.reference}
                </h3>
                <span className="badge badge-stage">{details.current_stage.replace(/_/g, ' ')}</span>
                <span className={`badge ${
                  details.status === 'COMPLETED' ? 'badge-completed' :
                  details.status === 'RETURNED' ? 'badge-returned' :
                  details.status === 'DRAFT' ? 'badge-draft' :
                  details.status === 'OVERDUE' ? 'badge-overdue' : 'badge-in_progress'
                }`}>
                  {details.status}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                <b>{details.institution_name}</b> · {details.application_type} · Region: {details.region} · AY {details.academic_year}
              </span>
            </div>
          </div>

          <button
            style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 6 }}
            onClick={onClose}
            aria-label="Close dossier"
          >
            <X size={20} />
          </button>
        </div>

        {/* Dossier Sub-Navigation */}
        <div className="dossier-tab-nav" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'OVERVIEW'}
            className={`dossier-tab-btn ${activeTab === 'OVERVIEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('OVERVIEW')}
          >
            <Clock size={14} />
            <span>Workflow & Overview</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'SCRUTINY'}
            className={`dossier-tab-btn ${activeTab === 'SCRUTINY' ? 'active' : ''}`}
            onClick={() => setActiveTab('SCRUTINY')}
          >
            <FileSearch size={14} />
            <span>Scrutiny & Rules ({scrutinyFindings.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'DEFICIENCIES'}
            className={`dossier-tab-btn ${activeTab === 'DEFICIENCIES' ? 'active' : ''}`}
            onClick={() => setActiveTab('DEFICIENCIES')}
          >
            <RotateCcw size={14} />
            <span>Clarifications & Resubmission ({correctionRequests.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'DOCUMENTS'}
            className={`dossier-tab-btn ${activeTab === 'DOCUMENTS' ? 'active' : ''}`}
            onClick={() => setActiveTab('DOCUMENTS')}
          >
            <FileText size={14} />
            <span>Documents & Review ({documents.length})</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'EVC'}
            className={`dossier-tab-btn ${activeTab === 'EVC' ? 'active' : ''}`}
            onClick={() => setActiveTab('EVC')}
          >
            <Calendar size={14} />
            <span>EVC Inspection {evcVisit ? `(${evcVisit.status})` : ''}</span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'AUDIT'}
            className={`dossier-tab-btn ${activeTab === 'AUDIT' ? 'active' : ''}`}
            onClick={() => setActiveTab('AUDIT')}
          >
            <History size={14} />
            <span>Audit Trail & Order ({auditEvents.length})</span>
          </button>
        </div>

        {/* Messages */}
        <div style={{ padding: '12px 20px 0' }}>
          {errorMsg && (
            <div className="alert-banner danger" style={{ marginBottom: 10 }}>
              <span>{errorMsg}</span>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }} onClick={() => setErrorMsg('')}>×</button>
            </div>
          )}
          {successMsg && (
            <div className="alert-banner info" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer', fontWeight: 800 }} onClick={() => setSuccessMsg('')}>×</button>
            </div>
          )}
        </div>

        {/* Dossier Body */}
        <div className="modal-body" style={{ gap: 18, paddingTop: 10 }}>
          {/* TAB 1: WORKFLOW & OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <>
              {/* Draft Banner */}
              {isDraft && (
                <div className="alert-banner info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <FileText size={18} />
                    <div>
                      <b style={{ display: 'block' }}>Draft Application Proposal:</b>
                      <span>This proposal is saved in draft mode. Upload all mandatory documents and click "Submit for Scrutiny" to initiate formal review.</span>
                    </div>
                  </div>
                  {isInstitution && (
                    <button
                      className="btn-primary"
                      disabled={isActionLoading}
                      onClick={handleFormalSubmit}
                    >
                      <Send size={13} />
                      <span>Formal Submit</span>
                    </button>
                  )}
                </div>
              )}

              {/* Returned Case Banner */}
              {isReturned && (
                <div className="alert-banner warning">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <RotateCcw size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <b style={{ display: 'block' }}>Case Returned for Institutional Rectification:</b>
                      <span>
                        This application has deficiencies flagged by regulatory scrutiny. Clarification responses and documentary proof are required to resume scrutiny.
                      </span>
                    </div>
                  </div>
                  {isInstitution && (
                    <button
                      className="btn-primary"
                      style={{ background: '#c2410c', borderColor: '#c2410c', padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 12 }}
                      onClick={() => setIsResubmitOpen(true)}
                    >
                      <Send size={12} />
                      <span>Submit Rectifications</span>
                    </button>
                  )}
                </div>
              )}

              {/* Workflow Stepper */}
              <div style={{ background: '#f8fafc', padding: '14px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    AICTE Approval Workflow Progression
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                    Standard Regulatory Pipeline
                  </span>
                </div>

                <div className="stepper-container">
                  {stageList.map((stg, idx) => {
                    const isPassed = !isReturned && !isDraft && currentStageIndex > idx;
                    const isCurrent = !isReturned && currentStageIndex === idx;

                    let stateClass = '';
                    if (isPassed || details.current_stage === 'COMPLETED') stateClass = 'completed';
                    if (isCurrent && !isDraft) stateClass = 'current';
                    if (isReturned && currentStageIndex === idx) stateClass = 'returned';

                    return (
                      <div key={stg} className={`stepper-step ${stateClass}`}>
                        <div className="step-indicator">
                          {isPassed || details.current_stage === 'COMPLETED' ? (
                            <Check size={13} />
                          ) : (
                            idx + 1
                          )}
                        </div>
                        <span className="step-name">{stg.replace(/_/g, ' ')}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid: Application Info & Contextual Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
                {/* Details card */}
                <div style={{
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  fontSize: 12
                }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Reference ID
                    </span>
                    <b style={{ fontFamily: 'JetBrains Mono', color: 'var(--primary)' }}>{details.reference}</b>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Current Stage
                    </span>
                    <b>{details.current_stage.replace(/_/g, ' ')}</b>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Assigned Officer
                    </span>
                    <span>{details.assigned_to}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Target Due Date
                    </span>
                    <span>{details.due_date || '—'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Submission Date
                    </span>
                    <span>{details.submission_date || 'Draft'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Deficiency Count
                    </span>
                    <span style={{ fontWeight: 700, color: details.deficiency_count > 0 ? '#b91c1c' : '#047857' }}>
                      {details.deficiency_count} Deficiencies Flagged
                    </span>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                      Notes & Declared Scope
                    </span>
                    <p style={{ margin: '4px 0 0', color: '#475569', lineHeight: 1.45 }}>
                      {details.notes || 'No institutional notes recorded.'}
                    </p>
                  </div>
                </div>

                {/* Right: Role-Aware Regulatory Action Panel */}
                <div style={{
                  background: '#f8fafc',
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      Contextual Actions ({user?.role})
                    </span>
                  </div>

                  {/* Draft Formal Submit */}
                  {isInstitution && isDraft && (
                    <button
                      className="btn-primary"
                      disabled={isActionLoading}
                      onClick={handleFormalSubmit}
                    >
                      <Send size={14} />
                      <span>Formally Submit for Scrutiny</span>
                    </button>
                  )}

                  {/* Officer Scrutiny trigger */}
                  {isOfficerOrAdmin && (details.current_stage === 'SCRUTINY' || details.current_stage === 'RE_SCRUTINY') && (
                    <button
                      className="btn-primary"
                      disabled={isActionLoading}
                      onClick={() => handleRunScrutiny(details.current_stage === 'RE_SCRUTINY' ? 'RE_SCRUTINY' : 'INITIAL')}
                      title="Run automated APH 2024-2027 rule validation pipeline"
                    >
                      <PlayCircle size={14} />
                      <span>{isActionLoading ? 'Evaluating...' : 'Run Automated Scrutiny Pipeline'}</span>
                    </button>
                  )}

                  {/* Re-Scrutiny clearance for officer */}
                  {isOfficerOrAdmin && details.current_stage === 'RE_SCRUTINY' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn-primary"
                        style={{ background: '#047857', borderColor: '#047857', flex: 1 }}
                        disabled={isActionLoading}
                        onClick={() => handleCompleteRescrutiny('CLEARED', 'Deficiencies reconciled upon re-scrutiny.')}
                      >
                        <Check size={14} />
                        <span>Clear Re-Scrutiny</span>
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ borderColor: '#ea580c', color: '#c2410c', flex: 1 }}
                        disabled={isActionLoading}
                        onClick={() => setIsReturnOpen(true)}
                      >
                        <RotateCcw size={14} />
                        <span>Return Again</span>
                      </button>
                    </div>
                  )}

                  {/* Institution Clarification Submission */}
                  {isInstitution && isReturned && (
                    <button
                      className="btn-primary"
                      style={{ background: '#c2410c', borderColor: '#c2410c' }}
                      disabled={isActionLoading}
                      onClick={() => setIsResubmitOpen(true)}
                    >
                      <Send size={14} />
                      <span>Submit Clarification Memo</span>
                    </button>
                  )}

                  {/* Institution Document Upload */}
                  {isInstitution && (
                    <button
                      className="btn-secondary"
                      disabled={isActionLoading}
                      onClick={() => setIsUploadOpen(true)}
                    >
                      <Upload size={14} />
                      <span>Upload Regulatory Document</span>
                    </button>
                  )}

                  {/* Schedule EVC Visit */}
                  {isOfficerOrAdmin && details.current_stage === 'EVC_PENDING' && (
                    <button
                      className="btn-primary"
                      disabled={isActionLoading}
                      onClick={() => setIsScheduleEvcOpen(true)}
                    >
                      <Calendar size={14} />
                      <span>Constitute & Schedule EVC Panel</span>
                    </button>
                  )}

                  {/* Issue Statutory Final Decision (Approve / Reject) */}
                  {isOfficerOrAdmin && (details.current_stage === 'SAC_SHC_REVIEW' || details.current_stage === 'COMPLIANCE_PENDING') && (
                    <button
                      className="btn-primary"
                      style={{ background: '#0f294a', borderColor: '#1e3a8a' }}
                      disabled={isActionLoading}
                      onClick={() => setIsDecisionOpen(true)}
                    >
                      <Gavel size={14} />
                      <span>Issue Statutory Final Order</span>
                    </button>
                  )}

                  {/* Generic Available Transitions from workflow state machine */}
                  {transitions.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--text-subtle)', fontWeight: 700, textTransform: 'uppercase' }}>
                        Advance Workflow State
                      </span>
                      {transitions.map((t) => {
                        if (t.action === 'RETURN') {
                          return (
                            <button
                              key={t.action}
                              className="btn-secondary"
                              style={{ borderColor: '#ea580c', color: '#c2410c' }}
                              disabled={isActionLoading}
                              onClick={() => setIsReturnOpen(true)}
                            >
                              <RotateCcw size={13} />
                              <span>Return for Clarification</span>
                            </button>
                          );
                        }
                        if (t.action === 'RESUBMIT') {
                          return null; // Handled specifically above
                        }
                        return (
                          <button
                            key={t.action}
                            className="btn-secondary"
                            disabled={isActionLoading}
                            onClick={() => handleTransition(t.action, `Advanced via ${t.action}`)}
                          >
                            <ArrowRight size={13} />
                            <span>{t.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SCRUTINY & FINDINGS */}
          {activeTab === 'SCRUTINY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'Manrope', fontWeight: 800 }}>
                    Automated Regulatory Scrutiny Findings
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Evaluated against AICTE Approval Process Handbook (APH) statutory rules
                  </span>
                </div>

                {isOfficerOrAdmin && (
                  <button
                    className="btn-primary"
                    disabled={isActionLoading}
                    onClick={() => handleRunScrutiny('INITIAL')}
                  >
                    <PlayCircle size={14} />
                    <span>Run Full Scrutiny Pipeline</span>
                  </button>
                )}
              </div>

              {/* Scrutiny Run Summary */}
              {scrutinyRuns.length > 0 && (
                <div style={{
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8
                }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                      Latest Pipeline Execution: <b>{scrutinyRuns[0].run_type}</b> by {scrutinyRuns[0].conducted_by}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                      Timestamp: {new Date(scrutinyRuns[0].created_at).toLocaleString()} · AI-Assisted: {scrutinyRuns[0].ai_assisted ? 'Yes' : 'Deterministic Fallback'}
                    </span>
                  </div>
                  <span className={`badge ${scrutinyRuns[0].status === 'PASSED' ? 'badge-completed' : 'badge-overdue'}`}>
                    {scrutinyRuns[0].status}
                  </span>
                </div>
              )}

              {/* Scrutiny Findings List */}
              {scrutinyFindings.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={24} color="#047857" />
                  <h4>No Regulatory Deficiencies Flagged</h4>
                  <p>
                    {scrutinyRuns.length === 0
                      ? 'Automated scrutiny has not been executed yet on this application.'
                      : 'All mandatory regulatory rules and document requirements passed compliance checks.'}
                  </p>
                  {isOfficerOrAdmin && scrutinyRuns.length === 0 && (
                    <button className="btn-primary" onClick={() => handleRunScrutiny('INITIAL')}>
                      Run Scrutiny Now
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {scrutinyFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className={`finding-card severity-${finding.severity.toLowerCase()}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 700, fontSize: 11, color: 'var(--primary)' }}>
                            {finding.rule_id}
                          </span>
                          <span className={`badge badge-${finding.severity === 'DEFICIENCY' ? 'critical' : (finding.severity === 'WARNING' ? 'warning' : 'info')}`}>
                            {finding.severity}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Category: {finding.category}
                          </span>
                        </div>
                        <span className="badge badge-pending">
                          Disposition: {finding.officer_disposition}
                        </span>
                      </div>

                      <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-main)', lineHeight: 1.4 }}>
                        {finding.description}
                      </p>

                      {finding.evidence_quote && (
                        <div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Extracted Document Evidence:
                          </span>
                          <div className="quote-box">"{finding.evidence_quote}"</div>
                        </div>
                      )}

                      {finding.suggested_action && (
                        <div style={{ fontSize: 11, color: '#1e40af', background: '#eff6ff', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                          <b>Recommended Remedial Action:</b> {finding.suggested_action}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLARIFICATIONS & RESUBMISSION */}
          {activeTab === 'DEFICIENCIES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'Manrope', fontWeight: 800 }}>
                    Deficiency Memos & Clarification History
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Mandatory cited reasons recorded when returning cases, with applicant rectifications
                  </span>
                </div>

                {isInstitution && isReturned && (
                  <button className="btn-primary" onClick={() => setIsResubmitOpen(true)}>
                    <Send size={14} />
                    <span>Submit Clarification</span>
                  </button>
                )}
                {isOfficerOrAdmin && (
                  <button className="btn-secondary" style={{ borderColor: '#ea580c', color: '#c2410c' }} onClick={() => setIsReturnOpen(true)}>
                    <RotateCcw size={14} />
                    <span>Issue Deficiency Memo / Return</span>
                  </button>
                )}
              </div>

              {correctionRequests.length === 0 ? (
                <div className="empty-state">
                  <CheckCircle2 size={24} color="#047857" />
                  <h4>No Deficiency Memos on Record</h4>
                  <p>This application has not been returned for clarification.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {correctionRequests.map((cr, idx) => (
                    <div
                      key={cr.id || idx}
                      style={{
                        padding: '16px',
                        borderRadius: 'var(--radius-md)',
                        background: '#ffffff',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-xs)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <b style={{ fontSize: 12, color: '#9a3412' }}>Correction Request #{cr.id || idx + 1}</b>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                            {cr.requested_by ? `Requested by ${cr.requested_by}` : ''} on {new Date(cr.created_at).toLocaleString()}
                          </span>
                        </div>
                        <span className={`badge ${cr.status === 'RESOLVED' ? 'badge-completed' : (cr.status === 'RESUBMITTED' ? 'badge-in_progress' : 'badge-returned')}`}>
                          {cr.status || 'PENDING'}
                        </span>
                      </div>

                      <div style={{ padding: '10px 12px', background: '#fff7ed', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #ea580c' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase' }}>
                          Cited Deficiency Grounds:
                        </span>
                        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#7c2d12', lineHeight: 1.4 }}>
                          {cr.reason}
                        </p>
                      </div>

                      {cr.institution_response ? (
                        <div style={{ padding: '10px 12px', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #16a34a' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>
                              Applicant Institution Response:
                            </span>
                            {cr.response_submitted_at && (
                              <span style={{ fontSize: 10, color: '#15803d' }}>
                                Resubmitted: {new Date(cr.response_submitted_at).toLocaleString()}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#14532d', lineHeight: 1.4 }}>
                            {cr.institution_response}
                          </p>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Awaiting institutional explanation and rectification proof.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DOCUMENTS & REVIEW */}
          {activeTab === 'DOCUMENTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'Manrope', fontWeight: 800 }}>
                    Attached Regulatory Documents ({documents.length})
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Statutory land deeds, NOC clearances, affidavits, and instructional approvals
                  </span>
                </div>

                <button className="btn-primary" onClick={() => setIsUploadOpen(true)}>
                  <Upload size={14} />
                  <span>Upload Document</span>
                </button>
              </div>

              {documents.length === 0 ? (
                <div className="empty-state">
                  <FileText size={24} color="#94a3b8" />
                  <h4>No Regulatory Documents Attached</h4>
                  <p>Upload mandatory documents (registered lease deed, fire NOC, statutory affidavit) for scrutiny.</p>
                  <button className="btn-primary" onClick={() => setIsUploadOpen(true)}>
                    Upload First Document
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        padding: '14px',
                        background: '#ffffff',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        boxShadow: 'var(--shadow-xs)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div>
                          <b style={{ fontSize: 13, display: 'block' }}>{doc.document_name}</b>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Type: <b>{doc.document_type}</b> · {Math.round(doc.file_size / 1024)} KB · Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={`badge ${doc.review_status === 'ACCEPTED' ? 'badge-completed' : (doc.review_status === 'CORRECTION_REQUIRED' ? 'badge-returned' : 'badge-pending')}`}>
                            {doc.review_status}
                          </span>

                          {/* Scrutinizing Officer Actions */}
                          {isOfficerOrAdmin && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 10, borderColor: '#10b981', color: '#047857' }}
                                disabled={isActionLoading || doc.review_status === 'ACCEPTED'}
                                onClick={() => handleReviewDocument(doc.id, 'ACCEPTED', 'Verified and accepted against norms.')}
                              >
                                Accept
                              </button>
                              <button
                                className="btn-secondary"
                                style={{ padding: '4px 8px', fontSize: 10, borderColor: '#ea580c', color: '#c2410c' }}
                                disabled={isActionLoading || doc.review_status === 'CORRECTION_REQUIRED'}
                                onClick={() => handleReviewDocument(doc.id, 'CORRECTION_REQUIRED', 'Deficiencies identified. Rectification demanded.')}
                              >
                                Correction
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {doc.ai_summary && (
                        <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 11, color: '#334155' }}>
                          <b>AI Summary:</b> {doc.ai_summary}
                        </div>
                      )}

                      {doc.reviewer_notes && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Officer Notes: {doc.reviewer_notes} (by {doc.reviewed_by})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: EVC INSPECTION */}
          {activeTab === 'EVC' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'Manrope', fontWeight: 800 }}>
                    Expert Visiting Committee (EVC) Inspection
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Physical or virtual inspection of infrastructure, laboratories, and land boundaries
                  </span>
                </div>

                {isOfficerOrAdmin && !evcVisit && (
                  <button className="btn-primary" onClick={() => setIsScheduleEvcOpen(true)}>
                    <Calendar size={14} />
                    <span>Constitute EVC Panel</span>
                  </button>
                )}
              </div>

              {!evcVisit ? (
                <div className="empty-state">
                  <Calendar size={24} color="#94a3b8" />
                  <h4>No EVC Inspection Scheduled</h4>
                  <p>
                    Expert Visiting Committee visits are mandated for New Programme / Level introductions or where physical infrastructure verification is ordered.
                  </p>
                  {isOfficerOrAdmin && (
                    <button className="btn-primary" onClick={() => setIsScheduleEvcOpen(true)}>
                      Schedule Visit Now
                    </button>
                  )}
                </div>
              ) : (
                <div style={{
                  padding: '18px',
                  background: '#ffffff',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Calendar size={18} color="var(--primary)" />
                      <b style={{ fontSize: 14 }}>Scheduled Date: {evcVisit.scheduled_date}</b>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="badge badge-stage">Mode: {evcVisit.visit_mode}</span>
                      <span className={`badge ${evcVisit.status === 'COMPLETED' ? 'badge-completed' : 'badge-in_progress'}`}>
                        {evcVisit.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                      EVC Committee Members & Experts:
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-main)', marginTop: 2, display: 'block' }}>
                      {evcVisit.committee_members}
                    </span>
                  </div>

                  {evcVisit.report_summary ? (
                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                        Inspection Findings Summary:
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-main)', lineHeight: 1.45 }}>
                        {evcVisit.report_summary}
                      </p>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Inspection report pending submission by committee chairperson.
                    </div>
                  )}

                  {evcVisit.recommendations && (
                    <div style={{ padding: '12px', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', display: 'block' }}>
                        Committee Recommendations:
                      </span>
                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#14532d', lineHeight: 1.45 }}>
                        {evcVisit.recommendations}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: AUDIT TRAIL & STATUTORY DECISIONS */}
          {activeTab === 'AUDIT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 14, fontFamily: 'Manrope', fontWeight: 800 }}>
                    Chronological Audit Trail & Statutory Verdict
                  </h4>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Immutable historical ledger of every officer disposition and system escalation
                  </span>
                </div>

                {isOfficerOrAdmin && (details.current_stage === 'SAC_SHC_REVIEW' || details.current_stage === 'COMPLIANCE_PENDING') && (
                  <button className="btn-primary" onClick={() => setIsDecisionOpen(true)}>
                    <Gavel size={14} />
                    <span>Issue Statutory Order</span>
                  </button>
                )}
              </div>

              {/* Statutory Verdict Card if recorded */}
              {details.decision_outcome && (
                <div style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: details.decision_outcome === 'APPROVED' ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${details.decision_outcome === 'APPROVED' ? '#bbf7d0' : '#fecaca'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Gavel size={18} color={details.decision_outcome === 'APPROVED' ? '#047857' : '#b91c1c'} />
                      <b style={{ fontSize: 14, color: details.decision_outcome === 'APPROVED' ? '#14532d' : '#991b1b' }}>
                        Official Statutory Decision: {details.decision_outcome}
                      </b>
                    </div>
                    {details.decision_date && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Date of Order: {new Date(details.decision_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-main)', lineHeight: 1.45 }}>
                    <b>Speaking Order Remarks:</b> {details.decision_remarks || 'Official regulatory order issued.'}
                  </p>
                  <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                    Authorized Signatory: {details.decision_by || 'Approval Bureau Official'}
                  </span>
                </div>
              )}

              {/* Audit Timeline */}
              <div className="audit-timeline">
                {auditEvents.map((e) => (
                  <div key={e.id} className="timeline-item">
                    <div className="timeline-meta">
                      <b>{e.actor}</b>
                      <span className="user-role-badge" style={{ fontSize: 9 }}>{e.actor_role}</span>
                      <span>· {new Date(e.created_at).toLocaleString()}</span>
                    </div>
                    <div className="timeline-title">
                      {e.action} {e.from_stage && e.to_stage ? `(${e.from_stage} → ${e.to_stage})` : ''}
                    </div>
                    <div className="timeline-details">{e.details}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close Dossier
          </button>
        </div>
      </div>

      {/* Return / Deficiency Memo Dialog (Mandatory Grounds) */}
      {isReturnOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ color: '#c2410c' }}>Return Case with Mandatory Deficiency Memo</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsReturnOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.45 }}>
                Under AICTE regulations, cases cannot be arbitrarily returned. You must cite specific legal or regulatory grounds from the Approval Process Handbook (APH).
              </p>
              <div className="form-group">
                <label>Mandatory Deficiency Remarks *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Registered lease deed page 4 is illegible; please re-upload clear certified copy with sub-registrar seal..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsReturnOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: '#c2410c', borderColor: '#c2410c' }}
                disabled={isActionLoading || returnReason.trim().length < 5}
                onClick={handleOfficerRequestCorrections}
              >
                {isActionLoading ? 'Issuing...' : 'Issue Deficiency Memo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Institution Clarification Resubmission Dialog */}
      {isResubmitOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3>Submit Clarification Response</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsResubmitOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.45 }}>
                Explain how each deficiency flagged by the scrutinizing officer has been resolved. Submitting this will advance the application into Re-Scrutiny.
              </p>
              <div className="form-group">
                <label>Institutional Rectification Response *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Attested copy of registered lease deed uploaded as document #4. Survey numbers 412/1 and 413 reconciled with revenue records..."
                  value={resubmitReason}
                  onChange={(e) => setResubmitReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsResubmitOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isActionLoading || resubmitReason.trim().length < 3}
                onClick={handleResubmit}
              >
                {isActionLoading ? 'Submitting...' : 'Submit Response'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {isUploadOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ width: 'min(500px, 92%)' }}>
            <div className="modal-header">
              <h3>Upload Regulatory Document</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsUploadOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadDocument}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Document Type *</label>
                  <select value={uploadDocType} onChange={(e) => setUploadDocType(e.target.value)}>
                    <option value="LEASE_DEED">Registered Land Lease Deed</option>
                    <option value="FIRE_NOC">Fire & Life Safety NOC</option>
                    <option value="BUILDING_PLAN">Approved Building Plan</option>
                    <option value="AFFIDAVIT">Mandatory Statutory Undertaking</option>
                    <option value="FACULTY_LIST">Instructional Cadre & Faculty Matrix</option>
                    <option value="LAND_CONVERSION">Land Use Conversion Certificate</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Select File (PDF, DOCX, TXT — Max 10MB) *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadFile(e.target.files[0]);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isActionLoading || !uploadFile}>
                  {isActionLoading ? 'Ingesting & Screening...' : 'Upload & Screen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule EVC Visit Modal */}
      {isScheduleEvcOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3>Constitute EVC Inspection Committee</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsScheduleEvcOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleEvc}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Committee Panel Members *</label>
                  <textarea
                    rows={3}
                    required
                    value={evcMembers}
                    onChange={(e) => setEvcMembers(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Inspection Date *</label>
                    <input
                      type="date"
                      required
                      value={evcDate}
                      onChange={(e) => setEvcDate(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Visit Mode</label>
                    <select value={evcMode} onChange={(e: any) => setEvcMode(e.target.value)}>
                      <option value="PHYSICAL">Physical On-Site</option>
                      <option value="VIRTUAL">Virtual Inspection</option>
                      <option value="HYBRID">Hybrid Mode</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsScheduleEvcOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isActionLoading || !evcDate}>
                  {isActionLoading ? 'Scheduling...' : 'Schedule Inspection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Statutory Final Decision Modal */}
      {isDecisionOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }} role="dialog" aria-modal="true">
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3>Issue Statutory Final Determination</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsDecisionOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleRecordDecision}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Statutory Verdict *</label>
                  <select
                    value={decisionVerdict}
                    onChange={(e: any) => setDecisionVerdict(e.target.value)}
                  >
                    <option value="APPROVED">Grant Approval (Issue Approval Order)</option>
                    <option value="REJECTED">Reject Application (Issue Speaking Order)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Approval Order Reference</label>
                  <input
                    type="text"
                    placeholder={`AICTE/AB/${new Date().getFullYear()}/${details.reference}`}
                    value={orderReference}
                    onChange={(e) => setOrderReference(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Speaking Order Remarks & Statutory Grounds *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide statutory justifications, approval conditions, or grounds for refusal..."
                    value={decisionRemarks}
                    onChange={(e) => setDecisionRemarks(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsDecisionOpen(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{
                    background: decisionVerdict === 'APPROVED' ? '#047857' : '#b91c1c',
                    borderColor: decisionVerdict === 'APPROVED' ? '#047857' : '#b91c1c'
                  }}
                  disabled={isActionLoading || !decisionRemarks.trim()}
                >
                  {isActionLoading ? 'Recording...' : `Confirm ${decisionVerdict}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
