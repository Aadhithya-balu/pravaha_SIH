import React, { useState } from 'react';
import {
  Search,
  Plus,
  Eye,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  FileText,
  Upload,
  X,
  BookOpen,
  GraduationCap,
  Building2,
  Calendar
} from 'lucide-react';
import { Application, User } from '../types';
import { createApplication, uploadApplicationDocument } from '../api';

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

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'EOA' | 'NEW_PROGRAMME'>('EOA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'submit' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields - Common
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [dueDate, setDueDate] = useState('');

  // Form Fields - EOA
  const [existingIntake, setExistingIntake] = useState('B.Tech Computer Science: 120 seats, B.Tech Electronics: 60 seats, B.Tech Mechanical: 60 seats');
  const [landCompliance, setLandCompliance] = useState('Registered Land Lease valid through 2060; fire safety clearance attested');
  const [eoaNotes, setEoaNotes] = useState('Annual Extension of Approval request for academic year 2026-2027 with ongoing intake.');

  // Form Fields - New Programme/Level
  const [programmeName, setProgrammeName] = useState('B.Tech in Artificial Intelligence & Machine Learning');
  const [programmeLevel, setProgrammeLevel] = useState('Undergraduate (UG)');
  const [proposedIntake, setProposedIntake] = useState(60);
  const [labReadiness, setLabReadiness] = useState('Computing laboratory equipped with 40 GPU-enabled workstations, optical fiber LAN, and licensed simulation suites.');
  const [newProgrammeNotes, setNewProgrammeNotes] = useState('Proposal for introduction of new high-demand emerging technology programme.');

  // Attached File
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedDocType, setAttachedDocType] = useState('LEASE_DEED');
  const [attachedDocName, setAttachedDocName] = useState('');

  const filteredApps = applications.filter((a) => {
    const matchesSearch =
      a.reference.toLowerCase().includes(search.toLowerCase()) ||
      a.institution_name.toLowerCase().includes(search.toLowerCase()) ||
      (a.notes && a.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesStage = stageFilter === 'ALL' || a.current_stage === stageFilter;
    const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
    const matchesType =
      typeFilter === 'ALL' ||
      a.application_type === typeFilter ||
      (typeFilter === 'Extension of Approval' && a.application_type.includes('Extension of Approval')) ||
      (typeFilter === 'New Programme/Level' && a.application_type.includes('New Programme'));
    return matchesSearch && matchesStage && matchesStatus && matchesType;
  });

  function resetForm() {
    setErrorMsg('');
    setAcademicYear('2026-2027');
    setDueDate('');
    setExistingIntake('B.Tech Computer Science: 120 seats, B.Tech Electronics: 60 seats, B.Tech Mechanical: 60 seats');
    setLandCompliance('Registered Land Lease valid through 2060; fire safety clearance attested');
    setEoaNotes('Annual Extension of Approval request for academic year 2026-2027 with ongoing intake.');
    setProgrammeName('B.Tech in Artificial Intelligence & Machine Learning');
    setProgrammeLevel('Undergraduate (UG)');
    setProposedIntake(60);
    setLabReadiness('Computing laboratory equipped with 40 GPU-enabled workstations, optical fiber LAN, and licensed simulation suites.');
    setNewProgrammeNotes('Proposal for introduction of new high-demand emerging technology programme.');
    setAttachedFile(null);
    setAttachedDocName('');
  }

  function handleOpenCreate() {
    resetForm();
    setIsCreateOpen(true);
  }

  async function handleSubmit(isDraft: boolean) {
    setIsSubmitting(true);
    setSubmittingAction(isDraft ? 'draft' : 'submit');
    setErrorMsg('');

    try {
      let appType = '';
      let compositeNotes = '';

      if (activeTab === 'EOA') {
        appType = 'Extension of Approval (EOA)';
        compositeNotes = `${eoaNotes.trim()}\nExisting Intake: ${existingIntake.trim()}\nCompliance Status: ${landCompliance.trim()}`;
      } else {
        appType = 'New Programme/Level';
        compositeNotes = `${newProgrammeNotes.trim()}\nProposed Programme: ${programmeName.trim()} (${programmeLevel})\nProposed Intake: ${proposedIntake} seats\nLab Readiness: ${labReadiness.trim()}`;
      }

      // Call V1 API
      const newApp = await createApplication({
        application_type: appType,
        academic_year: academicYear,
        notes: compositeNotes,
        due_date: dueDate || null,
        is_draft: isDraft
      });

      // Upload file if selected
      if (attachedFile && newApp?.id) {
        await uploadApplicationDocument(
          newApp.id,
          attachedFile,
          attachedDocType,
          attachedDocName || attachedFile.name
        );
      }

      setIsCreateOpen(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed. Please review the inputs.');
    } finally {
      setIsSubmitting(false);
      setSubmittingAction(null);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="badge badge-draft">
            <FileText size={10} /> Draft
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="badge badge-in_progress">
            <Clock size={10} /> In Progress
          </span>
        );
      case 'RETURNED':
        return (
          <span className="badge badge-returned">
            <RotateCcw size={10} /> Returned
          </span>
        );
      case 'OVERDUE':
        return (
          <span className="badge badge-overdue">
            <AlertTriangle size={10} /> Overdue
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="badge badge-completed">
            <CheckCircle2 size={10} /> Completed
          </span>
        );
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="panel-card">
        {/* Header */}
        <div className="panel-header">
          <div>
            <h3>Applications Register & Submissions</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {user?.role === 'institution'
                ? `Authorized Institution: ${user.institution_name} · Showing ${filteredApps.length} applications`
                : `Showing ${filteredApps.length} of ${applications.length} applications across jurisdictions`}
            </span>
          </div>

          <button className="btn-primary" onClick={handleOpenCreate}>
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
              placeholder="Search reference (AICTE-...), institution, or program notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Application Types</option>
            <option value="Extension of Approval">Extension of Approval (EOA)</option>
            <option value="New Programme/Level">New Programme / Level</option>
            <option value="New Institution">New Institution</option>
            <option value="Compliance Submission">Compliance Submission</option>
          </select>

          <select
            className="filter-select"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All Workflow Stages</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
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
            <option value="DRAFT">Draft</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RETURNED">Returned</option>
            <option value="OVERDUE">Overdue</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        {/* Applications Data Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Institution Name</th>
                <th>Application Type</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Assigned To</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <FileText size={32} color="#94a3b8" />
                      <b>No applications found</b>
                      <span style={{ fontSize: 12 }}>
                        {search || stageFilter !== 'ALL' || statusFilter !== 'ALL'
                          ? 'Try resetting the search filters above.'
                          : 'Click "New Application" to create your Extension of Approval (EOA) or New Programme proposal.'}
                      </span>
                      {(!search && stageFilter === 'ALL' && statusFilter === 'ALL') && (
                        <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleOpenCreate}>
                          <Plus size={14} />
                          <span>Start New Application</span>
                        </button>
                      )}
                    </div>
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
                    <td>
                      <span style={{ fontWeight: 600 }}>{a.application_type}</span>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>AY {a.academic_year}</small>
                    </td>
                    <td>
                      <span className="badge badge-stage">{a.current_stage.replace(/_/g, ' ')}</span>
                    </td>
                    <td>{getStatusBadge(a.status)}</td>
                    <td>
                      <span style={{ fontSize: 12, color: '#334155' }}>
                        {a.updated_at ? new Date(a.updated_at).toLocaleDateString() : (a.submission_date || new Date(a.created_at).toLocaleDateString())}
                      </span>
                      <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                        {a.updated_at ? new Date(a.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </small>
                    </td>
                    <td>
                      <span style={{ fontSize: 12 }}>{a.assigned_to}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: 11, marginLeft: 'auto' }}
                        onClick={() => onSelectApplication(a)}
                      >
                        <Eye size={13} />
                        <span>Inspect & Track</span>
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
          <div className="modal-dialog" style={{ width: 'min(760px, 95%)' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 'var(--radius-md)',
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Plus size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Register AICTE Regulatory Application</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Smart India Hackathon Prototype · Regulatory Workflow Automation
                  </span>
                </div>
              </div>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={() => setIsCreateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: 18 }}>
              {errorMsg && (
                <div className="alert-banner danger">
                  <AlertTriangle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Institution Identity Banner */}
              <div style={{
                background: '#f8fafc',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <small style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Applicant Institution
                  </small>
                  <b style={{ display: 'block', fontSize: 13, color: 'var(--text-main)' }}>
                    {user?.institution_name || 'ABC Engineering College'}
                  </b>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <small style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Regional Jurisdiction
                  </small>
                  <span style={{ display: 'block', fontSize: 12, fontWeight: 600 }}>
                    {user?.region || 'Northern'} Region
                  </span>
                </div>
              </div>

              {/* Application Type Switcher */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Select Application Journey Type *
                </label>
                <div className="form-tab-bar">
                  <button
                    type="button"
                    className={`form-tab-btn ${activeTab === 'EOA' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('EOA');
                      setAttachedDocType('LEASE_DEED');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <BookOpen size={15} />
                      <span>1. Extension of Approval (EOA)</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`form-tab-btn ${activeTab === 'NEW_PROGRAMME' ? 'active' : ''}`}
                    onClick={() => {
                      setActiveTab('NEW_PROGRAMME');
                      setAttachedDocType('DPR_PROPOSAL');
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <GraduationCap size={15} />
                      <span>2. New Programme / Level</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Common Fields */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label>Academic Year *</label>
                  <input
                    type="text"
                    required
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2026-2027"
                  />
                </div>

                <div className="form-group">
                  <label>Target Scrutiny Completion Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Tab 1: Extension of Approval Form */}
              {activeTab === 'EOA' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label>Existing Approved Programmes & Current Intake *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. B.Tech CSE (120), B.Tech ECE (60), B.Tech ME (60)"
                      value={existingIntake}
                      onChange={(e) => setExistingIntake(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Land Lease & Statutory Safety Status *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 35-year lease deed verified; valid fire NOC renewed"
                      value={landCompliance}
                      onChange={(e) => setLandCompliance(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Institutional Disclosures & Declaration *</label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Declaration of compliance with AICTE Approval Process Handbook norms..."
                      value={eoaNotes}
                      onChange={(e) => setEoaNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: New Programme / Level Form */}
              {activeTab === 'NEW_PROGRAMME' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label>Proposed Programme / Course Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. B.Tech in Artificial Intelligence & Data Science"
                        value={programmeName}
                        onChange={(e) => setProgrammeName(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label>Programme Level *</label>
                      <select
                        value={programmeLevel}
                        onChange={(e) => setProgrammeLevel(e.target.value)}
                      >
                        <option value="Undergraduate (UG)">Undergraduate (UG)</option>
                        <option value="Postgraduate (PG)">Postgraduate (PG)</option>
                        <option value="Diploma">Diploma / Polytechnic</option>
                        <option value="Doctoral / Fellow">Doctoral / Fellow</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Proposed Student Intake (Annual Seats) *</label>
                    <input
                      type="number"
                      min={15}
                      max={300}
                      step={15}
                      required
                      value={proposedIntake}
                      onChange={(e) => setProposedIntake(Number(e.target.value))}
                    />
                  </div>

                  <div className="form-group">
                    <label>Laboratory & Infrastructure Readiness Summary *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Summary of specialized lab equipment, computing hardware, space allocation..."
                      value={labReadiness}
                      onChange={(e) => setLabReadiness(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Curricular Justification & Regional Demand *</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Detailed justification on student employment demand and regional industry linkage..."
                      value={newProgrammeNotes}
                      onChange={(e) => setNewProgrammeNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Document Attachment Section */}
              <div style={{
                background: '#f8fafc',
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Upload size={16} color="var(--primary)" />
                  <b style={{ fontSize: 12 }}>Supporting Regulatory Document Upload</b>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(Optional for Draft; Mandatory for Direct Submission)</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label>Document Category</label>
                    <select
                      value={attachedDocType}
                      onChange={(e) => setAttachedDocType(e.target.value)}
                    >
                      {activeTab === 'EOA' ? (
                        <>
                          <option value="LEASE_DEED">Land Lease / Ownership Deed</option>
                          <option value="BUILDING_PLAN">Building Occupancy Certificate / Plan</option>
                          <option value="FACULTY_LIST">Faculty Cadre Declaration</option>
                          <option value="UNDERTAKING">Statutory Undertaking</option>
                        </>
                      ) : (
                        <>
                          <option value="DPR_PROPOSAL">Detailed Project Report (DPR)</option>
                          <option value="LAB_READINESS">Laboratory Equipment & Hardware Inventory</option>
                          <option value="FACULTY_LIST">Faculty Sanction & Recruitment Plan</option>
                          <option value="AFFILIATION_LETTER">University Affiliation Letter</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Select File (PDF, DOCX, TXT - Max 10MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setAttachedFile(file);
                        if (file && !attachedDocName) {
                          setAttachedDocName(file.name);
                        }
                      }}
                    />
                  </div>
                </div>

                {attachedFile && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} />
                    <span>Selected: <b>{attachedFile.name}</b> ({(attachedFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                disabled={isSubmitting}
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                disabled={isSubmitting}
                onClick={() => handleSubmit(true)}
              >
                <FileText size={14} />
                <span>{isSubmitting && submittingAction === 'draft' ? 'Saving Draft...' : 'Save as Draft'}</span>
              </button>

              <button
                type="button"
                className="btn-primary"
                disabled={isSubmitting}
                onClick={() => handleSubmit(false)}
              >
                <CheckCircle2 size={14} />
                <span>{isSubmitting && submittingAction === 'submit' ? 'Submitting Application...' : 'Submit Application for Scrutiny'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
