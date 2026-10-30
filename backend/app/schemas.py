from datetime import date, datetime
from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, ConfigDict


class RegisterRequest(BaseModel):
    institution_name: str = Field(min_length=3, max_length=200)
    contact_name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=255)
    phone: str = Field(min_length=8, max_length=20)
    region: str = Field(default="Northern")
    state: str = Field(default="Delhi")
    city: str = Field(default="New Delhi")
    institution_type: str = Field(default="Engineering and Technology")
    institution_code: Optional[str] = None
    address: Optional[str] = "Campus Address"
    password: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=6)


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str
    institution_name: Optional[str] = None
    region: str
    designation: str

    model_config = ConfigDict(from_attributes=True)


class InstitutionProfileOut(BaseModel):
    id: int
    code: str
    name: str
    region: str
    state: str
    address: str
    contact_email: str
    contact_phone: str
    institution_type: str

    model_config = ConfigDict(from_attributes=True)


class ApplicationCreate(BaseModel):
    institution_name: Optional[str] = None  # Populated from user profile for institutions or entered by user
    application_type: str = "Extension of Approval"
    region: Optional[str] = None
    due_date: Optional[date] = None
    notes: str = ""
    academic_year: str = "2026-2027"
    form_data: Optional[Union[Dict[str, Any], str]] = None
    is_draft: bool = False


class ApplicationPatch(BaseModel):
    notes: Optional[str] = None
    due_date: Optional[date] = None
    academic_year: Optional[str] = None
    form_data: Optional[Union[Dict[str, Any], str]] = None


class ApplicationUpdate(BaseModel):
    application_type: Optional[str] = None
    academic_year: Optional[str] = None
    region: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    form_data: Optional[Union[Dict[str, Any], str]] = None


class FindingDispositionRequest(BaseModel):
    disposition: str = "ACCEPTED"  # ACCEPTED, WAIVED, CORRECTION_REQUESTED, REJECTED
    disposition_notes: Optional[str] = None


class CorrectionItemOut(BaseModel):
    source: str
    reason: str
    document_id: Optional[int] = None
    document_name: Optional[str] = None
    created_at: datetime


class ApplicationTransition(BaseModel):
    action: str  # SCRUTINY_PASS, SEND_EVC, SCHEDULE_EVC, COMPLETE_EVC, SAC_APPROVE, COMPLIANCE_CLEAR, APPROVE_FINAL, RETURN, RESUBMIT
    reason: str = ""
    assigned_to: Optional[str] = None


class ApplicationResubmit(BaseModel):
    response_text: Optional[str] = Field(default=None, min_length=3, description="Detailed institutional explanation addressing cited deficiencies")
    reason: Optional[str] = None
    explanation: Optional[str] = None


class ApplicationOut(BaseModel):
    id: int
    reference: str
    institution_name: str
    application_type: str
    current_stage: str
    status: str
    assigned_to: str
    assigned_role: str
    region: str
    submission_date: date
    due_date: Optional[date] = None
    notes: str
    deficiency_count: int
    academic_year: str
    form_data: Optional[str] = None
    decision_outcome: Optional[str] = None
    decision_remarks: Optional[str] = None
    decision_by: Optional[str] = None
    decision_date: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    next_action: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class AuditEventOut(BaseModel):
    id: int
    application_id: int
    actor: str
    actor_role: str
    action: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    details: str
    prev_hash: Optional[str] = None
    event_hash: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RecentAuditEventOut(AuditEventOut):
    application_reference: Optional[str] = None
    institution_name: Optional[str] = None


class ComplianceCreate(BaseModel):
    institution_name: str
    application_id: Optional[int] = None
    item_type: str = "UNDERTAKING"
    description: str
    due_date: date


class ComplianceEvidenceSubmit(BaseModel):
    submission_evidence: str = Field(min_length=10)


class ComplianceVerify(BaseModel):
    action: str = "VERIFY"  # VERIFY or REJECT
    officer_comments: str = ""


class ComplianceOut(BaseModel):
    id: int
    institution_name: str
    application_id: Optional[int] = None
    item_type: str
    description: str
    due_date: date
    status: str
    submission_evidence: Optional[str] = None
    submitted_at: Optional[datetime] = None
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    officer_comments: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EVCVisitCreate(BaseModel):
    application_id: int
    committee_members: str
    scheduled_date: date
    visit_mode: str = "PHYSICAL"
    location_details: Optional[str] = None


