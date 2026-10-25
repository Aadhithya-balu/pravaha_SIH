import os
import csv
import io
import json
from datetime import date, timedelta, datetime, timezone
from uuid import uuid4
from typing import Optional, List, Any, Dict

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .db import Base, engine, get_db, run_schema_migrations
from .models import (
    User, Institution, Application, AuditEvent, Document, EVCVisit,
    ComplianceItem, Alert, ScrutinyRun, ScrutinyFinding, CorrectionRequest
)
from .schemas import (
    LoginRequest, UserOut, ApplicationCreate, ApplicationPatch, ApplicationTransition,
    ApplicationResubmit, ApplicationOut, AuditEventOut, ComplianceCreate,
    ComplianceEvidenceSubmit, ComplianceVerify, ComplianceOut, EVCVisitCreate,
    EVCVisitUpdate, EVCVisitOut, DocumentUploadCheck, DocumentReviewAction,
    AlertOut, DashboardMetrics, OfficerScrutinyRequest, OfficerCorrectionRequest,
    OfficerRescrutinyComplete, OfficerAdvanceStage, OfficerDecisionRequest
)
from .workflow import (
    get_available_transitions, validate_transition, TRANSITION_RULES,
    WORKFLOW_STAGES, APPLICATION_STATUSES
)
from .ai_service import review_document
from .doc_extractor import process_and_store_upload
from .scrutiny import execute_scrutiny_pipeline, normalize_application_route, ROUTE_EOA, ROUTE_NEW_PROGRAMME
from .escalation import run_escalation_engine
from .seed import seed_database, password_hash


SECRET = os.getenv("SECRET_KEY", "aicte-sih-prototype-secure-token-secret-2026")
ALGORITHM = "HS256"
bearer = HTTPBearer(auto_error=False)


def password_verify(password: str, stored: str) -> bool:
    try:
        import hashlib, hmac
        salt_hex, digest_hex = stored.split(":", 1)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), 310000).hex()
        return hmac.compare_digest(actual, digest_hex)
    except Exception:
        return False


app = FastAPI(
    title="Pravaha — AICTE Approval Workflow & Scrutiny Engine",
    description="Full-stack Backend, Workflow Engine, AI Scrutiny and Officer Portal for AICTE Regulatory Approvals.",
    version="2.0.0"
)

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# --- Authentication & Authorization Dependencies ---

def get_current_user(creds: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required. Please log in.")
    try:
        payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
        uid = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid or expired access token.")
    
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User account is deactivated or not found.")
    return user


def require_roles(allowed_roles: list[str]):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles and user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Requires one of roles: {allowed_roles}. Current role: '{user.role}'."
            )
        return user
    return role_checker


# Role-specific guards
officer_or_admin = require_roles(["officer", "bureau", "admin"])
bureau_or_admin = require_roles(["bureau", "admin"])
evc_or_officer = require_roles(["evc_expert", "officer", "admin"])
admin_only = require_roles(["admin"])


@app.on_event("startup")
def startup():
    Base.metadata.create_all(engine)
    run_schema_migrations(engine)
    with next(get_db()) as db:
        seed_database(db)


# --- Health & Auth Endpoints ---

@app.get("/api/health")
@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "service": "Pravaha AICTE Regulatory Workflow & Scrutiny Engine",
        "timestamp": datetime.utcnow().isoformat(),
        "routes_supported": ["Extension of Approval (EoA)", "New Programme / Level"]
    }


@app.post("/api/auth/login")
@app.post("/api/v1/auth/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower().strip()).first()
    if not user or not password_verify(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials. Please verify email and password.")

    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "name": user.name,
        "institution_name": user.institution_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }
    access_token = jwt.encode(token_data, SECRET, algorithm=ALGORITHM)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "name": user.name,
        "email": user.email,
        "institution_name": user.institution_name,
        "region": user.region,
        "designation": user.designation
    }


