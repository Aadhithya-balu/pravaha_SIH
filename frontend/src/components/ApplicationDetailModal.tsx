import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileText,
  Building2,
  ShieldCheck,
  Send,
  Upload,
  Calendar,
  Sparkles,
  Check,
  Lock,
  RefreshCw,
  Layers,
  Database,
  CheckSquare,
  MessageSquare,
  Square,
  Download,
  AlertCircle,
  FileCheck,
  Gavel,
  ClipboardList,
  UserCheck,
  MapPin,
  ExternalLink,
  ChevronRight,
  Info
} from 'lucide-react';
import {
  Application,
  AuditEvent,
  DocumentRecord,
  EVCVisit,
  AvailableTransition,
  User,
  CorrectionRequest,
  CandidateField,
  NextBestAction,
  ScrutinyFinding,
  ScrutinyRun,
  ComplianceItem,
  StageRemark
} from '../types';
import {
  fetchApplicationDetail,
  uploadApplicationDocument,
  submitApplication,
  resubmitApplication,
  fetchExtractedFields,
  applyExtractedFields,
  verifyAuditChain,
  runOfficerScrutiny,
  setFindingDisposition,
  recordOfficerDecision,
  updateEvcVisitRecord,
  fetchCompliance,
  submitComplianceEvidence,
  verifyComplianceEvidence,
  patchApplication,
  fetchStageRemarks,
  addStageRemark,
  fetchApprovedDocuments,
  retryDocumentProcessing,
  token,
  api
} from '../api';

interface ApplicationDetailModalProps {
  application: Application;
  user: User | null;
  onClose: () => void;
  onRefresh: () => void;
}

