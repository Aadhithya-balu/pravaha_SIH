import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  FileText,
  Building2,
  ShieldCheck,
  Send,
  Upload,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Application, AuditEvent, DocumentRecord, EVCVisit, AvailableTransition, User, CorrectionRequest } from '../types';
import {
  fetchApplicationDetail,
  uploadApplicationDocument,
  submitApplication,
  resubmitApplication,
  api
} from '../api';

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
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [evcVisit, setEvcVisit] = useState<EVCVisit | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Return dialog state (officer)
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  // Resubmit dialog state (institution)
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitReason, setResubmitReason] = useState('');

  // Document upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('LEASE_DEED');
  const [uploadDocName, setUploadDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const stageList = [
    'DRAFT',
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
      const data = await fetchApplicationDetail(application.id);
      setDetails(data.application);
      setTransitions(data.available_transitions || []);
      setAuditEvents(data.audit_history || []);
      setDocuments(data.documents || []);
      setEvcVisit(data.evc_visit || null);
      setCorrectionRequests(data.correction_requests || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch application details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [application.id]);

  // Handle generic workflow transition (e.g. officer advancement)
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
      setSuccessMsg(`Workflow action '${action}' completed successfully.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsActionLoading(false);
    }
  }

  // Handle Institution Submit from Draft
  async function handleSubmitDraft() {
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await submitApplication(details.id);
      setSuccessMsg('Application submitted successfully for regulatory scrutiny.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsActionLoading(false);
    }
  }

  // Handle Institution Resubmit
  async function handleResubmit() {
    if (!resubmitReason || resubmitReason.trim().length < 3) {
      setErrorMsg('A detailed rectification explanation (minimum 3 characters) is required.');
      return;
    }
    setIsActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await resubmitApplication(details.id, resubmitReason.trim());
      setIsResubmitOpen(false);
      setResubmitReason('');
      setSuccessMsg('Clarification response resubmitted successfully. Scrutiny will resume.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsActionLoading(false);
    }
  }

  // Handle Document Upload
  async function handleUploadDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) {
      setErrorMsg('Please select a valid document file.');
      return;
    }
    setIsUploading(true);
    setErrorMsg('');
    setAiSummary(null);
    try {
      const result = await uploadApplicationDocument(
        details.id,
        uploadFile,
        uploadDocType,
        uploadDocName || uploadFile.name
      );
      setSuccessMsg(`Document '${uploadFile.name}' attached successfully.`);
      if (result.ai_analysis?.summary) {
        setAiSummary(result.ai_analysis.summary);
      }
      setUploadFile(null);
      setUploadDocName('');
      setIsUploadOpen(false);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  const isReturned = details.current_stage === 'RETURNED_FOR_CLARIFICATION' || details.status === 'RETURNED';
  const isDraft = details.current_stage === 'DRAFT' || details.status === 'DRAFT';
  const isInstitution = user?.role === 'institution';
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin' || user?.role === 'bureau';

  const currentStageIndex = stageList.indexOf(details.current_stage);

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ width: 'min(940px, 95%)' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: '#dbeafe',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16 }}>
                {details.reference} — {details.institution_name}
              </h3>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {details.application_type} · Region: {details.region} · Academic Year: {details.academic_year}
              </span>
            </div>
          </div>
          <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ gap: 18 }}>
          {/* Notification / Toast Feedback */}
          {errorMsg && (
            <div className="alert-banner danger">
              <AlertTriangle size={16} />
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
            <div className="alert-banner info">
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

          {/* RETURNED CASE: Prominent Correction Request Banner */}
          {isReturned && (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fdba74',
              borderLeft: '5px solid #ea580c',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <RotateCcw size={18} color="#c2410c" />
                  <b style={{ color: '#9a3412', fontSize: 14 }}>
                    Application Returned for Clarification & Correction
                  </b>
                </div>
                {isInstitution && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: '6px 12px', borderColor: '#ea580c', color: '#c2410c' }}
                      onClick={() => setIsUploadOpen(true)}
                    >
                      <Upload size={13} />
                      <span>Upload Corrected Document</span>
                    </button>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '6px 12px', background: '#ea580c', borderColor: '#ea580c' }}
                      onClick={() => setIsResubmitOpen(true)}
                    >
                      <Send size={13} />
                      <span>Resubmit Case</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Display Officer Deficiency Remarks */}
              <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid #fed7aa' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9a3412', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                  Scrutiny Officer Deficiency Remarks
                </span>
                {correctionRequests.length > 0 ? (
                  correctionRequests.map((req, idx) => (
                    <div key={idx} style={{ marginBottom: 6, fontSize: 13, color: '#334155' }}>
                      <p style={{ margin: 0, lineHeight: 1.4 }}>
                        <b>• {req.source === 'RETURN_DEFICIENCY' ? 'Case Deficiency:' : `Document Flag (${req.document_name}):`}</b> {req.reason}
                      </p>
                      <small style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                        Recorded on: {new Date(req.created_at).toLocaleString()}
                      </small>
                    </div>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: '#334155' }}>
                    Specific regulatory justification recorded in the workflow audit trail below.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* DRAFT STATE BANNER */}
          {isDraft && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderLeft: '5px solid #64748b',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={18} color="#475569" />
                  <b style={{ color: '#1e293b', fontSize: 14 }}>Draft Application</b>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                  This application is currently saved as a draft. Ensure required supporting documents are uploaded before submission.
                </p>
              </div>

              {isInstitution && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ fontSize: 11, padding: '6px 12px' }}
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Upload size={13} />
                    <span>Attach Document</span>
                  </button>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 11, padding: '6px 12px' }}
                    disabled={isActionLoading}
                    onClick={handleSubmitDraft}
                  >
                    <Send size={13} />
                    <span>{isActionLoading ? 'Submitting...' : 'Submit for Scrutiny'}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Interactive Stepper */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                AICTE Regulatory Workflow Progression
              </span>
              <span className="badge badge-stage">{details.current_stage.replace(/_/g, ' ')}</span>
            </div>

            <div className="stepper-container">
              {stageList.map((stg, idx) => {
                const isPassed = !isReturned && currentStageIndex > idx;
                const isCurrent = !isReturned && currentStageIndex === idx;

                let stateClass = '';
                if (isPassed || details.current_stage === 'COMPLETED') stateClass = 'completed';
                if (isCurrent) stateClass = 'current';

                return (
                  <div key={stg} className={`stepper-step ${stateClass}`}>
                    <div className="step-indicator">
                      {isPassed || details.current_stage === 'COMPLETED' ? (
                        <CheckCircle2 size={14} />
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

          {/* Metadata & Actions Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            {/* Left: Metadata Details */}
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
                  Current Status
                </span>
                <b>{details.status}</b>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Assigned Officer / Reviewer
                </span>
                <span>{details.assigned_to}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Submission Date
                </span>
                <span>{details.submission_date || 'Draft'}</span>
              </div>
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Last Updated
                </span>
                <span>{details.updated_at ? new Date(details.updated_at).toLocaleString() : new Date(details.created_at).toLocaleString()}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Notes & Programme Details
                </span>
                <p style={{ margin: '4px 0 0', color: '#475569', lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                  {details.notes || 'No institutional notes recorded.'}
                </p>
              </div>
            </div>

            {/* Right: Available Actions */}
            <div style={{
              background: '#f8fafc',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Available Actions ({user?.role})
              </span>

              {/* Institution Quick Actions */}
              {isInstitution && isReturned && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    style={{ borderColor: '#ea580c', color: '#c2410c' }}
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Upload size={14} />
                    <span>Upload Corrected Document</span>
                  </button>
                  <button
                    className="btn-primary"
                    style={{ background: '#ea580c', borderColor: '#ea580c' }}
                    onClick={() => setIsResubmitOpen(true)}
                  >
                    <Send size={14} />
                    <span>Submit Clarification Justification</span>
                  </button>
                </div>
              )}

              {isInstitution && isDraft && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Upload size={14} />
                    <span>Attach Supporting Document</span>
                  </button>
                  <button
                    className="btn-primary"
                    disabled={isActionLoading}
                    onClick={handleSubmitDraft}
                  >
                    <Send size={14} />
                    <span>{isActionLoading ? 'Submitting...' : 'Submit Application'}</span>
                  </button>
                </div>
              )}

              {/* Officer / Admin Transitions */}
              {isOfficerOrAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transitions.length === 0 ? (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 'auto 0' }}>
                      No stage transitions pending for '{user?.role}' on this stage.
                    </p>
                  ) : (
                    transitions.map((t) => {
                      if (t.action === 'RETURN') {
                        return (
                          <button
                            key={t.action}
                            className="btn-secondary"
                            style={{ borderColor: '#ea580c', color: '#c2410c' }}
                            disabled={isActionLoading}
                            onClick={() => setIsReturnOpen(true)}
                          >
                            <RotateCcw size={14} />
                            <span>Return for Clarification</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          key={t.action}
                          className="btn-primary"
                          disabled={isActionLoading}
                          onClick={() => handleTransition(t.action, `Advanced via ${t.action}`)}
                        >
                          <ArrowRight size={14} />
                          <span>{t.description}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              {isInstitution && !isReturned && !isDraft && (
                <div style={{ margin: 'auto 0' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Application is actively under scrutiny by regional officials. You will receive an immediate notification if clarification or evidence is required.
                  </p>
                  <button
                    className="btn-secondary"
                    style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
                    onClick={() => setIsUploadOpen(true)}
                  >
                    <Upload size={13} />
                    <span>Attach Supplementary Document</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Attached Regulatory Documents */}
          <div className="panel-card" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: 12, paddingBottom: 8 }}>
              <h3>
                <FileText size={16} color="var(--primary)" />
                Attached Regulatory Documents ({documents.length})
              </h3>
              {isInstitution && (
                <button
                  className="btn-secondary"
                  style={{ fontSize: 11, padding: '5px 10px' }}
                  onClick={() => setIsUploadOpen(true)}
                >
                  <Upload size={12} />
                  <span>Upload Document</span>
                </button>
              )}
            </div>

            {documents.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                No regulatory documents attached yet. Click 'Upload Document' to attach land lease, fire NOC, or programme syllabus.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      padding: '12px 14px',
                      background: doc.review_status === 'CORRECTION_REQUIRED' ? '#fff7ed' : '#f8fafc',
                      borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${doc.review_status === 'CORRECTION_REQUIRED' ? '#fdba74' : 'var(--border-subtle)'}`,
                      borderLeft: doc.review_status === 'CORRECTION_REQUIRED' ? '4px solid #ea580c' : '4px solid #3b82f6'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <b style={{ fontSize: 13, display: 'block' }}>{doc.document_name}</b>
                        <small style={{ color: 'var(--text-muted)' }}>
                          Type: <b>{doc.document_type}</b> · {(doc.file_size / 1024).toFixed(0)} KB · Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}
                        </small>
                      </div>
                      <span className={`badge badge-${doc.review_status === 'ACCEPTED' ? 'completed' : (doc.review_status === 'CORRECTION_REQUIRED' ? 'returned' : 'pending')}`}>
                        {doc.review_status}
                      </span>
                    </div>

                    {/* Reviewer Notes / Deficiency Remarks */}
                    {doc.reviewer_notes && (
                      <div style={{ marginTop: 8, padding: '8px 10px', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid #fed7aa', fontSize: 11, color: '#9a3412' }}>
                        <b>Scrutinizer Remarks:</b> {doc.reviewer_notes}
                      </div>
                    )}

                    {/* AI Assistance Summary */}
                    {doc.ai_summary && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#475569' }}>
                        <span style={{ color: '#7e22ce', fontWeight: 600 }}>AI Check: </span>
                        {doc.ai_summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chronological Workflow Timeline */}
          <div className="panel-card" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: 12, paddingBottom: 8 }}>
              <h3>
                <Clock size={16} color="var(--primary)" />
                Chronological Workflow Timeline & Audit History ({auditEvents.length} events)
              </h3>
            </div>

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
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {/* Dialog: Officer Return Application */}
      {isReturnOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ color: '#c2410c' }}>Return Application for Clarification</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsReturnOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Please provide a clear and specific regulatory justification for returning this application.
                This reason will be recorded permanently in the audit history and delivered to the applicant institution.
              </p>
              <div className="form-group">
                <label>Mandatory Deficiency Justification *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Registered lease deed page 4 is illegible; please re-upload clear certified copy..."
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
                onClick={() => handleTransition('RETURN', returnReason)}
              >
                {isActionLoading ? 'Returning...' : 'Confirm Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Institution Resubmit Case */}
      {isResubmitOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3>Submit Clarification Response & Resubmit</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsResubmitOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Detail how the deficiencies identified by the scrutinizing officer have been resolved.
                This will transition the case back into active Scrutiny.
              </p>
              <div className="form-group">
                <label>Institutional Rectification Explanation *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Attested copy of registered lease deed uploaded as document. Survey numbers cross-verified..."
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
                {isActionLoading ? 'Resubmitting...' : 'Resubmit Application'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog: Upload Document Modal */}
      {isUploadOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-dialog" style={{ width: 'min(500px, 90%)' }}>
            <div className="modal-header">
              <h3>Upload Regulatory Document</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsUploadOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadDocument}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Document Type *</label>
                  <select
                    value={uploadDocType}
                    onChange={(e) => setUploadDocType(e.target.value)}
                  >
                    <option value="LEASE_DEED">Land Lease / Ownership Deed</option>
                    <option value="BUILDING_PLAN">Building Occupancy Plan / Certificate</option>
                    <option value="FIRE_NOC">Fire Safety Clearance NOC</option>
                    <option value="FACULTY_LIST">Faculty Sanction & Recruitment List</option>
                    <option value="DPR_PROPOSAL">Detailed Project Report (DPR)</option>
                    <option value="AFFILIATION_LETTER">University Affiliation Letter</option>
                    <option value="CORRECTED_DOCUMENT">Corrected Replacement Document</option>
                    <option value="UNDERTAKING">Statutory Undertaking</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Document Title / Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. Certified Land Deed 2026-2060"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Select Document File (Max 10MB) *</label>
                  <input
                    type="file"
                    required
                    accept=".pdf,.docx,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setUploadFile(file);
                      if (file && !uploadDocName) {
                        setUploadDocName(file.name);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isUploading}
                  onClick={() => setIsUploadOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isUploading || !uploadFile}
                >
                  <Upload size={14} />
                  <span>{isUploading ? 'Uploading & Scrutinizing...' : 'Upload & Attach'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