class EVCVisitUpdate(BaseModel):
    status: Optional[str] = "COMPLETED"
    report_summary: Optional[str] = ""
    recommendations: Optional[str] = ""
    actual_date: Optional[date] = None
    visit_occurred: Optional[str] = "OCCURRED"  # OCCURRED, DID_NOT_OCCUR, UNCONFIRMED
    missed_reason: Optional[str] = None
    evidence_verification_status: Optional[str] = "PENDING"
    location_details: Optional[str] = None
    structured_checklist: Optional[Union[Dict[str, Any], str]] = None
    inspection_outcome: Optional[str] = "RECOMMENDED"


class EVCRescheduleRequest(BaseModel):
    new_date: date
    reason: str = Field(min_length=3, description="Mandatory reason for rescheduling inspection")
    visit_mode: Optional[str] = None


class EVCApproveNextStageRequest(BaseModel):
    remarks: str = Field(default="", description="Mandatory or recommended remarks for advancing stage")
    target_stage: Optional[str] = None


class EVCVisitOut(BaseModel):
    id: int
    application_id: int
    institution_name: str
    committee_members: str
    scheduled_date: date
    actual_date: Optional[date] = None
    visit_mode: str
    status: str
    visit_occurred: str = "UNCONFIRMED"
    missed_reason: Optional[str] = None
    evidence_verification_status: str = "PENDING"
    location_details: Optional[str] = None
    structured_checklist: Optional[str] = None
    inspection_outcome: Optional[str] = None
    report_summary: Optional[str] = None
    recommendations: Optional[str] = None
    assigned_by: str
    created_at: datetime
    evidence_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)


class InspectionEvidenceOut(BaseModel):
    id: int
    visit_id: int
    application_id: int
    evidence_type: str
    file_name: str
    file_path: str
    file_hash: str
    file_size: int
    uploaded_by: str
    remarks: Optional[str] = None
    verification_status: str = "PENDING"
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InspectionEvidenceVerifyRequest(BaseModel):
    action: str = "VERIFY"  # VERIFY or REJECT
    remarks: Optional[str] = None


class DocumentUploadCheck(BaseModel):
    document_name: str
    document_type: str = "LEASE_DEED"
    document_category: str = "INSTITUTIONAL_RECORDS"
    extracted_text: str
    application_id: Optional[int] = None


class DocumentReviewAction(BaseModel):
    review_status: str  # ACCEPTED or CORRECTION_REQUIRED
    reviewer_notes: str = ""