type WorkspaceTab =
  | 'overview'
  | 'documents'
  | 'scrutiny'
  | 'corrections'
  | 'evc'
  | 'compliance'
  | 'fields'
  | 'audit'
  | 'remarks';

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
  const [scrutinyRuns, setScrutinyRuns] = useState<ScrutinyRun[]>([]);
  const [scrutinyFindings, setScrutinyFindings] = useState<ScrutinyFinding[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);


  // Stage Remarks & Decision Trail
  const [stageRemarks, setStageRemarks] = useState<StageRemark[]>([]);
  const [newRemarkText, setNewRemarkText] = useState('');
  const [newRemarkActionType, setNewRemarkActionType] = useState('OBSERVATION');
  const [newRemarkVisibility, setNewRemarkVisibility] = useState<'APPLICANT_VISIBLE' | 'INTERNAL_OFFICER_ONLY'>('APPLICANT_VISIBLE');
  const [replyingToRemarkId, setReplyingToRemarkId] = useState<number | null>(null);
  const [isPostingRemark, setIsPostingRemark] = useState(false);

  // Approved Documents & Document Category
  const [approvedDocuments, setApprovedDocuments] = useState<any[]>([]);
  const [uploadDocCategory, setUploadDocCategory] = useState('Institutional Records');

  // Tab navigation
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  // Candidate fields extraction & provenance
  const [extractedFields, setExtractedFields] = useState<CandidateField[]>([]);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<Record<string, boolean>>({});
  const [isApplyingFields, setIsApplyingFields] = useState(false);

  // Audit chain verification
  const [auditVerification, setAuditVerification] = useState<{
    chain_intact?: boolean;
    verified?: boolean;
    total_events?: number;
    checked_count?: number;
    message?: string;
    reason?: string;
  } | null>(null);
  const [isVerifyingAudit, setIsVerifyingAudit] = useState(false);

  // Form edit & dirty tracking
  const [notesDraft, setNotesDraft] = useState(application.notes || '');
  const [academicYearDraft, setAcademicYearDraft] = useState(application.academic_year || '2026-2027');
  const [dueDateDraft, setDueDateDraft] = useState(application.due_date || '');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const isDirty =
    notesDraft !== (details.notes || '') ||
    academicYearDraft !== (details.academic_year || '') ||
    dueDateDraft !== (details.due_date || '');

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

  // Finding Waiver Dialog State
  const [isWaiveOpen, setIsWaiveOpen] = useState(false);
  const [selectedFindingForWaive, setSelectedFindingForWaive] = useState<ScrutinyFinding | null>(null);
  const [waiveJustification, setWaiveJustification] = useState('');

  // Final Statutory Decision Dialog State
  const [isDecisionOpen, setIsDecisionOpen] = useState(false);
  const [decisionOutcome, setDecisionOutcome] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [decisionRemarks, setDecisionRemarks] = useState('');
  const [decisionOrderRef, setDecisionOrderRef] = useState('');

  // Document upload state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState('LEASE_DEED');
  const [uploadDocName, setUploadDocName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // EVC Inspection Report Update Dialog
  const [isEvcModalOpen, setIsEvcModalOpen] = useState(false);
  const [evcReportSummary, setEvcReportSummary] = useState('');
  const [evcRecommendations, setEvcRecommendations] = useState('');
  const [evcVisitStatus, setEvcVisitStatus] = useState('COMPLETED');

  // Compliance Evidence Submit Dialog
  const [isComplianceModalOpen, setIsComplianceModalOpen] = useState(false);
  const [selectedComplianceItem, setSelectedComplianceItem] = useState<ComplianceItem | null>(null);
  const [complianceEvidenceInput, setComplianceEvidenceInput] = useState('');

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
      setScrutinyRuns(data.scrutiny_runs || []);
      setScrutinyFindings(data.scrutiny_findings || []);

      setNotesDraft(data.application.notes || '');
      setAcademicYearDraft(data.application.academic_year || '2026-2027');
      setDueDateDraft(data.application.due_date || '');

      if (data.evc_visit) {
        setEvcReportSummary(data.evc_visit.report_summary || '');
        setEvcRecommendations(data.evc_visit.recommendations || '');
        setEvcVisitStatus(data.evc_visit.status || 'COMPLETED');
      }

      // Fetch compliance requirements
      try {
        const compList = await fetchCompliance();
        const filteredComp = compList.filter(
          (c: ComplianceItem) =>
            c.application_id === application.id || c.institution_name === data.application.institution_name
        );
        setComplianceItems(filteredComp);
      } catch (cErr) {
        // Soft fail
      }

      // Fetch persistent multi-party stage remarks
      try {
        const rData = await fetchStageRemarks(application.id);
        setStageRemarks(rData || []);
      } catch (rErr) {
        // Soft fail
      }

      // Fetch approved documents
      try {
        const aData = await fetchApprovedDocuments(application.id);
        setApprovedDocuments(aData || []);
      } catch (aErr) {
        // Soft fail
      }

      // Fetch extracted candidate fields
      try {
        const fields = await fetchExtractedFields(application.id);
        setExtractedFields(fields || []);
        const initialSel: Record<string, boolean> = {};
        (fields || []).forEach((f) => {
          initialSel[f.field_key] = true;
        });
        setSelectedFieldKeys(initialSel);
      } catch (fErr) {
        // Soft fail
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch application details.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetails();
  }, [application.id]);

  function handleAttemptClose() {
    if (isDirty) {
      if (window.confirm('You have unsaved changes in your application metadata. Discard changes and close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  }

  // Handle generic workflow transition
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

  // Handle Saving Dossier Metadata
  async function handleSaveMetadata() {
    setIsSavingMetadata(true);
    setErrorMsg('');
    try {
      await patchApplication(details.id, {
        notes: notesDraft,
        academic_year: academicYearDraft,
        due_date: dueDateDraft || null
      });
      setSuccessMsg('Application metadata and self-disclosure declarations saved.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save metadata.');
    } finally {
      setIsSavingMetadata(false);
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
    try {
      await uploadApplicationDocument(
        details.id,
        uploadFile,
        uploadDocType,
        uploadDocName || uploadFile.name,
        uploadDocCategory
      );
      setSuccessMsg(`Document '${uploadFile.name}' attached and scrutinized.`);
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

  // Handle Document Download
  async function handleDownloadDoc(docId: number, docName: string) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const authTok = token();
      const res = await fetch(`${baseUrl}/documents/${docId}/download`, {
        headers: authTok ? { Authorization: `Bearer ${authTok}` } : {}
      });
      if (!res.ok) {
        throw new Error(`Failed to download document: ${res.statusText}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMsg(err.message || 'Download failed.');
    }
  }

  // Officer Action: Run Automated Scrutiny Pipeline
  async function handleRunScrutiny() {
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      const runType = details.current_stage === 'RE_SCRUTINY' ? 'RE_SCRUTINY' : 'INITIAL';
      const res = await runOfficerScrutiny(details.id, runType);
      setSuccessMsg(`Scrutiny completed successfully. Evaluated against APH rules. ${res.deficiency_count} deficiency/deficiencies identified.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Scrutiny pipeline execution failed.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Remarks & Comments: Post stage remark / reply
  async function handlePostRemark(e: React.FormEvent) {
    e.preventDefault();
    if (!newRemarkText.trim()) return;
    setIsPostingRemark(true);
    setErrorMsg('');
    try {
      await addStageRemark(details.id, {
        stage: details.current_stage,
        comment_text: newRemarkText.trim(),
        action_type: newRemarkActionType,
        visibility: newRemarkVisibility,
        parent_remark_id: replyingToRemarkId
      });
      setNewRemarkText('');
      setReplyingToRemarkId(null);
      setSuccessMsg('Remark successfully recorded in application audit trail.');
      const rData = await fetchStageRemarks(details.id);
      setStageRemarks(rData || []);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to post remark.');
    } finally {
      setIsPostingRemark(false);
    }
  }

  // Document Processing: Retry OCR / PDF text extraction
  async function handleRetryProcessing(docId: number) {
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      const res = await retryDocumentProcessing(docId);
      setSuccessMsg(`Document re-processing complete (${res.character_count || 0} characters extracted via ${res.extractor_used || 'OCR engine'}).`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reprocess document.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Officer Action: Set Finding Disposition
  async function handleFindingDisposition(findingId: number, disp: 'ACCEPTED' | 'WAIVED' | 'CORRECTION_REQUESTED', notes?: string) {
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await setFindingDisposition(findingId, disp, notes);
      setSuccessMsg(`Finding disposition recorded as '${disp}'.`);
      setIsWaiveOpen(false);
      setSelectedFindingForWaive(null);
      setWaiveJustification('');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update finding disposition.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Officer Action: Record Final Statutory Decision
  async function handleRecordFinalDecision() {
    if (decisionOutcome === 'REJECTED' && (!decisionRemarks || decisionRemarks.trim().length < 5)) {
      setErrorMsg('Mandatory speaking order remarks (minimum 5 characters) are required for rejection.');
      return;
    }
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await recordOfficerDecision(
        details.id,
        decisionOutcome,
        decisionRemarks.trim() || `Statutory order issued by ${user?.name}.`,
        decisionOrderRef.trim() || undefined
      );
      setIsDecisionOpen(false);
      setSuccessMsg(`Statutory final order recorded: ${decisionOutcome}. Application case closed.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record decision.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // EVC Inspection Update
  async function handleUpdateEvcVisit() {
    if (!evcVisit) return;
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await updateEvcVisitRecord(evcVisit.id, {
        status: evcVisitStatus,
        report_summary: evcReportSummary,
        recommendations: evcRecommendations
      });
      setIsEvcModalOpen(false);
      setSuccessMsg('EVC inspection visit report and recommendations recorded.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update EVC inspection.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Compliance Evidence Submit
  async function handleSubmitComplianceEvidence() {
    if (!selectedComplianceItem || !complianceEvidenceInput.trim()) {
      setErrorMsg('Evidence documentation or reference is required.');
      return;
    }
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await submitComplianceEvidence(selectedComplianceItem.id, complianceEvidenceInput.trim());
      setIsComplianceModalOpen(false);
      setSelectedComplianceItem(null);
      setComplianceEvidenceInput('');
      setSuccessMsg('Compliance evidence submitted successfully for verification.');
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit evidence.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Compliance Evidence Verification (Officer)
  async function handleVerifyCompliance(complianceId: number, action: 'VERIFY' | 'REJECT') {
    setIsActionLoading(true);
    setErrorMsg('');
    try {
      await verifyComplianceEvidence(complianceId, action, `Verified by ${user?.name}`);
      setSuccessMsg(`Compliance item marked as ${action === 'VERIFY' ? 'VERIFIED' : 'REJECTED'}.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to verify compliance item.');
    } finally {
      setIsActionLoading(false);
    }
  }

  // Handle apply extracted fields into application form
  async function handleApplyExtractedFields() {
    const fieldsToApply: Record<string, string> = {};
    extractedFields.forEach((f) => {
      if (selectedFieldKeys[f.field_key]) {
        fieldsToApply[f.field_key] = f.extracted_value;
      }
    });

    if (Object.keys(fieldsToApply).length === 0) {
      setErrorMsg('Please select at least one candidate field to apply.');
      return;
    }

    setIsApplyingFields(true);
    setErrorMsg('');
    try {
      const res = await applyExtractedFields(details.id, fieldsToApply);
      setSuccessMsg(`Successfully applied ${res.applied_count || Object.keys(fieldsToApply).length} confirmed fields into the application form.`);
      await loadDetails();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply extracted fields.');
    } finally {
      setIsApplyingFields(false);
    }
  }

  // Handle verify audit hash chain
  async function handleVerifyAuditChain() {
    setIsVerifyingAudit(true);
    setErrorMsg('');
    try {
      const res = await verifyAuditChain(details.id);
      setAuditVerification(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Audit chain verification failed.');
    } finally {
      setIsVerifyingAudit(false);
    }
  }

  // Next Best Action execution authorization
  function canExecuteNextAction(nba: NextBestAction | undefined, curUser: User | null): boolean {
    if (!nba || !curUser) return false;
    if (curUser.role === 'admin') return true;
    if (curUser.role === nba.authorized_role) return true;
    if (nba.authorized_role === 'officer' && (curUser.role === 'officer' || curUser.role === 'bureau')) return true;
    return false;
  }

  async function handleAddRemark() {
    if (!newRemarkText.trim()) return;
    setIsPostingRemark(true);
    try {
      await addStageRemark(application.id, {
        stage: details.current_stage,
        remark_text: newRemarkText.trim(),
        visibility: newRemarkVisibility
      });
      setNewRemarkText('');
      await loadDetails();
      setSuccessMsg('Official remark recorded successfully.');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to submit remark.');
    } finally {
      setIsPostingRemark(false);
    }
  }

  function handleExecuteNextAction(nba: NextBestAction) {
    if (nba.action_code === 'SUBMIT_DRAFT') {
      handleSubmitDraft();
    } else if (nba.action_code === 'RETURN_FOR_CLARIFICATION' || nba.action_code === 'RETURN_DEFICIENCY') {
      setIsReturnOpen(true);
    } else if (nba.action_code === 'RESUBMIT_CLARIFICATION') {
      setIsResubmitOpen(true);
    } else if (nba.action_code === 'RUN_SCRUTINY') {
      handleRunScrutiny();
    } else if (nba.action_code === 'REFER_EVC') {
      handleTransition('SEND_EVC', 'Refer to Expert Visiting Committee (EVC) Inspection');
    } else if (nba.action_code === 'SCHEDULE_EVC' || nba.action_code === 'CONFIRM_EVC_SCHEDULE') {
      setActiveTab('evc');
    } else if (nba.action_code === 'SUBMIT_EVC_REPORT') {
      setActiveTab('evc');
      setIsEvcModalOpen(true);
    } else if (nba.action_code === 'VERIFY_COMPLIANCE_EVIDENCE') {
      setActiveTab('compliance');
    } else {
      const matchingTrans = transitions.find((t) => t.action === nba.action_code);
      if (matchingTrans) {
        handleTransition(matchingTrans.action, `Advanced via Next Best Action: ${nba.action_label}`);
      } else {
        handleTransition(nba.action_code, `Advanced via Next Best Action: ${nba.action_label}`);
      }
    }
  }

  const isReturned = details.current_stage === 'RETURNED_FOR_CLARIFICATION' || details.status === 'RETURNED';
  const isDraft = details.current_stage === 'DRAFT' || details.status === 'DRAFT';
  const isCompleted = details.current_stage === 'COMPLETED' || details.status === 'COMPLETED' || details.status === 'REJECTED';
  const isInstitution = user?.role === 'institution';
  const isOfficerOrAdmin = user?.role === 'officer' || user?.role === 'admin' || user?.role === 'bureau';
  const isEvcExpert = user?.role === 'evc_expert';

  const currentStageIndex = stageList.indexOf(details.current_stage);

  return (
    <div className="modal-backdrop">
      <div
        className="modal-dialog application-dossier-modal"
        style={{
          width: 'min(1200px, 96vw)',
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}
      >
        {/* National Tricolor Top Stripe */}
        <div className="tricolor-ribbon" style={{ height: 4 }} />

        {/* Top Header: Case Identity & Statutory Context */}
        <div
          className="modal-header"
          style={{
            padding: '12px 18px',
            background: 'var(--color-navy)',
            color: '#FFFFFF',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0,
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}
            >
              <ShieldCheck size={20} />
            </div>

            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#93C5FD',
                    letterSpacing: '0.02em',
                    flexShrink: 0
                  }}
                >
                  {details.reference}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>·</span>
                <b style={{ fontSize: 14, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '340px' }} title={details.institution_name}>
                  {details.institution_name}
                </b>
                <span
                  className="badge badge-stage"
                  style={{
                    fontSize: 10,
                    background: 'rgba(255,255,255,0.15)',
                    color: '#FFFFFF',
                    borderColor: 'rgba(255,255,255,0.25)'
                  }}
                >
                  {details.current_stage.replace(/_/g, ' ')}
                </span>
              </div>

              <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span>{details.application_type}</span>
                <span>•</span>
                <span>Region: <b>{details.region}</b></span>
                <span>•</span>
                <span>AY: <b>{details.academic_year}</b></span>
                <span>•</span>
                <span>Status: <b>{details.status}</b></span>
                {details.deficiency_count > 0 && (
                  <>
                    <span>•</span>
                    <span style={{ color: '#FCA5A5', fontWeight: 700 }}>
                      ⚠️ {details.deficiency_count} Deficiencies Flagged
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                padding: '5px 12px',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.15s ease'
              }}
              onClick={handleAttemptClose}
              title="Return to Regulatory Operations Dashboard"
            >
              <ArrowLeft size={14} />
              <span>Back to Dashboard</span>
            </button>
            <button
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 0,
                color: '#FFFFFF',
                borderRadius: 'var(--radius-sm)',
                padding: '6px',
                cursor: 'pointer'
              }}
              onClick={handleAttemptClose}
              title="Close Case Workspace"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* NEXT BEST ACTION BANNER */}
        {details.next_action && !isCompleted && (
          <div
            style={{
              background: '#F0FDF4',
              borderBottom: '1px solid #BBF7D0',
              borderLeft: '5px solid #16A34A',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              boxSizing: 'border-box',
              width: '100%',
              minWidth: 0
            }}
          >
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background:
                      details.next_action.sla_urgency === 'P0_CRITICAL'
                        ? '#FEF2F2'
                        : details.next_action.sla_urgency === 'P1_HIGH'
                        ? '#FFF7ED'
                        : '#DCFCE7',
                    color:
                      details.next_action.sla_urgency === 'P0_CRITICAL'
                        ? '#DC2626'
                        : details.next_action.sla_urgency === 'P1_HIGH'
                        ? '#EA580C'
                        : '#166534',
                    padding: '2px 7px',
                    borderRadius: 999,
                    border: '1px solid currentColor'
                  }}
                >
                  Next Best Action · {details.next_action.sla_urgency}
                </span>
                <span style={{ fontSize: 11, color: '#4B5563' }}>
                  Target Role: <b style={{ textTransform: 'capitalize' }}>{details.next_action.authorized_role}</b>
                </span>
              </div>
              <b style={{ fontSize: 13, color: '#166534', display: 'block' }}>
                {details.next_action.action_label}
              </b>
              <span style={{ fontSize: 11, color: '#374151', lineHeight: 1.35 }}>
                {details.next_action.rationale}
              </span>
            </div>

            {canExecuteNextAction(details.next_action, user) && (
              <button
                className="btn-primary"
                style={{
                  background: '#16A34A',
                  borderColor: '#16A34A',
                  fontSize: 11.5,
                  padding: '7px 14px',
                  whiteSpace: 'nowrap'
                }}
                disabled={isActionLoading}
                onClick={() => handleExecuteNextAction(details.next_action!)}
              >
                <ArrowRight size={13} />
                <span>Execute: {details.next_action.action_label}</span>
              </button>
            )}
          </div>
        )}

        {/* Notifications & Action Feedback */}
        {errorMsg && (
          <div className="alert-banner danger" style={{ margin: '8px 20px 0' }}>
            <AlertTriangle size={15} />
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
          <div className="alert-banner info" style={{ margin: '8px 20px 0' }}>
            <CheckCircle2 size={15} />
            <span>{successMsg}</span>
            <button
              style={{ background: 'transparent', border: 0, cursor: 'pointer', marginLeft: 'auto', fontWeight: 800 }}
              onClick={() => setSuccessMsg('')}
            >
              ×
            </button>
          </div>
        )}

        {/* Main Workspace 2-Column Split */}
        <div
          className="modal-workspace-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) 280px',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            minWidth: 0,
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          {/* Left Column: Navigation Tabs & Tab Content Panels */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              borderRight: '1px solid var(--border-subtle)',
              minHeight: 0,
              minWidth: 0,
              width: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box'
            }}
          >
            {/* Tab Navigation Bar */}
            <div
              className="modal-tabs-bar"
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-subtle)',
                background: '#F8FAFC',
                padding: '0 16px',
                gap: 4,
                overflowX: 'auto',
                whiteSpace: 'nowrap',
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
                scrollbarWidth: 'thin'
              }}
            >
              <button
                onClick={() => setActiveTab('overview')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'overview' ? 'var(--color-action-blue)' : '#64748B',
                  borderBottom: activeTab === 'overview' ? '2px solid var(--color-action-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Layers size={13} />
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'documents' ? 'var(--color-action-blue)' : '#64748B',
                  borderBottom: activeTab === 'documents' ? '2px solid var(--color-action-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FileText size={13} />
                <span>Documents ({documents.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('scrutiny')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'scrutiny' ? '#7C3AED' : '#64748B',
                  borderBottom: activeTab === 'scrutiny' ? '2px solid #7C3AED' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Sparkles size={13} color="#7C3AED" />
                <span>AI Scrutiny ({scrutinyFindings.length})</span>
                {details.deficiency_count > 0 && (
                  <span style={{ fontSize: 9.5, background: '#FEE2E2', color: '#DC2626', padding: '1px 5px', borderRadius: 999, fontWeight: 700 }}>
                    {details.deficiency_count} Def
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('corrections')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'corrections' ? '#EA580C' : '#64748B',
                  borderBottom: activeTab === 'corrections' ? '2px solid #EA580C' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RotateCcw size={13} />
                <span>Clarifications ({correctionRequests.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('evc')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'evc' ? 'var(--color-action-blue)' : '#64748B',
                  borderBottom: activeTab === 'evc' ? '2px solid var(--color-action-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Building2 size={13} />
                <span>EVC Inspection</span>
              </button>

              <button
                onClick={() => setActiveTab('compliance')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'compliance' ? '#0D9488' : '#64748B',
                  borderBottom: activeTab === 'compliance' ? '2px solid #0D9488' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ClipboardList size={13} />
                <span>Compliance ({complianceItems.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('fields')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'fields' ? '#7C3AED' : '#64748B',
                  borderBottom: activeTab === 'fields' ? '2px solid #7C3AED' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Database size={13} />
                <span>Provenance ({extractedFields.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'audit' ? 'var(--color-action-blue)' : '#64748B',
                  borderBottom: activeTab === 'audit' ? '2px solid var(--color-action-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <ShieldCheck size={13} />
                <span>Audit Chain ({auditEvents.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('remarks')}
                style={{
                  padding: '10px 12px',
                  border: 0,
                  background: 'transparent',
                  fontSize: 12,
                  fontWeight: 600,
                  color: activeTab === 'remarks' ? 'var(--color-action-blue)' : '#64748B',
                  borderBottom: activeTab === 'remarks' ? '2px solid var(--color-action-blue)' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <MessageSquare size={13} />
                <span>Remarks & History ({stageRemarks.length})</span>
              </button>
            </div>

            {/* Tab Body Container */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '16px 20px',
                minWidth: 0,
                boxSizing: 'border-box'
              }}
            >
              {/* TAB 1: OVERVIEW & INSTITUTION DETAILS */}
              {activeTab === 'overview' && (() => {
                let parsedForm: Record<string, any> = {};
                try {
                  if (details.form_data) parsedForm = JSON.parse(details.form_data);
                } catch (e) {}

                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Mandatory Institutional & Campus Particulars Card */}
                  <div
                    style={{
                      background: '#F0F9FF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid #BAE6FD',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Building2 size={16} color="#0369A1" />
                        <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#0369A1' }}>
                          Registered College & Campus Information
                        </h4>
                      </div>
                      <span style={{ fontSize: 11, background: '#E0F2FE', color: '#0369A1', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                        Permanent ID: {parsedForm.institution_code || `AICTE-${details.id.toString().padStart(6, '0')}`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 12 }}>
                      <div>
                        <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          College / Institution Name
                        </span>
                        <b style={{ color: '#0C4A6E', fontSize: 13 }}>{parsedForm.college_name || details.institution_name}</b>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Institution Category / Type
                        </span>
                        <span style={{ color: '#0C4A6E' }}>{parsedForm.institution_type || 'Engineering & Technology'}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Campus Address
                        </span>
                        <span style={{ color: '#0C4A6E' }}>{parsedForm.campus_address || `${details.region} Region Institutional Campus`}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          District & State
                        </span>
                        <span style={{ color: '#0C4A6E' }}>{parsedForm.district ? `${parsedForm.district}, ` : ''}{parsedForm.state || details.region}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: '#0369A1', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Authorized Contact
                        </span>
                        <span style={{ color: '#0C4A6E' }}>{parsedForm.contact_person || 'Registrar / Principal'} ({parsedForm.contact_email || 'registrar@institute.edu.in'})</span>
                      </div>
                    </div>
                  </div>

                  {/* Institutional & Application Particulars */}
                  <div
                    style={{
                      background: '#FFFFFF',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Institutional Dossier Particulars
                      </h4>
                      {isDirty && (
                        <span style={{ fontSize: 11, color: '#EA580C', fontWeight: 600 }}>
                          ● Unsaved changes
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, fontSize: 12 }}>
                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Institution Name
                        </span>
                        <b style={{ color: 'var(--text-primary)' }}>{details.institution_name}</b>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Jurisdictional Region
                        </span>
                        <span>{details.region} Region</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Application Type / Route
                        </span>
                        <span>{details.application_type}</span>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Academic Year
                        </span>
                        {isDraft || isReturned ? (
                          <input
                            type="text"
                            value={academicYearDraft}
                            onChange={(e) => setAcademicYearDraft(e.target.value)}
                            style={{ fontSize: 12, padding: '3px 8px', marginTop: 2, width: '90%' }}
                          />
                        ) : (
                          <b>AY {details.academic_year}</b>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Target SLA Due Date
                        </span>
                        {isDraft || isReturned ? (
                          <input
                            type="date"
                            value={dueDateDraft}
                            onChange={(e) => setDueDateDraft(e.target.value)}
                            style={{ fontSize: 12, padding: '3px 8px', marginTop: 2, width: '90%' }}
                          />
                        ) : (
                          <span>{details.due_date || 'Standard 30-Day SLA'}</span>
                        )}
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Submission Timestamp
                        </span>
                        <span>{details.submission_date ? new Date(details.submission_date).toLocaleDateString() : 'Draft Mode'}</span>
                      </div>
                    </div>

                    {/* Self-Disclosure & Form Notes */}
                    <div style={{ marginTop: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                          Self-Disclosure Declaration / Programme Notes
                        </span>
                        {(isDraft || isReturned) && (
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            disabled={isSavingMetadata || !isDirty}
                            onClick={handleSaveMetadata}
                          >
                            <span>{isSavingMetadata ? 'Saving...' : 'Save Dossier Updates'}</span>
                          </button>
                        )}
                      </div>

                      {isDraft || isReturned ? (
                        <textarea
                          rows={4}
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          style={{ width: '100%', fontSize: 12, lineHeight: 1.4, padding: '8px' }}
                          placeholder="Institution declaration, approved intake, and land tenure summary..."
                        />
                      ) : (
                        <div
                          style={{
                            background: '#F8FAFC',
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: 12,
                            lineHeight: 1.45,
                            whiteSpace: 'pre-line',
                            color: '#334155'
                          }}
                        >
                          {details.notes || 'No institutional remarks recorded.'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Final Statutory Decision Order (if completed) */}
                  {details.decision_outcome && (
                    <div
                      style={{
                        padding: '14px 18px',
                        background: details.decision_outcome === 'APPROVED' ? '#F0FDF4' : '#FEF2F2',
                        border: `1px solid ${details.decision_outcome === 'APPROVED' ? '#86EFAC' : '#FCA5A5'}`,
                        borderLeft: `5px solid ${details.decision_outcome === 'APPROVED' ? '#16A34A' : '#DC2626'}`,
                        borderRadius: 'var(--radius-md)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Gavel size={16} color={details.decision_outcome === 'APPROVED' ? '#16A34A' : '#DC2626'} />
                        <b style={{ fontSize: 13, color: details.decision_outcome === 'APPROVED' ? '#166534' : '#991B1B' }}>
                          Official AICTE Statutory Order: {details.decision_outcome}
                        </b>
                      </div>
                      <p style={{ margin: '4px 0', fontSize: 12, color: '#334155' }}>
                        <b>Decision Remarks:</b> {details.decision_remarks || 'Statutory order issued.'}
                      </p>
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                        Issued by: <b>{details.decision_by || 'Competent Authority'}</b> on{' '}
                        {details.decision_date ? new Date(details.decision_date).toLocaleString() : 'N/A'}
                      </div>
                    </div>
                  )}
                </div>
                );
              })()}

              {/* TAB 2: REGULATORY DOCUMENTS */}
              {activeTab === 'documents' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Attached Statutory Documents ({documents.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        All uploaded deeds, fire NOCs, and faculty lists are preserved with provenance and sha verification.
                      </span>
                    </div>

                    {isInstitution && !isCompleted && (
                      <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 10px' }} onClick={() => setIsUploadOpen(true)}>
                        <Upload size={12} />
                        <span>Upload Document</span>
                      </button>
                    )}
                  </div>

                  {documents.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <FileText size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No regulatory documents uploaded yet</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Upload the 30-year land lease deed or fire NOC to initiate AI-assisted scrutiny.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {documents.map((doc) => (
                        <div
                          key={doc.id}
                          style={{
                            padding: '12px 14px',
                            background: doc.review_status === 'CORRECTION_REQUIRED' ? '#FFF7ED' : '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${doc.review_status === 'CORRECTION_REQUIRED' ? '#FDBA74' : 'var(--border-subtle)'}`,
                            borderLeft: doc.review_status === 'CORRECTION_REQUIRED' ? '4px solid #EA580C' : '4px solid #3B82F6'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <b style={{ fontSize: 13, color: 'var(--text-primary)' }}>{doc.document_name}</b>
                                {doc.document_category && (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: '#EFF6FF',
                                    color: '#1D4ED8',
                                    border: '1px solid #BFDBFE'
                                  }}>
                                    Category: {doc.document_category}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                Type: <b>{doc.document_type}</b> · {(doc.file_size / 1024).toFixed(0)} KB · Uploaded by {doc.uploaded_by} on {new Date(doc.created_at).toLocaleDateString()}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className={`badge badge-${doc.review_status === 'ACCEPTED' ? 'completed' : doc.review_status === 'CORRECTION_REQUIRED' ? 'returned' : 'pending'}`}>
                                {doc.review_status}
                              </span>

                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleDownloadDoc(doc.id, doc.document_name)}
                                title="Download / Preview file"
                              >
                                <Download size={12} />
                                <span>Download</span>
                              </button>

                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleRetryProcessing(doc.id)}
                                title="Retry OCR & metadata extraction"
                                disabled={isActionLoading}
                              >
                                <RefreshCw size={12} />
                                <span>Retry OCR</span>
                              </button>
                            </div>
                          </div>

                          {doc.ai_summary && (
                            <div style={{ marginTop: 8, fontSize: 11, color: '#475569', background: '#F8FAFC', padding: '6px 10px', borderRadius: 4 }}>
                              <span style={{ color: '#7E22CE', fontWeight: 700 }}>AI Analysis: </span>
                              {doc.ai_summary}
                            </div>
                          )}

                          {doc.reviewer_notes && (
                            <div style={{ marginTop: 6, fontSize: 11, color: '#9A3412', background: '#FFFBEB', padding: '6px 10px', borderRadius: 4 }}>
                              <b>Officer Remarks:</b> {doc.reviewer_notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Approved Documents Section */}
                  {approvedDocuments.length > 0 && (
                    <div style={{ marginTop: 14, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <CheckCircle2 size={16} color="#16A34A" />
                        <b style={{ fontSize: 13, color: '#166534' }}>
                          Verified Statutory Approved Documents ({approvedDocuments.length})
                        </b>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {approvedDocuments.map((ad: any) => (
                          <div key={ad.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 10px', background: '#FFFFFF', borderRadius: 4, border: '1px solid #DCFCE7' }}>
                            <div>
                              <b>{ad.document_name}</b> <span style={{ color: '#64748B' }}>({ad.document_category || ad.document_type})</span>
                            </div>
                            <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 600 }}>● APPROVED</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: AI SCRUTINY FINDINGS & DISPOSITIONS */}
              {activeTab === 'scrutiny' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        AICTE Automated Regulatory Scrutiny Pipeline
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Deterministic rule engine + AI cross-checks against Approval Process Handbook (APH 2024-2027).
                      </span>
                    </div>

                    {isOfficerOrAdmin && !isCompleted && (
                      <button
                        className="btn-primary"
                        style={{ background: '#7C3AED', borderColor: '#7C3AED', fontSize: 11, padding: '6px 12px' }}
                        disabled={isActionLoading}
                        onClick={handleRunScrutiny}
                      >
                        <Sparkles size={13} />
                        <span>{isActionLoading ? 'Evaluating Rules...' : 'Run Regulatory Scrutiny'}</span>
                      </button>
                    )}
                  </div>

                  {/* Scrutiny Run Summary */}
                  {scrutinyRuns.length > 0 && (
                    <div style={{ padding: '10px 14px', background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: 'var(--radius-sm)', fontSize: 11.5 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <b style={{ color: '#6D28D9' }}>Latest Run: {scrutinyRuns[0].run_type} Scrutiny</b>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(scrutinyRuns[0].created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ margin: 0, color: '#4B5563' }}>{scrutinyRuns[0].summary}</p>
                    </div>
                  )}

                  {/* Statutory Requirements Checklist Table */}
                  {(() => {
                    const results = scrutinyRuns.length > 0
                      ? (typeof scrutinyRuns[0].rule_results === 'string'
                          ? (() => { try { return JSON.parse(scrutinyRuns[0].rule_results || '{}'); } catch { return {}; } })()
                          : scrutinyRuns[0].rule_results)
                      : null;
                    const checklist = results?.requirements_checklist;
                    if (!checklist || checklist.length === 0) return null;

                    return (
                      <div style={{ marginBottom: 14 }}>
                        <h4 style={{ fontSize: 12, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                          Statutory Document & Rule Verification Checklist (APH 2024-2027)
                        </h4>
                        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead style={{ background: '#F8FAFC', color: '#475569', textAlign: 'left', fontWeight: 600 }}>
                              <tr>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Requirement</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Status</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Matched Document</th>
                                <th style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>Assessment Note</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checklist.map((item: any, idx: number) => {
                                const isSatisfied = item.status === 'SATISFIED' || item.status === 'PASS';
                                return (
                                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)', background: isSatisfied ? '#FFFFFF' : '#FEF2F2' }}>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>{item.name}</span>
                                      <code style={{ fontSize: 9.5, color: '#64748B' }}>{item.rule_id}</code>
                                    </td>
                                    <td style={{ padding: '8px 10px' }}>
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          fontWeight: 800,
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          background: isSatisfied ? '#DCFCE7' : '#FEE2E2',
                                          color: isSatisfied ? '#166534' : '#991B1B'
                                        }}
                                      >
                                        {item.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                                      {item.document_type || item.evidence_document || '—'}
                                    </td>
                                    <td style={{ padding: '8px 10px', color: '#475569' }}>
                                      {item.remarks || item.notes || '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Findings List */}
                  {scrutinyRuns.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)', border: '1px dashed #CBD5E1' }}>
                      <Sparkles size={32} color="#7C3AED" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>Regulatory Scrutiny Pending Execution</b>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'block', maxWidth: 440, margin: '4px auto 14px' }}>
                        The AI scrutiny pipeline has not yet evaluated uploaded documents against APH 2024-2027 statutory rules.
                      </span>
                      {isOfficerOrAdmin && (
                        <button
                          className="btn-primary"
                          style={{ background: '#7C3AED', borderColor: '#7C3AED', fontSize: 12, padding: '7px 16px', margin: '0 auto' }}
                          disabled={isActionLoading}
                          onClick={handleRunScrutiny}
                        >
                          <Sparkles size={14} />
                          <span>{isActionLoading ? 'Evaluating Rules...' : 'Run Scrutiny Pipeline Now'}</span>
                        </button>
                      )}
                    </div>
                  ) : scrutinyFindings.length === 0 ? (
                    <div style={{ padding: '28px', textAlign: 'center', background: '#F0FDF4', borderRadius: 'var(--radius-md)', border: '1px solid #BBF7D0' }}>
                      <FileCheck size={32} color="#16A34A" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: '#166534' }}>All Statutory Requirements Satisfied</b>
                      <span style={{ fontSize: 11, color: '#15803D' }}>
                        All uploaded documents and statutory thresholds satisfy current APH 2024-2027 rules.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {scrutinyFindings.map((f) => (
                        <div
                          key={f.id}
                          style={{
                            padding: '12px 14px',
                            background: f.severity === 'DEFICIENCY' ? '#FEF2F2' : '#FFFBEB',
                            borderRadius: 'var(--radius-sm)',
                            border: `1px solid ${f.severity === 'DEFICIENCY' ? '#FCA5A5' : '#FDE68A'}`,
                            borderLeft: `4px solid ${f.severity === 'DEFICIENCY' ? '#DC2626' : '#D97706'}`
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: f.severity === 'DEFICIENCY' ? '#DC2626' : '#D97706',
                                  color: '#FFFFFF'
                                }}
                              >
                                {f.severity}
                              </span>
                              <b style={{ fontFamily: 'JetBrains Mono', fontSize: 12, color: 'var(--text-primary)' }}>{f.rule_id}</b>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({f.document_type})</span>
                            </div>

                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: f.officer_disposition === 'ACCEPTED' ? '#DCFCE7' : f.officer_disposition === 'WAIVED' ? '#EDE9FE' : '#F1F5F9',
                                color: f.officer_disposition === 'ACCEPTED' ? '#166534' : f.officer_disposition === 'WAIVED' ? '#6D28D9' : '#475569'
                              }}
                            >
                              Disposition: {f.officer_disposition}
                            </span>
                          </div>

                          <p style={{ margin: '8px 0 4px', fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                            {f.description}
                          </p>

                          {f.evidence_quote && (
                            <div style={{ fontSize: 11, color: '#475569', background: '#FFFFFF', padding: '6px 10px', borderRadius: 4, border: '1px solid #E2E8F0', marginTop: 4 }}>
                              <b>Evidence Quote:</b> <span style={{ fontStyle: 'italic' }}>"{f.evidence_quote}"</span>
                            </div>
                          )}

                          {f.suggested_action && (
                            <div style={{ fontSize: 11, color: '#1E40AF', marginTop: 4 }}>
                              <b>Recommended Action:</b> {f.suggested_action}
                            </div>
                          )}

                          {f.disposition_notes && (
                            <div style={{ fontSize: 11, color: '#047857', marginTop: 4, background: '#ECFDF5', padding: '4px 8px', borderRadius: 4 }}>
                              <b>Waiver / Disposition Justification:</b> {f.disposition_notes}
                            </div>
                          )}

                          {/* Officer Disposition Action Buttons */}
                          {isOfficerOrAdmin && !isCompleted && f.officer_disposition === 'PENDING' && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px', color: '#166534', borderColor: '#86EFAC' }}
                                disabled={isActionLoading}
                                onClick={() => handleFindingDisposition(f.id, 'ACCEPTED')}
                              >
                                <Check size={12} />
                                <span>Accept Finding</span>
                              </button>

                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px', color: '#6D28D9', borderColor: '#C4B5FD' }}
                                disabled={isActionLoading}
                                onClick={() => {
                                  setSelectedFindingForWaive(f);
                                  setWaiveJustification('');
                                  setIsWaiveOpen(true);
                                }}
                              >
                                <ShieldCheck size={12} />
                                <span>Waive Finding</span>
                              </button>

                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px', color: '#EA580C', borderColor: '#FDBA74' }}
                                disabled={isActionLoading}
                                onClick={() => handleFindingDisposition(f.id, 'CORRECTION_REQUESTED', f.description)}
                              >
                                <RotateCcw size={12} />
                                <span>Request Correction</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: MISSING INFORMATION & CORRECTIONS */}
              {activeTab === 'corrections' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Deficiency Records & Institutional Clarifications ({correctionRequests.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Formal statutory record of cited deficiencies, returned cases, and institution rectifications.
                      </span>
                    </div>

                    {isOfficerOrAdmin && !isCompleted && details.current_stage !== 'RETURNED_FOR_CLARIFICATION' && (
                      <button
                        className="btn-secondary"
                        style={{ fontSize: 11, padding: '5px 10px', borderColor: '#EA580C', color: '#EA580C' }}
                        onClick={() => setIsReturnOpen(true)}
                      >
                        <RotateCcw size={12} />
                        <span>Return for Clarification</span>
                      </button>
                    )}
                  </div>

                  {correctionRequests.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <CheckCircle2 size={32} color="#16A34A" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No Active Clarification Requests</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        No outstanding deficiency observations currently returned to the institution.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {correctionRequests.map((cr, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 14px',
                            background: '#FFF7ED',
                            border: '1px solid #FDBA74',
                            borderLeft: '4px solid #EA580C',
                            borderRadius: 'var(--radius-sm)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <b style={{ fontSize: 12.5, color: '#9A3412' }}>
                              Observation {idx + 1}: {cr.source === 'RETURN_DEFICIENCY' ? 'Case Deficiency Return' : 'Document Flag'}
                            </b>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                              {new Date(cr.created_at).toLocaleString()}
                            </span>
                          </div>

                          <p style={{ margin: '4px 0', fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                            <b>Officer Cited Deficiency:</b> {cr.reason}
                          </p>

                          {cr.institution_response && (
                            <div style={{ marginTop: 8, padding: '8px 10px', background: '#FFFFFF', borderRadius: 4, border: '1px solid #FED7AA', fontSize: 11.5, color: '#166534' }}>
                              <b>Institutional Clarification:</b> {cr.institution_response}
                              {cr.response_submitted_at && (
                                <span style={{ display: 'block', fontSize: 9.5, color: 'var(--text-muted)', marginTop: 2 }}>
                                  Submitted: {new Date(cr.response_submitted_at).toLocaleString()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: EVC INSPECTION */}
              {activeTab === 'evc' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Expert Visiting Committee (EVC) Inspection
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Statutory committee verification for new programmes, conversion, and regulatory inspections.
                      </span>
                    </div>

                    {(isOfficerOrAdmin || isEvcExpert) && !isCompleted && evcVisit && (
                      <button
                        className="btn-primary"
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        onClick={() => setIsEvcModalOpen(true)}
                      >
                        <Building2 size={12} />
                        <span>Record Inspection Findings</span>
                      </button>
                    )}
                  </div>

                  {!evcVisit ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <Building2 size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No EVC Inspection Scheduled</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 14 }}>
                        EVC inspection is initiated when an application progresses to the EVC_PENDING stage.
                      </span>
                      {isOfficerOrAdmin && (details.current_stage === 'EVC_PENDING' || details.current_stage === 'SCRUTINY' || details.current_stage === 'RE_SCRUTINY') && (
                        <button
                          className="btn-primary"
                          style={{ margin: '0 auto', fontSize: 11, padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          disabled={isActionLoading}
                          onClick={() => handleTransition('SCHEDULE_EVC', 'EVC Inspection Committee Constituted')}
                        >
                          <Calendar size={13} />
                          <span>Schedule EVC Inspection Panel</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '16px',
                        background: '#FFFFFF',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 12 }}>
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Inspection Mode
                          </span>
                          <b>{evcVisit.visit_mode} Visit</b>
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Visit Status
                          </span>
                          <span className={`badge badge-${evcVisit.status === 'COMPLETED' ? 'completed' : 'pending'}`}>
                            {evcVisit.status}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Scheduled Date
                          </span>
                          <span>{evcVisit.scheduled_date}</span>
                        </div>
                      </div>

                      <div>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                          Expert Committee Panel
                        </span>
                        <div style={{ fontSize: 12, color: '#334155', background: '#F8FAFC', padding: '6px 10px', borderRadius: 4, marginTop: 2 }}>
                          {evcVisit.committee_members}
                        </div>
                      </div>

                      {evcVisit.report_summary && (
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Committee Report Summary
                          </span>
                          <div style={{ fontSize: 12, color: '#334155', background: '#F8FAFC', padding: '8px 10px', borderRadius: 4, marginTop: 2 }}>
                            {evcVisit.report_summary}
                          </div>
                        </div>
                      )}

                      {evcVisit.recommendations && (
                        <div>
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>
                            Statutory Recommendation
                          </span>
                          <div style={{ fontSize: 12, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '8px 10px', borderRadius: 4, marginTop: 2 }}>
                            {evcVisit.recommendations}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 6: COMPLIANCE CHECKLIST & EVIDENCE */}
              {activeTab === 'compliance' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        APH Statutory Compliance Checklist ({complianceItems.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Institutional undertakings, land tenure covenants, and fire safety NOC verification.
                      </span>
                    </div>
                  </div>

                  {complianceItems.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <ClipboardList size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No Compliance Items Tracked</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Compliance items are created during scrutiny or when the case enters COMPLIANCE_PENDING.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {complianceItems.map((c) => (
                        <div
                          key={c.id}
                          style={{
                            padding: '12px 14px',
                            background: '#FFFFFF',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: `4px solid ${c.status === 'VERIFIED' ? '#16A34A' : c.status === 'REJECTED' ? '#DC2626' : '#3B82F6'}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                            <div>
                              <b style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.item_type}</b>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>
                                Due Date: <b>{c.due_date}</b>
                              </span>
                            </div>

                            <span className={`badge badge-${c.status === 'VERIFIED' ? 'completed' : c.status === 'REJECTED' ? 'overdue' : 'pending'}`}>
                              {c.status}
                            </span>
                          </div>

                          <p style={{ margin: '6px 0 4px', fontSize: 12, color: '#334155' }}>{c.description}</p>

                          {c.submission_evidence && (
                            <div style={{ fontSize: 11, color: '#166534', background: '#F0FDF4', padding: '6px 10px', borderRadius: 4, marginTop: 4 }}>
                              <b>Submitted Evidence:</b> {c.submission_evidence}
                            </div>
                          )}

                          {c.officer_comments && (
                            <div style={{ fontSize: 11, color: '#9A3412', background: '#FFFBEB', padding: '6px 10px', borderRadius: 4, marginTop: 4 }}>
                              <b>Officer Verification Comments:</b> {c.officer_comments}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            {isInstitution && !isCompleted && (c.status === 'PENDING' || c.status === 'REJECTED') && (
                              <button
                                className="btn-secondary"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => {
                                  setSelectedComplianceItem(c);
                                  setComplianceEvidenceInput(c.submission_evidence || '');
                                  setIsComplianceModalOpen(true);
                                }}
                              >
                                <Upload size={12} />
                                <span>Submit Evidence</span>
                              </button>
                            )}

                            {isOfficerOrAdmin && !isCompleted && c.status === 'SUBMITTED' && (
                              <>
                                <button
                                  className="btn-secondary"
                                  style={{ fontSize: 11, padding: '4px 8px', color: '#166534', borderColor: '#86EFAC' }}
                                  disabled={isActionLoading}
                                  onClick={() => handleVerifyCompliance(c.id, 'VERIFY')}
                                >
                                  <Check size={12} />
                                  <span>Verify Evidence</span>
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ fontSize: 11, padding: '4px 8px', color: '#DC2626', borderColor: '#FCA5A5' }}
                                  disabled={isActionLoading}
                                  onClick={() => handleVerifyCompliance(c.id, 'REJECT')}
                                >
                                  <X size={12} />
                                  <span>Reject Evidence</span>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 7: FIELD PROVENANCE & CANDIDATE FIELDS */}
              {activeTab === 'fields' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Extracted Candidate Fields with Evidence Quotes ({extractedFields.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Fields parsed from uploaded documents. Explicit human review and approval required before merging.
                      </span>
                    </div>

                    {extractedFields.length > 0 && !isCompleted && (
                      <button
                        className="btn-primary"
                        style={{ background: '#7C3AED', borderColor: '#7C3AED', fontSize: 11, padding: '6px 12px' }}
                        disabled={isApplyingFields}
                        onClick={handleApplyExtractedFields}
                      >
                        <CheckCircle2 size={13} />
                        <span>{isApplyingFields ? 'Applying...' : 'Confirm & Apply Selected'}</span>
                      </button>
                    )}
                  </div>

                  {extractedFields.length === 0 ? (
                    <div style={{ padding: '36px', textAlign: 'center', background: '#F8FAFC', borderRadius: 'var(--radius-md)' }}>
                      <Database size={32} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                      <b style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>No Candidate Fields Extracted</b>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Upload regulatory documents to parse survey numbers, land acreage, and certificate validity dates.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {extractedFields.map((field) => {
                        const isChecked = !!selectedFieldKeys[field.field_key];
                        return (
                          <div
                            key={field.field_key}
                            style={{
                              padding: '12px 14px',
                              background: isChecked ? '#F5F3FF' : '#F8FAFC',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${isChecked ? '#C4B5FD' : 'var(--border-subtle)'}`,
                              display: 'grid',
                              gridTemplateColumns: 'auto minmax(0, 1.2fr) minmax(0, 1fr)',
                              gap: 12,
                              alignItems: 'center'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => setSelectedFieldKeys({ ...selectedFieldKeys, [field.field_key]: e.target.checked })}
                              style={{ cursor: 'pointer', width: 16, height: 16 }}
                            />

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <b style={{ fontSize: 13, color: '#1E293B' }}>{field.label || field.field_label}</b>
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    background: field.provenance === 'DETERMINISTIC_PARSED' ? '#DCFCE7' : '#E0E7FF',
                                    color: field.provenance === 'DETERMINISTIC_PARSED' ? '#166534' : '#3730A3'
                                  }}
                                >
                                  {field.provenance}
                                </span>
                                <span style={{ fontSize: 10, color: '#059669', fontWeight: 600 }}>
                                  {Math.round((field.confidence ?? 0.9) * 100)}% Conf
                                </span>
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, color: '#0F172A', fontWeight: 600 }}>
                                Value: <span style={{ color: '#2563EB' }}>{field.extracted_value}</span>
                              </div>
                            </div>

                            <div style={{ fontSize: 11, color: '#475569', background: '#FFFFFF', padding: '6px 8px', borderRadius: 4, border: '1px solid #E2E8F0' }}>
                              <span style={{ display: 'block', fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>
                                Source: {field.source_document}
                              </span>
                              <span style={{ fontStyle: 'italic' }}>"{field.evidence_quote}"</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 8: CRYPTOGRAPHIC AUDIT CHAIN */}
              {activeTab === 'audit' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Tamper-Evident SHA-256 Audit Hash Chain ({auditEvents.length} events)
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Every workflow action and decision is cryptographically chained with the preceding event hash.
                      </span>
                    </div>

                    <button
                      className="btn-secondary"
                      style={{ fontSize: 11, padding: '6px 12px', borderColor: '#2563EB', color: '#1D4ED8' }}
                      disabled={isVerifyingAudit}
                      onClick={handleVerifyAuditChain}
                    >
                      <RefreshCw size={12} className={isVerifyingAudit ? 'spin' : ''} />
                      <span>{isVerifyingAudit ? 'Verifying Hashes...' : 'Verify Cryptographic Chain'}</span>
                    </button>
                  </div>

                  {auditVerification && (() => {
                    const isIntact = auditVerification.chain_intact ?? auditVerification.verified ?? false;
                    const eventCount = auditVerification.total_events ?? auditVerification.checked_count ?? auditEvents.length;
                    return (
                      <div
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          background: isIntact ? '#F0FDF4' : '#FEF2F2',
                          border: `1px solid ${isIntact ? '#86EFAC' : '#FCA5A5'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          fontSize: 12
                        }}
                      >
                        {isIntact ? (
                          <CheckCircle2 size={18} color="#16A34A" />
                        ) : (
                          <AlertTriangle size={18} color="#DC2626" />
                        )}
                        <div>
                          <b style={{ color: isIntact ? '#166534' : '#991B1B' }}>
                            {isIntact
                              ? `✓ Cryptographic Integrity Verified Intact (${eventCount} events verified)`
                              : '⚠️ Cryptographic Discrepancy Detected'}
                          </b>
                          <span style={{ display: 'block', fontSize: 11, color: '#4B5563' }}>
                            {isIntact
                              ? (auditVerification.message || 'All SHA-256 hashes validated successfully with no tampering.')
                              : (auditVerification.reason || 'Hash mismatch detected in event chain.')}
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="audit-timeline">
                    {auditEvents.map((e) => (
                      <div key={e.id} className="timeline-item">
                        <div className="timeline-meta" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <b>{e.actor}</b>
                          <span className="user-role-badge" style={{ fontSize: 9 }}>{e.actor_role}</span>
                          <span>· {new Date(e.created_at).toLocaleString()}</span>
                          {e.event_hash && (
                            <code style={{ fontSize: 9, background: '#F1F5F9', padding: '1px 5px', borderRadius: 3, color: '#475569', marginLeft: 'auto' }}>
                              hash: {e.event_hash.slice(0, 10)}... | prev: {e.prev_hash ? e.prev_hash.slice(0, 8) + '...' : 'GENESIS'}
                            </code>
                          )}
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

              {/* TAB 9: STAGE REMARKS, COMMENTS & DECISION HISTORY */}
              {activeTab === 'remarks' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--color-navy)' }}>
                        Stage Remarks, Comments & Multi-Party Discussions ({stageRemarks.length})
                      </h4>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Persistent chronological notes with reply threading and role-based visibility.
                      </span>
                    </div>
                  </div>

                  {/* Add Remark Form */}
                  <form onSubmit={handlePostRemark} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 14 }}>
                    {replyingToRemarkId && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: 12 }}>
                        <span>Replying to Remark <b>#{replyingToRemarkId}</b></span>
                        <button type="button" onClick={() => setReplyingToRemarkId(null)} style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', fontWeight: 600 }}>Cancel Reply</button>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: isOfficerOrAdmin ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase' }}>
                          Remark Type
                        </label>
                        <select
                          value={newRemarkActionType}
                          onChange={(e) => setNewRemarkActionType(e.target.value)}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 12, background: '#FFFFFF' }}
                        >
                          <option value="OBSERVATION">Officer Observation</option>
                          <option value="QUERY">Clarification Query to Applicant</option>
                          <option value="CORRECTION_NOTE">Correction Guidance</option>
                          <option value="APPROVAL_NOTE">Approval Endorsement</option>
                          <option value="GENERAL">General Regulatory Note</option>
                        </select>
                      </div>

                      {isOfficerOrAdmin && (
                        <div>
                          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 3, textTransform: 'uppercase' }}>
                            Visibility Level
                          </label>
                          <select
                            value={newRemarkVisibility}
                            onChange={(e) => setNewRemarkVisibility(e.target.value as 'APPLICANT_VISIBLE' | 'INTERNAL_OFFICER_ONLY')}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #CBD5E1', fontSize: 12, background: '#FFFFFF' }}
                          >
                            <option value="APPLICANT_VISIBLE">Visible to Institution & Officers</option>
                            <option value="INTERNAL_OFFICER_ONLY">Internal Officer Only (Confidential)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 10 }}>
                      <textarea
                        required
                        rows={3}
                        placeholder="Enter stage observation, clarification request, or regulatory finding remarks..."
                        value={newRemarkText}
                        onChange={(e) => setNewRemarkText(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: 12.5, boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isPostingRemark || !newRemarkText.trim()}
                        style={{ fontSize: 12, padding: '6px 14px' }}
                      >
                        {isPostingRemark ? 'Saving Remark...' : (replyingToRemarkId ? 'Post Reply' : 'Add Remark')}
                      </button>
                    </div>
                  </form>

                  {/* Remarks Chronological List */}
                  {stageRemarks.length === 0 ? (
                    <div style={{ padding: 24, textAlign: 'center', background: '#F8FAFC', borderRadius: 6, border: '1px dashed #CBD5E1', color: '#64748B', fontSize: 13 }}>
                      No remarks recorded yet for this application lifecycle.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stageRemarks.filter(r => !r.parent_remark_id).map((r) => {
                        const replies = stageRemarks.filter(child => child.parent_remark_id === r.id);
                        return (
                          <div key={r.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <b style={{ fontSize: 13, color: '#1E293B' }}>{r.author_name}</b>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#F1F5F9', color: '#475569' }}>
                                  {r.author_role.toUpperCase()}
                                </span>
                                <span style={{ fontSize: 10.5, color: '#64748B' }}>
                                  Stage: <b>{r.stage}</b>
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {r.visibility === 'INTERNAL_OFFICER_ONLY' && (
                                  <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: '#FEF3C7', color: '#92400E', fontWeight: 700 }}>
                                    INTERNAL ONLY
                                  </span>
                                )}
                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#EFF6FF', color: '#1D4ED8', fontWeight: 600 }}>
                                  {r.action_type || 'OBSERVATION'}
                                </span>
                                <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                  {new Date(r.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>

                            <p style={{ margin: '6px 0 10px', fontSize: 12.5, color: '#334155', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                              {r.comment_text}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setReplyingToRemarkId(r.id)}
                                style={{ background: 'none', border: 'none', color: '#2563EB', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}
                              >
                                Reply →
                              </button>
                            </div>

                            {/* Nested Replies */}
                            {replies.length > 0 && (
                              <div style={{ marginTop: 10, paddingLeft: 16, borderLeft: '2px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {replies.map((reply) => (
                                  <div key={reply.id} style={{ background: '#F8FAFC', borderRadius: 6, padding: '8px 12px', border: '1px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <b style={{ fontSize: 12, color: '#1E293B' }}>{reply.author_name}</b>
                                        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#E2E8F0', color: '#475569' }}>
                                          {reply.author_role.toUpperCase()}
                                        </span>
                                      </div>
                                      <span style={{ fontSize: 10.5, color: '#94A3B8' }}>
                                        {new Date(reply.created_at).toLocaleString()}
                                      </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                      {reply.comment_text}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Workflow Stage Stepper & Officer Action Hub */}
          <div
            className="modal-sidebar-right"
            style={{
              background: '#FAFAFA',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              overflowY: 'auto',
              overflowX: 'hidden',
              minWidth: 0,
              width: '280px',
              maxWidth: '280px',
              boxSizing: 'border-box'
            }}
          >
            {/* Vertical Workflow Stage Stepper */}
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 10 }}>
                Workflow Stage Progression
              </span>

              <div className="vertical-timeline">
                {stageList.map((stg, idx) => {
                  const isPassed = !isReturned && currentStageIndex > idx;
                  const isCurrent = !isReturned && currentStageIndex === idx;

                  let stepClass = 'vertical-timeline-step';
                  if (isPassed || details.current_stage === 'COMPLETED') stepClass += ' completed';
                  if (isCurrent) stepClass += ' current';

                  return (
                    <div key={stg} className={stepClass}>
                      <div className="vertical-step-marker">
                        {isPassed || details.current_stage === 'COMPLETED' ? (
                          <Check size={10} />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>
                      <div className="vertical-step-title">{stg.replace(/_/g, ' ')}</div>
                      {isCurrent && (
                        <div className="vertical-step-subtitle">Current Active Stage</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

            {/* Officer Action Hub / Transitions */}
            <div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 8 }}>
                Available Regulatory Transitions ({user?.role})
              </span>

              {/* Institution Draft Submission */}
              {isInstitution && isDraft && (
                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled={isActionLoading}
                  onClick={handleSubmitDraft}
                >
                  <Send size={13} />
                  <span>Submit for Scrutiny</span>
                </button>
              )}

              {/* Institution Returned Resubmission */}
              {isInstitution && isReturned && (
                <button
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center', background: '#EA580C', borderColor: '#EA580C' }}
                  onClick={() => setIsResubmitOpen(true)}
                >
                  <Send size={13} />
                  <span>Resubmit Rectification</span>
                </button>
              )}

              {/* Officer / Admin Transitions */}
              {isOfficerOrAdmin && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {transitions.length === 0 ? (
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      No stage transitions pending for '{user?.role}' on this stage.
                    </span>
                  ) : (
                    transitions.map((t) => {
                      if (t.action === 'RETURN') {
                        return (
                          <button
                            key={t.action}
                            className="btn-secondary"
                            style={{
                              borderColor: '#EA580C',
                              color: '#EA580C',
                              width: '100%',
                              whiteSpace: 'normal',
                              textAlign: 'center',
                              wordBreak: 'break-word',
                              lineHeight: 1.35,
                              padding: '8px 10px',
                              height: 'auto',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6
                            }}
                            disabled={isActionLoading}
                            onClick={() => setIsReturnOpen(true)}
                          >
                            <RotateCcw size={13} style={{ flexShrink: 0 }} />
                            <span>Return for Clarification</span>
                          </button>
                        );
                      }

                      return (
                        <button
                          key={t.action}
                          className="btn-primary"
                          style={{
                            width: '100%',
                            whiteSpace: 'normal',
                            textAlign: 'center',
                            wordBreak: 'break-word',
                            lineHeight: 1.35,
                            padding: '8px 10px',
                            height: 'auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                          disabled={isActionLoading}
                          onClick={() => handleTransition(t.action, `Advanced via ${t.action}`)}
                        >
                          <ArrowRight size={13} style={{ flexShrink: 0 }} />
                          <span style={{ flex: 1, textAlign: 'center' }}>{t.description}</span>
                        </button>
                      );
                    })
                  )}

                  {/* Statutory Decision Action (When eligible) */}
                  {!isCompleted &&
                    (details.current_stage === 'SAC_SHC_REVIEW' ||
                      details.current_stage === 'COMPLIANCE_PENDING' ||
                      details.current_stage === 'EVC_COMPLETED') && (
                      <button
                        className="btn-secondary"
                        style={{
                          marginTop: 6,
                          width: '100%',
                          whiteSpace: 'normal',
                          textAlign: 'center',
                          wordBreak: 'break-word',
                          lineHeight: 1.35,
                          padding: '8px 10px',
                          height: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          borderColor: 'var(--color-navy)',
                          color: 'var(--color-navy)',
                          fontWeight: 700
                        }}
                        onClick={() => {
                          setDecisionOutcome('APPROVED');
                          setDecisionRemarks('');
                          setDecisionOrderRef(`AICTE/APH/2026/${details.reference}`);
                          setIsDecisionOpen(true);
                        }}
                      >
                        <Gavel size={13} />
                        <span>Issue Statutory Final Order</span>
                      </button>
                    )}
                </div>
              )}

              {/* Institution Active Status Note */}
              {isInstitution && !isDraft && !isReturned && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Case is under active regulatory scrutiny. You will receive an immediate alert if additional evidence or clarifications are requested.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="modal-footer"
          style={{
            padding: '12px 20px',
            background: '#FFFFFF',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxSizing: 'border-box',
            width: '100%',
            minWidth: 0
          }}
        >
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Application Dossier: <b>{details.reference}</b> · Case ID #{details.id}
          </div>

          <button className="btn-secondary" onClick={handleAttemptClose} style={{ flexShrink: 0 }}>
            Close Case Workspace
          </button>
        </div>
      </div>

      {/* DIALOG 1: Return Application for Clarification (Officer) */}
      {isReturnOpen && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(540px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ color: '#C2410C', margin: 0, fontSize: 15 }}>Return Application for Clarification</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsReturnOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                Please record clear and specific regulatory observations. This reason is permanently recorded in the cryptographic audit trail and dispatched to the institution.
              </p>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Mandatory Cited Deficiency Justification (Min 5 chars) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Land lease deed tenure expires in 2038 which is below the statutory 30-year threshold prescribed in APH 2024-2027 Section 3.2..."
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
                style={{ background: '#C2410C', borderColor: '#C2410C' }}
                disabled={isActionLoading || returnReason.trim().length < 5}
                onClick={() => handleTransition('RETURN', returnReason)}
              >
                {isActionLoading ? 'Returning...' : 'Confirm Return of Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 2: Resubmit Application Rectification (Institution) */}
      {isResubmitOpen && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(540px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Submit Clarification Response & Resubmit</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsResubmitOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                Detail how the cited deficiencies have been rectified. This transitions the case back into RE_SCRUTINY.
              </p>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Institutional Rectification Explanation (Min 3 chars) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Registered lease deed addendum valid through 2055 has been uploaded. Cadre ratio rectified with appointment letters..."
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
                {isActionLoading ? 'Resubmitting...' : 'Resubmit Case for Re-Scrutiny'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 3: Waive Finding Justification (Officer) */}
      {isWaiveOpen && selectedFindingForWaive && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(540px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Waive Scrutiny Finding</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsWaiveOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                Waiving finding <b>{selectedFindingForWaive.rule_id}</b> requires mandatory regulatory justification recorded in the audit trail.
              </p>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Mandatory Waiver Justification (Min 5 chars) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Verified special exemption granted under AICTE council order dated 14 Feb 2026 for state government university affiliate..."
                  value={waiveJustification}
                  onChange={(e) => setWaiveJustification(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsWaiveOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{ background: '#7C3AED', borderColor: '#7C3AED' }}
                disabled={isActionLoading || waiveJustification.trim().length < 5}
                onClick={() => handleFindingDisposition(selectedFindingForWaive.id, 'WAIVED', waiveJustification.trim())}
              >
                {isActionLoading ? 'Waiving...' : 'Confirm Finding Waiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 4: Statutory Final Decision Order (Officer) */}
      {isDecisionOpen && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(580px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Issue Statutory Final Decision Order</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsDecisionOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ gap: 14 }}>
              <div className="form-group">
                <label>Statutory Decision Outcome *</label>
                <select
                  value={decisionOutcome}
                  onChange={(e) => setDecisionOutcome(e.target.value as any)}
                >
                  <option value="APPROVED">APPROVED (Grant of Approval / EoA)</option>
                  <option value="REJECTED">REJECTED (Rejection Order with Speaking Grounds)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Statutory Order Reference Number</label>
                <input
                  type="text"
                  value={decisionOrderRef}
                  onChange={(e) => setDecisionOrderRef(e.target.value)}
                  placeholder="e.g. AICTE/APH/2026/ORDER/8821"
                />
              </div>

              <div className="form-group">
                <label>
                  {decisionOutcome === 'REJECTED'
                    ? 'Mandatory Speaking Order Grounds for Rejection (Min 5 chars) *'
                    : 'Decision Remarks & Approval Conditions'}
                </label>
                <textarea
                  rows={4}
                  required={decisionOutcome === 'REJECTED'}
                  placeholder={
                    decisionOutcome === 'REJECTED'
                      ? 'Specify exact statutory non-compliances leading to rejection...'
                      : 'Approval granted subject to adherence with AICTE fee regulatory norms...'
                  }
                  value={decisionRemarks}
                  onChange={(e) => setDecisionRemarks(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsDecisionOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                style={{
                  background: decisionOutcome === 'APPROVED' ? '#16A34A' : '#DC2626',
                  borderColor: decisionOutcome === 'APPROVED' ? '#16A34A' : '#DC2626'
                }}
                disabled={isActionLoading || (decisionOutcome === 'REJECTED' && decisionRemarks.trim().length < 5)}
                onClick={handleRecordFinalDecision}
              >
                {isActionLoading ? 'Issuing Order...' : `Confirm Statutory Order: ${decisionOutcome}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 5: Record EVC Inspection Report (Officer / EVC Expert) */}
      {isEvcModalOpen && evcVisit && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(580px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Record EVC Inspection Findings</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsEvcModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ gap: 14 }}>
              <div className="form-group">
                <label>Inspection Visit Status *</label>
                <select
                  value={evcVisitStatus}
                  onChange={(e) => setEvcVisitStatus(e.target.value)}
                >
                  <option value="COMPLETED">COMPLETED (Inspection successfully concluded)</option>
                  <option value="IN_PROGRESS">IN_PROGRESS (Inspection underway)</option>
                  <option value="POSTPONED">POSTPONED (Rescheduling required)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Committee Physical Infrastructure Observations *</label>
                <textarea
                  rows={3}
                  placeholder="Laboratories, equipment, computing facilities, and faculty verification observations..."
                  value={evcReportSummary}
                  onChange={(e) => setEvcReportSummary(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Formal Committee Recommendation *</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Recommended for approval with proposed 60 intake in AI & ML..."
                  value={evcRecommendations}
                  onChange={(e) => setEvcRecommendations(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsEvcModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isActionLoading}
                onClick={handleUpdateEvcVisit}
              >
                {isActionLoading ? 'Saving...' : 'Save Inspection Findings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 6: Submit Compliance Evidence (Institution) */}
      {isComplianceModalOpen && selectedComplianceItem && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Submit Compliance Evidence</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsComplianceModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
                Requirement: <b>{selectedComplianceItem.item_type}</b>
              </p>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Evidence Reference / Certificate Number / Document URL *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="e.g. Registered lease deed extension No. 8920/2026 registered at Sub-Registrar Gautam Buddha Nagar..."
                  value={complianceEvidenceInput}
                  onChange={(e) => setComplianceEvidenceInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setIsComplianceModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                disabled={isActionLoading || !complianceEvidenceInput.trim()}
                onClick={handleSubmitComplianceEvidence}
              >
                {isActionLoading ? 'Submitting...' : 'Submit Evidence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG 7: Upload Document Modal */}
      {isUploadOpen && (
        <div className="modal-backdrop" style={{ zIndex: 120 }}>
          <div className="modal-dialog" style={{ width: 'min(520px, 92%)' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 15 }}>Upload Regulatory Document</h3>
              <button style={{ background: 'transparent', border: 0, cursor: 'pointer' }} onClick={() => setIsUploadOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadDocument}>
              <div className="modal-body" style={{ gap: 14 }}>
                <div className="form-group">
                  <label>Regulatory Document Category *</label>
                  <select
                    value={uploadDocCategory}
                    onChange={(e) => setUploadDocCategory(e.target.value)}
                  >
                    <option value="Institutional Records">Institutional Records</option>
                    <option value="Approval Documents">Approval Documents</option>
                    <option value="Faculty-Related Records">Faculty-Related Records</option>
                    <option value="Infrastructure Records">Infrastructure Records</option>
                    <option value="Lease Documents">Lease Documents</option>
                    <option value="Undertakings">Statutory Undertakings & Affidavits</option>
                    <option value="Inspection Evidence">Inspection Evidence & Geotagged Proofs</option>
                    <option value="Other">Other Regulatory Disclosures</option>
                  </select>
                </div>

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
                  <label>Document Reference Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Certified 33-Year Land Deed"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Select Document File (PDF, DOCX, TXT - Max 10MB) *</label>
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
                <button type="button" className="btn-secondary" disabled={isUploading} onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isUploading || !uploadFile}>
                  <Upload size={14} />
                  <span>{isUploading ? 'Uploading & Scrutinizing...' : 'Upload & Scrutinize'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
