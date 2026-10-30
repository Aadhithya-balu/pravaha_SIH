import React, { useState, useMemo } from 'react';
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
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  UserCheck,
  MapPin,
  Clock3
} from 'lucide-react';
import { Application, User } from '../types';
import { createApplication, uploadApplicationDocument, fetchInstitutionProfile } from '../api';

interface ApplicationsTabProps {
  applications: Application[];
  user: User | null;
  onSelectApplication: (app: Application) => void;
  onRefresh: () => void;
  initialStageFilter?: string;
  initialStatusFilter?: string;
}

type SortField = 'reference' | 'institution' | 'type' | 'stage' | 'officer' | 'date' | 'ageing' | 'status';

export const ApplicationsTab: React.FC<ApplicationsTabProps> = ({
  applications,
  user,
  onSelectApplication,
  onRefresh,
  initialStageFilter = 'ALL',
  initialStatusFilter = 'ALL'
}) => {
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState(initialStageFilter);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [regionFilter, setRegionFilter] = useState('ALL');
  const [officerFilter, setOfficerFilter] = useState('ALL');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Sorting State
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2 | 3>(1);
  const [activeTab, setActiveTab] = useState<'EOA' | 'NEW_PROGRAMME'>('EOA');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'draft' | 'submit' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form Fields - Mandatory Institutional Information
  const [collegeName, setCollegeName] = useState(user?.institution_name || '');
  const [institutionCode, setInstitutionCode] = useState('1-10023451');
  const [campusAddress, setCampusAddress] = useState('Sector 62, Institutional Area, Noida 201309');
  const [stateName, setStateName] = useState('Uttar Pradesh');
  const [districtName, setDistrictName] = useState('Gautam Buddha Nagar');
  const [institutionType, setInstitutionType] = useState('Engineering & Technology');
  const [contactPerson, setContactPerson] = useState(user?.name || 'Prof. Anand Deshmukh');
  const [contactPhone, setContactPhone] = useState('+91-120-2400100');
  const [contactEmail, setContactEmail] = useState(user?.email || 'principal@abccollege.demo.local');

  // Form Fields - Document Category
  const [attachedDocCategory, setAttachedDocCategory] = useState('LAND_LEASE_DOCUMENTS');

  React.useEffect(() => {
    if (user?.role === 'institution') {
      fetchInstitutionProfile().then((profile) => {
        if (profile) {
          if (profile.name) setCollegeName(profile.name);
          if (profile.code) setInstitutionCode(profile.code);
          if (profile.address) setCampusAddress(profile.address);
          if (profile.state) setStateName(profile.state);
          if (profile.contact_phone) setContactPhone(profile.contact_phone);
          if (profile.contact_email) setContactEmail(profile.contact_email);
          if (profile.institution_type) setInstitutionType(profile.institution_type);
        }
      }).catch(() => {});
    }
  }, [user]);

  // Form Fields - Common
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [dueDate, setDueDate] = useState('');

  // Form Fields - EOA
  const [existingIntake, setExistingIntake] = useState('B.Tech Computer Science: 120 seats, B.Tech Electronics: 60 seats, B.Tech Mechanical: 60 seats');
  const [landCompliance, setLandCompliance] = useState('Registered Land Lease valid through 2055; fire safety clearance attested');
  const [eoaNotes, setEoaNotes] = useState('Annual Extension of Approval request for academic year 2026-2027 with ongoing intake.');

  // Form Fields - New Programme/Level
  const [programmeName, setProgrammeName] = useState('B.Tech in Artificial Intelligence & Machine Learning');
  const [programmeLevel, setProgrammeLevel] = useState('Undergraduate (UG)');
  const [proposedIntake, setProposedIntake] = useState(60);
  const [labReadiness, setLabReadiness] = useState('Computing laboratory equipped with 40 GPU-enabled workstations, optical fiber LAN, and licensed simulation suites.');
  const [newProgrammeNotes, setNewProgrammeNotes] = useState('Proposal for introduction of new high-demand emerging technology programme.');

  // Attached File & Provenance Indicator
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedDocType, setAttachedDocType] = useState('LEASE_DEED');
  const [attachedDocName, setAttachedDocName] = useState('');
  const [prefilledProvenance, setPrefilledProvenance] = useState<string | null>(null);
  const [autofillPreview, setAutofillPreview] = useState<{ source: string; details: string[] } | null>(null);

  const isFormDirty =
    academicYear !== '2026-2027' ||
    dueDate !== '' ||
    attachedFile !== null;

  React.useEffect(() => {
    if (initialStageFilter) setStageFilter(initialStageFilter);
    if (initialStatusFilter) setStatusFilter(initialStatusFilter);
  }, [initialStageFilter, initialStatusFilter]);

  // Extract unique regions and officers dynamically from dataset
  const uniqueRegions = useMemo(() => {
    const regSet = new Set<string>();
    applications.forEach((a) => {
      if (a.region && a.region.trim()) regSet.add(a.region.trim());
    });
    return Array.from(regSet).sort();
  }, [applications]);

  const uniqueOfficers = useMemo(() => {
    const offSet = new Set<string>();
    applications.forEach((a) => {
      if (a.assigned_to && a.assigned_to.trim() && a.assigned_to !== 'Closed' && a.assigned_to !== 'Applicant Institution') {
        offSet.add(a.assigned_to.trim());
      }
    });
    return Array.from(offSet).sort();
  }, [applications]);

  // Helper: Ageing calculation
  function calculateAgeingDays(app: Application): number {
    const baseDate = app.submission_date ? new Date(app.submission_date) : new Date(app.created_at);
    const diffTime = Math.abs(Date.now() - baseDate.getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  // Helper: SLA Status
  function getSlaInfo(app: Application): { isOverdue: boolean; daysRemaining: number | null; label: string } {
    if (app.status === 'COMPLETED' || app.status === 'REJECTED') {
      return { isOverdue: false, daysRemaining: null, label: 'Resolved' };
    }
    const ageing = calculateAgeingDays(app);
    if (!app.due_date) {
      return { isOverdue: ageing > 30, daysRemaining: null, label: `${ageing}d ageing` };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(app.due_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { isOverdue: true, daysRemaining: diffDays, label: `${Math.abs(diffDays)}d overdue` };
    } else if (diffDays === 0) {
      return { isOverdue: false, daysRemaining: 0, label: 'Due today' };
    } else {
      return { isOverdue: false, daysRemaining: diffDays, label: `${diffDays}d remaining` };
    }
  }

  // Multi-dimensional filtering
  const filteredApps = useMemo(() => {
    return applications.filter((a) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        a.reference.toLowerCase().includes(q) ||
        a.institution_name.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.region && a.region.toLowerCase().includes(q)) ||
        (a.assigned_to && a.assigned_to.toLowerCase().includes(q));

      const matchesStage = stageFilter === 'ALL' || a.current_stage === stageFilter;
      const matchesStatus = statusFilter === 'ALL' || a.status === statusFilter;
      const matchesType =
        typeFilter === 'ALL' ||
        a.application_type === typeFilter ||
        (typeFilter === 'Extension of Approval' && a.application_type.includes('Extension of Approval')) ||
        (typeFilter === 'New Programme/Level' && a.application_type.includes('New Programme'));
      const matchesRegion = regionFilter === 'ALL' || a.region === regionFilter;
      const matchesOfficer = officerFilter === 'ALL' || a.assigned_to === officerFilter;

      const sla = getSlaInfo(a);
      const isRecordOverdue = a.status === 'OVERDUE' || sla.isOverdue;
      const matchesOverdue = !overdueOnly || isRecordOverdue;

      return matchesSearch && matchesStage && matchesStatus && matchesType && matchesRegion && matchesOfficer && matchesOverdue;
    });
  }, [applications, search, stageFilter, statusFilter, typeFilter, regionFilter, officerFilter, overdueOnly]);

  // Sorting
  const sortedApps = useMemo(() => {
    const list = [...filteredApps];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'reference':
          valA = a.reference;
          valB = b.reference;
          break;
        case 'institution':
          valA = a.institution_name;
          valB = b.institution_name;
          break;
        case 'type':
          valA = a.application_type;
          valB = b.application_type;
          break;
        case 'stage':
          valA = a.current_stage;
          valB = b.current_stage;
          break;
        case 'officer':
          valA = a.assigned_to || '';
          valB = b.assigned_to || '';
          break;
        case 'date':
          valA = a.submission_date || a.created_at || '';
          valB = b.submission_date || b.created_at || '';
          break;
        case 'ageing':
          valA = calculateAgeingDays(a);
          valB = calculateAgeingDays(b);
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        default:
          valA = a.created_at;
          valB = b.created_at;
      }

      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredApps, sortField, sortAsc]);

  // Pagination calculation
  const totalRecords = sortedApps.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const paginatedApps = sortedApps.slice(startIndex, startIndex + pageSize);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  // Active filter checks
  const hasActiveFilters =
    search !== '' ||
    stageFilter !== 'ALL' ||
    statusFilter !== 'ALL' ||
    typeFilter !== 'ALL' ||
    regionFilter !== 'ALL' ||
    officerFilter !== 'ALL' ||
    overdueOnly;

  function resetAllFilters() {
    setSearch('');
    setStageFilter('ALL');
    setStatusFilter('ALL');
    setTypeFilter('ALL');
    setRegionFilter('ALL');
    setOfficerFilter('ALL');
    setOverdueOnly(false);
    setCurrentPage(1);
  }

  // Creation authorization: strictly institution or admin
  const canCreate = user?.role === 'institution' || user?.role === 'admin';

  function resetForm() {
    setErrorMsg('');
    setFieldErrors({});
    setCreateStep(1);
    setAcademicYear('2026-2027');
    setDueDate('');
    setExistingIntake('B.Tech Computer Science: 120 seats, B.Tech Electronics: 60 seats, B.Tech Mechanical: 60 seats');
    setLandCompliance('Registered Land Lease valid through 2055; fire safety clearance attested');
    setEoaNotes('Annual Extension of Approval request for academic year 2026-2027 with ongoing intake.');
    setProgrammeName('B.Tech in Artificial Intelligence & Machine Learning');
    setProgrammeLevel('Undergraduate (UG)');
    setProposedIntake(60);
    setLabReadiness('Computing laboratory equipped with 40 GPU-enabled workstations, optical fiber LAN, and licensed simulation suites.');
    setNewProgrammeNotes('Proposal for introduction of new high-demand emerging technology programme.');
    setAttachedFile(null);
    setAttachedDocName('');
    setPrefilledProvenance(null);
    setAutofillPreview(null);
  }

  function handleOpenCreate() {
    resetForm();
    setIsCreateOpen(true);
  }

  function handleAttemptClose() {
    if (isFormDirty) {
      if (window.confirm('You have unsaved form data in this application draft. Discard changes and close?')) {
        setIsCreateOpen(false);
      }
    } else {
      setIsCreateOpen(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setErrorMsg('');
    if (!file) {
      setAttachedFile(null);
      return;
    }

    // Size limit validation (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg(`Selected document '${file.name}' (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum statutory 10MB limit.`);
      e.target.value = '';
      return;
    }

    // Extension validation
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt'].includes(ext || '')) {
      setErrorMsg(`Unsupported file type '.${ext}'. Please attach a verified regulatory document in PDF, DOCX, or TXT format.`);
      e.target.value = '';
      return;
    }

    setAttachedFile(file);
    if (!attachedDocName) {
      setAttachedDocName(file.name);
    }
  }

  function handleSamplePrefill(sampleType: 'valid_lease' | 'fire_noc') {
    if (sampleType === 'valid_lease') {
      const leaseStatus = 'Plot 412/1, 7.50 Acres, 33-Year Registered Lease Deed valid until 2053 (Sub-Registrar Noida No. 4589/2020)';
      const notes = 'Annual EoA submission verified against registered 33-year land lease deed and building plans.';
      setLandCompliance(leaseStatus);
      setEoaNotes(notes);
      setAttachedDocType('LEASE_DEED');
      setAttachedDocName('Registered_33Yr_Lease_Deed.pdf');
      setPrefilledProvenance('Auto-prefilled from Verified Land Lease Deed (Khasra 412/1, 7.50 Acres, 33 Years)');
      setAutofillPreview({
        source: 'Registered Land Lease Deed (33-Year Term)',
        details: [
          'Land Compliance: ' + leaseStatus,
          'Attached Document: Registered_33Yr_Lease_Deed.pdf (LEASE_DEED)',
          'Executive Notes updated with land tenure verification'
        ]
      });
    } else {
      const fireStatus = 'Fire & Life Safety NOC No. CFO/GBN/NOC/2025/112, valid until 11 August 2026 for multi-storey blocks.';
      setLandCompliance(fireStatus);
      setAttachedDocType('BUILDING_PLAN');
      setAttachedDocName('Fire_Safety_Clearance_NOC.pdf');
      setPrefilledProvenance('Auto-prefilled from Fire Safety Clearance Certificate (CFO/GBN/NOC/2025/112)');
      setAutofillPreview({
        source: 'Fire & Life Safety Certificate (CFO/GBN/NOC/2025/112)',
        details: [
          'Compliance Status: ' + fireStatus,
          'Attached Document: Fire_Safety_Clearance_NOC.pdf (BUILDING_PLAN)'
        ]
      });
    }
  }

  function validateStep(step: 1 | 2): boolean {
    const errors: Record<string, string> = {};
    if (step === 1) {
      if (!collegeName.trim()) {
        errors.collegeName = 'College / Institution Name is mandatory.';
      }
      if (!academicYear.trim()) {
        errors.academicYear = 'Academic Year is required (e.g. 2026-2027).';
      } else if (!/^\d{4}-\d{4}$/.test(academicYear.trim())) {
        errors.academicYear = 'Format must be YYYY-YYYY (e.g. 2026-2027).';
      }
    } else if (step === 2) {
      if (activeTab === 'EOA') {
        if (!existingIntake.trim()) errors.existingIntake = 'Existing approved programmes & student intake are mandatory.';
        if (!landCompliance.trim()) errors.landCompliance = 'Land & safety compliance status is required.';
        if (!eoaNotes.trim()) errors.eoaNotes = 'Self-disclosure remarks are required.';
      } else {
        if (!programmeName.trim()) errors.programmeName = 'Proposed programme / course name is required.';
        if (!proposedIntake || proposedIntake < 15 || proposedIntake > 300) {
          errors.proposedIntake = 'Proposed intake must be between 15 and 300 seats.';
        }
        if (!labReadiness.trim()) errors.labReadiness = 'Laboratory readiness summary is required.';
        if (!newProgrammeNotes.trim()) errors.newProgrammeNotes = 'Curricular justification is required.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleNextStep() {
    setErrorMsg('');
    if (createStep === 1 && validateStep(1)) {
      setCreateStep(2);
    } else if (createStep === 2 && validateStep(2)) {
      setCreateStep(3);
    }
  }

  function handlePrevStep() {
    setErrorMsg('');
    if (createStep > 1) {
      setCreateStep((createStep - 1) as 1 | 2);
    }
  }

  async function handleSubmit(isDraft: boolean) {
    if (!isDraft) {
      if (!validateStep(1) || !validateStep(2)) {
        setErrorMsg('Please rectify form validation errors before submission.');
        return;
      }
      if (!attachedFile && !attachedDocName) {
        setErrorMsg('Statutory regulatory document attachment is mandatory for direct submission to scrutiny. You may otherwise save as Draft.');
        return;
      }
    }

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

      const newApp = await createApplication({
        institution_name: collegeName.trim(),
        application_type: appType,
        academic_year: academicYear,
        notes: compositeNotes,
        due_date: dueDate || null,
        form_data: {
          college_name: collegeName.trim(),
          institution_code: institutionCode.trim(),
          campus_address: campusAddress.trim(),
          state: stateName.trim(),
          district: districtName.trim(),
          institution_type: institutionType.trim(),
          contact_person: contactPerson.trim(),
          contact_phone: contactPhone.trim(),
          contact_email: contactEmail.trim(),
          existing_intake: existingIntake,
          land_compliance: landCompliance,
          programme_name: programmeName,
          programme_level: programmeLevel,
          proposed_intake: proposedIntake,
          lab_readiness: labReadiness
        },
        is_draft: isDraft
      });

      if (attachedFile && newApp?.id) {
        await uploadApplicationDocument(
          newApp.id,
          attachedFile,
          attachedDocType,
          attachedDocName || attachedFile.name,
          attachedDocCategory
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
      case 'REJECTED':
        return (
          <span className="badge badge-overdue">
            <X size={10} /> Rejected
          </span>
        );
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={12} color="#94A3B8" />;
    }
    return sortAsc ? <ArrowUp size={12} color="var(--color-navy)" /> : <ArrowDown size={12} color="var(--color-navy)" />;
  };

  return (
    <div className="page-container">
      <div className="panel-card" style={{ padding: 0 }}>
        {/* Page Header */}
        <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Applications Register & Case Management</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {user?.role === 'institution'
                ? `Authorized Institution: ${user.institution_name} · Showing ${filteredApps.length} records`
                : `Showing ${filteredApps.length} of ${applications.length} applications across jurisdictions`}
            </span>
          </div>

          {/* Prominent "New Application" button only for authorized users */}
          {canCreate && (
            <button className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={15} />
              <span>New Application</span>
            </button>
          )}
        </div>

        {/* Filter Controls Bar */}
        <div style={{ padding: '14px 20px', background: '#FAFAFA', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="filter-bar" style={{ margin: 0 }}>
            {/* Search Input */}
            <div className="search-wrap" style={{ flex: '2 1 240px' }}>
              <Search size={14} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search reference, institution, officer, or notes..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            {/* Stage Filter */}
            <select
              className="filter-select"
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Stages</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="SCRUTINY">Primary Scrutiny</option>
              <option value="RE_SCRUTINY">Re-Scrutiny</option>
              <option value="EVC_PENDING">EVC Pending</option>
              <option value="EVC_SCHEDULED">EVC Scheduled</option>
              <option value="EVC_COMPLETED">EVC Completed</option>
              <option value="SAC_SHC_REVIEW">SAC / SHC Review</option>
              <option value="COMPLIANCE_PENDING">Compliance Pending</option>
              <option value="COMPLETED">Completed</option>
              <option value="RETURNED_FOR_CLARIFICATION">Returned for Clarification</option>
            </select>

            {/* Status Filter */}
            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RETURNED">Returned</option>
              <option value="OVERDUE">Overdue</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Type Filter */}
            <select
              className="filter-select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Types</option>
              <option value="Extension of Approval">Extension of Approval (EOA)</option>
              <option value="New Programme/Level">New Programme / Level</option>
            </select>

            {/* Region Filter */}
            {uniqueRegions.length > 0 && (
              <select
                className="filter-select"
                value={regionFilter}
                onChange={(e) => {
                  setRegionFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Regions</option>
                {uniqueRegions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg} Region
                  </option>
                ))}
              </select>
            )}

            {/* Assigned Officer Filter */}
            {uniqueOfficers.length > 0 && user?.role !== 'institution' && (
              <select
                className="filter-select"
                value={officerFilter}
                onChange={(e) => {
                  setOfficerFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Officers</option>
                {uniqueOfficers.map((off) => (
                  <option key={off} value={off}>
                    {off}
                  </option>
                ))}
              </select>
            )}

            {/* Overdue/Urgent Quick Toggle */}
            <button
              type="button"
              className="btn-secondary"
              style={{
                fontSize: 11,
                padding: '6px 10px',
                background: overdueOnly ? '#FEF2F2' : '#FFFFFF',
                borderColor: overdueOnly ? '#DC2626' : 'var(--border-medium)',
                color: overdueOnly ? '#DC2626' : 'var(--text-secondary)'
              }}
              onClick={() => {
                setOverdueOnly(!overdueOnly);
                setCurrentPage(1);
              }}
            >
              <AlertTriangle size={12} color={overdueOnly ? '#DC2626' : '#64748B'} />
              <span>Overdue Only</span>
            </button>
          </div>

          {/* Active Filter Chips Bar */}
          {hasActiveFilters && (
            <div className="filter-chips-bar" style={{ marginTop: 10, marginBottom: 0 }}>
              <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Filter size={12} /> Active Filters:
              </span>

              {search && (
                <span className="filter-chip">
                  Search: <b>"{search}"</b>
                  <button className="filter-chip-clear" onClick={() => setSearch('')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {stageFilter !== 'ALL' && (
                <span className="filter-chip">
                  Stage: <b>{stageFilter.replace(/_/g, ' ')}</b>
                  <button className="filter-chip-clear" onClick={() => setStageFilter('ALL')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {statusFilter !== 'ALL' && (
                <span className="filter-chip">
                  Status: <b>{statusFilter}</b>
                  <button className="filter-chip-clear" onClick={() => setStatusFilter('ALL')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {typeFilter !== 'ALL' && (
                <span className="filter-chip">
                  Type: <b>{typeFilter}</b>
                  <button className="filter-chip-clear" onClick={() => setTypeFilter('ALL')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {regionFilter !== 'ALL' && (
                <span className="filter-chip">
                  Region: <b>{regionFilter}</b>
                  <button className="filter-chip-clear" onClick={() => setRegionFilter('ALL')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {officerFilter !== 'ALL' && (
                <span className="filter-chip">
                  Officer: <b>{officerFilter}</b>
                  <button className="filter-chip-clear" onClick={() => setOfficerFilter('ALL')}>
                    <X size={12} />
                  </button>
                </span>
              )}

              {overdueOnly && (
                <span className="filter-chip" style={{ borderColor: '#DC2626', color: '#DC2626' }}>
                  Urgency: <b>Overdue Only</b>
                  <button className="filter-chip-clear" onClick={() => setOverdueOnly(false)}>
                    <X size={12} />
                  </button>
                </span>
              )}

              <button className="filter-reset-btn" onClick={resetAllFilters}>
                Reset All Filters
              </button>
            </div>
          )}
        </div>

        {/* Applications Data Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable-th" onClick={() => handleSort('reference')}>
                  <div className="th-content">
                    <span>Application ID</span>
                    {renderSortIndicator('reference')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('institution')}>
                  <div className="th-content">
                    <span>Institution & Region</span>
                    {renderSortIndicator('institution')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('type')}>
                  <div className="th-content">
                    <span>Type</span>
                    {renderSortIndicator('type')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('stage')}>
                  <div className="th-content">
                    <span>Workflow Stage</span>
                    {renderSortIndicator('stage')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('officer')}>
                  <div className="th-content">
                    <span>Assigned Officer</span>
                    {renderSortIndicator('officer')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('date')}>
                  <div className="th-content">
                    <span>Submission Date</span>
                    {renderSortIndicator('date')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('ageing')}>
                  <div className="th-content">
                    <span>Pending Duration</span>
                    {renderSortIndicator('ageing')}
                  </div>
                </th>
                <th className="sortable-th" onClick={() => handleSort('status')}>
                  <div className="th-content">
                    <span>Status</span>
                    {renderSortIndicator('status')}
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedApps.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '56px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <FileText size={36} color="#94a3b8" />
                      <b style={{ fontSize: 14, color: 'var(--text-primary)' }}>No applications match your criteria</b>
                      <span style={{ fontSize: 12, maxWidth: 460 }}>
                        {hasActiveFilters
                          ? 'Try broadening your search criteria or reset your active filters.'
                          : 'No applications are registered under your jurisdiction yet. Begin by registering an Extension of Approval (EOA) or New Programme proposal.'}
                      </span>
                      {hasActiveFilters ? (
                        <button className="btn-secondary" style={{ marginTop: 8 }} onClick={resetAllFilters}>
                          <RotateCcw size={13} />
                          <span>Reset All Filters</span>
                        </button>
                      ) : (
                        canCreate && (
                          <button className="btn-primary" style={{ marginTop: 8 }} onClick={handleOpenCreate}>
                            <Plus size={14} />
                            <span>Start New Application</span>
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedApps.map((a) => {
                  const sla = getSlaInfo(a);
                  const ageingDays = calculateAgeingDays(a);
                  const isRecordOverdue = a.status === 'OVERDUE' || sla.isOverdue;
                  const isRecordReturned = a.status === 'RETURNED' || a.current_stage === 'RETURNED_FOR_CLARIFICATION';

                  let rowUrgencyClass = 'row-clickable';
                  if (isRecordOverdue) {
                    rowUrgencyClass += ' row-overdue';
                  } else if (isRecordReturned) {
                    rowUrgencyClass += ' row-urgent';
                  }

                  return (
                    <tr
                      key={a.id}
                      className={rowUrgencyClass}
                      onClick={() => onSelectApplication(a)}
                    >
                      {/* Application ID */}
                      <td>
                        <b style={{ fontFamily: 'JetBrains Mono', color: 'var(--color-navy)', fontSize: 12 }}>
                          {a.reference}
                        </b>
                        <small style={{ display: 'block', color: 'var(--text-muted)' }}>AY {a.academic_year}</small>
                      </td>

                      {/* Institution & Region */}
                      <td>
                        <b style={{ color: 'var(--text-primary)', display: 'block' }}>{a.institution_name}</b>
                        <span style={{ fontSize: 10.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <MapPin size={10} /> {a.region || 'Northern'} Region
                        </span>
                      </td>

                      {/* Application Type */}
                      <td>
                        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                          {a.application_type}
                        </span>
                      </td>

                      {/* Stage */}
                      <td>
                        <span className="badge badge-stage">{a.current_stage.replace(/_/g, ' ')}</span>
                      </td>

                      {/* Assigned Officer */}
                      <td>
                        {a.assigned_to && a.assigned_to !== 'Closed' ? (
                          <span style={{ fontSize: 11, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <UserCheck size={11} color="#64748B" /> {a.assigned_to}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {a.status === 'COMPLETED' || a.status === 'REJECTED' ? 'Closed' : 'Unassigned'}
                          </span>
                        )}
                      </td>

                      {/* Submission Date */}
                      <td>
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                          {a.submission_date ? new Date(a.submission_date).toLocaleDateString() : (a.created_at ? new Date(a.created_at).toLocaleDateString() : 'Draft')}
                        </span>
                      </td>

                      {/* Pending Duration / SLA */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: isRecordOverdue ? 700 : 500,
                              color: isRecordOverdue ? '#DC2626' : (sla.daysRemaining !== null && sla.daysRemaining <= 3 ? '#EA580C' : 'var(--text-primary)')
                            }}
                          >
                            {sla.label}
                          </span>
                          <span style={{ fontSize: 9.5, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock3 size={10} /> {ageingDays}d elapsed
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(a.status)}</td>

                      {/* Action */}
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: 11, marginLeft: 'auto' }}
                          onClick={() => onSelectApplication(a)}
                        >
                          <Eye size={13} />
                          <span>Inspect Dossier</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalRecords > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              <span>
                Showing <b>{startIndex + 1}</b> to <b>{Math.min(startIndex + pageSize, totalRecords)}</b> of <b>{totalRecords}</b> applications
              </span>
              <span style={{ color: 'var(--border-medium)' }}>|</span>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                Rows per page:
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-xs)',
                    border: '1px solid var(--border-medium)',
                    fontSize: 11.5
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <div className="pagination-controls">
              <button
                className="page-btn"
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(validCurrentPage - 1)}
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                if (
                  pg === 1 ||
                  pg === totalPages ||
                  (pg >= validCurrentPage - 1 && pg <= validCurrentPage + 1)
                ) {
                  return (
                    <button
                      key={pg}
                      className={`page-btn ${pg === validCurrentPage ? 'active' : ''}`}
                      onClick={() => setCurrentPage(pg)}
                    >
                      {pg}
                    </button>
                  );
                }
                if (pg === validCurrentPage - 2 || pg === validCurrentPage + 2) {
                  return (
                    <span key={pg} style={{ padding: '0 4px', color: 'var(--text-muted)' }}>
                      …
                    </span>
                  );
                }
                return null;
              })}

              <button
                className="page-btn"
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(validCurrentPage + 1)}
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Application Modal */}
      {isCreateOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ width: 'min(780px, 95%)' }}>
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
                  <h3 style={{ margin: 0, fontSize: 16 }}>Start New AICTE Regulatory Application</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Approval Process Handbook (APH 2024-2027) Compliance Pathway · Step {createStep} of 3
                  </span>
                </div>
              </div>
              <button
                style={{ background: 'transparent', border: 0, cursor: 'pointer' }}
                onClick={handleAttemptClose}
                title="Close and discard changes"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ gap: 14 }}>
              {errorMsg && (
                <div className="alert-banner danger">
                  <AlertTriangle size={15} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 3-Step Wizard Stepper */}
              <div className="form-wizard-stepper">
                <div className={`wizard-step ${createStep >= 1 ? 'active' : ''} ${createStep > 1 ? 'completed' : ''}`}>
                  <span className="step-num">1</span>
                  <span className="step-title">Pathway & Year</span>
                </div>
                <div className="wizard-line" />
                <div className={`wizard-step ${createStep >= 2 ? 'active' : ''} ${createStep > 2 ? 'completed' : ''}`}>
                  <span className="step-num">2</span>
                  <span className="step-title">Intake & Compliance</span>
                </div>
                <div className="wizard-line" />
                <div className={`wizard-step ${createStep >= 3 ? 'active' : ''}`}>
                  <span className="step-num">3</span>
                  <span className="step-title">Documents & Submit</span>
                </div>
              </div>

              {/* STEP 1: PATHWAY & ACADEMIC YEAR */}
              {createStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Mandatory College & Institutional Information Card */}
                  <div style={{
                    background: '#F8FAFC',
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid #E2E8F0'
                  }}>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#1E3A8A',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      display: 'block',
                      marginBottom: 10
                    }}>
                      Mandatory College / Institution Information *
                    </span>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group">
                        <label>College / Institution Name *</label>
                        <input
                          type="text"
                          required
                          value={collegeName}
                          onChange={(e) => {
                            setCollegeName(e.target.value);
                            if (fieldErrors.collegeName) setFieldErrors({ ...fieldErrors, collegeName: '' });
                          }}
                          placeholder="Official College / Institution Name"
                          style={{ borderColor: fieldErrors.collegeName ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.collegeName && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.collegeName}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>AICTE Permanent ID / Code</label>
                        <input
                          type="text"
                          value={institutionCode}
                          onChange={(e) => setInstitutionCode(e.target.value)}
                          placeholder="e.g. 1-10023451"
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group">
                        <label>Institution Type</label>
                        <select
                          value={institutionType}
                          onChange={(e) => setInstitutionType(e.target.value)}
                        >
                          <option value="Engineering & Technology">Engineering & Technology</option>
                          <option value="Management">Management</option>
                          <option value="Pharmacy">Pharmacy</option>
                          <option value="MCA / Computer Applications">MCA / Computer Applications</option>
                          <option value="Applied Arts & Crafts">Applied Arts & Crafts</option>
                          <option value="Hotel Management">Hotel Management</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>State</label>
                        <input
                          type="text"
                          value={stateName}
                          onChange={(e) => setStateName(e.target.value)}
                          placeholder="e.g. Uttar Pradesh"
                        />
                      </div>

                      <div className="form-group">
                        <label>District / City</label>
                        <input
                          type="text"
                          value={districtName}
                          onChange={(e) => setDistrictName(e.target.value)}
                          placeholder="e.g. Noida / Gautam Buddha Nagar"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Campus Address</label>
                      <input
                        type="text"
                        value={campusAddress}
                        onChange={(e) => setCampusAddress(e.target.value)}
                        placeholder="Complete registered physical campus address"
                      />
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                      Select Statutory Regulatory Approval Pathway *
                    </span>
                    <div className="tab-nav" style={{ margin: 0 }}>
                      <button
                        type="button"
                        className={`tab-btn ${activeTab === 'EOA' ? 'active' : ''}`}
                        onClick={() => setActiveTab('EOA')}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <GraduationCap size={15} />
                        <span>Extension of Approval (EOA)</span>
                      </button>
                      <button
                        type="button"
                        className={`tab-btn ${activeTab === 'NEW_PROGRAMME' ? 'active' : ''}`}
                        onClick={() => setActiveTab('NEW_PROGRAMME')}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        <Building2 size={15} />
                        <span>New Programme / Level / Course</span>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div className="form-group">
                      <label>Target Academic Year *</label>
                      <input
                        type="text"
                        required
                        value={academicYear}
                        onChange={(e) => {
                          setAcademicYear(e.target.value);
                          if (fieldErrors.academicYear) setFieldErrors({ ...fieldErrors, academicYear: '' });
                        }}
                        placeholder="e.g. 2026-2027"
                        style={{ borderColor: fieldErrors.academicYear ? '#DC2626' : undefined }}
                      />
                      {fieldErrors.academicYear && (
                        <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.academicYear}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Target SLA Due Date (Optional Standard: 30 Days)</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 11.5, color: '#475569' }}>
                    <b>Regulatory Note: </b>
                    {activeTab === 'EOA'
                      ? 'Extension of Approval evaluates ongoing program continuation, faculty cadre ratios, and land tenure validity against APH 2024-2027 norms.'
                      : 'New Programme proposals require curriculum sanction, specialized laboratory equipment, and mandatory Expert Visiting Committee (EVC) verification.'}
                  </div>
                </div>
              )}

              {/* STEP 2: INTAKE & REGULATORY COMPLIANCE */}
              {createStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {activeTab === 'EOA' ? (
                    <>
                      <div className="form-group">
                        <label>Existing Approved Programmes & Student Intake *</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="List existing approved courses, intake count, accreditation..."
                          value={existingIntake}
                          onChange={(e) => {
                            setExistingIntake(e.target.value);
                            if (fieldErrors.existingIntake) setFieldErrors({ ...fieldErrors, existingIntake: '' });
                          }}
                          style={{ borderColor: fieldErrors.existingIntake ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.existingIntake && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.existingIntake}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Land & Safety Statutory Compliance Status *</label>
                        <input
                          type="text"
                          required
                          placeholder="Registered land lease tenure, Fire NOC validity, building stability..."
                          value={landCompliance}
                          onChange={(e) => {
                            setLandCompliance(e.target.value);
                            if (fieldErrors.landCompliance) setFieldErrors({ ...fieldErrors, landCompliance: '' });
                          }}
                          style={{ borderColor: fieldErrors.landCompliance ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.landCompliance && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.landCompliance}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Executive Notes / Self-Disclosure Remarks *</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Institutional declaration for annual extension of approval..."
                          value={eoaNotes}
                          onChange={(e) => {
                            setEoaNotes(e.target.value);
                            if (fieldErrors.eoaNotes) setFieldErrors({ ...fieldErrors, eoaNotes: '' });
                          }}
                          style={{ borderColor: fieldErrors.eoaNotes ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.eoaNotes && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.eoaNotes}</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                        <div className="form-group">
                          <label>Proposed Programme / Course Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. B.Tech in Artificial Intelligence & Data Science"
                            value={programmeName}
                            onChange={(e) => {
                              setProgrammeName(e.target.value);
                              if (fieldErrors.programmeName) setFieldErrors({ ...fieldErrors, programmeName: '' });
                            }}
                            style={{ borderColor: fieldErrors.programmeName ? '#DC2626' : undefined }}
                          />
                          {fieldErrors.programmeName && (
                            <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.programmeName}</span>
                          )}
                        </div>

                        <div className="form-group">
                          <label>Level of Programme *</label>
                          <select
                            value={programmeLevel}
                            onChange={(e) => setProgrammeLevel(e.target.value)}
                          >
                            <option value="Undergraduate (UG)">Undergraduate (UG)</option>
                            <option value="Postgraduate (PG)">Postgraduate (PG)</option>
                            <option value="Diploma">Diploma</option>
                            <option value="Post-Diploma">Post-Diploma</option>
                          </select>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Proposed Intake (Seats) * (Min 15, Max 300)</label>
                        <input
                          type="number"
                          required
                          min={15}
                          max={300}
                          value={proposedIntake}
                          onChange={(e) => {
                            setProposedIntake(Number(e.target.value));
                            if (fieldErrors.proposedIntake) setFieldErrors({ ...fieldErrors, proposedIntake: '' });
                          }}
                          style={{ borderColor: fieldErrors.proposedIntake ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.proposedIntake && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.proposedIntake}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Laboratory & Infrastructure Readiness Summary *</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Summary of specialized lab equipment, computing hardware, space allocation..."
                          value={labReadiness}
                          onChange={(e) => {
                            setLabReadiness(e.target.value);
                            if (fieldErrors.labReadiness) setFieldErrors({ ...fieldErrors, labReadiness: '' });
                          }}
                          style={{ borderColor: fieldErrors.labReadiness ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.labReadiness && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.labReadiness}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Curricular Justification & Regional Demand *</label>
                        <textarea
                          rows={2}
                          required
                          placeholder="Detailed justification on student employment demand and regional industry linkage..."
                          value={newProgrammeNotes}
                          onChange={(e) => {
                            setNewProgrammeNotes(e.target.value);
                            if (fieldErrors.newProgrammeNotes) setFieldErrors({ ...fieldErrors, newProgrammeNotes: '' });
                          }}
                          style={{ borderColor: fieldErrors.newProgrammeNotes ? '#DC2626' : undefined }}
                        />
                        {fieldErrors.newProgrammeNotes && (
                          <span style={{ fontSize: 10.5, color: '#DC2626', marginTop: 2 }}>{fieldErrors.newProgrammeNotes}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* STEP 3: REGULATORY DOCUMENTS & SUBMISSION */}
              {createStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* 1-Click Intelligent Ingestion & Prefill Quick Bar */}
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sparkles size={16} color="#059669" />
                      <div>
                        <b style={{ fontSize: 12, color: '#166534', display: 'block' }}>
                          Intelligent Ingestion & Autofill
                        </b>
                        <span style={{ fontSize: 11, color: '#15803d' }}>
                          Test instant prefill from verified regulatory sample documents
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '5px 10px', background: '#ffffff', borderColor: '#86efac', color: '#166534' }}
                        onClick={() => handleSamplePrefill('valid_lease')}
                      >
                        <span>Prefill from Land Lease (33Y)</span>
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '5px 10px', background: '#ffffff', borderColor: '#86efac', color: '#166534' }}
                        onClick={() => handleSamplePrefill('fire_noc')}
                      >
                        <span>Prefill from Fire NOC</span>
                      </button>
                    </div>
                  </div>

                  {/* Autofill Review Preview Box */}
                  {autofillPreview && (
                    <div style={{
                      padding: '10px 14px',
                      background: '#ECFDF5',
                      border: '1px solid #6EE7B7',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 11.5
                    }}>
                      <b style={{ color: '#065F46', display: 'block', marginBottom: 4 }}>
                        ✓ Values Prefilled from {autofillPreview.source}:
                      </b>
                      <ul style={{ margin: 0, paddingLeft: 18, color: '#047857' }}>
                        {autofillPreview.details.map((d, i) => (
                          <li key={i}>{d}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Document Attachment Section */}
                  <div style={{
                    background: '#f8fafc',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--border-strong)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Upload size={15} color="var(--primary)" />
                      <b style={{ fontSize: 12 }}>Attach Supporting Regulatory Document</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        (Required for direct scrutiny submission; optional for drafts)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div className="form-group">
                        <label>Regulatory Category *</label>
                        <select
                          value={attachedDocCategory}
                          onChange={(e) => setAttachedDocCategory(e.target.value)}
                        >
                          <option value="LAND_LEASE_DOCUMENTS">Land & Lease Documents</option>
                          <option value="APPROVAL_DOCUMENTS">Approval Documents & Previous EoA</option>
                          <option value="INFRASTRUCTURE_RECORDS">Infrastructure & Safety Blueprints</option>
                          <option value="FACULTY_RECORDS">Faculty Cadre Records</option>
                          <option value="UNDERTAKINGS_AFFIDAVITS">Undertakings & Affidavits</option>
                          <option value="INSTITUTIONAL_RECORDS">Institutional Governance Records</option>
                          <option value="FINANCIAL_RECORDS">Financial & Audit Records</option>
                          <option value="OTHER_CONFIGURED">Other Configured Category</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Document Type *</label>
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
                          onChange={handleFileChange}
                          style={{ fontSize: 11.5, padding: '6px' }}
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

                  {/* Summary of what will be submitted */}
                  <div style={{ padding: '10px 14px', background: '#F1F5F9', borderRadius: 'var(--radius-sm)', fontSize: 11.5, color: '#334155' }}>
                    <b>Submission Summary: </b>
                    Application Type: <b>{activeTab === 'EOA' ? 'Extension of Approval' : 'New Programme'}</b> · Academic Year: <b>{academicYear}</b> · Document: <b>{attachedFile ? attachedFile.name : (attachedDocName || 'None Attached')}</b>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions Footer with Stepper Controls */}
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmitting}
                  onClick={handleAttemptClose}
                >
                  Cancel
                </button>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {createStep > 1 && (
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isSubmitting}
                    onClick={handlePrevStep}
                  >
                    Back
                  </button>
                )}

                {/* Save Draft Available at Any Step */}
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ borderColor: 'var(--primary)', color: 'var(--primary)' }}
                  disabled={isSubmitting}
                  onClick={() => handleSubmit(true)}
                  title="Save current progress as Draft"
                >
                  <FileText size={14} />
                  <span>{isSubmitting && submittingAction === 'draft' ? 'Saving Draft...' : 'Save as Draft'}</span>
                </button>

                {createStep < 3 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSubmitting}
                    onClick={handleNextStep}
                  >
                    <span>Next Step</span>
                    <ArrowRight size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit(false)}
                  >
                    <CheckCircle2 size={14} />
                    <span>{isSubmitting && submittingAction === 'submit' ? 'Submitting Application...' : 'Submit Application for Scrutiny'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

