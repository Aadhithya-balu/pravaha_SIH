import React, { useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X
} from 'lucide-react';
import { Application, User } from '../types';
import { api } from '../api';

interface ApplicationsTabProps {
  applications: Application[];
  user: User | null;
  onSelectApplication: (app: Application) => void;
  onRefresh: () => void;
}

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  applications,
  user,
  onSelectApplication,
  onRefresh
}) => {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Create form fields
  const [institutionName, setInstitutionName] = useState(user?.institution_name || '');
  const [appType, setAppType] = useState('Extension of Approval');
  const [region, setRegion] = useState(user?.region || 'Northern');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const filteredApps = applications.filter((a) => {
    const matchesSearch =
      a.reference.toLowerCase().includes(search.toLowerCase()) ||
      a.institution_name.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'ALL' || a.current_stage === stageFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || a.application_type === typeFilter;
    return matchesSearch && matchesStage && matchesStatus && matchesType;
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await api('/applications', {
        method: 'POST',
        body: JSON.stringify({
          institution_name: user?.role === 'institution' ? user.institution_name : institutionName,
          application_type: appType,
          region,
          due_date: dueDate || null,
          notes,
          academic_year: '2026-2027'
        })
      });
      setIsCreateOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return <span className="badge badge-in_progress">In Progress</span>;
      case 'RETURNED':
        return <span className="badge badge-returned"><RotateCcw size={10} /> Returned</span>;
      case 'OVERDUE':
        return <span className="badge badge-overdue"><AlertTriangle size={10} /> Overdue</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed"><CheckCircle2 size={10} /> Completed</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        <div className="panel-header">
          <div>
            <h3>Applications Register</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Showing {filteredApps.length} of {applications.length} applications
            </span>
          </div>

          <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={15} />
            <span>New Application</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={15} />
            <input
              type="text"
              placeholder="Search reference (AICTE-...) or institution name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All Stages</option>
            <option value="SCRUTINY">Scrutiny</option>
            <option value="RE_SCRUTINY">Re-Scrutiny</option>
            <option value="EVC_PENDING">EVC Pending</option>
            <option value="EVC_SCHEDULED">EVC Scheduled</option>
            <option value="EVC_COMPLETED">EVC Completed</option>
            <option value="SAC_SHC_REVIEW">SAC / SHC Review</option>
            <option value="COMPLIANCE_PENDING">Compliance Pending</option>
            <option value="COMPLETED">Completed</option>
            <option value="RETURNED_FOR_CLARIFICATION">Returned for Clarification</option>
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RETURNED">Returned</option>
            <option value="OVERDUE">Overdue</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Application Types</option>
            <option value="Extension of Approval">Extension of Approval</option>
            <option value="New Institution">New Institution</option>
            <option value="New Course">New Course / Intake Increase</option>
            <option value="Institutional Change">Institutional Change / Site</option>
            <option value="Compliance Submission">Compliance Submission</option>
          </select>
        </div>

        {/* Data Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Institution Name</th>
                <th>Application Type</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No applications found matching the selected search criteria.
                  </td>
                </tr>
              ) : (
                filteredApps.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <b style={{ fontFamily: 'JetBrains Mono', color: 'var(--primary)', fontSize: 12 }}>
                        {a.reference}
                      </b>
                    </td>
                    <td>
                      <b style={{ color: 'var(--text-main)', display: 'block' }}>{a.institution_name}</b>
                      <small style={{ color: 'var(--text-muted)' }}>Region: {a.region}</small>
                    </td>
                    <td>{a.application_type}</td>
                    <td>
                      <span className="badge badge-stage">{a.current_stage.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{getStatusBadge(a.status)}</td>
                    <td>{a.assigned_to}</td>
                    <td>{a.due_date || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: 11, marginLeft: 'auto' }}
                        onClick={() => onSelectApplication(a)}
                      >
                        <Eye size={13} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Application Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Register New AICTE Application</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsCreateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {errorMsg && (
                  <div className="alert-banner danger">{errorMsg}</div>
                )}

                {user?.role !== 'institution' ? (
                  <div className="form-group">
                    <label>Institution Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ABC Engineering College"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Institution Name</label>
                    <input type="text" disabled value={user.institution_name || ''} />
                  </div>
                )}

                <div className="form-group">
                  <label>Application Type *</label>
                  <select value={appType} onChange={(e) => setAppType(e.target.value)}>
                    <option value="Extension of Approval">Extension of Approval (EoA)</option>
                    <option value="New Institution">New Institution Approval</option>
                    <option value="New Course">New Course / Intake Increase</option>
                    <option value="Institutional Change">Institutional Change / Land Shift</option>
                    <option value="Compliance Submission">Statutory Compliance Submission</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>Region</label>
                    <select value={region} onChange={(e) => setRegion(e.target.value)}>
                      <option value="Northern">Northern Region (Kanpur/Noida)</option>
                      <option value="Western">Western Region (Mumbai/Pune)</option>
                      <option value="Southern">Southern Region (Bengaluru/Chennai)</option>
                      <option value="Eastern">Eastern Region (Kolkata)</option>
                      <option value="Central">Central Region (Bhopal)</option>
                      <option value="HQ">AICTE Head Office (New Delhi)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Target Scrutiny Due Date</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Application Purpose & Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of application scope, programs, intake capacity..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