@app.get("/api/auth/me", response_model=UserOut)
@app.get("/api/v1/auth/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


# --- Dashboard Analytics ---

@app.get("/api/dashboard", response_model=DashboardMetrics)
@app.get("/api/v1/dashboard", response_model=DashboardMetrics)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Application)
    cq = db.query(ComplianceItem)

    # Institution data isolation
    if user.role == "institution":
        q = q.filter(Application.institution_name == user.institution_name)
        cq = cq.filter(ComplianceItem.institution_name == user.institution_name)
    elif user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(Application.region == user.region)

    apps = q.all()
    today = date.today()

    total_applications = len(apps)
    in_progress = sum(1 for a in apps if a.status == "IN_PROGRESS")
    overdue = sum(1 for a in apps if a.status == "OVERDUE" or (a.due_date and a.due_date < today and a.status != "COMPLETED"))
    due_soon = sum(1 for a in apps if a.due_date and today <= a.due_date <= today + timedelta(days=7) and a.status not in ["COMPLETED", "REJECTED"])
    returned = sum(1 for a in apps if a.status == "RETURNED")
    completed = sum(1 for a in apps if a.status == "COMPLETED")

    by_stage = {stage: 0 for stage in WORKFLOW_STAGES}
    by_type = {}
    for a in apps:
        by_stage[a.current_stage] = by_stage.get(a.current_stage, 0) + 1
        by_type[a.application_type] = by_type.get(a.application_type, 0) + 1

    evc_pending_count = sum(1 for a in apps if a.current_stage in ["EVC_PENDING", "EVC_SCHEDULED"])
    compliance_pending_count = cq.filter(ComplianceItem.status.in_(["PENDING", "OVERDUE"])).count()

    # Fetch top urgent alerts
    aq = db.query(Alert).filter(Alert.severity.in_(["HIGH", "CRITICAL"]))
    if user.role == "institution":
        aq = aq.filter(or_(Alert.target_role == "institution", Alert.institution_name == user.institution_name))
    alerts_data = [
        {"id": al.id, "title": al.title, "message": al.message, "severity": al.severity, "created_at": al.created_at.isoformat()}
        for al in aq.order_by(desc(Alert.created_at)).limit(5).all()
    ]

    return {
        "total_applications": total_applications,
        "in_progress": in_progress,
        "due_soon": due_soon,
        "overdue": overdue,
        "returned": returned,
        "completed": completed,
        "by_stage": by_stage,
        "by_type": by_type,
        "evc_pending_count": evc_pending_count,
        "compliance_pending_count": compliance_pending_count,
        "urgent_alerts": alerts_data
    }


# ==============================================================================
# --- Institution-Facing Application APIs ---
# ==============================================================================

@app.get("/api/applications", response_model=List[ApplicationOut])
@app.get("/api/v1/applications", response_model=List[ApplicationOut])
def list_applications(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    app_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Application)

    # Server-side institution data isolation
    if user.role == "institution":
        q = q.filter(Application.institution_name == user.institution_name)
    elif user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(or_(Application.region == user.region, Application.assigned_to == user.name))

    if stage:
        q = q.filter(Application.current_stage == stage)
    if status:
        q = q.filter(Application.status == status)
    if app_type:
        q = q.filter(Application.application_type.ilike(f"%{app_type}%"))
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(Application.reference.ilike(s), Application.institution_name.ilike(s)))

    return q.order_by(desc(Application.created_at)).all()


@app.post("/api/applications", response_model=ApplicationOut, status_code=201)
@app.post("/api/v1/applications", response_model=ApplicationOut, status_code=201)
def create_application(
    req: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if user.role == "institution":
        institution_name = user.institution_name
        region = user.region
    else:
        if not req.institution_name or not req.institution_name.strip():
            raise HTTPException(status_code=400, detail="Institution name is required.")
        institution_name = req.institution_name.strip()
        region = req.region or "Northern"

    reference = f"AICTE-{date.today().year}-{uuid4().hex[:6].upper()}"
    default_due = req.due_date or (date.today() + timedelta(days=14))

    # Serialize form_data if passed as dict
    form_data_str = None
    if req.form_data:
        form_data_str = json.dumps(req.form_data) if isinstance(req.form_data, dict) else str(req.form_data)

    app_record = Application(
        reference=reference,
        institution_name=institution_name,
        application_type=req.application_type,
        current_stage="SCRUTINY",
        status="IN_PROGRESS",
        assigned_to="Regional Officer",
        assigned_role="officer",
        region=region,
        submission_date=date.today(),
        due_date=default_due,
        notes=req.notes or f"Application registered for {req.application_type} via online portal.",
        form_data=form_data_str,
        academic_year=req.academic_year,
        created_by=user.id
    )
    db.add(app_record)
    db.flush()

    audit = AuditEvent(
        application_id=app_record.id,
        actor=user.email,
        actor_role=user.role,
        action="SUBMITTED",
        from_stage=None,
        to_stage="SCRUTINY",
        details=f"Application registered by {user.name} ({user.role}) for {req.application_type}."
    )
    db.add(audit)

    # Trigger officer alert
    db.add(Alert(
        title=f"New Application Submitted: {app_record.reference}",
        message=f"{institution_name} filed '{req.application_type}' for academic year {req.academic_year}.",
        severity="INFO",
        target_role="officer",
        institution_name=institution_name,
        application_id=app_record.id,
        trigger_type="APPLICATION_SUBMITTED"
    ))

    db.commit()
    db.refresh(app_record)
    return app_record


@app.get("/api/applications/{aid}")
@app.get("/api/v1/applications/{aid}")
def get_application_details(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. You can only inspect your own institution's cases.")

    # Fetch transitions available to this role
    transitions = get_available_transitions(a.current_stage, user.role, a.application_type)

    # Fetch audit events
    audit_history = db.query(AuditEvent).filter(AuditEvent.application_id == aid).order_by(desc(AuditEvent.created_at)).all()

    # Fetch attached documents
    docs = db.query(Document).filter(Document.application_id == aid).order_by(desc(Document.created_at)).all()

    # Fetch EVC visits if any
    evc = db.query(EVCVisit).filter(EVCVisit.application_id == aid).order_by(desc(EVCVisit.created_at)).first()

    # Fetch Scrutiny Runs & Findings
    scrutiny_runs = db.query(ScrutinyRun).filter(ScrutinyRun.application_id == aid).order_by(desc(ScrutinyRun.created_at)).all()
    scrutiny_findings = db.query(ScrutinyFinding).filter(ScrutinyFinding.application_id == aid).order_by(desc(ScrutinyFinding.created_at)).all()

    # Fetch Correction Requests
    correction_requests = db.query(CorrectionRequest).filter(CorrectionRequest.application_id == aid).order_by(desc(CorrectionRequest.created_at)).all()

    return {
        "application": a,
        "available_transitions": transitions,
        "audit_history": audit_history,
        "documents": docs,
        "evc_visit": evc,
        "scrutiny_runs": scrutiny_runs,
        "scrutiny_findings": scrutiny_findings,
        "correction_requests": correction_requests
    }


@app.patch("/api/v1/applications/{aid}", response_model=ApplicationOut)
def patch_application(
    aid: int,
    req: ApplicationPatch,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Allows applicant institution or officer to update draft form fields or notes."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. Cannot modify another institution's application.")

    if a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Cannot edit an application that has already reached final decision.")

    if req.notes is not None:
        a.notes = req.notes
    if req.due_date is not None:
        a.due_date = req.due_date
    if req.academic_year is not None:
        a.academic_year = req.academic_year
    if req.form_data is not None:
        a.form_data = json.dumps(req.form_data) if isinstance(req.form_data, dict) else str(req.form_data)

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="APPLICATION_UPDATED",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Application metadata / form fields updated by {user.name}."
    ))

    db.commit()
    db.refresh(a)
    return a


