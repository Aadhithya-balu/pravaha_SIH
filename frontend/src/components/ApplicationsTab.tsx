import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Eye,
  Filter,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  Clock,
  ArrowUpDown,
  Building2,
  Calendar,
  ChevronLeft,
  ChevronRight
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
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');

  // Sorting
  const [sortField, setSortField] = useState<keyof Application>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Create form modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form fields
  const [institutionName, setInstitutionName] = useState(user?.institution_name || '');
  const [appType, setAppType] = useState('Extension of Approval');
  const [region, setRegion] = useState(user?.region || 'Northern');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredApps = useMemo(() => {
    return applications.filter((a) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.reference.toLowerCase().includes(q) ||
        a.institution_name.toLowerCase().includes(q) ||
        (a.region && a.region.toLowerCase().includes(q));

      const matchesStage = stageFilter === 'ALL' || a.current_stage === stageFilter;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchesType = typeFilter === 'ALL' || a.application_type.toLowerCase().includes(typeFilter.toLowerCase());
      const matchesRegion = regionFilter === 'ALL' || a.region === regionFilter;

      let matchesSla = true;
      if (slaFilter === 'OVERDUE') {
        matchesSla = a.status === 'OVERDUE' || Boolean(a.due_date && a.due_date < todayStr && a.status !== 'COMPLETED');
      } else if (slaFilter === 'DUE_SOON') {
        if (a.due_date && a.status !== 'COMPLETED') {
          const diffDays = Math.ceil((new Date(a.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
          matchesSla = diffDays >= 0 && diffDays <= 7;
        } else {
          matchesSla = false;
        }
      }

      return matchesSearch && matchesStage && matchesStatus && matchesType && matchesRegion && matchesSla;
    });
  }, [applications, search, stageFilter, statusFilter, typeFilter, regionFilter, slaFilter, todayStr]);

  // Sorted applications
  const sortedApps = useMemo(() => {
    return [...filteredApps].sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [filteredApps, sortField, sortAsc]);

  // Paginated applications
  const totalPages = Math.max(1, Math.ceil(sortedApps.length / pageSize));
  const paginatedApps = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedApps.slice(start, start + pageSize);
  }, [sortedApps, currentPage, pageSize]);

  function handleSort(field: keyof Application) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearch('');
    setStageFilter('ALL');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setRegionFilter('ALL');
    setSlaFilter('ALL');
    setCurrentPage(1);
  }

  const hasActiveFilters =
    search ||
    stageFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    regionFilter !== 'ALL' ||
    slaFilter !== 'ALL';

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
      setErrorMsg(err.message || 'Failed to create application.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const getStatusBadge = (a: Application) => {
    const isOverdue = a.status === 'OVERDUE' || Boolean(a.due_date && a.due_date < todayStr && a.status !== 'COMPLETED');

    if (isOverdue) {
      return (
        <span className="badge badge-overdue" title="Regulatory SLA target exceeded">
          <AlertTriangle size={10} /> Overdue
        </span>
      );
    }

    switch (a.status) {
      case 'IN_PROGRESS':
        return <span className="badge badge-in_progress">In Progress</span>;
      case 'RETURNED':
        return <span className="badge badge-returned"><RotateCcw size={10} /> Returned</span>;
      case 'COMPLETED':
        return <span className="badge badge-completed"><CheckCircle2 size={10} /> Approved</span>;
      case 'REJECTED':
        return <span className="badge badge-critical">Rejected</span>;
      default:
        return <span className="badge badge-pending">{a.status}</span>;
    }
  };

  const getSlaRiskTag = (a: Application) => {
    if (a.status === 'COMPLETED' || a.status === 'REJECTED') {
      return <span className="sla-risk-tag ontrack">Concluded</span>;
    }

    if (!a.due_date) {
      return <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>—</span>;
    }

    const due = new Date(a.due_date).getTime();
    const now = new Date().getTime();
    const diffDays = Math.ceil((due - now) / (1000 * 3600 * 24));

    if (diffDays < 0) {
      return (
        <span className="sla-risk-tag overdue" title={`${Math.abs(diffDays)} days overdue`}>
          <AlertTriangle size={10} /> -{Math.abs(diffDays)}d SLA
        </span>
      );
    }

    if (diffDays <= 7) {
      return (
        <span className="sla-risk-tag warning" title={`Due in ${diffDays} days`}>
          <Clock size={10} /> {diffDays}d left
        </span>
      );
    }

    return (
      <span className="sla-risk-tag ontrack">
        {diffDays}d
      </span>
    );
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        {/* Panel Header */}
        <div className="panel-header">
          <div>
            <h3>Regulatory Applications Workbench</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Official registry of technical institute applications for scrutiny and statutory approval
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user?.role !== 'evc_expert' && (
              <button className="btn-primary" onClick={() => setIsCreateOpen(true)}>
                <Plus size={14} />
                <span>Register Application</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="filter-bar">
          <div className="search-input-wrap">
            <Search size={14} />
            <input
              type="text"
              placeholder="Search reference (AICTE-...), college, or region..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Search applications"
            />
          </div>

          <select
            className="filter-select"
            value={stageFilter}
            onChange={(e) => {
              setStageFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by stage"
          >
            <option value="ALL">All Stages</option>
            <option value="SUBMITTED">1. Submitted</option>
            <option value="SCRUTINY">2. Scrutiny</option>
            <option value="RE_SCRUTINY">3. Re-Scrutiny</option>
            <option value="EVC_PENDING">4. EVC Pending</option>
            <option value="EVC_SCHEDULED">5. EVC Scheduled</option>
            <option value="EVC_COMPLETED">6. EVC Completed</option>
            <option value="SAC_SHC_REVIEW">7. SAC / SHC Review</option>
            <option value="COMPLIANCE_PENDING">8. Compliance Pending</option>
            <option value="COMPLETED">9. Completed</option>
            <option value="RETURNED_FOR_CLARIFICATION">Returned (Clarification)</option>
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RETURNED">Returned (Deficient)</option>
            <option value="OVERDUE">Overdue (SLA Breach)</option>
            <option value="COMPLETED">Approved / Concluded</option>
          </select>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by type"
          >
            <option value="ALL">All Application Types</option>
            <option value="Extension of Approval">Extension of Approval (EoA)</option>
            <option value="New Institution">New Institution</option>
            <option value="New Course">New Course / Intake</option>
            <option value="Institutional Change">Institutional Change</option>
            <option value="Compliance Submission">Compliance Submission</option>
          </select>

          {user?.role !== 'institution' && (
            <select
              className="filter-select"
              value={regionFilter}
              onChange={(e) => {
                setRegionFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter by region"
            >
              <option value="ALL">All Regions</option>
              <option value="Northern">Northern</option>
              <option value="Western">Western</option>
              <option value="Southern">Southern</option>
              <option value="Eastern">Eastern</option>
              <option value="Central">Central</option>
              <option value="HQ">HQ</option>
            </select>
          )}

          <select
            className="filter-select"
            value={slaFilter}
            onChange={(e) => {
              setSlaFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by SLA risk"
          >
            <option value="ALL">All SLA States</option>
            <option value="OVERDUE">Overdue Only (&gt;14d)</option>
            <option value="DUE_SOON">Due Soon (&lt;7d)</option>
          </select>

          {hasActiveFilters && (
            <button
              className="btn-secondary"
              onClick={handleClearFilters}
              style={{ fontSize: 11, padding: '6px 10px' }}
            >
              <X size={12} />
              <span>Reset Filters</span>
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="table-responsive">
          <table className="data-table" aria-label="Applications table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('reference')}
                  style={{ cursor: 'pointer' }}
                  title="Click to sort by reference"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Reference ID</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('institution_name')}
                  style={{ cursor: 'pointer' }}
                  title="Click to sort by institution"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Institution & Region</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th>Type / Academic Year</th>
                <th>Stage</th>
                <th>Status</th>
                <th
                  onClick={() => handleSort('submission_date')}
                  style={{ cursor: 'pointer' }}
                  title="Click to sort by submission date"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Submission</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('due_date')}
                  style={{ cursor: 'pointer' }}
                  title="Click to sort by due date"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Due Date & SLA</span>
                    <ArrowUpDown size={11} />
                  </div>
                </th>
                <th>Assigned Desk</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedApps.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state">
                      <Filter size={24} color="#94a3b8" />
                      <h4>No matching applications found</h4>
                      <p>
                        {hasActiveFilters
                          ? 'No records match the active search criteria or filters. Try resetting the filters.'
                          : 'No applications have been registered in this scope yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button className="btn-secondary" onClick={handleClearFilters} style={{ marginTop: 6 }}>
                          Reset all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedApps.map((a) => (
                  <tr
                    key={a.id}
                    className="clickable-row"
                    onClick={() => onSelectApplication(a)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectApplication(a);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open application ${a.reference}`}
                  >
                    <td>
                      <b style={{ fontFamily: 'JetBrains Mono', color: 'var(--primary)', fontSize: 12 }}>
                        {a.reference}
                      </b>
                    </td>
                    <td>
                      <b style={{ color: 'var(--text-main)', display: 'block' }}>{a.institution_name}</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Region: {a.region || 'HQ'}
                      </span>
                    </td>
                    <td>
                      <span style={{ display: 'block', fontWeight: 600 }}>{a.application_type}</span>
                      <small style={{ color: 'var(--text-muted)' }}>AY {a.academic_year || '2026-2027'}</small>
                    </td>
                    <td>
                      <span className="badge badge-stage">{a.current_stage.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{getStatusBadge(a)}</td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.submission_date}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11 }}>{a.due_date || '—'}</span>
                        {getSlaRiskTag(a)}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.assigned_to}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '5px 9px', fontSize: 11, marginLeft: 'auto' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectApplication(a);
                        }}
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {sortedApps.length > 0 && (
            <div className="pagination-bar">
              <div>
                Showing <b>{Math.min((currentPage - 1) * pageSize + 1, sortedApps.length)}</b> to{' '}
                <b>{Math.min(currentPage * pageSize, sortedApps.length)}</b> of <b>{sortedApps.length}</b> applications
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Rows:</span>
                  <select
                    className="filter-select"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="pagination-controls">
                  <button
                    className="btn-page"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => {
                      const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span style={{ padding: '0 4px' }}>…</span>}
                          <button
                            className={`btn-page ${currentPage === p ? 'active' : ''}`}
                            onClick={() => setCurrentPage(p)}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    className="btn-page"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Application Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3>Register New Regulatory Application</h3>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsCreateOpen(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                {errorMsg && <div className="alert-banner danger">{errorMsg}</div>}

                {user?.role !== 'institution' ? (
                  <div className="form-group">
                    <label>Institution Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Government Engineering College"
                      value={institutionName}
                      onChange={(e) => setInstitutionName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Applicant Institution</label>
                    <input type="text" disabled value={user.institution_name || ''} />
                  </div>
                )}

                <div className="form-group">
                  <label>Application Type *</label>
                  <select value={appType} onChange={(e) => setAppType(e.target.value)}>
                    <option value="Extension of Approval">Extension of Approval (EoA)</option>
                    <option value="New Institution">New Institution Approval</option>
                    <option value="New Course">New Course / Intake Increase</option>
                    <option value="Institutional Change">Institutional Change / Site Relocation</option>
                    <option value="Compliance Submission">Statutory Compliance Submission</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label>AICTE Region</label>
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
                  <label>Application Notes & Scope</label>
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
                  {isSubmitting ? 'Registering...' : 'Register Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
