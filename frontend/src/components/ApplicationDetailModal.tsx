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
  Send
} from 'lucide-react';
import { Application, AuditEvent, DocumentRecord, EVCVisit, AvailableTransition, User } from '../types';
import { api } from '../api';

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
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Return dialog state
  const [isReturnOpen, setIsReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  // Resubmit dialog state
  const [isResubmitOpen, setIsResubmitOpen] = useState(false);
  const [resubmitReason, setResubmitReason] = useState('');

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
      const data = await api(`/applications/${application.id}`);
      setDetails(data.application);
      setTransitions(data.available_transitions || []);
      setAuditEvents(data.audit_history || []);
      setDocuments(data.documents || []);
      setEvcVisit(data.evc_visit || null);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [application.id]);

  async function handleTransition(action: string, reason: string = '') {
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await api(`/applications/${details.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({ action, reason })
      });
      setIsReturnOpen(false);
      setIsResubmitOpen(false);
      setReturnReason('');
      setResubmitReason('');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsActionLoading(false);
    }
  }

  const currentStageIndex = stageList.indexOf(details.current_stage);
  const isReturned = details.current_stage === 'RETURNED_FOR_CLARIFICATION' || details.status === 'RETURNED';

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ width: 'min(900px, 95%)' }}>
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: '#dbeafe',
              color: '#1d4ed8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldCheck size={20} />
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

        <div className="modal-body" style={{ gap: 20 }}>
          {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

          {/* Returned Case Banner */}
          {isReturned && (
            <div className="alert-banner warning">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <RotateCcw size={16} />
                <span>
                  <b>Case Returned for Clarification:</b> This application has been returned with specific deficiency remarks.
                  Scrutiny will resume once the applicant institution resubmits with appropriate justification.
                </span>
              </div>
              {user?.role === 'institution' && (
                <button
                  className="btn-primary"
                  style={{ padding: '6px 12px', fontSize: 11, whiteSpace: 'nowrap', marginLeft: 12 }}
                  onClick={() => setIsResubmitOpen(true)}
                >
                  <Send size={12} />
                  <span>Submit Clarification</span>
                </button>
              )}
            </div>
          )}

          {/* Interactive Stage Stepper */}
          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                AICTE Approval Workflow Progression
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

          {/* Application Metadata & Action Box */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
            {/* Left: Summary Grid */}
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
                <span>{details.submission_date}</span>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                  Notes & Disclosures
                </span>
                <p style={{ margin: '4px 0 0', color: '#475569', lineHeight: 1.4 }}>
                  {details.notes || 'No institutional notes recorded.'}
                </p>
              </div>
            </div>

            {/* Right: Available Transitions / Actions */}
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
                Available Workflow Actions ({user?.role})
              </span>

              {transitions.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 'auto 0' }}>
                  No pending transition actions available for role '{user?.role}' on this stage.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transitions.map((t) => {
                    const isReturn = t.action === 'RETURN';
                    const isResubmit = t.action === 'RESUBMIT';

                    if (isReturn) {
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

                    if (isResubmit) {
                      return (
                        <button
                          key={t.action}
                          className="btn-primary"
                          style={{ background: '#ea580c', borderColor: '#ea580c' }}
                          disabled={isActionLoading}
                          onClick={() => setIsResubmitOpen(true)}
                        >
                          <Send size={14} />
                          <span>Submit Clarification Response</span>
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
                  })}
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
            </div>

            {documents.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                No documents uploaded for this application yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)'
                    }}
                  >
                    <div>
                      <b style={{ fontSize: 12, display: 'block' }}>{doc.document_name}</b>
                      <small style={{ color: 'var(--text-muted)' }}>
                        Type: {doc.document_type} · {(doc.file_size / 1024).toFixed(0)} KB · Uploaded by {doc.uploaded_by}
                      </small>
                    </div>
                    <span className={`badge badge-${doc.review_status === 'ACCEPTED' ? 'verified' : (doc.review_status === 'CORRECTION_REQUIRED' ? 'returned' : 'pending')}`}>
                      {doc.review_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chronological Audit History Timeline */}
          <div className="panel-card" style={{ padding: '16px' }}>
            <div className="panel-header" style={{ marginBottom: 12, paddingBottom: 8 }}>
              <h3>
                <Clock size={16} color="var(--primary)" />
                Chronological Audit History ({auditEvents.length} actions)
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

      {/* Return For Clarification Dialog (Enforces Mandatory Reason) */}
      {isReturnOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-dialog" style={{ width: 'min(500px, 90%)' }}>
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

      {/* Institution Clarification Resubmit Dialog */}
      {isResubmitOpen && (
        <div className="modal-backdrop" style={{ zIndex: 110 }}>
          <div className="modal-dialog" style={{ width: 'min(500px, 90%)' }}>
            <div className="modal-header">
              <h3>Submit Clarification Response</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsResubmitOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                Describe how the deficiencies identified by the scrutinizing officer have been rectified.
                This will transition the case back into Scrutiny.
              </p>
              <div className="form-group">
                <label>Institutional Explanation *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Attested copy of registered lease deed uploaded as document #4. All survey numbers verified..."
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
                onClick={() => handleTransition('RESUBMIT', resubmitReason)}
              >
                {isActionLoading ? 'Resubmitting...' : 'Resubmit Case'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