@app.post("/api/v1/applications/{aid}/documents")
async def upload_application_document(
    aid: int,
    file: UploadFile = File(...),
    document_type: str = Form("LEASE_DEED"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Institution uploads a document linked to an application.
    Validates file type & size, extracts text (PDF/DOCX/TXT), runs AI screening, and saves Document.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. Cannot upload documents for another institution's case.")

    # Ingest file safely via doc_extractor
    upload_res = await process_and_store_upload(file)

    # Run AI / deterministic document screening
    ai_result = await review_document(
        document_name=upload_res["original_filename"],
        document_type=document_type,
        text=upload_res["extracted_text"]
    )

    doc = Document(
        application_id=aid,
        institution_name=a.institution_name,
        document_name=upload_res["original_filename"],
        document_type=document_type,
        file_path=upload_res["stored_filepath"],
        file_size=upload_res["file_size"],
        mime_type=upload_res["mime_type"],
        uploaded_by=user.email,
        extracted_text=upload_res["extracted_text"][:10000],
        ai_summary=ai_result.get("summary"),
        ai_findings=json.dumps(ai_result),
        ai_confidence=float(ai_result.get("confidence_score", 0.9)),
        review_status="PENDING"
    )
    db.add(doc)

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="DOC_UPLOADED",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Uploaded '{upload_res['original_filename']}' ({document_type}, {round(upload_res['file_size']/1024, 1)} KB)."
    ))

    db.commit()
    db.refresh(doc)

    return {
        "document": {
            "id": doc.id,
            "application_id": doc.application_id,
            "document_name": doc.document_name,
            "document_type": doc.document_type,
            "file_size": doc.file_size,
            "review_status": doc.review_status,
            "created_at": doc.created_at.isoformat()
        },
        "ai_analysis": ai_result
    }


@app.post("/api/v1/applications/{aid}/submit", response_model=ApplicationOut)
def submit_application(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Institution formally submits application for scrutiny."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. Cannot submit another institution's case.")

    prev_stage = a.current_stage
    a.current_stage = "SCRUTINY"
    a.status = "IN_PROGRESS"
    a.submission_date = date.today()

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="SUBMITTED",
        from_stage=prev_stage,
        to_stage="SCRUTINY",
        details="Application formally submitted by institution for regulatory scrutiny."
    ))

    db.add(Alert(
        title=f"Application Submitted: {a.reference}",
        message=f"{a.institution_name} submitted case for initial scrutiny.",
        severity="INFO",
        target_role="officer",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="APPLICATION_SUBMITTED"
    ))

    db.commit()
    db.refresh(a)
    return a