class DocumentOut(BaseModel):
    id: int
    application_id: Optional[int] = None
    institution_name: str
    document_name: str
    document_type: str
    document_category: str = "INSTITUTIONAL_RECORDS"
    file_size: int
    mime_type: str
    uploaded_by: str
    version: int = 1
    is_latest: bool = True
    file_hash: Optional[str] = None
    processing_status: str = "COMPLETED"
    review_status: str = "PENDING"
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertOut(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    target_role: str
    institution_name: Optional[str] = None
    application_id: Optional[int] = None
    recipient_user_id: Optional[int] = None
    is_read: bool
    trigger_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardMetrics(BaseModel):
    total_applications: int
    in_progress: int
    due_soon: int
    overdue: int
    returned: int
    completed: int
    by_stage: Dict[str, int]
    by_type: Dict[str, int]
    evc_pending_count: int
    compliance_pending_count: int
    urgent_alerts: List[Dict[str, Any]]


# --- Officer Specific Schemas ---

class OfficerScrutinyRequest(BaseModel):
    run_type: str = "INITIAL"  # INITIAL or RE_SCRUTINY


class OfficerCorrectionRequest(BaseModel):
    reason: str = Field(min_length=5, description="Clear mandatory justification for returning application")
    deficiencies: Optional[List[Dict[str, Any]]] = None


class OfficerRescrutinyComplete(BaseModel):
    decision: str = "CLEARED"  # CLEARED or DEFICIENT
    remarks: str = ""


class OfficerAdvanceStage(BaseModel):
    target_stage: str
    reason: str = ""
    assigned_to: Optional[str] = None


class OfficerDecisionRequest(BaseModel):
    decision: str = "APPROVED"  # APPROVED or REJECTED
    remarks: str = ""
    approval_order_reference: Optional[str] = None


# --- Advanced GovTech Intelligence Schemas ---

class NextBestActionOut(BaseModel):
    action_code: str
    action_label: str
    target_role: str
    assigned_to: str
    reason: str
    urgency: str
    days_remaining: Optional[int] = None
    is_user_authorized: bool = False


class CandidateFieldOut(BaseModel):
    field_key: str
    field_label: str
    extracted_value: str
    provenance: str
    source_document: str
    evidence_quote: Optional[str] = None
    confidence_label: str
    target_form_field: Optional[str] = None


class ApplyExtractedFieldsRequest(BaseModel):
    fields: Dict[str, str]


class BottleneckAnalyticsOut(BaseModel):
    total_active_applications: int
    sla_compliance_rate: float
    total_sla_breaches: int
    stage_analytics: List[Dict[str, Any]]
    region_workload: Dict[str, int]
    officer_workload: Dict[str, int]
    identified_bottlenecks: List[str]


# --- Structured Scrutiny Findings Schemas ---

class ScrutinyFindingOut(BaseModel):
    id: int
    scrutiny_run_id: Optional[int] = None
    application_id: int
    document_id: Optional[int] = None
    rule_id: str
    document_type: str
    severity: str
    category: str
    description: str
    evidence_quote: Optional[str] = None
    source_document: Optional[str] = None
    page_number: Optional[int] = None
    expected_requirement: Optional[str] = None
    observed_value: Optional[str] = None
    suggested_action: Optional[str] = None
    is_provisional: bool = False
    source_reference: Optional[str] = None
    officer_disposition: str = "PENDING"
    disposition_notes: Optional[str] = None
    disposed_by: Optional[str] = None
    disposed_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScrutinyFindingDispositionUpdate(BaseModel):
    disposition: str = Field(description="Officer review disposition: ACCEPTED, WAIVED, CORRECTION_REQUESTED, or REJECTED")
    remarks: str = Field(min_length=3, description="Officer recorded remarks or legal justification for disposition")


class ScrutinyRunOut(BaseModel):
    id: int
    application_id: int
    run_type: str
    conducted_by: str
    status: str
    summary: str
    missing_docs: Optional[str] = None
    rule_results: Optional[str] = None
    ai_assisted: bool
    model_provider: Optional[str] = None
    model_name: Optional[str] = None
    ruleset_version: Optional[str] = None
    created_at: datetime
    findings: Optional[List[ScrutinyFindingOut]] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentReviewOut(BaseModel):
    document_id: int
    application_id: Optional[int] = None
    document_name: str
    document_type: str
    document_category: Optional[str] = "INSTITUTIONAL_RECORDS"
    file_size: int
    mime_type: str
    uploaded_by: str
    version: int = 1
    is_latest: bool = True
    file_hash: Optional[str] = None
    processing_status: str = "COMPLETED"
    review_status: str
    reviewer_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    ai_summary: Optional[str] = None
    ai_confidence: Optional[float] = None
    ai_analysis: Optional[Dict[str, Any]] = None
    findings: List[ScrutinyFindingOut] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StageRemarkCreate(BaseModel):
    stage: str = "SCRUTINY"
    comment_text: Optional[str] = None
    remark: Optional[str] = None
    action_type: Optional[str] = "REVIEW_COMMENT"
    visibility: Optional[str] = "APPLICANT_VISIBLE"
    document_reference: Optional[str] = None
    parent_remark_id: Optional[int] = None


class StageRemarkOut(BaseModel):
    id: int
    application_id: int
    stage: str
    author_name: str
    author_email: str
    author_role: str
    comment_text: str
    action_type: str = "REVIEW_COMMENT"
    visibility: str
    document_reference: Optional[str] = None
    parent_remark_id: Optional[int] = None
    is_resolved: bool = False
    resolution_notes: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegulatoryCategoryOut(BaseModel):
    id: int
    category_code: str
    title: str
    institution_type: str
    description: str
    required_documents_json: str
    workflow_sequence_json: str
    sla_days: int
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
