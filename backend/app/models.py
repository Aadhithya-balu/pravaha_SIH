from datetime import datetime, date
from sqlalchemy import String, DateTime, Date, ForeignKey, Text, Integer, Float, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(40), index=True)  # institution, officer, bureau, evc_expert, admin
    institution_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    region: Mapped[str] = mapped_column(String(80), default="Northern")
    designation: Mapped[str] = mapped_column(String(120), default="Authorized Official")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Institution(Base):
    __tablename__ = "institutions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    region: Mapped[str] = mapped_column(String(80), index=True)
    state: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(Text)
    contact_email: Mapped[str] = mapped_column(String(255))
    contact_phone: Mapped[str] = mapped_column(String(40), default="+91-11-29581000")
    institution_type: Mapped[str] = mapped_column(String(100), default="Engineering & Technology")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Application(Base):
    __tablename__ = "applications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    institution_name: Mapped[str] = mapped_column(String(200), index=True)
    application_type: Mapped[str] = mapped_column(String(100), index=True)
    current_stage: Mapped[str] = mapped_column(String(60), default="SCRUTINY", index=True)
    status: Mapped[str] = mapped_column(String(40), default="IN_PROGRESS", index=True)  # IN_PROGRESS, RETURNED, OVERDUE, COMPLETED, REJECTED
    assigned_to: Mapped[str] = mapped_column(String(255), default="Regional Officer")
    assigned_role: Mapped[str] = mapped_column(String(40), default="officer")
    region: Mapped[str] = mapped_column(String(80), default="Northern")
    submission_date: Mapped[date] = mapped_column(Date, default=date.today)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    deficiency_count: Mapped[int] = mapped_column(Integer, default=0)
    academic_year: Mapped[str] = mapped_column(String(20), default="2026-2027")
    form_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON structure containing detailed form fields
    decision_outcome: Mapped[str | None] = mapped_column(String(40), nullable=True)  # APPROVED, REJECTED
    decision_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    decision_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    decision_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    actor: Mapped[str] = mapped_column(String(255))
    actor_role: Mapped[str] = mapped_column(String(40), default="officer")
    action: Mapped[str] = mapped_column(String(80), index=True)
    from_stage: Mapped[str | None] = mapped_column(String(60), nullable=True)
    to_stage: Mapped[str | None] = mapped_column(String(60), nullable=True)
    details: Mapped[str] = mapped_column(Text, default="")
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    event_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Document(Base):
    __tablename__ = "documents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    institution_name: Mapped[str] = mapped_column(String(200), index=True)
    document_name: Mapped[str] = mapped_column(String(255))
    document_type: Mapped[str] = mapped_column(String(80), default="LEASE_DEED")
    file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), default="application/pdf")
    uploaded_by: Mapped[str] = mapped_column(String(255))
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    ai_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_findings: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    ai_confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_status: Mapped[str] = mapped_column(String(40), default="PENDING")  # PENDING, ACCEPTED, CORRECTION_REQUIRED
    reviewer_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScrutinyRun(Base):
    __tablename__ = "scrutiny_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    run_type: Mapped[str] = mapped_column(String(40), default="INITIAL")  # INITIAL, RE_SCRUTINY
    conducted_by: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(40), default="PASSED")  # PASSED, DEFICIENCIES_FOUND, PENDING_REVIEW
    summary: Mapped[str] = mapped_column(Text, default="")
    missing_docs: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON list
    rule_results: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON summary
    ai_assisted: Mapped[bool] = mapped_column(Boolean, default=False)
    model_provider: Mapped[str | None] = mapped_column(String(80), nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    ruleset_version: Mapped[str | None] = mapped_column(String(80), nullable=True, default="APH-2024-2027-v1.2")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ScrutinyFinding(Base):
    __tablename__ = "scrutiny_findings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    scrutiny_run_id: Mapped[int | None] = mapped_column(ForeignKey("scrutiny_runs.id"), nullable=True, index=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    document_id: Mapped[int | None] = mapped_column(ForeignKey("documents.id"), nullable=True, index=True)
    rule_id: Mapped[str] = mapped_column(String(80), index=True)  # e.g. APH-2024-LAND-TENURE
    document_type: Mapped[str] = mapped_column(String(80))
    severity: Mapped[str] = mapped_column(String(30), default="DEFICIENCY")  # INFO, WARNING, DEFICIENCY
    category: Mapped[str] = mapped_column(String(60), default="VALIDATION")  # MISSING_DOCUMENT, REGULATORY_NON_COMPLIANCE, INCONSISTENCY, ABSENT_EVIDENCE, EXTRACTION_FAILURE, PROCEDURAL_REQUIREMENT
    description: Mapped[str] = mapped_column(Text)
    evidence_quote: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_document: Mapped[str | None] = mapped_column(String(255), nullable=True)
    page_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_requirement: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_provisional: Mapped[bool] = mapped_column(Boolean, default=False)
    source_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    officer_disposition: Mapped[str] = mapped_column(String(40), default="PENDING")  # PENDING, ACCEPTED, WAIVED, CORRECTION_REQUESTED, REJECTED
    disposition_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    disposed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    disposed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CorrectionRequest(Base):
    __tablename__ = "correction_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    requested_by: Mapped[str] = mapped_column(String(255))
    reason: Mapped[str] = mapped_column(Text)
    deficiencies_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array of deficiencies
    status: Mapped[str] = mapped_column(String(40), default="PENDING")  # PENDING, RESUBMITTED, RESOLVED
    institution_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolved_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EVCVisit(Base):
    __tablename__ = "evc_visits"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), index=True)
    institution_name: Mapped[str] = mapped_column(String(200), index=True)
    committee_members: Mapped[str] = mapped_column(Text)
    scheduled_date: Mapped[date] = mapped_column(Date)
    visit_mode: Mapped[str] = mapped_column(String(40), default="PHYSICAL")  # PHYSICAL, VIRTUAL, HYBRID
    status: Mapped[str] = mapped_column(String(40), default="SCHEDULED")  # PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, POSTPONED
    report_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_by: Mapped[str] = mapped_column(String(255), default="Regional Officer")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ComplianceItem(Base):
    __tablename__ = "compliance_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    institution_name: Mapped[str] = mapped_column(String(200), index=True)
    application_id: Mapped[int | None] = mapped_column(ForeignKey("applications.id"), nullable=True, index=True)
    item_type: Mapped[str] = mapped_column(String(80), index=True)  # UNDERTAKING, LEASE_DOCUMENT, FIRE_SAFETY_NOC, etc.
    description: Mapped[str] = mapped_column(Text)
    due_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(40), default="PENDING", index=True)  # PENDING, SUBMITTED, VERIFIED, REJECTED, OVERDUE
    submission_evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    officer_comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(30), default="INFO", index=True)  # INFO, WARNING, HIGH, CRITICAL
    target_role: Mapped[str] = mapped_column(String(30), default="officer", index=True)  # all, officer, institution, bureau, evc_expert, admin
    institution_name: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    application_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    recipient_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    trigger_type: Mapped[str] = mapped_column(String(40), default="DEADLINE")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