@app.post("/api/v1/applications/{aid}/resubmit", response_model=ApplicationOut)
def resubmit_application(
    aid: int,
    req: ApplicationResubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Institution resubmits application after rectifying deficiencies."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. Cannot resubmit another institution's case.")

    if a.current_stage != "RETURNED_FOR_CLARIFICATION":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot resubmit application from stage '{a.current_stage}'. Application must be in 'RETURNED_FOR_CLARIFICATION'."
        )

    prev_stage = a.current_stage
    a.current_stage = "RE_SCRUTINY"
    a.status = "IN_PROGRESS"
    a.assigned_to = "Regional Officer"

    # Resolve pending correction request if any
    pending_cr = db.query(CorrectionRequest).filter(
        CorrectionRequest.application_id == aid,
        CorrectionRequest.status == "PENDING"
    ).order_by(desc(CorrectionRequest.created_at)).first()
    if pending_cr:
        pending_cr.status = "RESUBMITTED"
        pending_cr.institution_response = req.response_text.strip()
        pending_cr.response_submitted_at = datetime.utcnow()

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="RESUBMIT",
        from_stage=prev_stage,
        to_stage="RE_SCRUTINY",
        details=f"Institutional Clarification: {req.response_text.strip()}"
    ))

    db.add(Alert(
        title=f"Application Resubmitted: {a.reference}",
        message=f"{a.institution_name} responded to correction request and resubmitted case for re-scrutiny.",
        severity="INFO",
        target_role="officer",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="APPLICATION_RESUBMITTED"
    ))

    db.commit()
    db.refresh(a)
    return a


@app.get("/api/v1/applications/{aid}/timeline", response_model=List[AuditEventOut])
@app.get("/api/applications/{aid}/audit", response_model=List[AuditEventOut])
def get_application_timeline(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and a.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden.")
    return db.query(AuditEvent).filter(AuditEvent.application_id == aid).order_by(desc(AuditEvent.created_at)).all()


@app.post("/api/applications/{aid}/transition", response_model=ApplicationOut)
def transition_application(
    aid: int,
    req: ApplicationTransition,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Generic workflow state transition endpoint."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution":
        if a.institution_name != user.institution_name:
            raise HTTPException(status_code=403, detail="Forbidden. Cannot modify other institutions' records.")
        if req.action.upper() != "RESUBMIT":
            raise HTTPException(status_code=403, detail="Institutions are only permitted to resubmit returned cases.")

    rule = validate_transition(
        current_stage=a.current_stage,
        action=req.action,
        user_role=user.role,
        reason=req.reason,
        application_type=a.application_type
    )

    prev_stage = a.current_stage
    new_stage = rule["target_stage"]
    new_status = rule["target_status"]

    a.current_stage = new_stage
    a.status = new_status
    if req.assigned_to:
        a.assigned_to = req.assigned_to
    else:
        a.assigned_to = rule.get("assigned_to", a.assigned_to)

    details = rule["description"]
    if req.reason.strip():
        details += f" | Justification: {req.reason.strip()}"

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action=req.action.upper(),
        from_stage=prev_stage,
        to_stage=new_stage,
        details=details
    ))

    # If returned, notify institution
    if new_status == "RETURNED":
        a.deficiency_count += 1
        db.add(Alert(
            title=f"Application Returned: {a.reference}",
            message=f"Case returned by {user.name}: {req.reason.strip()}",
            severity="WARNING",
            target_role="institution",
            institution_name=a.institution_name,
            application_id=aid,
            trigger_type="STAGE_CHANGE"
        ))

    db.commit()
    db.refresh(a)
    return a


# ==============================================================================
# --- Officer-Facing Workflow & Scrutiny APIs ---
# ==============================================================================

@app.get("/api/v1/officer/applications")
def officer_list_applications(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    app_type: Optional[str] = None,
    region: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """Officer queue for inspecting institutional applications."""
    q = db.query(Application)

    if user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(Application.region == user.region)
    elif region:
        q = q.filter(Application.region == region)

    if stage:
        q = q.filter(Application.current_stage == stage)
    if status:
        q = q.filter(Application.status == status)
    if app_type:
        q = q.filter(Application.application_type.ilike(f"%{app_type}%"))
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(Application.reference.ilike(s), Application.institution_name.ilike(s)))

    return q.order_by(desc(Application.created_at)).all()


