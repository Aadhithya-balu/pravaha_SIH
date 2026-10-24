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
  Building2
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Officer Verification Modal
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [officerComments, setOfficerComments] = useState('');

  async function loadItems() {
    try {
      const data = await api<ComplianceItem[]>('/compliance');
      setItems(data);
    } catch (err: any) {
      setErrorMsg(err.message);
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

  async function handleSubmitEvidence(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || !evidenceText.trim()) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api(`/compliance/${selectedItem.id}/submit-evidence`, {
        method: 'POST',
        body: JSON.stringify({ submission_evidence: evidenceText.trim() })
      });
      setIsSubmitOpen(false);
      setEvidenceText('');
      setSelectedItem(null);
      setSuccessMsg('Evidence submitted successfully. Awaiting scrutiny officer verification.');
      await loadItems();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerify(action: 'VERIFY' | 'REJECT') {
    if (!selectedItem) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api(`/compliance/${selectedItem.id}/verify`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          officer_comments: officerComments.trim() || (action === 'VERIFY' ? 'Verified compliant with APH norms.' : 'Rejected due to inadequate evidence.')
        })
      });
      setIsVerifyOpen(false);
      setSelectedItem(null);
      setOfficerComments('');
      setSuccessMsg(`Requirement marked as ${action === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}.`);
      await loadItems();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <span className="badge badge-verified"><CheckCircle2 size={10} /> Verified</span>;
      case 'SUBMITTED':
        return <span className="badge badge-in_progress"><Clock size={10} /> Submitted</span>;
      case 'OVERDUE':
        return <span className="badge badge-overdue"><AlertTriangle size={10} /> Overdue</span>;
      case 'REJECTED':
        return <span className="badge badge-returned"><AlertTriangle size={10} /> Rejected</span>;
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
              Monitoring time-bound statutory undertakings, land leases, fire safety clearances and annual NOCs
            </span>
          </div>
        </div>

        {errorMsg && <div className="alert-banner danger" style={{ marginBottom: 14 }}>{errorMsg}</div>}
        {successMsg && <div className="alert-banner info" style={{ marginBottom: 14 }}>{successMsg}</div>}

        {/* Filters */}
        <div className="filter-bar">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Submission</option>
            <option value="SUBMITTED">Submitted (Pending Verification)</option>
            <option value="VERIFIED">Verified</option>
            <option value="OVERDUE">Overdue</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Requirement Types</option>
            <option value="LEASE_DOCUMENT">Land Lease Validity</option>
            <option value="UNDERTAKING">Statutory Undertaking / Affidavit</option>
            <option value="FIRE_SAFETY_NOC">Fire & Life Safety NOC</option>
            <option value="LAND_CONVERSION">Land Use Conversion (CLU)</option>
          </select>
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
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No compliance requirements found matching filters.
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
                    <td style={{ maxWidth: 300, whiteSpace: 'normal', lineHeight: 1.3 }}>
                      {item.description}
                    </td>
                    <td>
                      <b>{item.due_date}</b>
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
                          className="btn-primary"
                          style={{ padding: '5px 9px', fontSize: 11, marginLeft: 'auto' }}
                          onClick={() => {
                            setSelectedItem(item);
                            setIsSubmitOpen(true);
                          }}
                        >
                          <Upload size={12} />
                          <span>Submit Evidence</span>
                        </button>
                      )}

                      {/* Officer / Admin: Verify button */}
                      {user?.role !== 'institution' && item.status !== 'VERIFIED' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '5px 9px', fontSize: 11, marginLeft: 'auto' }}
                          onClick={() => {
                            setSelectedItem(item);
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
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Submit Documentary Evidence</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsSubmitOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmitEvidence}>
              <div className="modal-body">
                <div>
                  <b style={{ fontSize: 13, display: 'block' }}>{selectedItem.description}</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Category: {selectedItem.item_type} · Due Date: {selectedItem.due_date}
                  </span>
                </div>

                <div className="form-group">
                  <label>Documentary Reference & Evidence Description *</label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Provide document serial number, notary attestation details, or upload reference..."
                    value={evidenceText}
                    onChange={(e) => setEvidenceText(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsSubmitOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmitting || evidenceText.trim().length < 5}
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Submission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Officer Verification Modal */}
      {isVerifyOpen && selectedItem && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Verify Statutory Compliance Submission</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsVerifyOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div>
                <b style={{ fontSize: 13, display: 'block' }}>{selectedItem.institution_name}</b>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {selectedItem.description} · Due Date: {selectedItem.due_date}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <b style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Submitted Evidence
                </b>
                <p style={{ margin: 0, fontSize: 12, color: '#334155' }}>
                  {selectedItem.submission_evidence || 'No evidence text submitted yet.'}
                </p>
              </div>

              <div className="form-group">
                <label>Scrutinizer Verification Remarks</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Verified against Sub-Registrar records. Validity confirmed until 2053..."
                  value={officerComments}
                  onChange={(e) => setOfficerComments(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                style={{ borderColor: '#ea580c', color: '#c2410c' }}
                disabled={isSubmitting}
                onClick={() => handleVerify('REJECT')}
              >
                Reject Evidence
              </button>
              <button
                className="btn-primary"
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                disabled={isSubmitting}
                onClick={() => handleVerify('VERIFY')}
              >
                {isSubmitting ? 'Verifying...' : 'Mark Verified'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
