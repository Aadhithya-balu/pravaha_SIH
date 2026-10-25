from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


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


class ApplicationCreate(BaseModel):
    institution_name: Optional[str] = None  # Populated from user profile for institutions
    application_type: str = "Extension of Approval"
    region: Optional[str] = None
    due_date: Optional[date] = None
    notes: str = ""
    academic_year: str = "2026-2027"
    is_draft: bool = False


class ApplicationUpdate(BaseModel):
    application_type: Optional[str] = None
    academic_year: Optional[str] = None
    region: Optional[str] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class ApplicationResubmit(BaseModel):
    reason: str = Field(min_length=3)
    explanation: Optional[str] = None


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
    created_at: datetime
    updated_at: Optional[datetime] = None


class AuditEventOut(BaseModel):
    id: int
    application_id: int
    actor: str
    actor_role: str
    action: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    details: str
    created_at: datetime


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


class EVCVisitCreate(BaseModel):
    application_id: int
    committee_members: str
    scheduled_date: date
    visit_mode: str = "PHYSICAL"


class EVCVisitUpdate(BaseModel):
    status: str = "COMPLETED"
    report_summary: str = ""
    recommendations: str = ""


class EVCVisitOut(BaseModel):
    id: int
    application_id: int
    institution_name: str
    committee_members: str
    scheduled_date: date
    visit_mode: str
    status: str
    report_summary: Optional[str] = None
    recommendations: Optional[str] = None
    assigned_by: str
    created_at: datetime


class DocumentUploadCheck(BaseModel):
    document_name: str
    document_type: str = "LEASE_DEED"
    extracted_text: str
    application_id: Optional[int] = None


class DocumentReviewAction(BaseModel):
    review_status: str  # ACCEPTED or CORRECTION_REQUIRED
    reviewer_notes: str = ""


class AlertOut(BaseModel):
    id: int
    title: str
    message: str
    severity: str
    target_role: str
    institution_name: Optional[str] = None
    application_id: Optional[int] = None
    is_read: bool
    trigger_type: str
    created_at: datetime


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