@app.get("/api/v1/officer/applications/{aid}")
def officer_get_application(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """Detailed view for scrutinizing officer with scrutiny runs and correction history."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    transitions = get_available_transitions(a.current_stage, user.role, a.application_type)
    audit_history = db.query(AuditEvent).filter(AuditEvent.application_id == aid).order_by(desc(AuditEvent.created_at)).all()
    docs = db.query(Document).filter(Document.application_id == aid).order_by(desc(Document.created_at)).all()
    evc = db.query(EVCVisit).filter(EVCVisit.application_id == aid).order_by(desc(EVCVisit.created_at)).first()
    scrutiny_runs = db.query(ScrutinyRun).filter(ScrutinyRun.application_id == aid).order_by(desc(ScrutinyRun.created_at)).all()
    scrutiny_findings = db.query(ScrutinyFinding).filter(ScrutinyFinding.application_id == aid).order_by(desc(ScrutinyFinding.created_at)).all()
    correction_requests = db.query(CorrectionRequest).filter(CorrectionRequest.application_id == aid).order_by(desc(CorrectionRequest.created_at)).all()

    return {
        "application": a,
        "available_transitions": transitions,
        "audit_history": audit_history,
        "documents": docs,
        "evc_visit": evc,
        "scrutiny_runs": scrutiny_runs,
        "scrutiny_findings": scrutiny_findings,
        "correction_requests": correction_requests
    }


@app.post("/api/v1/officer/applications/{aid}/scrutiny")
async def officer_run_scrutiny(
    aid: int,
    req: OfficerScrutinyRequest = OfficerScrutinyRequest(),
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Executes automated regulatory scrutiny against APH 2024-2027 route requirements.
    Extracts text, checks mandatory documents, evaluates rules, runs AI review, and persists findings.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    res = await execute_scrutiny_pipeline(
        application_id=aid,
        db=db,
        actor_email=user.email,
        run_type=req.run_type
    )

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="SCRUTINY_RUN",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Automated regulatory scrutiny completed. Found {res['deficiency_count']} deficiency/deficiencies."
    ))
    db.commit()

    return res


@app.post("/api/v1/officer/applications/{aid}/request-corrections")
def officer_request_corrections(
    aid: int,
    req: OfficerCorrectionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Officer returns application to institution with mandatory cited reason and deficiency memo.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    rule = validate_transition(
        current_stage=a.current_stage,
        action="RETURN",
        user_role=user.role,
        reason=req.reason,
        application_type=a.application_type
    )

    prev_stage = a.current_stage
    a.current_stage = "RETURNED_FOR_CLARIFICATION"
    a.status = "RETURNED"
    a.assigned_to = "Institution"
    a.deficiency_count += 1

    # Persist CorrectionRequest
    cr = CorrectionRequest(
        application_id=aid,
        requested_by=user.email,
        reason=req.reason.strip(),
        deficiencies_json=json.dumps(req.deficiencies or []),
        status="PENDING",
        created_at=datetime.utcnow()
    )
    db.add(cr)

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="RETURN",
        from_stage=prev_stage,
        to_stage="RETURNED_FOR_CLARIFICATION",
        details=f"Deficiency Memo / Clarification Request: {req.reason.strip()}"
    ))

    db.add(Alert(
        title=f"Action Required: Clarifications Demanded for {a.reference}",
        message=f"Regional Officer {user.name} returned your application for rectification: {req.reason.strip()}",
        severity="WARNING",
        target_role="institution",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="CORRECTION_REQUESTED"
    ))

    db.commit()
    db.refresh(a)
    return {
        "application": a,
        "correction_request": cr
    }


@app.post("/api/v1/officer/applications/{aid}/complete-rescrutiny")
def officer_complete_rescrutiny(
    aid: int,
    req: OfficerRescrutinyComplete,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Officer completes review of institutional resubmission.
    If CLEARED -> Advances to COMPLIANCE_PENDING (for EoA) or EVC_PENDING (for New Programme).
    If DEFICIENT -> Returns for clarification or forwards to committee.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if a.current_stage not in ["RE_SCRUTINY", "SCRUTINY"]:
        raise HTTPException(
            status_code=400,
            detail=f"Application is in stage '{a.current_stage}'. Re-scrutiny disposition requires 'RE_SCRUTINY' or 'SCRUTINY'."
        )

    prev_stage = a.current_stage
    is_new_prog = "new" in a.application_type.lower() or "programme" in a.application_type.lower()

    if req.decision.upper() == "CLEARED":
        # Resolve correction requests
        pending_crs = db.query(CorrectionRequest).filter(
            CorrectionRequest.application_id == aid,
            CorrectionRequest.status.in_(["PENDING", "RESUBMITTED"])
        ).all()
        for cr in pending_crs:
            cr.status = "RESOLVED"
            cr.resolved_at = datetime.utcnow()
            cr.resolved_by = user.email

        # Route-aware next stage:
        # EoA goes to COMPLIANCE_PENDING; New Programme mandatorily goes to EVC_PENDING
        next_stage = "EVC_PENDING" if is_new_prog else "COMPLIANCE_PENDING"
        a.current_stage = next_stage
        a.status = "IN_PROGRESS"
        a.deficiency_count = 0

        details = f"Re-scrutiny cleared by {user.name}. Case routed to {next_stage}."
        if req.remarks:
            details += f" Remarks: {req.remarks}"

        db.add(AuditEvent(
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="RESCRUTINY_CLEARED",
            from_stage=prev_stage,
            to_stage=next_stage,
            details=details
        ))

        db.add(Alert(
            title=f"Re-Scrutiny Cleared: {a.reference}",
            message=f"Deficiencies resolved. Application advanced to {next_stage}.",
            severity="INFO",
            target_role="institution",
            institution_name=a.institution_name,
            application_id=aid,
            trigger_type="STAGE_CHANGE"
        ))

    else:
        # Re-scrutiny failed / still deficient
        a.current_stage = "RETURNED_FOR_CLARIFICATION"
        a.status = "RETURNED"
        a.deficiency_count += 1
        reason = req.remarks or "Re-scrutiny revealed outstanding deficiencies requiring further resolution."

        cr = CorrectionRequest(
            application_id=aid,
            requested_by=user.email,
            reason=reason,
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(cr)

        db.add(AuditEvent(
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="RETURN",
            from_stage=prev_stage,
            to_stage="RETURNED_FOR_CLARIFICATION",
            details=f"Re-scrutiny Deficiencies: {reason}"
        ))

        db.add(Alert(
            title=f"Re-Scrutiny Deficiencies Flagged: {a.reference}",
            message=reason,
            severity="WARNING",
            target_role="institution",
            institution_name=a.institution_name,
            application_id=aid,
            trigger_type="CORRECTION_REQUESTED"
        ))

    db.commit()
    db.refresh(a)
    return a


@app.post("/api/v1/officer/applications/{aid}/advance", response_model=ApplicationOut)
def officer_advance_stage(
    aid: int,
    req: OfficerAdvanceStage,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """Advances application to a valid next stage in the regulatory workflow."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    # Find matching action that achieves target_stage
    stage_rules = TRANSITION_RULES.get(a.current_stage, {})
    matched_action = None
    for action, rule in stage_rules.items():
        if rule["target_stage"] == req.target_stage:
            if user.role in rule["allowed_roles"] or user.role == "admin":
                matched_action = action
                break

    if not matched_action:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance from stage '{a.current_stage}' to '{req.target_stage}'. Transition not permitted for role '{user.role}'."
        )

    return transition_application(
        aid=aid,
        req=ApplicationTransition(
            action=matched_action,
            reason=req.reason,
            assigned_to=req.assigned_to
        ),
        db=db,
        user=user
    )


