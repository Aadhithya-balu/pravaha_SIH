import React, { useState, useEffect } from 'react';
import {
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Clock,
  Send,
  X,
  ShieldCheck,
  Building2,
  Filter,
  RotateCcw,
  AlertCircle,
  FileText
} from 'lucide-react';
import { ComplianceItem, User } from '../types';
import { api } from '../api';

interface ComplianceTabProps {
  user: User | null;
  onRefresh: () => void;
}

export const ComplianceTab: React.FC<ComplianceTabProps> = ({ user, onRefresh }) => {
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Submit Evidence Modal
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ComplianceItem | null>(null);
  const [evidenceText, setEvidenceText] = useState('');
  const [attachmentDocRef, setAttachmentDocRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitDirty, setSubmitDirty] = useState(false);

  // Officer Verification Modal
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [officerComments, setOfficerComments] = useState('');
  const [confirmRejectModal, setConfirmRejectModal] = useState(false);

  async function loadItems() {
    try {
      const data = await api<ComplianceItem[]>('/compliance');
      setItems(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load compliance records.');
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesStatus = statusFilter === 'ALL' || item.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || item.item_type === typeFilter;
    return matchesStatus && matchesType;
  });

  function handleCloseSubmit() {
    if (submitDirty && !window.confirm('You have unsaved changes in your evidence submission. Discard?')) {
      return;
    }
    setIsSubmitOpen(false);
    setSelectedItem(null);
    setEvidenceText('');
    setAttachmentDocRef('');
    setSubmitDirty(false);
  }

  function handleCloseVerify() {
    setIsVerifyOpen(false);
    setSelectedItem(null);
    setOfficerComments('');
    setConfirmRejectModal(false);
  }

  async function handleSubmitEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !evidenceText.trim()) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const fullEvidence = attachmentDocRef.trim()
        ? `${evidenceText.trim()} [Attached Document: ${attachmentDocRef.trim()}]`
        : evidenceText.trim();

      await api(`/compliance/${selectedItem.id}/submit-evidence`, {
        method: 'POST',
        body: JSON.stringify({ submission_evidence: fullEvidence })
      });
      setIsSubmitOpen(false);
      setEvidenceText('');
      setAttachmentDocRef('');
      setSelectedItem(null);
      setSubmitDirty(false);
      setSuccessMsg('Evidence submitted successfully. Awaiting scrutiny officer verification.');
      await loadItems();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Evidence submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(action: 'VERIFY' | 'REJECT') {
    if (!selectedItem) return;

    if (action === 'REJECT' && officerComments.trim().length < 5) {
      setErrorMsg('Please provide a specific justification (min 5 chars) before rejecting submitted evidence.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api(`/compliance/${selectedItem.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          officer_comments:
            officerComments.trim() ||
            (action === 'VERIFY'
              ? 'Verified compliant with APH norms.'
              : 'Rejected due to inadequate or expired documentation.')
        })
      });
      setIsVerifyOpen(false);
      setSelectedItem(null);
      setOfficerComments('');
      setConfirmRejectModal(false);
      setSuccessMsg(`Requirement marked as ${action === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}.`);
      await loadItems();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification update failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <span className="badge badge-verified">
            <CheckCircle2 size={10} /> Verified
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="badge badge-in_progress">
            <Clock size={10} /> Submitted
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="badge badge-overdue">
            <AlertTriangle size={10} /> Overdue
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-returned">
            <AlertTriangle size={10} /> Rejected
          </span>
        );
      default:
        return <span className="badge badge-pending">Pending</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Compliance & Document Validity Tracker</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Monitoring time-bound statutory undertakings, land leases, fire safety clearances, and annual NOCs
            </span>
          </div>
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

        {/* Filters */}
        <div className="filter-bar">
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Status:</span>
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter compliance records by status"
            >
              <option value="ALL">All Statuses ({items.length})</option>
              <option value="PENDING">Pending Submission</option>
              <option value="SUBMITTED">Submitted (Pending Review)</option>
              <option value="VERIFIED">Verified</option>
              <option value="OVERDUE">Overdue</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </label>

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Category:</span>
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter compliance records by requirement type"
            >
              <option value="ALL">All Requirement Types</option>
              <option value="LEASE_DOCUMENT">Land Lease Validity</option>
              <option value="UNDERTAKING">Statutory Undertaking / Affidavit</option>
              <option value="FIRE_SAFETY_NOC">Fire & Life Safety NOC</option>
              <option value="LAND_CONVERSION">Land Use Conversion (CLU)</option>
            </select>
          </label>

          {(statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
              }}
            >
              <RotateCcw size={11} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Compliance Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Institution Name</th>
                <th>Requirement Category</th>
                <th>Description</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Evidence Submitted</th>
                <th>Verification</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0, border: 0 }}>
                    <div className="empty-state" style={{ margin: 0, border: 0 }}>
                      <div className="empty-state-icon">
                        <FileCheck2 size={26} />
                      </div>
                      <div className="empty-state-title">No Compliance Records Found</div>
                      <div className="empty-state-desc">
                        {statusFilter !== 'ALL' || typeFilter !== 'ALL'
                          ? 'No compliance items match the selected filter criteria. Try resetting the filters.'
                          : 'There are no compliance requirements currently recorded for this tenant or region.'}
                      </div>
                      {(statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
                        <div className="empty-state-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => {
                              setStatusFilter('ALL');
                              setTypeFilter('ALL');
                            }}
                          >
                            Reset All Filters
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <b style={{ color: 'var(--text-main)', display: 'block' }}>{item.institution_name}</b>
                    </td>
                    <td>
                      <span className="badge badge-stage">{item.item_type.replace(/_/g, ' ')}</span>
                    </td>
                    <td style={{ maxWidth: 280, whiteSpace: 'normal', lineHeight: 1.35, fontSize: 12 }}>
                      {item.description}
                    </td>
                    <td>
                      <b style={{ fontSize: 12 }}>{item.due_date}</b>
                    </td>
                    <td>{getStatusBadge(item.status)}</td>
                    <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: 11, color: '#475569' }}>
                      {item.submission_evidence || <span style={{ color: '#94a3b8' }}>None</span>}
                    </td>
                    <td style={{ fontSize: 11 }}>
                      {item.verified_by ? (
                        <div>
                          <b style={{ color: '#0f766e', display: 'block' }}>Verified</b>
                          <small style={{ color: '#64748b' }}>by {item.verified_by}</small>
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unverified</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {/* Institution: Submit evidence button */}
                      {user?.role === 'institution' && item.status !== 'VERIFIED' && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '5px 10px', fontSize: 11, marginLeft: 'auto' }}
                          onClick={() => {
                            setSelectedItem(item);
                            setEvidenceText(item.submission_evidence || '');
                            setSubmitDirty(false);
                            setIsSubmitOpen(true);
                          }}
                        >
                          <Upload size={12} />
                          <span>{item.submission_evidence ? 'Update Evidence' : 'Submit Evidence'}</span>
                        </button>
                      )}

                      {/* Officer / Admin: Verify button */}
                      {user?.role !== 'institution' && item.status !== 'VERIFIED' && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ padding: '5px 10px', fontSize: 11, marginLeft: 'auto' }}
                          onClick={() => {
                            setSelectedItem(item);
                            setOfficerComments('');
                            setConfirmRejectModal(false);
                            setIsVerifyOpen(true);
                          }}
                        >
                          <ShieldCheck size={12} color="#059669" />
                          <span>Review & Verify</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Evidence Modal (Institution) */}
      {isSubmitOpen && selectedItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="evidence-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h3 id="evidence-modal-title">Submit Documentary Evidence</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Statutory compliance filing for {selectedItem.institution_name}
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={handleCloseSubmit}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitEvidence}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <b style={{ fontSize: 13, display: 'block', color: 'var(--color-navy)' }}>{selectedItem.description}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Category: <b>{selectedItem.item_type}</b> · Statutory Due Date: <b>{selectedItem.due_date}</b>
                  </span>
                </div>

                <div className="form-group">
                  <label htmlFor="evidence-desc">
                    Documentary Reference & Evidence Description <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <textarea
                    id="evidence-desc"
                    rows={4}
                    required
                    placeholder="Provide Sub-Registrar deed number, notary stamp details, Fire NOC reference number, or issuing authority dates..."
                    value={evidenceText}
                    onChange={(e) => {
                      setEvidenceText(e.target.value);
                      setSubmitDirty(true);
                    }}
                    aria-required="true"
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="form-field-hint">Must quote valid government seal or registration serial numbers</span>
                    <span className="char-count">{evidenceText.length} characters (min 5)</span>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="evidence-file-ref">
                    Attached Document File Name / Reference (Optional)
                  </label>
                  <input
                    id="evidence-file-ref"
                    type="text"
                    placeholder="e.g. Registered_Lease_Deed_Book1_Vol42.pdf"
                    value={attachmentDocRef}
                    onChange={(e) => {
                      setAttachmentDocRef(e.target.value);
                      setSubmitDirty(true);
                    }}
                  />
                  <span className="form-field-hint">Permitted types: PDF, DOCX (Max 10MB)</span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseSubmit}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || evidenceText.trim().length < 5}
                >
                  {isSubmitting ? 'Submitting Evidence...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Officer Verification Modal */}
      {isVerifyOpen && selectedItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="verify-modal-title">
          <div className="modal-dialog" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <div>
                <h3 id="verify-modal-title">Verify Statutory Compliance Submission</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Statutory scrutiny by authorized AICTE officer
                </span>
              </div>
              <button
                type="button"
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-muted)' }}
                onClick={handleCloseVerify}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <b style={{ fontSize: 13, display: 'block', color: 'var(--color-navy)' }}>{selectedItem.institution_name}</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedItem.description} · Due Date: <b>{selectedItem.due_date}</b>
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <b style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Submitted Evidence Record
                </b>
                <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                  {selectedItem.submission_evidence || 'No documentary evidence submitted yet.'}
                </p>
              </div>

              <div className="form-group">
                <label htmlFor="verify-remarks">
                  Scrutinizer Verification Remarks {confirmRejectModal && <span style={{ color: '#dc2626' }}>* (Required for Rejection)</span>}
                </label>
                <textarea
                  id="verify-remarks"
                  rows={3}
                  placeholder={
                    confirmRejectModal
                      ? 'State the specific regulatory deficiency or invalidity (min 5 chars)...'
                      : 'e.g. Verified against Sub-Registrar records. Validity confirmed until 2054 under APH Norms...'
                  }
                  value={officerComments}
                  onChange={(e) => setOfficerComments(e.target.value)}
                  style={{
                    borderColor: confirmRejectModal ? '#dc2626' : undefined
                  }}
                />
                <span className="char-count">{officerComments.length} characters</span>
              </div>

              {confirmRejectModal && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 11.5, color: '#991b1b' }}>
                  <b>Warning:</b> Rejecting this submission will flag the compliance item as REJECTED and notify the institution to resubmit valid evidence.
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!confirmRejectModal ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ borderColor: '#ea580c', color: '#c2410c' }}
                    disabled={isSubmitting}
                    onClick={() => setConfirmRejectModal(true)}
                  >
                    Reject Evidence...
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a' }}
                    disabled={isSubmitting}
                    onClick={() => handleVerify('VERIFY')}
                  >
                    {isSubmitting ? 'Verifying...' : 'Mark Verified'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirmRejectModal(false)}
                    disabled={isSubmitting}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#dc2626', borderColor: '#dc2626' }}
                    disabled={isSubmitting || officerComments.trim().length < 5}
                    onClick={() => handleVerify('REJECT')}
                  >
                    {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