@app.post("/api/v1/officer/applications/{aid}/decision", response_model=ApplicationOut)
def officer_record_decision(
    aid: int,
    req: OfficerDecisionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Records statutory decision (APPROVED or REJECTED) on application.
    Generates approval order or speaking order of rejection.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    dec = req.decision.upper().strip()
    if dec not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Decision must be 'APPROVED' or 'REJECTED'.")

    prev_stage = a.current_stage
    a.current_stage = "COMPLETED"
    a.status = "COMPLETED" if dec == "APPROVED" else "REJECTED"
    a.decision_outcome = dec
    a.decision_remarks = req.remarks or f"Statutory order issued by {user.name} ({user.designation})."
    a.decision_by = user.email
    a.decision_date = datetime.utcnow()
    a.assigned_to = "Closed"

    order_ref = req.approval_order_reference or f"AICTE/AB/{date.today().year}/{a.reference}"

    db.add(AuditEvent(
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action=f"DECISION_{dec}",
        from_stage=prev_stage,
        to_stage="COMPLETED",
        details=f"Statutory Verdict: {dec} | Order Ref: {order_ref} | Remarks: {a.decision_remarks}"
    ))

    db.add(Alert(
        title=f"AICTE Decision Order Issued: {dec} ({a.reference})",
        message=f"Application has been {dec.lower()}. Order Ref: {order_ref}. Remarks: {a.decision_remarks}",
        severity="INFO" if dec == "APPROVED" else "HIGH",
        target_role="all",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="FINAL_DECISION"
    ))

    db.commit()
    db.refresh(a)
    return a


# ==============================================================================
# --- Notifications & Alerts APIs ---
# ==============================================================================

@app.get("/api/notifications", response_model=List[AlertOut])
@app.get("/api/v1/notifications", response_model=List[AlertOut])
@app.get("/api/alerts", response_model=List[AlertOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Alert)
    if user.role == "institution":
        q = q.filter(or_(Alert.target_role == "institution", Alert.institution_name == user.institution_name))
    elif user.role != "admin":
        q = q.filter(or_(Alert.target_role == user.role, Alert.target_role == "all", Alert.target_role == "officer"))

    if unread_only:
        q = q.filter(Alert.is_read == False)

    return q.order_by(desc(Alert.created_at)).all()


@app.patch("/api/notifications/{aid}/read")
@app.patch("/api/v1/notifications/{aid}/read")
@app.post("/api/alerts/{aid}/read")
def mark_notification_read(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    al = db.get(Alert, aid)
    if not al:
        raise HTTPException(status_code=404, detail="Notification not found.")
    al.is_read = True
    db.commit()
    return {"id": aid, "is_read": True}


# ==============================================================================
# --- Supporting Working Services (Documents, Compliance, EVC, Reports) ---
# ==============================================================================

@app.get("/api/documents")
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Document)
    if user.role == "institution":
        q = q.filter(Document.institution_name == user.institution_name)
    return q.order_by(desc(Document.created_at)).all()


@app.post("/api/documents/check-text")
async def check_document_text(req: DocumentUploadCheck, user: User = Depends(get_current_user)):
    """Analyze provided document text using AI service (LLM or deterministic fallback)."""
    return await review_document(
        document_name=req.document_name,
        document_type=req.document_type,
        text=req.extracted_text
    )


@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    document_type: str = Form("LEASE_DEED"),
    application_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """General document upload supporting PDF, DOCX, TXT."""
    upload_res = await process_and_store_upload(file)

    ai_result = await review_document(
        document_name=upload_res["original_filename"],
        document_type=document_type,
        text=upload_res["extracted_text"]
    )

    institution_name = user.institution_name or "Applicant Institution"
    if application_id:
        app_rec = db.get(Application, application_id)
        if app_rec:
            institution_name = app_rec.institution_name

    doc = Document(
        application_id=application_id,
        institution_name=institution_name,
        document_name=upload_res["original_filename"],
        document_type=document_type,
        file_path=upload_res["stored_filepath"],
        file_size=upload_res["file_size"],
        mime_type=upload_res["mime_type"],
        uploaded_by=user.email,
        extracted_text=upload_res["extracted_text"][:10000],
        ai_summary=ai_result.get("summary"),
        ai_findings=json.dumps(ai_result),
        ai_confidence=float(ai_result.get("confidence_score", 0.9)),
        review_status="PENDING"
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return {
        "document": doc,
        "ai_analysis": ai_result
    }


@app.post("/api/documents/{did}/review")
def review_document_action(
    did: int,
    req: DocumentReviewAction,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    doc = db.get(Document, did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found.")

    if req.review_status not in ["ACCEPTED", "CORRECTION_REQUIRED"]:
        raise HTTPException(status_code=400, detail="Review status must be 'ACCEPTED' or 'CORRECTION_REQUIRED'.")

    doc.review_status = req.review_status
    doc.reviewer_notes = req.reviewer_notes
    doc.reviewed_by = user.email
    doc.reviewed_at = datetime.utcnow()

    if doc.application_id:
        db.add(AuditEvent(
            application_id=doc.application_id,
            actor=user.email,
            actor_role=user.role,
            action=f"DOC_{req.review_status}",
            details=f"Document '{doc.document_name}' marked as {req.review_status}. Remarks: {req.reviewer_notes}"
        ))

    db.commit()
    db.refresh(doc)
    return doc


@app.get("/api/compliance", response_model=List[ComplianceOut])
def list_compliance(
    status: Optional[str] = None,
    item_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(ComplianceItem)
    if user.role == "institution":
        q = q.filter(ComplianceItem.institution_name == user.institution_name)
    if status:
        q = q.filter(ComplianceItem.status == status)
    if item_type:
        q = q.filter(ComplianceItem.item_type == item_type)
    return q.order_by(ComplianceItem.due_date).all()


@app.post("/api/compliance", response_model=ComplianceOut, status_code=201)
def create_compliance(req: ComplianceCreate, db: Session = Depends(get_db), user: User = Depends(officer_or_admin)):
    c = ComplianceItem(
        institution_name=req.institution_name,
        application_id=req.application_id,
        item_type=req.item_type,
        description=req.description,
        due_date=req.due_date,
        status="PENDING"
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@app.post("/api/compliance/{cid}/submit-evidence")
def submit_compliance_evidence(
    cid: int,
    req: ComplianceEvidenceSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    c = db.get(ComplianceItem, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Compliance requirement not found.")

    if user.role == "institution" and c.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden. Cannot submit evidence for another institution.")

    c.submission_evidence = req.submission_evidence.strip()
    c.submitted_at = datetime.utcnow()
    c.status = "SUBMITTED"

    db.add(Alert(
        title=f"Compliance Evidence Submitted: {c.institution_name}",
        message=f"{c.institution_name} submitted evidence for '{c.item_type}'. Scrutiny verification required.",
        severity="INFO",
        target_role="officer",
        institution_name=c.institution_name,
        application_id=c.application_id,
        trigger_type="COMPLIANCE"
    ))

    db.commit()
    db.refresh(c)
    return c


@app.post("/api/compliance/{cid}/verify")
def verify_compliance(
    cid: int,
    req: ComplianceVerify,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    c = db.get(ComplianceItem, cid)
    if not c:
        raise HTTPException(status_code=404, detail="Compliance item not found.")

    if req.action == "VERIFY":
        c.status = "VERIFIED"
    elif req.action == "REJECT":
        c.status = "REJECTED"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'VERIFY' or 'REJECT'.")

    c.verified_by = user.email
    c.verified_at = datetime.utcnow()
    c.officer_comments = req.officer_comments

    db.commit()
    return {"id": cid, "status": c.status, "verified_by": c.verified_by, "comments": c.officer_comments}


@app.get("/api/evc", response_model=List[EVCVisitOut])
def list_evc_visits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(EVCVisit)
    if user.role == "institution":
        q = q.filter(EVCVisit.institution_name == user.institution_name)
    return q.order_by(EVCVisit.scheduled_date).all()


@app.post("/api/evc", response_model=EVCVisitOut, status_code=201)
def schedule_evc_visit(
    req: EVCVisitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    app_rec = db.get(Application, req.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    visit = EVCVisit(
        application_id=req.application_id,
        institution_name=app_rec.institution_name,
        committee_members=req.committee_members,
        scheduled_date=req.scheduled_date,
        visit_mode=req.visit_mode,
        status="SCHEDULED",
        assigned_by=user.email
    )
    db.add(visit)

    if app_rec.current_stage == "EVC_PENDING":
        app_rec.current_stage = "EVC_SCHEDULED"
        db.add(AuditEvent(
            application_id=app_rec.id,
            actor=user.email,
            actor_role=user.role,
            action="SCHEDULE_EVC",
            from_stage="EVC_PENDING",
            to_stage="EVC_SCHEDULED",
            details=f"EVC visit scheduled on {req.scheduled_date}. Panel: {req.committee_members}"
        ))

    db.commit()
    db.refresh(visit)
    return visit


@app.post("/api/evc/{vid}/update")
def update_evc_visit(
    vid: int,
    req: EVCVisitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    v = db.get(EVCVisit, vid)
    if not v:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    v.status = req.status
    if req.report_summary:
        v.report_summary = req.report_summary
    if req.recommendations:
        v.recommendations = req.recommendations

    app_rec = db.get(Application, v.application_id)
    if app_rec and req.status == "COMPLETED" and app_rec.current_stage == "EVC_SCHEDULED":
        app_rec.current_stage = "EVC_COMPLETED"
        db.add(AuditEvent(
            application_id=app_rec.id,
            actor=user.email,
            actor_role=user.role,
            action="COMPLETE_EVC",
            from_stage="EVC_SCHEDULED",
            to_stage="EVC_COMPLETED",
            details=f"EVC visit conducted. Findings: {req.report_summary}"
        ))

    db.commit()
    db.refresh(v)
    return v


@app.post("/api/escalation/run-check")
def trigger_escalation_check(db: Session = Depends(get_db), user: User = Depends(officer_or_admin)):
    """Manual trigger endpoint for SIH demo to evaluate deadlines and trigger alerts."""
    result = run_escalation_engine(db)
    return result


@app.get("/api/reports/export-csv")
def export_csv(
    report_type: str = Query("applications"),
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """Generates an RFC-compliant CSV report with formula injection sanitization."""
    if report_type not in ["applications", "compliance"]:
        raise HTTPException(status_code=400, detail="report_type must be 'applications' or 'compliance'.")
    output = io.StringIO()
    writer = csv.writer(output)

    def sanitize_csv_cell(val: Any) -> str:
        s = str(val or "")
        if s and s[0] in ("=", "+", "-", "@", "\t", "\r"):
            return f"'{s}"
        return s

    if report_type == "applications":
        writer.writerow(["Reference", "Institution Name", "Type", "Stage", "Status", "Assigned To", "Due Date", "Submission Date", "Region"])
        apps = db.query(Application).order_by(desc(Application.created_at)).all()
        for a in apps:
            writer.writerow([
                sanitize_csv_cell(a.reference),
                sanitize_csv_cell(a.institution_name),
                sanitize_csv_cell(a.application_type),
                sanitize_csv_cell(a.current_stage),
                sanitize_csv_cell(a.status),
                sanitize_csv_cell(a.assigned_to),
                sanitize_csv_cell(a.due_date),
                sanitize_csv_cell(a.submission_date),
                sanitize_csv_cell(a.region)
            ])
        filename = f"aicte_applications_{date.today()}.csv"

    else:
        writer.writerow(["Institution Name", "Item Type", "Description", "Due Date", "Status", "Verified By"])
        items = db.query(ComplianceItem).order_by(ComplianceItem.due_date).all()
        for c in items:
            writer.writerow([
                sanitize_csv_cell(c.institution_name),
                sanitize_csv_cell(c.item_type),
                sanitize_csv_cell(c.description),
                sanitize_csv_cell(c.due_date),
                sanitize_csv_cell(c.status),
                sanitize_csv_cell(c.verified_by)
            ])
        filename = f"aicte_compliance_{date.today()}.csv"

    output.seek(0)
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Returns users for demo role switching and administrative oversight."""
    return db.query(User).filter(User.is_active == True).all()
