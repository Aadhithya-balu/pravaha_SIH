import os
import csv
import io
import json
import math
from datetime import date, timedelta, datetime, timezone
from uuid import uuid4
from typing import Optional, List, Any, Dict

from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File, Form, Response, APIRouter
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .db import Base, engine, get_db, run_schema_migrations, get_database_diagnostics, DATABASE_READY, DATABASE_ERROR
from .document_storage import init_storage, resolve_storage_path, get_storage_diagnostics, reconcile_storage, verify_file_integrity, delete_stored_document, STORAGE_DIR
from .models import (
    User, Institution, Application, AuditEvent, Document, EVCVisit,
    ComplianceItem, Alert, ScrutinyRun, ScrutinyFinding, CorrectionRequest,
    StageRemark, InspectionEvidence, RegulatoryCategory, EmailDeliveryRecord,
    EVCAssignmentHistory
)
from .schemas import (
    EVCLocationCaptureRequest, EVCProofSubmitRequest, EVCProofVerifyRequest, EVCVisitProofDossierOut,
    InstitutionProfileOut, EVCRescheduleRequest, EVCApproveNextStageRequest, InspectionEvidenceOut, InspectionEvidenceVerifyRequest, DocumentOut, RegulatoryCategoryOut,
    StageRemarkCreate, StageRemarkOut,
    RegisterRequest,
    LoginRequest, UserOut, ApplicationCreate, ApplicationPatch, ApplicationTransition,
    ApplicationUpdate, ApplicationResubmit, ApplicationOut, AuditEventOut, ComplianceCreate,
    ComplianceEvidenceSubmit, ComplianceVerify, ComplianceOut, EVCVisitCreate,
    EVCVisitUpdate, EVCVisitOut, DocumentUploadCheck, DocumentReviewAction,
    AlertOut, DashboardMetrics, OfficerScrutinyRequest, OfficerCorrectionRequest,
    OfficerRescrutinyComplete, OfficerAdvanceStage, OfficerDecisionRequest,
    FindingDispositionRequest, NextBestActionOut, CandidateFieldOut,
    ApplyExtractedFieldsRequest, BottleneckAnalyticsOut,
    ScrutinyFindingDispositionUpdate, ScrutinyFindingOut, ScrutinyRunOut, DocumentReviewOut, RecentAuditEventOut,
    EVCStaffOut, EVCAssignmentHistoryOut, EVCAssignRequest, EVCAutoAssignRequest, EVCRespondRequest,
    EVCStaffAvailabilityUpdateRequest, EVCEligibilityOut
)
from .workflow import (
    get_available_transitions, validate_transition, TRANSITION_RULES,
    WORKFLOW_STAGES, APPLICATION_STATUSES, record_audit_event, verify_audit_chain,
    compute_next_best_action, compute_bottleneck_analytics
)
from .ai_service import review_document, extract_candidate_fields, analyze_evc_image, compute_image_phash
from .doc_extractor import process_and_store_upload, parse_document_content, UPLOAD_DIR
from .scrutiny import execute_scrutiny_pipeline, normalize_application_route, ROUTE_EOA, ROUTE_NEW_PROGRAMME
from .escalation import run_escalation_engine
from .seed import seed_database, password_hash
from .email_service import send_workflow_email, get_email_status


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

cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r".*",
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
        effective_roles = set(allowed_roles)
        # Combined Regional Officer / Admin demo role interoperability
        if "admin" in effective_roles:
            effective_roles.add("officer")
        if "officer" in effective_roles:
            effective_roles.add("admin")

        if user.role not in effective_roles and user.role != "admin":
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Requires one of roles: {list(effective_roles)}. Current role: '{user.role}'."
            )
        return user
    return role_checker


# Role-specific guards
officer_or_admin = require_roles(["officer", "bureau", "admin"])
bureau_or_admin = require_roles(["bureau", "admin"])
evc_or_officer = require_roles(["evc_expert", "officer", "admin"])
admin_only = require_roles(["admin"])


def strict_admin_only(user: User = Depends(get_current_user)) -> User:
    """Strict Admin-only authorization dependency (strictly restricted to admin)."""
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Administrative privileges strictly required for this operation."
        )
    return user


def check_officer_jurisdiction(user: User, application: Application):
    """
    Regional officers may act on applications in their assigned region,
    unassigned regional queue cases, or cases assigned to them.
    HQ/National/Admin officers have nationwide jurisdiction.
    """
    if user.role in ["admin", "bureau"]:
        return
    if user.role == "officer":
        if not user.region or user.region in ["HQ", "National"]:
            return
        if application.assigned_to in [None, "Regional Officer", user.name]:
            return
        if application.region and application.region == user.region:
            return
        if application.assigned_to and application.assigned_to not in [user.name, "Regional Officer"]:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied outside regional jurisdiction. Application is assigned to {application.assigned_to} in region '{application.region}'."
            )


def check_evc_assignment(user: User, application: Application, db: Session):
    """EVC experts may only access applications for inspections to which they are assigned."""
    if user.role == "evc_expert":
        is_assigned = db.query(EVCVisit).filter(
            EVCVisit.application_id == application.id,
            or_(
                EVCVisit.committee_members.ilike(f"%{user.name}%"),
                EVCVisit.committee_members.ilike(f"%{user.email}%")
            )
        ).first() is not None or application.assigned_to == user.name or application.assigned_to == user.email
        if not is_assigned:
            raise HTTPException(
                status_code=403,
                detail="Access denied. You are not assigned to an inspection committee for this application."
            )


def has_institution_access(user: User, resource: Any, created_by: Optional[int] = None) -> bool:
    """
    Validates whether an institution user has legitimate access to a regulatory application or document.
    Enforces strict multi-tenant boundary:
    1. System roles (officer, admin, bureau, evc) have authorized administrative access.
    2. Institution users have access if the institution name matches (case-insensitive & trimmed).
    3. For user-created cases (beyond seed cases 1-10), the creator also retains legitimate upload/inspection access.
    """
    if not user or user.role != "institution":
        return True

    # Exact or normalized institution name match
    target_inst = getattr(resource, "institution_name", resource) if resource is not None else None
    u_inst = (user.institution_name or "").strip().lower()
    a_inst = (target_inst or "").strip().lower() if isinstance(target_inst, str) else ""

    if u_inst and a_inst and u_inst == a_inst:
        return True

    # For user-created cases (not seed cases 1001-1010), allow creator
    app_ref = getattr(resource, "reference", "") or ""
    is_seed_app = app_ref.startswith("AICTE-2026-10") and len(app_ref) == 15 and app_ref[-4:].isdigit() and int(app_ref[-4:]) <= 1010
    if not is_seed_app:
        if created_by is not None and created_by == user.id:
            return True
        if hasattr(resource, "created_by") and getattr(resource, "created_by") == user.id:
            return True
        if hasattr(resource, "uploaded_by") and getattr(resource, "uploaded_by") == user.email:
            return True

    return False


@app.on_event("startup")
def startup():
    storage_res = init_storage()
    print(f"[STARTUP] Local document storage initialized: status={storage_res.get('status')}, directory={storage_res.get('directory')}", flush=True)
    if DATABASE_READY:
        print("[STARTUP] Applying schema migrations and checking seed data...", flush=True)
        Base.metadata.create_all(engine)
        run_schema_migrations(engine)
        with next(get_db()) as db:
            seed_database(db)
        print("[STARTUP READY] PRAVAHA backend is fully initialized and operational.", flush=True)
    else:
        print(f"[STARTUP WARNING] Skipping DB migrations and seeding because database is not ready: {DATABASE_ERROR}", flush=True)


# --- Health & Auth Endpoints ---

@app.get("/api/health")
@app.get("/api/v1/health")
def health():
    db_diag = get_database_diagnostics()
    storage_diag = get_storage_diagnostics()

    is_healthy = db_diag.get("database_ready", False) and storage_diag.get("status") == "healthy"

    return {
        "status": "ok" if is_healthy else "degraded",
        "service": "Pravaha AICTE Regulatory Workflow & Scrutiny Engine",
        "timestamp": datetime.utcnow().isoformat(),
        "database_ready": db_diag.get("database_ready", False),
        "database_provider": db_diag.get("database_provider", "sqlite"),
        "database_error": db_diag.get("database_error"),
        "environment": os.getenv("APP_ENV", "development"),
        "storage_provider": "local_storage",
        "storage_directory": storage_diag.get("directory"),
        "storage_ready": storage_diag.get("status") == "healthy",
        "routes_supported": ["Extension of Approval (EoA)", "New Programme / Level"]
    }


@app.post("/api/auth/register", status_code=201)
@app.post("/api/v1/auth/register", status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    clean_email = req.email.lower().strip()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail=f"User with email '{clean_email}' is already registered.")

    clean_inst_name = req.institution_name.strip()
    inst = db.query(Institution).filter(Institution.name == clean_inst_name).first()
    if not inst:
        inst_code = req.institution_code or f"AICTE-1-{uuid4().hex[:7].upper()}"
        inst = Institution(
            code=inst_code,
            name=clean_inst_name,
            region=req.region,
            state=req.state,
            address=f"{req.city}, {req.state}",
            contact_email=clean_email,
            contact_phone=req.phone,
            institution_type=req.institution_type
        )
        db.add(inst)
        db.flush()

    new_user = User(
        email=clean_email,
        name=req.contact_name.strip(),
        password_hash=password_hash(req.password),
        role="institution",
        institution_name=clean_inst_name,
        region=req.region,
        designation="Authorized Institutional Representative",
        is_active=True
    )
    db.add(new_user)
    db.flush()

    alert = Alert(
        title="Welcome to PRAVAHA Institutional Portal",
        message=f"Registration successful for {clean_inst_name}. You may now prepare and submit regulatory approval dossiers.",
        severity="INFO",
        target_role="institution",
        institution_name=clean_inst_name,
        recipient_user_id=new_user.id,
        trigger_type="SYSTEM"
    )
    db.add(alert)
    db.commit()
    db.refresh(new_user)

    token_data = {
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role,
        "name": new_user.name,
        "institution_name": new_user.institution_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12)
    }
    access_token = jwt.encode(token_data, SECRET, algorithm=ALGORITHM)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": new_user.role,
        "name": new_user.name,
        "email": new_user.email,
        "institution_name": new_user.institution_name,
        "region": new_user.region,
        "designation": new_user.designation,
        "message": "Institution registered successfully."
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



# --- Institution Profile Endpoints ---

@app.get("/api/institutions/profile", response_model=InstitutionProfileOut)
@app.get("/api/v1/institutions/profile", response_model=InstitutionProfileOut)
@app.get("/api/institutions/me", response_model=InstitutionProfileOut)
def get_institution_profile(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Fetches profile of logged-in institution or creates persistent record if newly registered."""
    clean_name = (user.institution_name or "").strip()
    inst = None
    if clean_name:
        inst = db.query(Institution).filter(Institution.name == clean_name).first()
    if not inst:
        inst = db.query(Institution).filter(Institution.contact_email == user.email).first()
    if not inst:
        inst_code = f"AICTE-1-{user.id:04d}"
        inst = Institution(
            code=inst_code,
            name=clean_name or f"Institution {user.id}",
            region=user.region or "Northern",
            state="Delhi",
            address="Campus Address",
            contact_email=user.email,
            contact_phone="+91-11-29581000",
            institution_type="Engineering & Technology"
        )
        db.add(inst)
        db.commit()
        db.refresh(inst)
    return inst

@app.get("/api/institutions", response_model=List[InstitutionProfileOut])
@app.get("/api/v1/institutions", response_model=List[InstitutionProfileOut])
def list_institutions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """List registered institutions for selection, prefill, and statutory oversight."""
    return db.query(Institution).order_by(Institution.name).all()

# --- Dashboard Analytics ---

@app.get("/api/dashboard", response_model=DashboardMetrics)
@app.get("/api/v1/dashboard", response_model=DashboardMetrics)
def dashboard(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Application)
    cq = db.query(ComplianceItem)

    # Role and tenant data isolation
    if user.role == "institution":
        q = q.filter(Application.institution_name == user.institution_name)
        cq = cq.filter(ComplianceItem.institution_name == user.institution_name)
    elif user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(or_(
            Application.region == user.region,
            Application.assigned_to == user.name,
            Application.assigned_to == "Regional Officer",
            Application.region.is_(None)
        ))
        cq = cq.filter(ComplianceItem.institution_name.in_(db.query(Institution.name).filter(Institution.region == user.region)))
    elif user.role == "evc_expert":
        assigned_app_ids = db.query(EVCVisit.application_id).filter(
            or_(
                EVCVisit.committee_members.ilike(f"%{user.name}%"),
                EVCVisit.committee_members.ilike(f"%{user.email}%")
            )
        ).all()
        app_ids = [x[0] for x in assigned_app_ids]
        q = q.filter(or_(Application.id.in_(app_ids), Application.assigned_to == user.name, Application.assigned_role == "evc_expert"))
        cq = cq.filter(ComplianceItem.application_id.in_(app_ids))

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

    # Fetch top urgent alerts with tenant isolation
    aq = db.query(Alert).filter(Alert.severity.in_(["HIGH", "CRITICAL"]))
    if user.role == "institution":
        aq = aq.filter(
            or_(
                Alert.institution_name == user.institution_name,
                and_(Alert.institution_name.is_(None), Alert.target_role.in_(["institution", "all"]))
            )
        )
    elif user.role == "officer" and user.region and user.region != "HQ":
        aq = aq.filter(or_(Alert.target_role.in_(["officer", "all"]), Alert.recipient_user_id == user.id))
    elif user.role == "evc_expert":
        aq = aq.filter(or_(Alert.target_role.in_(["evc_expert", "all"]), Alert.recipient_user_id == user.id))

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
def list_applications(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    app_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Application)

    # Server-side institution and regional isolation
    if user.role == "institution":
        q = q.filter(Application.institution_name == user.institution_name)
    elif user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(or_(
            Application.region == user.region,
            Application.assigned_to == user.name,
            Application.assigned_to == "Regional Officer",
            Application.region.is_(None)
        ))
    elif user.role == "evc_expert":
        assigned_app_ids = db.query(EVCVisit.application_id).filter(
            or_(
                EVCVisit.committee_members.ilike(f"%{user.name}%"),
                EVCVisit.committee_members.ilike(f"%{user.email}%")
            )
        ).all()
        app_ids = [x[0] for x in assigned_app_ids]
        q = q.filter(or_(Application.id.in_(app_ids), Application.assigned_to == user.name, Application.assigned_role == "evc_expert"))

    if stage:
        q = q.filter(Application.current_stage == stage)
    if status:
        q = q.filter(Application.status == status)
    if app_type:
        q = q.filter(Application.application_type.ilike(f"%{app_type}%"))
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(Application.reference.ilike(s), Application.institution_name.ilike(s)))

    apps = q.order_by(desc(Application.created_at)).all()
    for app_item in apps:
        app_item.next_action = compute_next_best_action(app_item, db, user)
    return apps


@app.post("/api/applications", response_model=ApplicationOut, status_code=201)
def create_application(
    req: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if req.institution_name and req.institution_name.strip():
        institution_name = req.institution_name.strip()
    elif user.institution_name and user.institution_name.strip():
        institution_name = user.institution_name.strip()
    else:
        raise HTTPException(status_code=400, detail="College / Institution name is mandatory.")

    if user.role == "institution" and not user.institution_name:
        user.institution_name = institution_name
        db.add(user)

    region = req.region or user.region or "Northern"

    reference = f"AICTE-{date.today().year}-{uuid4().hex[:6].upper()}"
    default_due = req.due_date or (date.today() + timedelta(days=14))

    # Serialize form_data if passed as dict
    form_data_str = None
    if req.form_data:
        form_data_str = json.dumps(req.form_data) if isinstance(req.form_data, dict) else str(req.form_data)
    is_draft = getattr(req, "is_draft", False) or ("draft" in (req.notes or "").lower())
    stage = "DRAFT" if is_draft else "SCRUTINY"
    status = "DRAFT" if is_draft else "IN_PROGRESS"
    assigned_to = "Applicant Institution" if is_draft else "Regional Officer"
    assigned_role = "institution" if is_draft else "officer"

    app_record = Application(
        reference=reference,
        institution_name=institution_name,
        application_type=req.application_type,
        current_stage=stage,
        status=status,
        assigned_to=assigned_to,
        assigned_role=assigned_role,
        region=region,
        submission_date=date.today(),
        due_date=default_due,
        notes=req.notes or ("Draft application registered via online portal." if is_draft else f"Application registered for {req.application_type} via online portal."),
        form_data=form_data_str,
        academic_year=req.academic_year,
        created_by=user.id
    )
    db.add(app_record)
    db.flush()

    record_audit_event(
        db=db,
        application_id=app_record.id,
        actor=user.email,
        actor_role=user.role,
        action="DRAFT_SAVED" if is_draft else "SUBMITTED",
        from_stage=None,
        to_stage=stage,
        details=f"Draft application created by {user.name}." if is_draft else f"Application registered by {user.name} ({user.role}) for {req.application_type}. Initial scrutiny workflow initiated."
    )

    # Trigger officer alert
    if not is_draft:
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
def get_application_details(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. You can only inspect your own institution's cases.")

    check_officer_jurisdiction(user, a)
    check_evc_assignment(user, a, db)

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
    if not correction_requests:
        for e in audit_history:
            if e.action == "RETURN":
                reason_text = e.details
                if "Justification: " in reason_text:
                    reason_text = reason_text.split("Justification: ", 1)[1].strip()
                correction_requests.append({
                    "source": "RETURN_DEFICIENCY",
                    "reason": reason_text,
                    "document_id": None,
                    "document_name": None,
                    "created_at": e.created_at
                })
                break

        for doc in docs:
            if doc.review_status == "CORRECTION_REQUIRED":
                correction_requests.append({
                    "source": "DOCUMENT_CORRECTION",
                    "reason": doc.reviewer_notes or f"Correction requested for {doc.document_name}.",
                    "document_id": doc.id,
                    "document_name": doc.document_name,
                    "created_at": doc.reviewed_at or doc.created_at
                })

    next_action = compute_next_best_action(a, db, user)
    a.next_action = next_action

    # Fetch Stage Remarks
    q_rem = db.query(StageRemark).filter(StageRemark.application_id == aid)
    if user.role == "institution":
        q_rem = q_rem.filter(StageRemark.visibility == "APPLICANT_VISIBLE")
    remarks = q_rem.order_by(StageRemark.created_at.asc()).all()

    return {
        "application": a,
        "next_action": next_action,
        "available_transitions": transitions,
        "audit_history": audit_history,
        "documents": docs,
        "evc_visit": evc,
        "scrutiny_runs": scrutiny_runs,
        "scrutiny_findings": scrutiny_findings,
        "correction_requests": correction_requests,
        "remarks": remarks
    }


@app.patch("/api/applications/{aid}", response_model=ApplicationOut)
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

    if user.role == "institution" and not has_institution_access(user, a):
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

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="APPLICATION_UPDATED",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Application metadata / form fields updated by {user.name}."
    )

    db.commit()
    db.refresh(a)
    return a


@app.post("/api/applications/{aid}/documents")
async def upload_application_document(
    aid: int,
    file: UploadFile = File(...),
    document_type: str = Form("LEASE_DEED"),
    document_category: str = Form("INSTITUTIONAL_RECORDS"),
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

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot upload documents for another institution's case.")

    if a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Cannot upload documents for an application that has reached final decision.")

    # Ingest file safely via doc_extractor
    upload_res = await process_and_store_upload(file)

    # Run AI / deterministic document screening
    ai_result = await review_document(
        document_name=upload_res["original_filename"],
        document_type=document_type,
        text=upload_res["extracted_text"]
    )

    try:
        doc = Document(
            application_id=aid,
            institution_name=a.institution_name,
            document_name=upload_res["original_filename"],
            stored_filename=upload_res.get("stored_filename"),
            document_type=document_type,
            document_category=document_category,
            file_path=upload_res["stored_filepath"],
            file_size=upload_res["file_size"],
            file_hash=upload_res.get("file_hash"),
            mime_type=upload_res["mime_type"],
            uploaded_by=user.email,
            version=1,
            is_latest=True,
            ocr_status=upload_res.get("extraction_status", "SUCCESS"),
            processing_status="COMPLETED" if upload_res.get("is_readable") else "NEEDS_REVIEW",
            authenticity_status="UNVERIFIED",
            regulatory_status="PENDING_EVALUATION",
            extracted_text=upload_res["extracted_text"][:10000],
            extracted_fields=json.dumps(ai_result.get("extracted_fields", {})),
            ai_summary=ai_result.get("summary"),
            ai_findings=json.dumps(ai_result),
            ai_confidence=float(ai_result.get("confidence_score", 0.9)),
            review_status="PENDING"
        )
        db.add(doc)

        record_audit_event(
            db=db,
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="DOC_UPLOADED",
            from_stage=a.current_stage,
            to_stage=a.current_stage,
            details=f"Uploaded '{upload_res['original_filename']}' ({document_type}, {round(upload_res['file_size']/1024, 1)} KB). SHA-256: {upload_res.get('file_hash', 'N/A')[:16]}..."
        )

        db.commit()
        db.refresh(doc)
    except Exception as db_err:
        db.rollback()
        delete_stored_document(upload_res.get("stored_filename", ""))
        raise db_err

    return {
        "document": {
            "id": doc.id,
            "application_id": doc.application_id,
            "document_name": doc.document_name,
            "document_type": doc.document_type,
            "document_category": doc.document_category,
            "file_size": doc.file_size,
            "file_hash": doc.file_hash,
            "version": doc.version,
            "is_latest": doc.is_latest,
            "processing_status": doc.processing_status,
            "review_status": doc.review_status,
            "created_at": doc.created_at.isoformat()
        },
        "ai_analysis": ai_result
    }


@app.post("/api/applications/{aid}/submit", response_model=ApplicationOut)
async def submit_application(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Institution formally submits application for scrutiny."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot submit another institution's case.")

    if a.status != "DRAFT" and a.current_stage != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"Application cannot be submitted. Current status: '{a.status}', stage: '{a.current_stage}'. Only draft applications can be submitted."
        )

    prev_stage = a.current_stage
    a.current_stage = "SCRUTINY"
    a.status = "IN_PROGRESS"
    a.assigned_to = "Regional Officer"
    a.assigned_role = "officer"
    a.submission_date = date.today()

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="SUBMITTED",
        from_stage=prev_stage,
        to_stage="SCRUTINY",
        details="Application formally submitted by institution for regulatory scrutiny."
    )

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
    try:
        await execute_scrutiny_pipeline(aid, db, user.email, "INITIAL")
    except Exception as e:
        logger.warning(f"Initial scrutiny pipeline failed on submission: {e}")
    return a


@app.post("/api/applications/{aid}/resubmit", response_model=ApplicationOut)
async def resubmit_application(
    aid: int,
    req: ApplicationResubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Institution resubmits application after rectifying deficiencies."""
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
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
    response_text = (req.response_text or req.reason or req.explanation or "").strip()
    if len(response_text) < 3:
        raise HTTPException(
            status_code=422,
            detail="A detailed institutional clarification (minimum 3 characters) is required for resubmission."
        )

    # Resolve pending correction request if any
    pending_cr = db.query(CorrectionRequest).filter(
        CorrectionRequest.application_id == aid,
        CorrectionRequest.status == "PENDING"
    ).order_by(desc(CorrectionRequest.created_at)).first()
    if pending_cr:
        pending_cr.status = "RESUBMITTED"
        pending_cr.institution_response = response_text
        pending_cr.response_submitted_at = datetime.utcnow()

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="RESUBMIT",
        from_stage=prev_stage,
        to_stage=a.current_stage,
        details=f"Institutional Clarification: {response_text}"
    )

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
    try:
        await execute_scrutiny_pipeline(aid, db, user.email, "RE_SCRUTINY")
    except Exception as e:
        logger.warning(f"Re-scrutiny pipeline failed on resubmission: {e}")
    return a


@app.get("/api/applications/{aid}/audit", response_model=List[AuditEventOut])
def get_application_timeline(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return db.query(AuditEvent).filter(AuditEvent.application_id == aid).order_by(desc(AuditEvent.created_at)).all()


@app.get("/api/audit/recent", response_model=List[RecentAuditEventOut])
def get_recent_audit_events(
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(
        AuditEvent,
        Application.reference,
        Application.institution_name
    ).join(Application, AuditEvent.application_id == Application.id)

    if user.role == "institution":
        q = q.filter(Application.institution_name == user.institution_name)
    elif user.role == "officer" and user.region and user.region != "HQ":
        q = q.filter(or_(Application.region == user.region, Application.assigned_to == user.name))
    elif user.role == "evc_expert":
        assigned_app_ids = db.query(EVCVisit.application_id).filter(
            or_(
                EVCVisit.committee_members.ilike(f"%{user.name}%"),
                EVCVisit.committee_members.ilike(f"%{user.email}%")
            )
        ).all()
        app_ids = [x[0] for x in assigned_app_ids]
        q = q.filter(Application.id.in_(app_ids))

    results = q.order_by(desc(AuditEvent.created_at)).limit(limit).all()
    events = []
    for ev, ref, inst in results:
        events.append(RecentAuditEventOut(
            id=ev.id,
            application_id=ev.application_id,
            application_reference=ref,
            institution_name=inst,
            actor=ev.actor,
            actor_role=ev.actor_role,
            action=ev.action,
            from_stage=ev.from_stage,
            to_stage=ev.to_stage,
            details=ev.details,
            prev_hash=ev.prev_hash,
            event_hash=ev.event_hash,
            created_at=ev.created_at
        ))
    return events


@app.get("/api/applications/{aid}/next-action", response_model=NextBestActionOut)
def get_application_next_action(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Computes the single Next Best Action for the specified application dossier.
    Combines current stage, outstanding deficiencies, evidence, SLA deadline, and role permissions.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return compute_next_best_action(app=a, db=db, user=user)


@app.get("/api/applications/{aid}/extracted-fields", response_model=List[CandidateFieldOut])
def get_application_extracted_fields(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Retrieves candidate fields extracted from all supporting documents attached to an application.
    Preserves document provenance, evidence quotes, and confidence labels for safe officer review.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")

    docs = db.query(Document).filter(Document.application_id == aid).all()
    all_candidates: List[CandidateFieldOut] = []
    seen = set()

    for d in docs:
        extracted = extract_candidate_fields(d.document_name, d.document_type, d.extracted_text or "")
        for item in extracted:
            unique_key = f"{item['field_key']}_{item['extracted_value']}"
            if unique_key not in seen:
                seen.add(unique_key)
                all_candidates.append(CandidateFieldOut(**item))

    return all_candidates


@app.post("/api/applications/{aid}/apply-extracted-fields")
def apply_application_extracted_fields(
    aid: int,
    req: ApplyExtractedFieldsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Applies user-confirmed extracted candidate fields directly into the application's form metadata.
    Avoids silent AI overwrites by requiring explicit human confirmation and logs a tamper-evident audit trail.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")
    if a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Cannot mutate application fields after final decision.")

    current_data = {}
    if a.form_data:
        try:
            current_data = json.loads(a.form_data) if isinstance(a.form_data, str) else dict(a.form_data)
        except Exception:
            current_data = {}

    current_data.update(req.fields)
    a.form_data = json.dumps(current_data)
    a.updated_at = datetime.utcnow()

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="FIELDS_PREFILLED",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Extracted metadata ({', '.join(req.fields.keys())}) confirmed and applied by {user.name}."
    )
    db.commit()
    db.refresh(a)
    return {
        "status": "success",
        "message": f"{len(req.fields)} field(s) confirmed and applied to application {a.reference}.",
        "form_data": current_data
    }


@app.get("/api/analytics/bottlenecks", response_model=BottleneckAnalyticsOut)
def get_bottleneck_analytics(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Operational analytics endpoint identifying stage backlogs, average ageing,
    workload friction points, and SLA breach risks across regions.
    """
    return compute_bottleneck_analytics(db=db, user=user)


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

    if a.current_stage == "COMPLETED" or a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot perform transition on application that has already reached a final decision."
        )

    check_officer_jurisdiction(user, a)
    check_evc_assignment(user, a, db)

    if user.role == "institution":
        if not has_institution_access(user, a):
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

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action=req.action.upper(),
        from_stage=prev_stage,
        to_stage=new_stage,
        details=details
    )

    # If EVC is scheduled, ensure an EVCVisit record exists for the panel
    if new_stage == "EVC_SCHEDULED" or req.action.upper() == "SCHEDULE_EVC":
        existing_visit = db.query(EVCVisit).filter(EVCVisit.application_id == aid).first()
        if not existing_visit:
            new_visit = EVCVisit(
                application_id=aid,
                institution_name=a.institution_name,
                committee_members=req.reason.strip() if req.reason else "Dr. EVC Expert (evc@demo.local), Prof. K. Sharma",
                scheduled_date=date.today() + timedelta(days=7),
                visit_mode="PHYSICAL",
                status="SCHEDULED",
                assigned_by=user.email
            )
            db.add(new_visit)
            db.flush()

    # If returned, persist CorrectionRequest and notify institution
    if new_status == "RETURNED" or req.action.upper() == "RETURN":
        a.deficiency_count += 1
        cr = CorrectionRequest(
            application_id=aid,
            requested_by=user.email,
            reason=req.reason.strip(),
            deficiencies_json=json.dumps([]),
            status="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(cr)
        db.add(Alert(
            title=f"Action Required: Clarifications Demanded for {a.reference}",
            message=f"Regional Officer {user.name} returned your application for rectification: {req.reason.strip()}",
            severity="WARNING",
            target_role="institution",
            institution_name=a.institution_name,
            application_id=aid,
            trigger_type="CORRECTION_REQUESTED"
        ))
        send_workflow_email(
            recipient=user.email,
            subject=f"Action Required: Deficiency Memo Issued for {a.reference}",
            template_type="CORRECTION_REQUESTED",
            context={
                "reference": a.reference,
                "institution_name": a.institution_name,
                "stage": "RETURNED_FOR_CLARIFICATION",
                "details": req.reason.strip()
            }
        )
    elif req.action.upper() in ["SCRUTINY_PASS", "RESCRUTINY_CLEARED", "SEND_EVC"]:
        pending_crs = db.query(CorrectionRequest).filter(
            CorrectionRequest.application_id == aid,
            CorrectionRequest.status.in_(["PENDING", "RESUBMITTED"])
        ).all()
        for cr in pending_crs:
            cr.status = "RESOLVED"
            cr.resolved_at = datetime.utcnow()
            cr.resolved_by = user.email

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

    check_officer_jurisdiction(user, a)

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


@app.post("/api/scrutiny/run/{aid}")
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

    check_officer_jurisdiction(user, a)

    res = await execute_scrutiny_pipeline(
        application_id=aid,
        db=db,
        actor_email=user.email,
        run_type=req.run_type
    )

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="SCRUTINY_RUN",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Automated regulatory scrutiny completed. Found {res['deficiency_count']} deficiency/deficiencies."
    )
    db.commit()

    return res


@app.get("/api/scrutiny/applications/{aid}")
@app.get("/api/scrutiny/runs/{aid}")
def get_application_scrutiny(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, app_rec):
        raise HTTPException(status_code=403, detail="Forbidden.")

    runs = db.query(ScrutinyRun).filter(ScrutinyRun.application_id == aid).order_by(desc(ScrutinyRun.created_at)).all()
    findings = db.query(ScrutinyFinding).filter(ScrutinyFinding.application_id == aid).order_by(desc(ScrutinyFinding.created_at)).all()

    return {
        "application_id": aid,
        "deficiency_count": app_rec.deficiency_count,
        "scrutiny_runs": runs,
        "findings": findings
    }


@app.post("/api/scrutiny/findings/{fid}/disposition")
@app.patch("/api/scrutiny/findings/{fid}/disposition")
@app.post("/api/v1/officer/scrutiny/findings/{fid}/disposition")
def update_finding_disposition(
    fid: int,
    req: ScrutinyFindingDispositionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Human-in-the-loop review:
    Officers can accept, waive where legally permitted, request correction, or reject an AI finding.
    Records remarks and re-evaluates active application deficiency count.
    """
    finding = db.get(ScrutinyFinding, fid)
    if not finding:
        raise HTTPException(status_code=404, detail="Scrutiny finding not found.")

    valid_dispositions = ["ACCEPTED", "WAIVED", "CORRECTION_REQUESTED", "REJECTED"]
    disp_upper = req.disposition.upper().strip()
    if disp_upper not in valid_dispositions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid disposition '{req.disposition}'. Permitted values: {valid_dispositions}"
        )

    remarks = req.remarks.strip()
    if len(remarks) < 3:
        raise HTTPException(
            status_code=422,
            detail="Recorded remarks / justification must be at least 3 characters long."
        )

    prev_disp = finding.officer_disposition
    finding.officer_disposition = disp_upper
    finding.disposition_notes = remarks
    finding.disposed_by = user.email
    finding.disposed_at = datetime.utcnow()
    db.flush()

    # Recalculate application deficiency count
    app_rec = db.get(Application, finding.application_id)
    if app_rec:
        active_deficiencies = db.query(ScrutinyFinding).filter(
            ScrutinyFinding.application_id == finding.application_id,
            ScrutinyFinding.severity == "DEFICIENCY",
            ScrutinyFinding.officer_disposition.in_(["PENDING", "ACCEPTED", "CORRECTION_REQUESTED"])
        ).count()
        app_rec.deficiency_count = active_deficiencies

        db.add(AuditEvent(
            application_id=app_rec.id,
            actor=user.email,
            actor_role=user.role,
            action="FINDING_DISPOSITION",
            details=f"Finding '{finding.rule_id}' disposition updated from {prev_disp} to {disp_upper}. Remarks: {remarks}"
        ))

    db.commit()
    db.refresh(finding)

    return {
        "id": finding.id,
        "application_id": finding.application_id,
        "rule_id": finding.rule_id,
        "severity": finding.severity,
        "category": finding.category,
        "officer_disposition": finding.officer_disposition,
        "disposition_notes": finding.disposition_notes,
        "disposed_by": finding.disposed_by,
        "disposed_at": finding.disposed_at.isoformat() if finding.disposed_at else None,
        "application_deficiency_count": app_rec.deficiency_count if app_rec else 0
    }


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

    check_officer_jurisdiction(user, a)

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

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="RETURN",
        from_stage=prev_stage,
        to_stage="RETURNED_FOR_CLARIFICATION",
        details=f"Deficiency Memo / Clarification Request: {req.reason.strip()}"
    )

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

    check_officer_jurisdiction(user, a)

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

        record_audit_event(
            db=db,
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="RESCRUTINY_CLEARED",
            from_stage=prev_stage,
            to_stage=next_stage,
            details=details
        )

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

        record_audit_event(
            db=db,
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="RETURN",
            from_stage=prev_stage,
            to_stage="RETURNED_FOR_CLARIFICATION",
            details=f"Re-scrutiny Deficiencies: {reason}"
        )

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

    check_officer_jurisdiction(user, a)

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
    Prevents duplicate or contradictory final decisions.
    """
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if a.decision_outcome is not None or a.current_stage == "COMPLETED" or a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate or contradictory final decision rejected. A final decision has already been recorded as '{a.decision_outcome}' on {a.decision_date}."
        )

    check_officer_jurisdiction(user, a)

    dec = req.decision.upper().strip()
    if dec not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Decision must be 'APPROVED' or 'REJECTED'.")

    if dec == "REJECTED" and (not req.remarks or len(req.remarks.strip()) < 5):
        raise HTTPException(
            status_code=400,
            detail="Speaking order remarks (minimum 5 characters) are mandatory when recording a rejection decision."
        )

    prev_stage = a.current_stage
    a.current_stage = "COMPLETED"
    a.status = "COMPLETED" if dec == "APPROVED" else "REJECTED"
    a.decision_outcome = dec
    a.decision_remarks = req.remarks or f"Statutory order issued by {user.name} ({user.designation})."
    a.decision_by = user.email
    a.decision_date = datetime.utcnow()
    a.assigned_to = "Closed"

    order_ref = req.approval_order_reference or f"AICTE/AB/{date.today().year}/{a.reference}"

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action=f"DECISION_{dec}",
        from_stage=prev_stage,
        to_stage="COMPLETED",
        details=f"Statutory Verdict: {dec} | Order Ref: {order_ref} | Remarks: {a.decision_remarks}"
    )

    db.add(StageRemark(
        application_id=aid,
        stage="COMPLETED",
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=f"Statutory Decision Issued: {dec}. Order Reference: {order_ref}. Remarks: {a.decision_remarks}",
        action_type="DECISION_REMARK",
        visibility="APPLICANT_VISIBLE",
        created_at=datetime.utcnow()
    ))

    # Generate post-approval compliance obligations if approved
    if dec == "APPROVED":
        # post_approval_compliance_generated
        post_compliance = [
            ComplianceItem(
                institution_name=a.institution_name,
                application_id=a.id,
                item_type="FIRE_SAFETY_NOC",
                description="Mandatory Annual Fire & Life Safety Certificate / NOC Renewal Submission",
                due_date=date.today() + timedelta(days=365),
                status="PENDING"
            ),
            ComplianceItem(
                institution_name=a.institution_name,
                application_id=a.id,
                item_type="UNDERTAKING",
                description="Faculty Cadre Ratio, Biometric Attendance & Salary Disbursal Compliance Affirmation",
                due_date=date.today() + timedelta(days=90),
                status="PENDING"
            ),
            ComplianceItem(
                institution_name=a.institution_name,
                application_id=a.id,
                item_type="UNDERTAKING",
                description="Mandatory Anti-Ragging Committee Constitution & Student Safeguards Affidavit",
                due_date=date.today() + timedelta(days=60),
                status="PENDING"
            ),
            ComplianceItem(
                institution_name=a.institution_name,
                application_id=a.id,
                item_type="UNDERTAKING",
                description="Fee Regulatory Committee Adherence & Student Grievance Redressal Portal Integration",
                due_date=date.today() + timedelta(days=90),
                status="PENDING"
            )
        ]
        db.add_all(post_compliance)
        db.add(Alert(
            title=f"Post-Approval Compliance Obligations Initialized ({a.reference})",
            message="Statutory post-approval undertakings and renewals have been registered in your compliance roster.",
            severity="INFO",
            target_role="institution",
            institution_name=a.institution_name,
            application_id=aid,
            trigger_type="COMPLIANCE_CREATED"
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


@app.post("/api/v1/officer/findings/{fid}/disposition")
@app.post("/api/findings/{fid}/disposition")
def dispose_scrutiny_finding(
    fid: int,
    req: FindingDispositionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Officer records disposition on a specific scrutiny finding (ACCEPTED, WAIVED, CORRECTION_REQUESTED).
    Mandates remarks for waivers and records tamper-evident audit events.
    """
    finding = db.get(ScrutinyFinding, fid)
    if not finding:
        raise HTTPException(status_code=404, detail="Scrutiny finding not found.")

    app_rec = db.get(Application, finding.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    check_officer_jurisdiction(user, app_rec)

    disp = req.disposition.upper().strip()
    if disp not in ["ACCEPTED", "WAIVED", "CORRECTION_REQUESTED", "RESOLVED"]:
        raise HTTPException(
            status_code=400,
            detail="Disposition must be 'ACCEPTED', 'WAIVED', 'CORRECTION_REQUESTED', or 'RESOLVED'."
        )

    if disp == "WAIVED" and (not req.disposition_notes or len(req.disposition_notes.strip()) < 5):
        raise HTTPException(
            status_code=400,
            detail="Mandatory justification (minimum 5 characters) is required when waiving a scrutiny finding."
        )

    finding.officer_disposition = disp
    finding.disposition_notes = req.disposition_notes
    finding.disposed_by = user.email
    finding.disposed_at = datetime.utcnow()

    # Recalculate remaining active deficiencies
    active_deficiencies = db.query(ScrutinyFinding).filter(
        ScrutinyFinding.application_id == app_rec.id,
        ScrutinyFinding.severity == "DEFICIENCY",
        ScrutinyFinding.officer_disposition.notin_(["WAIVED", "RESOLVED", "ACCEPTED"])
    ).count()
    app_rec.deficiency_count = active_deficiencies

    record_audit_event(
        db=db,
        application_id=app_rec.id,
        actor=user.email,
        actor_role=user.role,
        action=f"FINDING_{disp}",
        from_stage=app_rec.current_stage,
        to_stage=app_rec.current_stage,
        details=f"Finding '{finding.rule_id}' ({finding.document_type}) disposed as {disp}. Remarks: {req.disposition_notes or 'None'}"
    )

    db.commit()
    db.refresh(finding)
    return finding


# ==============================================================================
# --- Notifications & Alerts APIs ---
# ==============================================================================

@app.get("/api/notifications", response_model=List[AlertOut])
@app.get("/api/alerts", response_model=List[AlertOut])
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Alert)
    if user.role == "institution":
        q = q.filter(
            or_(
                Alert.institution_name == user.institution_name,
                and_(Alert.institution_name.is_(None), Alert.target_role.in_(["institution", "all", "ALL"]))
            )
        )
    elif user.role != "admin":
        q = q.filter(or_(Alert.target_role == user.role, Alert.target_role == "all", Alert.target_role == "ALL", Alert.target_role == "officer", Alert.target_role == None))

    if unread_only:
        q = q.filter(Alert.is_read == False)

    return q.order_by(desc(Alert.created_at)).all()


@app.patch("/api/notifications/{aid}/read")
@app.post("/api/alerts/{aid}/read")
def mark_notification_read(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    al = db.get(Alert, aid)
    if not al:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if user.role == "institution" and al.institution_name and al.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden.")
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


@app.get("/api/documents/{did}/download")
def download_document(
    did: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    doc = db.get(Document, did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if doc.application_id:
        app_rec = db.get(Application, doc.application_id)
        if app_rec:
            if user.role == "institution" and not has_institution_access(user, app_rec):
                raise HTTPException(status_code=403, detail="Forbidden. Cannot download other institutions' documents.")
            elif user.role == "officer":
                check_officer_jurisdiction(user, app_rec)
            elif user.role in ["evc", "evc_expert"]:
                check_evc_assignment(user, app_rec, db)
    elif user.role == "institution" and not has_institution_access(user, doc):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot download other institutions' documents.")

    # Safely resolve target storage path (prevents traversal)
    resolved_path = None
    try:
        if doc.file_path or doc.stored_filename:
            ref = doc.stored_filename or doc.file_path
            resolved_path = resolve_storage_path(ref)
    except Exception:
        resolved_path = None

    if not resolved_path or not os.path.exists(resolved_path):
        if doc.extracted_text:
            return Response(
                content=doc.extracted_text,
                media_type="text/plain",
                headers={"Content-Disposition": f'attachment; filename="{doc.document_name}.txt"'}
            )
        raise HTTPException(status_code=404, detail="Original document file not found on local storage.")

    return FileResponse(
        path=resolved_path,
        filename=doc.document_name,
        media_type=doc.mime_type or "application/octet-stream"
    )


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
    document_category: str = Form("INSTITUTIONAL_RECORDS"),
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
        document_category=document_category,
        file_path=upload_res["stored_filepath"],
        file_size=upload_res["file_size"],
        file_hash=upload_res.get("file_hash"),
        mime_type=upload_res["mime_type"],
        uploaded_by=user.email,
        version=1,
        is_latest=True,
        processing_status="COMPLETED" if upload_res.get("is_readable") else upload_res.get("extraction_status", "COMPLETED"),
        extracted_text=upload_res["extracted_text"][:10000],
        ai_summary=ai_result.get("summary"),
        ai_findings=json.dumps(ai_result),
        ai_confidence=float(ai_result.get("confidence_score", 0.9)),
        review_status="PENDING"
    )
    db.add(doc)
    db.flush()

    if application_id:
        record_audit_event(
            db=db,
            application_id=application_id,
            actor=user.email,
            actor_role=user.role,
            action="DOC_UPLOADED",
            from_stage=None,
            to_stage=None,
            details=f"Uploaded '{upload_res['original_filename']}' ({document_type}, {round(upload_res['file_size']/1024, 1)} KB)."
        )

    db.commit()
    db.refresh(doc)

    return {
        "document": doc,
        "ai_analysis": ai_result
    }


@app.get("/api/documents/{did}/review")
def get_document_review(
    did: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Returns explainable scrutiny review data, extracted metadata, and findings for a document.
    """
    doc = db.get(Document, did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found.")

    if user.role == "institution" and not has_institution_access(user, doc):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot inspect other institutions' documents.")

    ai_data = None
    if doc.ai_findings:
        try:
            ai_data = json.loads(doc.ai_findings)
        except Exception:
            ai_data = {"summary": doc.ai_summary, "raw": doc.ai_findings}

    findings = db.query(ScrutinyFinding).filter(
        or_(
            ScrutinyFinding.document_id == did,
            and_(
                ScrutinyFinding.application_id == doc.application_id,
                ScrutinyFinding.source_document == doc.document_name
            )
        )
    ).order_by(desc(ScrutinyFinding.created_at)).all()

    return {
        "document": {
            "id": doc.id,
            "application_id": doc.application_id,
            "institution_name": doc.institution_name,
            "document_name": doc.document_name,
            "document_type": doc.document_type,
            "file_size": doc.file_size,
            "mime_type": doc.mime_type,
            "uploaded_by": doc.uploaded_by,
            "review_status": doc.review_status,
            "reviewer_notes": doc.reviewer_notes,
            "reviewed_by": doc.reviewed_by,
            "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
            "ai_summary": doc.ai_summary,
            "ai_confidence": doc.ai_confidence,
            "created_at": doc.created_at.isoformat()
        },
        "review_status": doc.review_status,
        "reviewer_notes": doc.reviewer_notes,
        "reviewed_by": doc.reviewed_by,
        "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
        "ai_analysis": ai_data,
        "findings": [
            {
                "id": f.id,
                "rule_id": f.rule_id,
                "document_type": f.document_type,
                "severity": f.severity,
                "category": f.category,
                "description": f.description,
                "evidence_quote": f.evidence_quote,
                "source_document": f.source_document,
                "page_number": f.page_number,
                "expected_requirement": f.expected_requirement,
                "observed_value": f.observed_value,
                "suggested_action": f.suggested_action,
                "is_provisional": f.is_provisional,
                "source_reference": f.source_reference,
                "officer_disposition": f.officer_disposition,
                "disposition_notes": f.disposition_notes,
                "disposed_by": f.disposed_by,
                "disposed_at": f.disposed_at.isoformat() if f.disposed_at else None,
                "created_at": f.created_at.isoformat()
            }
            for f in findings
        ]
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

    if doc.application_id:
        app_rec = db.get(Application, doc.application_id)
        if app_rec:
            check_officer_jurisdiction(user, app_rec)

    doc.review_status = req.review_status
    doc.reviewer_notes = req.reviewer_notes
    doc.reviewed_by = user.email
    doc.reviewed_at = datetime.utcnow()

    if doc.application_id:
        record_audit_event(
            db=db,
            application_id=doc.application_id,
            actor=user.email,
            actor_role=user.role,
            action=f"DOC_{req.review_status}",
            from_stage=None,
            to_stage=None,
            details=f"Document '{doc.document_name}' marked as {req.review_status}. Remarks: {req.reviewer_notes}"
        )

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

    if user.role == "institution" and not has_institution_access(user, c):
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
        if not req.officer_comments or len(req.officer_comments.strip()) < 5:
            raise HTTPException(status_code=400, detail="Officer comments (minimum 5 characters) are mandatory when rejecting compliance evidence.")
        c.status = "REJECTED"
    else:
        raise HTTPException(status_code=400, detail="Action must be 'VERIFY' or 'REJECT'.")

    c.verified_by = user.email
    c.verified_at = datetime.utcnow()
    c.officer_comments = req.officer_comments

    if c.application_id:
        record_audit_event(
            db=db,
            application_id=c.application_id,
            actor=user.email,
            actor_role=user.role,
            action=f"COMPLIANCE_{c.status}",
            from_stage=None,
            to_stage=None,
            details=f"Compliance item '{c.item_type}' verified as {c.status} by {user.name}. Remarks: {req.officer_comments or 'None'}"
        )

    db.commit()
    return {"id": cid, "status": c.status, "verified_by": c.verified_by, "comments": c.officer_comments}


@app.get("/api/evc", response_model=List[EVCVisitOut])
def list_evc_visits(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(EVCVisit)
    if user.role == "institution":
        q = q.filter(EVCVisit.institution_name == user.institution_name)
    elif user.role in ["evc", "evc_expert"]:
        q = q.filter(
            or_(
                EVCVisit.assigned_staff_id == user.id,
                EVCVisit.assigned_staff_email == user.email,
                EVCVisit.assigned_by == user.email,
                EVCVisit.committee_members.ilike(f"%{user.email}%"),
                EVCVisit.committee_members.ilike(f"%{user.name}%")
            )
        )


# =====================================================================
# EVC STAFF ALLOCATION, ELIGIBILITY, AND ASSIGNMENT ENGINE
# =====================================================================

def check_application_evc_eligibility(app_rec: Application, db: Session) -> dict:
    """
    Checks if an application satisfies all statutory conditions for EVC inspection allocation:
    - Scrutiny must be completed
    - No unresolved mandatory deficiencies (officer_disposition must be ACCEPTED or WAIVED)
    - Mandatory documents uploaded
    - No active duplicate EVC assignment
    """
    reasons = []
    pending_items = []
    is_eligible = True

    # 1. Stage Check
    if app_rec.current_stage in ["DRAFT", "SUBMITTED"]:
        is_eligible = False
        reasons.append(f"Application is in '{app_rec.current_stage}' stage. Initial regulatory scrutiny must be completed first.")
        pending_items.append("Complete initial Scrutiny")

    # 2. Scrutiny Execution Check
    scrutiny_run_count = db.query(ScrutinyRun).filter(ScrutinyRun.application_id == app_rec.id).count()
    if scrutiny_run_count == 0 and app_rec.current_stage not in ["EVC_PENDING", "EVC_SCHEDULED"]:
        is_eligible = False
        reasons.append("Automated regulatory scrutiny pipeline has not been executed yet.")
        pending_items.append("Execute Regulatory Scrutiny")

    # 3. Unresolved Deficiencies Check
    unresolved_deficiencies = db.query(ScrutinyFinding).filter(
        ScrutinyFinding.application_id == app_rec.id,
        ScrutinyFinding.severity == "DEFICIENCY",
        ScrutinyFinding.officer_disposition.notin_(["ACCEPTED", "WAIVED"])
    ).all()
    if unresolved_deficiencies:
        is_eligible = False
        reasons.append(f"{len(unresolved_deficiencies)} unresolved mandatory deficiency finding(s) require officer waiver or applicant rectification.")
        pending_items.append(f"Resolve {len(unresolved_deficiencies)} Deficiencies")

    # 4. Mandatory Documents Check
    doc_count = db.query(Document).filter(Document.application_id == app_rec.id).count()
    if doc_count == 0:
        is_eligible = False
        reasons.append("No regulatory documents uploaded. Institutional records and title deeds must be submitted.")
        pending_items.append("Upload Mandatory Documents")

    # 5. Active EVC Assignment Check
    existing_active_visit = db.query(EVCVisit).filter(
        EVCVisit.application_id == app_rec.id,
        EVCVisit.status.in_(["SCHEDULED", "IN_PROGRESS"]),
        EVCVisit.assignment_status.in_(["ASSIGNMENT_PENDING", "ACCEPTED", "INSPECTION_SCHEDULED", "IN_PROGRESS"])
    ).first()
    if existing_active_visit:
        is_eligible = False
        reasons.append(f"Application already has an active EVC inspection assignment (Visit #{existing_active_visit.id}, Inspector: {existing_active_visit.assigned_staff_name or existing_active_visit.committee_members}, Status: {existing_active_visit.assignment_status}).")
        pending_items.append("Active Assignment In Progress")

    if is_eligible and not reasons:
        reasons.append("Application satisfies all APH requirements. Scrutiny cleared without unresolved deficiencies. Ready for EVC staff allocation.")

    return {
        "eligible": is_eligible,
        "reasons": reasons,
        "pending_items": pending_items
    }


def run_ai_staff_allocation(app_rec: Application, scheduled_date: date, db: Session) -> tuple[User, str, int]:
    """
    Explainable EVC Staff Allocation Algorithm:
    1. Filters active EVC experts marked as AVAILABLE.
    2. Excludes staff with conflicting scheduled inspections on `scheduled_date`.
    3. Evaluates regional proximity (match with institution region).
    4. Evaluates workload (prefers lower active assignment count).
    5. Evaluates expertise match against application type and notes.
    Returns (best_staff_user, explainable_rationale, match_score).
    """
    candidates = db.query(User).filter(
        User.role.in_(["evc", "evc_expert"]),
        User.is_active == True,
        User.availability_status == "AVAILABLE"
    ).all()

    if not candidates:
        raise HTTPException(
            status_code=422,
            detail="No Available Staff: All registered EVC inspection experts are currently marked unavailable, on leave, or inactive. Manual assignment or later scheduling required."
        )

    eligible_scored = []
    for cand in candidates:
        # Check conflict on the scheduled date
        conflict = db.query(EVCVisit).filter(
            EVCVisit.assigned_staff_id == cand.id,
            EVCVisit.scheduled_date == scheduled_date,
            EVCVisit.status.in_(["SCHEDULED", "IN_PROGRESS"]),
            EVCVisit.assignment_status.in_(["ACCEPTED", "ASSIGNMENT_PENDING", "INSPECTION_SCHEDULED", "IN_PROGRESS"])
        ).first()
        if conflict:
            continue

        # Count active workload
        active_count = db.query(EVCVisit).filter(
            EVCVisit.assigned_staff_id == cand.id,
            EVCVisit.status.in_(["SCHEDULED", "IN_PROGRESS"]),
            EVCVisit.assignment_status.in_(["ASSIGNMENT_PENDING", "ACCEPTED", "INSPECTION_SCHEDULED", "IN_PROGRESS"])
        ).count()

        # Workload limit: maximum 5 active assignments per inspector
        if active_count >= 5:
            continue

        score = 100
        reasons_list = ["Staff active & confirmed available"]

        # Proximity match
        if cand.region and app_rec.region and cand.region.lower() == app_rec.region.lower():
            score += 40
            reasons_list.append(f"{cand.region} jurisdictional proximity (+40 pts)")
        elif cand.region == "HQ":
            score += 20
            reasons_list.append("National Headquarters observer pool (+20 pts)")

        # Workload preference
        workload_penalty = active_count * 15
        score -= workload_penalty
        if active_count == 0:
            score += 20
            reasons_list.append("Zero current active workload (+20 pts)")
        else:
            reasons_list.append(f"{active_count} active case(s) (-{workload_penalty} pts)")

        # Expertise match
        expertise_str = (cand.expertise or "").lower()
        app_context = f"{app_rec.application_type} {app_rec.notes or ''}".lower()
        matched_skills = []
        for kw in ["ai", "computing", "computer", "engineering", "infrastructure", "civil", "mechanical", "electrical", "lab", "safety", "management"]:
            if kw in expertise_str and kw in app_context:
                matched_skills.append(kw)
        if matched_skills:
            score += 25
            reasons_list.append(f"Domain expertise match: {', '.join(matched_skills)} (+25 pts)")

        eligible_scored.append((score, cand, active_count, ", ".join(reasons_list)))

    if not eligible_scored:
        raise HTTPException(
            status_code=422,
            detail=f"No Available Staff: All {len(candidates)} registered EVC experts have scheduling conflicts on {scheduled_date} or exceeded workload limits. Please choose another date or assign manually."
        )

    # Sort descending by score, then ascending by active workload
    eligible_scored.sort(key=lambda x: (x[0], -x[2]), reverse=True)
    best_score, best_cand, best_workload, reasons_str = eligible_scored[0]

    rationale = f"AI Auto-Assigned {best_cand.name} (Allocation Score: {best_score}) based on: {reasons_str}."
    return best_cand, rationale, best_score


@app.get("/api/applications/{aid}/evc-eligibility", response_model=EVCEligibilityOut)
@app.get("/api/v1/applications/{aid}/evc-eligibility", response_model=EVCEligibilityOut)
def get_evc_eligibility(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Inspects and returns eligibility verification for EVC staff allocation."""
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")
    return check_application_evc_eligibility(app_rec, db)


@app.get("/api/evc/staff", response_model=List[EVCStaffOut])
@app.get("/api/v1/evc/staff", response_model=List[EVCStaffOut])
def list_evc_staff(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Retrieves all registered EVC inspection staff with live availability, expertise, and workload metrics."""
    staff_users = db.query(User).filter(User.role.in_(["evc", "evc_expert"])).order_by(User.name).all()
    res = []
    for s in staff_users:
        active_count = db.query(EVCVisit).filter(
            EVCVisit.assigned_staff_id == s.id,
            EVCVisit.status.in_(["SCHEDULED", "IN_PROGRESS"]),
            EVCVisit.assignment_status.in_(["ASSIGNMENT_PENDING", "ACCEPTED", "INSPECTION_SCHEDULED", "IN_PROGRESS"])
        ).count()
        prev_count = db.query(EVCVisit).filter(
            EVCVisit.assigned_staff_id == s.id,
            EVCVisit.status == "COMPLETED"
        ).count()
        res.append(EVCStaffOut(
            id=s.id,
            name=s.name,
            email=s.email,
            role=s.role,
            region=s.region,
            designation=s.designation,
            is_active=s.is_active,
            availability_status=getattr(s, "availability_status", "AVAILABLE") or "AVAILABLE",
            expertise=getattr(s, "expertise", "General Engineering, Technical Labs & Infrastructure") or "General Engineering, Technical Labs & Infrastructure",
            phone=getattr(s, "phone", None),
            active_assignments_count=active_count,
            previous_inspections_count=prev_count
        ))
    return res


@app.post("/api/applications/{aid}/evc/auto-assign", response_model=EVCVisitOut)
@app.post("/api/v1/applications/{aid}/evc/auto-assign", response_model=EVCVisitOut)
def evc_ai_auto_assign(
    aid: int,
    req: EVCAutoAssignRequest = EVCAutoAssignRequest(),
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Officer-triggered AI Auto Assignment:
    1. Validates application eligibility.
    2. Runs explainable AI matching algorithm to select the best available expert.
    3. Saves assignment with AI rationale.
    4. Notifies assigned staff member and logs audit trail.
    """
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    # 1. Eligibility validation
    eligibility = check_application_evc_eligibility(app_rec, db)
    if not eligibility["eligible"]:
        raise HTTPException(
            status_code=400,
            detail=f"Application is not eligible for EVC staff assignment: {'; '.join(eligibility['reasons'])}"
        )

    # 2. Run AI allocation
    sched_date = req.scheduled_date or getattr(req, 'proposed_date', None) or (date.today() + timedelta(days=7))
    best_staff, rationale, match_score = run_ai_staff_allocation(app_rec, sched_date, db)

    # 3. Create or update EVCVisit
    committee_str = f"{best_staff.name} (Chairperson & Lead Expert), AICTE Regional Nominee"
    loc_details = req.location_details or f"{app_rec.institution_name} Campus, {app_rec.region} Region"

    visit = EVCVisit(
        application_id=app_rec.id,
        institution_name=app_rec.institution_name,
        committee_members=committee_str,
        scheduled_date=sched_date,
        visit_mode=req.visit_mode or "PHYSICAL",
        location_details=loc_details,
        status="SCHEDULED",
        assigned_by=user.email,
        assigned_staff_id=best_staff.id,
        assigned_staff_name=best_staff.name,
        assigned_staff_email=best_staff.email,
        assignment_method="AI",
        assignment_status="ASSIGNMENT_PENDING",
        assignment_reason=rationale,
        assigned_at=datetime.utcnow()
    )
    db.add(visit)
    db.flush()

    # 4. Record in EVCAssignmentHistory
    hist = EVCAssignmentHistory(
        application_id=app_rec.id,
        visit_id=visit.id,
        staff_id=best_staff.id,
        staff_name=best_staff.name,
        staff_email=best_staff.email,
        assignment_method="AI",
        assigned_by=user.email,
        assignment_status="ASSIGNMENT_PENDING",
        assignment_reason=rationale,
        assigned_at=datetime.utcnow()
    )
    db.add(hist)

    # 5. Create notification for assigned EVC staff
    db.add(Alert(
        title=f"New EVC Assignment: {app_rec.institution_name}",
        message=f"You have been allocated an EVC inspection for {app_rec.institution_name} ({app_rec.reference}) scheduled on {sched_date}. Please review and Accept or Decline.",
        severity="HIGH",
        target_role="evc_expert",
        recipient_user_id=best_staff.id,
        institution_name=app_rec.institution_name,
        application_id=app_rec.id,
        trigger_type="EVC_ASSIGNMENT"
    ))

    # 6. Record Audit Event & Stage Remark
    prev_stg = app_rec.current_stage
    app_rec.current_stage = "EVC_SCHEDULED"
    app_rec.assigned_to = best_staff.name
    app_rec.assigned_role = "evc_expert"

    record_audit_event(
        db=db,
        application_id=app_rec.id,
        actor=user.email,
        actor_role=user.role,
        action="AI_AUTO_ASSIGN_EVC",
        from_stage=prev_stg,
        to_stage="EVC_SCHEDULED",
        details=f"AI Auto-assigned {best_staff.name} for EVC inspection on {sched_date}. {rationale}"
    )

    db.add(StageRemark(
        application_id=app_rec.id,
        stage="EVC_SCHEDULED",
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=f"EVC Inspection Allocated via AI: {rationale}",
        action_type="EVC_OBSERVATION",
        visibility="APPLICANT_VISIBLE",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(visit)
    return visit


@app.post("/api/applications/{aid}/evc/manual-assign", response_model=EVCVisitOut)
@app.post("/api/v1/applications/{aid}/evc/manual-assign", response_model=EVCVisitOut)
def evc_manual_assign(
    aid: int,
    req: EVCAssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Officer-triggered Manual Assignment:
    1. Validates application eligibility.
    2. Validates selected staff exists, is active, and is available.
    3. Saves assignment and notifies assigned staff.
    """
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    # 1. Eligibility validation
    eligibility = check_application_evc_eligibility(app_rec, db)
    if not eligibility["eligible"]:
        raise HTTPException(
            status_code=400,
            detail=f"Application is not eligible for EVC staff assignment: {'; '.join(eligibility['reasons'])}"
        )

    # 2. Staff validation
    staff = db.get(User, req.staff_id)
    if not staff or staff.role not in ["evc", "evc_expert"] or not staff.is_active:
        raise HTTPException(status_code=404, detail="Selected EVC staff member was not found or is inactive.")

    if getattr(staff, "availability_status", "AVAILABLE") != "AVAILABLE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot assign {staff.name}: Current availability status is '{staff.availability_status}'. Only AVAILABLE staff may be assigned."
        )

    sched_date = req.scheduled_date or getattr(req, 'proposed_date', None) or (date.today() + timedelta(days=7))

    # Conflict check
    conflict = db.query(EVCVisit).filter(
        EVCVisit.assigned_staff_id == staff.id,
        EVCVisit.scheduled_date == sched_date,
        EVCVisit.status.in_(["SCHEDULED", "IN_PROGRESS"]),
        EVCVisit.assignment_status.in_(["ACCEPTED", "ASSIGNMENT_PENDING", "INSPECTION_SCHEDULED", "IN_PROGRESS"])
    ).first()
    if conflict:
        raise HTTPException(
            status_code=400,
            detail=f"Scheduling conflict: {staff.name} already has an inspection assigned on {sched_date} (Visit #{conflict.id} for {conflict.institution_name})."
        )

    committee_str = req.committee_members or f"{staff.name} (Chairperson & Lead Expert), AICTE Regional Nominee"
    loc_details = req.location_details or f"{app_rec.institution_name} Campus, {app_rec.region} Region"
    remarks_str = req.remarks or f"Manual assignment delegated by Regional Officer {user.name}."

    visit = EVCVisit(
        application_id=app_rec.id,
        institution_name=app_rec.institution_name,
        committee_members=committee_str,
        scheduled_date=sched_date,
        visit_mode=req.visit_mode or "PHYSICAL",
        location_details=loc_details,
        status="SCHEDULED",
        assigned_by=user.email,
        assigned_staff_id=staff.id,
        assigned_staff_name=staff.name,
        assigned_staff_email=staff.email,
        assignment_method="MANUAL",
        assignment_status="ASSIGNMENT_PENDING",
        assignment_reason=remarks_str,
        assigned_at=datetime.utcnow()
    )
    db.add(visit)
    db.flush()

    # Record history
    hist = EVCAssignmentHistory(
        application_id=app_rec.id,
        visit_id=visit.id,
        staff_id=staff.id,
        staff_name=staff.name,
        staff_email=staff.email,
        assignment_method="MANUAL",
        assigned_by=user.email,
        assignment_status="ASSIGNMENT_PENDING",
        assignment_reason=remarks_str,
        assigned_at=datetime.utcnow()
    )
    db.add(hist)

    # Notification for staff
    db.add(Alert(
        title=f"New EVC Assignment: {app_rec.institution_name}",
        message=f"You have been manually allocated an EVC inspection for {app_rec.institution_name} ({app_rec.reference}) scheduled on {req.scheduled_date}. Please review and Accept or Decline.",
        severity="HIGH",
        target_role="evc_expert",
        recipient_user_id=staff.id,
        institution_name=app_rec.institution_name,
        application_id=app_rec.id,
        trigger_type="EVC_ASSIGNMENT"
    ))

    prev_stg = app_rec.current_stage
    app_rec.current_stage = "EVC_SCHEDULED"
    app_rec.assigned_to = staff.name
    app_rec.assigned_role = "evc_expert"

    record_audit_event(
        db=db,
        application_id=app_rec.id,
        actor=user.email,
        actor_role=user.role,
        action="MANUAL_ASSIGN_EVC",
        from_stage=prev_stg,
        to_stage="EVC_SCHEDULED",
        details=f"Manually assigned {staff.name} for EVC inspection on {req.scheduled_date}. Remarks: {remarks_str}"
    )

    db.add(StageRemark(
        application_id=app_rec.id,
        stage="EVC_SCHEDULED",
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=f"EVC Inspection Manually Assigned to {staff.name}. Remarks: {remarks_str}",
        action_type="EVC_OBSERVATION",
        visibility="APPLICANT_VISIBLE",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(visit)
    return visit


@app.post("/api/evc/{vid}/respond", response_model=EVCVisitOut)
@app.post("/api/v1/evc/{vid}/respond", response_model=EVCVisitOut)
def respond_to_evc_assignment(
    vid: int,
    req: EVCRespondRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Assigned EVC Staff Member Accept / Decline Action:
    - ACCEPT: Confirms willingness, updates status to ACCEPTED, notifies Officer.
    - DECLINE: Requires reason, updates status to DECLINED, returns application to pending allocation, notifies Officer.
    """
    v = db.get(EVCVisit, vid)
    if not v:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    # Authorization: user must be the assigned staff member or an administrator
    is_assigned = (v.assigned_staff_id == user.id) or (v.assigned_staff_email == user.email) or (user.email in v.committee_members)
    if not is_assigned and user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not the assigned EVC inspector for this visit."
        )

    action = req.action.upper().strip()
    now_dt = datetime.utcnow()

    app_rec = db.get(Application, v.application_id)

    if action == "ACCEPT":
        v.assignment_status = "ACCEPTED"
        v.status = "SCHEDULED"
        v.responded_at = now_dt
        user.availability_status = "BUSY"

        # Create history record
        db.add(EVCAssignmentHistory(
            application_id=v.application_id,
            visit_id=v.id,
            staff_id=user.id,
            staff_name=user.name,
            staff_email=user.email,
            assignment_method=v.assignment_method or "MANUAL",
            assigned_by=v.assigned_by,
            assignment_status="ACCEPTED",
            assignment_reason="Staff confirmed willingness and availability for inspection.",
            assigned_at=v.assigned_at or now_dt,
            responded_at=now_dt
        ))

        # Notify Regional Officer
        db.add(Alert(
            title=f"EVC Assignment Accepted: {v.institution_name}",
            message=f"Expert {user.name} has ACCEPTED the EVC inspection for {v.institution_name} scheduled on {v.scheduled_date}.",
            severity="INFO",
            target_role="officer",
            institution_name=v.institution_name,
            application_id=v.application_id,
            trigger_type="EVC_CONFIRMATION"
        ))

        if app_rec:
            record_audit_event(
                db=db,
                application_id=app_rec.id,
                actor=user.email,
                actor_role=user.role,
                action="EVC_ASSIGNMENT_ACCEPTED",
                from_stage=app_rec.current_stage,
                to_stage=app_rec.current_stage,
                details=f"{user.name} accepted EVC inspection on {v.scheduled_date}."
            )
            db.add(StageRemark(
                application_id=app_rec.id,
                stage=app_rec.current_stage,
                author_name=user.name,
                author_email=user.email,
                author_role=user.role,
                comment_text=f"EVC Inspection Accepted by {user.name} for {v.scheduled_date}.",
                action_type="EVC_OBSERVATION",
                visibility="APPLICANT_VISIBLE",
                created_at=now_dt
            ))

    elif action == "DECLINE":
        if not req.reason or len(req.reason.strip()) < 5:
            raise HTTPException(
                status_code=400,
                detail="Mandatory justification required: Please provide a substantive reason for declining this inspection assignment."
            )
        decline_str = req.reason.strip()
        v.assignment_status = "DECLINED"
        v.status = "PENDING"
        v.decline_reason = decline_str
        v.responded_at = now_dt

        # Release staff availability
        user.availability_status = "AVAILABLE"

        # Return application to EVC_PENDING queue for Officer reassignment
        if app_rec:
            prev_stg = app_rec.current_stage
            app_rec.current_stage = "EVC_PENDING"
            app_rec.assigned_to = "Regional Officer (Reassignment Required)"
            app_rec.assigned_role = "officer"

            record_audit_event(
                db=db,
                application_id=app_rec.id,
                actor=user.email,
                actor_role=user.role,
                action="EVC_ASSIGNMENT_DECLINED",
                from_stage=prev_stg,
                to_stage="EVC_PENDING",
                details=f"{user.name} declined EVC inspection on {v.scheduled_date}. Reason: {decline_str}"
            )
            db.add(StageRemark(
                application_id=app_rec.id,
                stage="EVC_PENDING",
                author_name=user.name,
                author_email=user.email,
                author_role=user.role,
                comment_text=f"EVC Inspection Declined by {user.name}. Reason: {decline_str}. Case returned to Officer allocation queue.",
                action_type="EVC_OBSERVATION",
                visibility="APPLICANT_VISIBLE",
                created_at=now_dt
            ))

        db.add(EVCAssignmentHistory(
            application_id=v.application_id,
            visit_id=v.id,
            staff_id=user.id,
            staff_name=user.name,
            staff_email=user.email,
            assignment_method=v.assignment_method or "MANUAL",
            assigned_by=v.assigned_by,
            assignment_status="DECLINED",
            decline_reason=decline_str,
            assigned_at=v.assigned_at or now_dt,
            responded_at=now_dt
        ))

        # Urgent notification to Regional Officer
        db.add(Alert(
            title=f"EVC Assignment DECLINED: {v.institution_name}",
            message=f"Expert {user.name} has DECLINED the EVC inspection for {v.institution_name}. Reason: {decline_str}. Reassignment required.",
            severity="HIGH",
            target_role="officer",
            institution_name=v.institution_name,
            application_id=v.application_id,
            trigger_type="EVC_DECLINE"
        ))

    else:
        raise HTTPException(status_code=400, detail="Invalid action: Expected 'ACCEPT' or 'DECLINE'.")

    db.commit()
    db.refresh(v)
    return v


@app.post("/api/evc/staff/availability", response_model=UserOut)
@app.post("/api/v1/evc/staff/availability", response_model=UserOut)
def update_evc_staff_availability(
    req: EVCStaffAvailabilityUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Allows EVC staff to manually update their live availability status (AVAILABLE, UNAVAILABLE, ON_LEAVE)."""
    valid_statuses = ["AVAILABLE", "UNAVAILABLE", "ON_LEAVE", "BUSY"]
    new_status = req.availability_status.upper().strip()
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid availability status. Must be one of: {valid_statuses}")

    user.availability_status = new_status
    db.commit()
    db.refresh(user)
    return user


@app.get("/api/applications/{aid}/evc/history", response_model=List[EVCAssignmentHistoryOut])
@app.get("/api/v1/applications/{aid}/evc/history", response_model=List[EVCAssignmentHistoryOut])
def get_evc_assignment_history(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Retrieves full chronological history of EVC assignments, acceptances, rejections, and reassignments."""
    return db.query(EVCAssignmentHistory).filter(
        EVCAssignmentHistory.application_id == aid
    ).order_by(EVCAssignmentHistory.assigned_at.desc()).all()


@app.get("/api/admin/role-matrix")
@app.get("/api/v1/admin/role-matrix")
def get_role_matrix(db: Session = Depends(get_db), admin: User = Depends(strict_admin_only)):
    """Admin-only endpoint returning system role definitions and permissions matrix."""
    users = db.query(User).filter(User.is_active == True).all()
    user_roster = [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "region": u.region,
            "designation": u.designation,
            "availability_status": getattr(u, "availability_status", "AVAILABLE") or "AVAILABLE"
        }
        for u in users
    ]
    return {
        "status": "AUTHORIZED",
        "admin_user": admin.email,
        "users": user_roster,
        "matrix": [
            {"feature": "Create New Application", "institution": True, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Application Register Access", "institution": True, "officer": False, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Scrutiny & Re-Scrutiny", "institution": False, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Return Case for Clarification", "institution": False, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Resubmit Returned Application", "institution": True, "officer": False, "bureau": False, "evc_expert": False, "admin": True},
            {"feature": "AI & Manual EVC Staff Assignment", "institution": False, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Confirm / Decline EVC Assignment", "institution": False, "officer": False, "bureau": False, "evc_expert": True, "admin": True},
            {"feature": "Submit EVC Inspection Report & Proof", "institution": False, "officer": False, "bureau": False, "evc_expert": True, "admin": True},
            {"feature": "Approve Next Stage (EVC Clearance)", "institution": False, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Verify Compliance Evidence", "institution": False, "officer": True, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Submit Compliance Evidence", "institution": True, "officer": False, "bureau": False, "evc_expert": False, "admin": True},
            {"feature": "SAC / SHC Final Approval", "institution": False, "officer": False, "bureau": True, "evc_expert": False, "admin": True},
            {"feature": "Role Matrix & Governance", "institution": False, "officer": False, "bureau": False, "evc_expert": False, "admin": True}
        ]
    }

    return q.order_by(EVCVisit.scheduled_date).all()


@app.post("/api/evc", response_model=EVCVisitOut, status_code=201)
def schedule_evc_visit(
    req: EVCVisitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    app_rec = db.get(Application, req.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

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

    if app_rec.current_stage in ["SCRUTINY", "EVC_PENDING"]:
        prev_stg = app_rec.current_stage
        app_rec.current_stage = "EVC_SCHEDULED"
        record_audit_event(
            db=db,
            application_id=app_rec.id,
            actor=user.email,
            actor_role=user.role,
            action="SCHEDULE_EVC",
            from_stage=prev_stg,
            to_stage="EVC_SCHEDULED",
            details=f"EVC visit scheduled on {req.scheduled_date}. Panel: {req.committee_members}"
        )

    db.commit()
    db.refresh(visit)
    return visit


@app.post("/api/evc/{vid}/update", response_model=EVCVisitOut)
@app.post("/api/v1/evc/{vid}/update", response_model=EVCVisitOut)
def update_evc_visit(
    vid: int,
    req: EVCVisitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    v = db.get(EVCVisit, vid)
    if not v:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, v.application_id)
    if app_rec:
        if user.role == "officer":
            check_officer_jurisdiction(user, app_rec)
        elif user.role in ["evc", "evc_expert"]:
            check_evc_assignment(user, app_rec, db)

    if req.actual_date is not None:
        v.actual_date = req.actual_date
    if req.location_details is not None:
        v.location_details = req.location_details
    if req.visit_occurred is not None:
        v.visit_occurred = req.visit_occurred
    if req.missed_reason is not None:
        v.missed_reason = req.missed_reason
    if req.evidence_verification_status is not None:
        v.evidence_verification_status = req.evidence_verification_status
    if req.inspection_outcome is not None:
        v.inspection_outcome = req.inspection_outcome
    if req.structured_checklist is not None:
        v.structured_checklist = json.dumps(req.structured_checklist) if isinstance(req.structured_checklist, dict) else str(req.structured_checklist)
    if req.report_summary:
        v.report_summary = req.report_summary
    if req.recommendations:
        v.recommendations = req.recommendations

    if req.visit_occurred == "DID_NOT_OCCUR":
        v.status = "POSTPONED"
    elif req.status is not None:
        v.status = req.status

    if app_rec and v.status == "COMPLETED" and v.visit_occurred == "OCCURRED" and app_rec.current_stage == "EVC_SCHEDULED":
        app_rec.current_stage = "EVC_COMPLETED"
        record_audit_event(
            db=db,
            application_id=app_rec.id,
            actor=user.email,
            actor_role=user.role,
            action="COMPLETE_EVC",
            from_stage="EVC_SCHEDULED",
            to_stage="EVC_COMPLETED",
            details=f"EVC visit conducted. Findings: {req.report_summary}"
        )

    db.commit()
    db.refresh(v)
    return v

@app.post("/api/evc/{vid}/reschedule", response_model=EVCVisitOut)
@app.post("/api/v1/evc/{vid}/reschedule", response_model=EVCVisitOut)
def reschedule_evc_visit(
    vid: int,
    req: EVCRescheduleRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """Reschedules an EVC visit with mandatory justification and triggers notifications."""
    v = db.get(EVCVisit, vid)
    if not v:
        raise HTTPException(status_code=404, detail="EVC visit not found.")
    app_rec = db.get(Application, v.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")

    old_date = v.scheduled_date
    v.scheduled_date = req.new_date
    v.missed_reason = req.reason.strip()
    if req.visit_mode:
        v.visit_mode = req.visit_mode
    v.status = "SCHEDULED"

    record_audit_event(
        db=db,
        application_id=app_rec.id,
        actor=user.email,
        actor_role=user.role,
        action="RESCHEDULE_EVC",
        from_stage=app_rec.current_stage,
        to_stage=app_rec.current_stage,
        details=f"EVC inspection rescheduled from {old_date} to {req.new_date}. Justification: {req.reason.strip()}"
    )

    db.add(Alert(
        title=f"EVC Inspection Rescheduled: {app_rec.institution_name}",
        message=f"EVC visit has been rescheduled to {req.new_date}. Reason: {req.reason.strip()}",
        severity="WARNING",
        target_role="all",
        institution_name=app_rec.institution_name,
        application_id=app_rec.id,
        trigger_type="EVC_SCHEDULE_CHANGE"
    ))

    db.add(StageRemark(
        application_id=app_rec.id,
        stage=app_rec.current_stage,
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=f"EVC inspection rescheduled from {old_date} to {req.new_date}. Reason: {req.reason.strip()}",
        action_type="EVC_OBSERVATION",
        visibility="APPLICANT_VISIBLE",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(v)
    return v

@app.post("/api/evc/{vid}/approve-next-stage", response_model=ApplicationOut)
@app.post("/api/v1/evc/{vid}/approve-next-stage", response_model=ApplicationOut)
def evc_approve_next_stage(
    vid: int,
    req: EVCApproveNextStageRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Approve Next Stage action on EVC review screen:
    Verifies stage, confirms visit occurred, validates inspection evidence, records remarks,
    advances application to next stage (SAC/SHC review or Compliance), and writes audit trail.
    """
    v = db.get(EVCVisit, vid)
    if not v:
        raise HTTPException(status_code=404, detail="EVC visit not found.")
    app_rec = db.get(Application, v.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")

    if app_rec.current_stage not in ["EVC_SCHEDULED", "EVC_COMPLETED"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve next stage from current stage '{app_rec.current_stage}'. Application must be in EVC_SCHEDULED or EVC_COMPLETED."
        )

    if v.visit_occurred == "DID_NOT_OCCUR":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance application: EVC visit was marked as DID NOT OCCUR ({v.missed_reason or 'No reason provided'}). Inspection must be rescheduled."
        )

    if v.status != "COMPLETED":
        raise HTTPException(
            status_code=400,
            detail="Cannot advance application: EVC inspection findings report has not been submitted and marked COMPLETED."
        )

    evidences = db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == vid).all()
    if not evidences:
        raise HTTPException(
            status_code=400,
            detail="Cannot advance application: Mandatory geotagged inspection evidence/photographs are missing. Evidence must be uploaded before stage clearance."
        )

    rejected_evidences = [e for e in evidences if e.verification_status == "REJECTED"]
    if rejected_evidences:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot advance application: {len(rejected_evidences)} inspection evidence item(s) are marked as REJECTED."
        )

    target = req.target_stage or "SAC_SHC_REVIEW"
    prev_stage = app_rec.current_stage
    app_rec.current_stage = target
    app_rec.status = "IN_PROGRESS"
    app_rec.assigned_to = "Bureau Officer" if target == "SAC_SHC_REVIEW" else "Regional Officer"
    app_rec.assigned_role = "bureau" if target == "SAC_SHC_REVIEW" else "officer"

    v.evidence_verification_status = "VERIFIED"
    for e in evidences:
        if e.verification_status != "VERIFIED":
            e.verification_status = "VERIFIED"
            e.verified_by = user.email
            e.verified_at = datetime.utcnow()

    remarks_text = req.remarks.strip() or f"EVC physical inspection cleared and verified by {user.name} ({user.role})."

    record_audit_event(
        db=db,
        application_id=app_rec.id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_APPROVE_NEXT_STAGE",
        from_stage=prev_stage,
        to_stage=target,
        details=f"EVC Inspection Approved. Target Stage: {target}. Remarks: {remarks_text}"
    )

    db.add(Alert(
        title=f"EVC Inspection Approved: {app_rec.institution_name}",
        message=f"EVC inspection has been formally approved and advanced to '{target}'. Remarks: {remarks_text}",
        severity="INFO",
        target_role="all",
        institution_name=app_rec.institution_name,
        application_id=app_rec.id,
        trigger_type="STAGE_ADVANCE"
    ))

    db.add(StageRemark(
        application_id=app_rec.id,
        stage=prev_stage,
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=f"EVC Stage Approved: {remarks_text}",
        action_type="EVC_OBSERVATION",
        visibility="APPLICANT_VISIBLE",
        created_at=datetime.utcnow()
    ))

    db.commit()
    db.refresh(app_rec)
    return app_rec

@app.get("/api/evc/{vid}/evidence", response_model=List[InspectionEvidenceOut])
@app.get("/api/v1/evc/{vid}/evidence", response_model=List[InspectionEvidenceOut])
def list_visit_evidence(vid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")
    return db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == vid).order_by(InspectionEvidence.created_at.desc()).all()

@app.post("/api/evc/evidence/{eid}/verify", response_model=InspectionEvidenceOut)
@app.post("/api/v1/evc/evidence/{eid}/verify", response_model=InspectionEvidenceOut)
def verify_inspection_evidence(
    eid: int,
    req: InspectionEvidenceVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    ev = db.get(InspectionEvidence, eid)
    if not ev:
        raise HTTPException(status_code=404, detail="Inspection evidence not found.")

    action = req.action.upper().strip()
    ev.verification_status = "VERIFIED" if action == "VERIFY" else "REJECTED"
    ev.verified_by = user.email
    ev.verified_at = datetime.utcnow()
    if req.remarks:
        ev.remarks = f"[{action}] {req.remarks.strip()}"

    db.commit()
    db.refresh(ev)
    return ev


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


# --- V1 REST API Router (SIH Agreed API Contract) ---

v1_router = APIRouter(prefix="/api/v1", tags=["v1"])


@v1_router.get("/applications", response_model=List[ApplicationOut])
def v1_list_applications(
    stage: Optional[str] = None,
    status: Optional[str] = None,
    app_type: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    return list_applications(stage=stage, status=status, app_type=app_type, search=search, db=db, user=user)


@v1_router.post("/applications", response_model=ApplicationOut, status_code=201)
def v1_create_application(
    req: ApplicationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    valid_types = [
        "Extension of Approval",
        "Extension of Approval (EOA)",
        "New Programme/Level",
        "New Programme / Level",
        "New Course",
        "Compliance Submission",
        "New Institution",
        "Institutional Change"
    ]
    if not req.application_type or req.application_type.strip() not in valid_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid application type '{req.application_type}'. Must be one of: {valid_types}."
        )

    # Check if this should be treated as draft
    is_draft = getattr(req, "is_draft", False) or ("draft" in (req.notes or "").lower())
    req.is_draft = is_draft

    if not is_draft:
        if not req.notes or len(req.notes.strip()) < 5:
            raise HTTPException(
                status_code=422,
                detail="Application notes/details are required (minimum 5 characters)."
            )
        if not req.academic_year or len(req.academic_year.strip()) < 4:
            raise HTTPException(
                status_code=422,
                detail="Valid academic year is required (e.g. 2026-2027)."
            )

    return create_application(req=req, db=db, user=user)


@v1_router.get("/applications/{aid}")
def v1_get_application(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_application_details(aid=aid, db=db, user=user)


@v1_router.patch("/applications/{aid}", response_model=ApplicationOut)
def v1_patch_application(
    aid: int,
    req: ApplicationUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution":
        if not has_institution_access(user, a):
            raise HTTPException(status_code=403, detail="Forbidden. Cannot modify other institutions' records.")
        if a.status in ["COMPLETED", "REJECTED"]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot edit application while in status '{a.status}'. Editing is only permitted for active drafts or pending cases."
            )

    if req.application_type is not None:
        a.application_type = req.application_type
    if req.academic_year is not None:
        a.academic_year = req.academic_year
    if req.notes is not None:
        a.notes = req.notes
    if req.due_date is not None:
        a.due_date = req.due_date
    if req.region is not None and user.role != "institution":
        a.region = req.region
    if req.form_data is not None:
        a.form_data = json.dumps(req.form_data) if isinstance(req.form_data, dict) else str(req.form_data)

    a.updated_at = datetime.utcnow()
    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="APP_UPDATED",
        from_stage=a.current_stage,
        to_stage=a.current_stage,
        details=f"Application details updated by {user.name}."
    )
    db.commit()
    db.refresh(a)
    return a


@v1_router.post("/applications/{aid}/documents")
async def v1_upload_application_document(
    aid: int,
    file: UploadFile = File(...),
    document_type: str = Form("LEASE_DEED"),
    document_name: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. You can only attach documents to your own applications.")

    if a.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Cannot upload documents for an application that has reached final decision.")

    upload_res = await process_and_store_upload(file)
    extracted_text = upload_res["extracted_text"]

    ai_result = await review_document(
        document_name=document_name or upload_res["original_filename"],
        document_type=document_type,
        text=upload_res["extracted_text"]
    )

    try:
        doc = Document(
            application_id=aid,
            institution_name=a.institution_name,
            document_name=document_name or upload_res["original_filename"],
            stored_filename=upload_res.get("stored_filename"),
            document_type=document_type,
            file_path=upload_res["stored_filepath"],
            file_size=upload_res["file_size"],
            file_hash=upload_res.get("file_hash"),
            mime_type=upload_res["mime_type"],
            uploaded_by=user.email,
            ocr_status=upload_res.get("extraction_status", "SUCCESS"),
            processing_status="COMPLETED" if upload_res.get("is_readable") else "NEEDS_REVIEW",
            authenticity_status="UNVERIFIED",
            regulatory_status="PENDING_EVALUATION",
            extracted_text=upload_res["extracted_text"][:10000],
            extracted_fields=json.dumps(ai_result.get("extracted_fields", {})),
            ai_summary=ai_result.get("summary"),
            ai_findings=json.dumps(ai_result),
            ai_confidence=float(ai_result.get("confidence_score", 0.9)),
            review_status="PENDING"
        )
        db.add(doc)
        db.flush()

        record_audit_event(
            db=db,
            application_id=aid,
            actor=user.email,
            actor_role=user.role,
            action="DOC_UPLOADED",
            from_stage=a.current_stage,
            to_stage=a.current_stage,
            details=f"Document '{doc.document_name}' ({doc.document_type}) uploaded by {user.name}. SHA-256: {upload_res.get('file_hash', 'N/A')[:16]}..."
        )
        a.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(doc)
    except Exception as db_err:
        db.rollback()
        delete_stored_document(upload_res.get("stored_filename", ""))
        raise db_err

    return {
        "message": f"Document '{doc.document_name}' successfully attached to application {a.reference}.",
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


@v1_router.get("/documents/{did}/download")
def v1_download_document(did: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return download_document(did=did, db=db, user=user)


@v1_router.post("/applications/{aid}/submit", response_model=ApplicationOut)
async def v1_submit_application(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot submit other institutions' records.")

    if a.status != "DRAFT" and a.current_stage != "DRAFT":
        raise HTTPException(
            status_code=400,
            detail=f"Application is already submitted (current status: {a.status}, stage: {a.current_stage})."
        )

    if not a.notes or len(a.notes.strip()) < 5:
        raise HTTPException(
            status_code=422,
            detail="Application notes/details are required before submission."
        )

    doc_count = db.query(Document).filter(Document.application_id == aid).count()
    if doc_count == 0:
        raise HTTPException(
            status_code=422,
            detail="At least one required supporting document must be uploaded before submitting the application."
        )

    prev_stage = a.current_stage
    a.current_stage = "SCRUTINY"
    a.status = "IN_PROGRESS"
    a.assigned_to = "Regional Officer"
    a.assigned_role = "officer"
    a.submission_date = date.today()
    a.updated_at = datetime.utcnow()

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="SUBMITTED",
        from_stage=prev_stage,
        to_stage="SCRUTINY",
        details=f"Application formally submitted for regulatory scrutiny by {user.name} ({user.role}) with {doc_count} document(s)."
    )

    db.add(Alert(
        title=f"New Application Submitted: {a.reference}",
        message=f"{a.institution_name} submitted {a.application_type} for AY {a.academic_year}.",
        severity="INFO",
        target_role="officer",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="STAGE_CHANGE"
    ))

    db.commit()
    db.refresh(a)
    try:
        await execute_scrutiny_pipeline(aid, db, user.email, "INITIAL")
    except Exception as e:
        logger.warning(f"Initial scrutiny pipeline failed on v1 submission: {e}")
    return a


@v1_router.post("/applications/{aid}/resubmit", response_model=ApplicationOut)
async def v1_resubmit_application(
    aid: int,
    req: ApplicationResubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")

    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot resubmit other institutions' records.")

    if user.role not in ["institution", "admin"]:
        raise HTTPException(status_code=403, detail="Only applicant institutions or admins can resubmit returned cases.")

    if a.current_stage != "RETURNED_FOR_CLARIFICATION" and a.status != "RETURNED":
        raise HTTPException(
            status_code=400,
            detail=f"Application cannot be resubmitted. Current status: '{a.status}', stage: '{a.current_stage}'. Resubmission is only allowed for returned cases."
        )

    reason = req.reason or req.explanation or req.response_text or ""
    if len(reason.strip()) < 3:
        raise HTTPException(
            status_code=422,
            detail="A detailed rectification explanation (minimum 3 characters) is mandatory when resubmitting an application."
        )

    target_stage = "RE_SCRUTINY" if req.response_text else "SCRUTINY"
    prev_stage = a.current_stage
    a.current_stage = target_stage
    a.status = "IN_PROGRESS"
    a.assigned_to = "Regional Officer"
    a.assigned_role = "officer"
    a.updated_at = datetime.utcnow()

    # Resolve pending correction requests
    pending_crs = db.query(CorrectionRequest).filter(
        CorrectionRequest.application_id == aid,
        CorrectionRequest.status == "PENDING"
    ).all()
    for cr in pending_crs:
        cr.status = "RESUBMITTED"
        cr.institution_response = reason.strip()

    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="RESUBMIT",
        from_stage=prev_stage,
        to_stage=target_stage,
        details=f"Clarification resubmitted by {user.name} ({user.role}): {reason.strip()}"
    )

    db.add(Alert(
        title=f"Clarification Resubmitted: {a.reference}",
        message=f"{a.institution_name} resubmitted application with justification: {reason.strip()}",
        severity="INFO",
        target_role="officer",
        institution_name=a.institution_name,
        application_id=aid,
        trigger_type="STAGE_CHANGE"
    ))

    db.commit()
    db.refresh(a)
    try:
        await execute_scrutiny_pipeline(aid, db, user.email, "RE_SCRUTINY")
    except Exception as e:
        logger.warning(f"Re-scrutiny pipeline failed on v1 resubmission: {e}")
    return a


@v1_router.get("/applications/{aid}/timeline", response_model=List[AuditEventOut])
def v1_get_timeline(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return db.query(AuditEvent).filter(AuditEvent.application_id == aid).order_by(AuditEvent.created_at.asc()).all()


@app.get("/api/applications/{aid}/audit/verify")
@v1_router.get("/applications/{aid}/audit/verify")
def v1_verify_audit(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    a = db.get(Application, aid)
    if not a:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, a):
        raise HTTPException(status_code=403, detail="Forbidden.")
    return verify_audit_chain(db, aid)



@v1_router.get("/notifications", response_model=List[AlertOut])
def v1_list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    q = db.query(Alert)
    if user.role == "institution":
        q = q.filter(
            or_(
                Alert.institution_name == user.institution_name,
                and_(Alert.institution_name.is_(None), Alert.target_role.in_(["institution", "all", "ALL"]))
            )
        )
    else:
        q = q.filter(
            or_(
                Alert.target_role.in_([user.role, "all", "ALL", None])
            )
        )
    return q.order_by(desc(Alert.created_at)).all()


@v1_router.patch("/notifications/{nid}/read", response_model=AlertOut)
@v1_router.post("/notifications/{nid}/read", response_model=AlertOut)
def v1_mark_notification_read(nid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    al = db.get(Alert, nid)
    if not al:
        raise HTTPException(status_code=404, detail="Notification not found.")
    if user.role == "institution" and al.institution_name and al.institution_name != user.institution_name:
        raise HTTPException(status_code=403, detail="Forbidden.")
    al.is_read = True
    db.commit()
    db.refresh(al)
    return al


@v1_router.get("/applications/{aid}/next-action", response_model=NextBestActionOut)
def v1_get_application_next_action(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_application_next_action(aid=aid, db=db, user=user)


@v1_router.get("/applications/{aid}/extracted-fields", response_model=List[CandidateFieldOut])
def v1_get_application_extracted_fields(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_application_extracted_fields(aid=aid, db=db, user=user)


@v1_router.post("/applications/{aid}/apply-extracted-fields")
def v1_apply_application_extracted_fields(aid: int, req: ApplyExtractedFieldsRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return apply_application_extracted_fields(aid=aid, req=req, db=db, user=user)


@v1_router.get("/analytics/bottlenecks", response_model=BottleneckAnalyticsOut)
def v1_get_bottleneck_analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_bottleneck_analytics(db=db, user=user)


@v1_router.get("/audit/recent", response_model=List[RecentAuditEventOut])
def v1_get_recent_audit_events(limit: int = 10, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_recent_audit_events(limit=limit, db=db, user=user)


app.include_router(v1_router)

# --- Regulatory Categories (Search-based Options) ---

@app.get("/api/regulatory-categories")
@app.get("/api/v1/regulatory-categories")
def get_regulatory_categories(
    search: Optional[str] = Query(None),
    institution_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(RegulatoryCategory).filter(RegulatoryCategory.is_active == True)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(or_(
            RegulatoryCategory.title.ilike(s),
            RegulatoryCategory.description.ilike(s),
            RegulatoryCategory.category_code.ilike(s),
            RegulatoryCategory.institution_type.ilike(s)
        ))
    if institution_type and institution_type != "ALL":
        q = q.filter(RegulatoryCategory.institution_type.ilike(f"%{institution_type}%"))
    
    cats = q.order_by(RegulatoryCategory.id).all()
    results = []
    for c in cats:
        # json already imported at top
        req_docs = json.loads(c.required_documents_json) if c.required_documents_json else []
        seq = json.loads(c.workflow_sequence_json) if c.workflow_sequence_json else []
        results.append({
            "id": c.id,
            "category_code": c.category_code,
            "title": c.title,
            "institution_type": c.institution_type,
            "description": c.description,
            "required_documents": req_docs,
            "workflow_sequence": seq,
            "sla_days": c.sla_days
        })
    return results


# --- Stage Remarks & Chronological Comments ---

@app.get("/api/applications/{aid}/remarks")
@app.get("/api/v1/applications/{aid}/remarks")
def get_stage_remarks(
    aid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    if user.role == "institution" and not has_institution_access(user, app_rec):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot view remarks for another institution.")
    
    q = db.query(StageRemark).filter(StageRemark.application_id == aid)
    if user.role == "institution":
        q = q.filter(StageRemark.visibility == "APPLICANT_VISIBLE")
    
    remarks = q.order_by(StageRemark.created_at.asc()).all()
    return remarks


@app.post("/api/applications/{aid}/remarks", status_code=201, response_model=StageRemarkOut)
@app.post("/api/v1/applications/{aid}/remarks", status_code=201, response_model=StageRemarkOut)
def add_stage_remark(
    aid: int,
    req: StageRemarkCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    stage = req.stage or "SCRUTINY"
    comment_text = (req.comment_text or req.remark or "").strip()
    if not comment_text:
        raise HTTPException(status_code=422, detail="Remark / comment text is required.")
    visibility = req.visibility or "APPLICANT_VISIBLE"
    document_reference = req.document_reference
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    if user.role == "institution":
        if not has_institution_access(user, app_rec):
            raise HTTPException(status_code=403, detail="Forbidden.")
        visibility = "APPLICANT_VISIBLE"

    if visibility not in ["APPLICANT_VISIBLE", "INTERNAL_OFFICER_ONLY"]:
        visibility = "APPLICANT_VISIBLE"

    action_type = req.action_type or "REVIEW_COMMENT"
    rem = StageRemark(
        application_id=aid,
        stage=stage,
        author_name=user.name,
        author_email=user.email,
        author_role=user.role,
        comment_text=comment_text.strip(),
        action_type=action_type,
        visibility=visibility,
        document_reference=document_reference,
        parent_remark_id=req.parent_remark_id
    )
    db.add(rem)
    
    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="STAGE_REMARK_ADDED",
        from_stage=app_rec.current_stage,
        to_stage=app_rec.current_stage,
        details=f"[{visibility}] Remark by {user.name} ({user.role}) on stage '{stage}': {comment_text[:80]}..."
    )
    
    db.commit()
    db.refresh(rem)
    return rem


# --- EVC Visit Evidence Upload ---



# ==============================================================================
# AI-Powered EVC Visit Proof & Authenticity Verification Subsystem
# ==============================================================================

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance in kilometers between two GPS coordinates."""
    r = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2.0)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return round(r * c, 3)


def compute_combined_evc_assessment(
    visit: EVCVisit,
    evidences: List[InspectionEvidence],
    inst: Optional[Institution] = None
) -> Dict[str, Any]:
    """
    Synthesizes independent image analysis, GPS location, timestamp, and checklist signals
    into a structured assessment without fabricating artificial overall scores.
    """
    total_photos = len(evidences)
    analyzed_photos = sum(1 for e in evidences if e.ai_analysis_status == "COMPLETED")
    failed_photos = sum(1 for e in evidences if e.ai_analysis_status == "FAILED")
    unavailable_photos = sum(1 for e in evidences if e.ai_analysis_status == "UNAVAILABLE")
    duplicates = sum(1 for e in evidences if e.is_duplicate)

    categories_present = list({e.evidence_type for e in evidences if e.evidence_type})
    core_categories = ["ENTRANCE_SIGNBOARD", "CAMPUS_BUILDINGS", "CLASSROOMS", "LABORATORIES_WORKSHOPS"]
    missing_core = [c for c in core_categories if c not in categories_present]

    has_gps = visit.gps_latitude is not None and visit.gps_longitude is not None
    location_summary = {
        "gps_available": has_gps,
        "latitude": visit.gps_latitude,
        "longitude": visit.gps_longitude,
        "accuracy_meters": visit.gps_accuracy,
        "distance_km": visit.gps_distance_km,
        "location_status": visit.location_status or ("BASELINE_UNAVAILABLE" if has_gps else "UNAVAILABLE")
    }

    timestamps = [e.captured_at or e.created_at for e in evidences if e.created_at]
    earliest = min(timestamps).isoformat() if timestamps else None
    latest = max(timestamps).isoformat() if timestamps else None

    # Determine overall qualitative assessment
    if total_photos == 0:
        overall_status = "Insufficient Evidence"
    elif duplicates > 0:
        overall_status = "Evidence Requires Review"
    elif unavailable_photos == total_photos:
        overall_status = "AI Analysis Unavailable"
    elif failed_photos > 0 or len(missing_core) > 2:
        overall_status = "Evidence Requires Review"
    else:
        overall_status = "Evidence Appears Relevant"

    return {
        "overall_status": overall_status,
        "image_analysis": {
            "total_photographs": total_photos,
            "analyzed_count": analyzed_photos,
            "failed_count": failed_photos,
            "unavailable_count": unavailable_photos,
            "duplicate_warnings_count": duplicates,
            "categories_present": categories_present,
            "missing_core_categories": missing_core
        },
        "location_evidence": location_summary,
        "timestamp_evidence": {
            "earliest_timestamp": earliest,
            "latest_timestamp": latest,
            "timestamp_consistency": "CONSISTENT"
        },
        "submission_completeness": {
            "total_photographs": total_photos,
            "minimum_photographs_met": total_photos >= 1,
            "has_declaration": bool(visit.proof_declaration),
            "status": visit.proof_submission_status or "NOT_SUBMITTED"
        }
    }


@app.post("/api/evc/{vid}/evidence", status_code=201, response_model=InspectionEvidenceOut)
@app.post("/api/v1/evc/{vid}/evidence", status_code=201, response_model=InspectionEvidenceOut)
async def upload_inspection_evidence(
    vid: int,
    file: UploadFile = File(...),
    evidence_type: str = Form("CAMPUS_BUILDINGS"),
    remarks: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    captured_at: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    """
    Uploads inspection photograph evidence with GPS location metadata,
    computes SHA-256 integrity hash, checks for duplicates, and associates with visit.
    """
    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    # Strict RBAC assignment check for EVC Experts
    if user.role == "evc_expert":
        check_evc_assignment(user, app_rec, db)
    elif user.role == "officer":
        check_officer_jurisdiction(user, app_rec)
    elif user.role == "institution":
        raise HTTPException(status_code=403, detail="Institutions cannot upload EVC inspection evidence.")

    # Max evidence count check (up to 15 photos per inspection)
    existing_count = db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == vid).count()
    if existing_count >= 15:
        raise HTTPException(status_code=400, detail="Maximum limit of 15 photographs per inspection reached.")

    # Validate supported image format
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, and WebP image formats are allowed for inspection photograph evidence."
        )

    # Process and store physical upload safely
    upload_res = await process_and_store_upload(file)
    f_hash = upload_res.get("file_hash")

    # Read stored bytes to compute perceptual hash and check image integrity
    phash_val = None
    stored_path = upload_res.get("absolute_path") or resolve_storage_path(upload_res["stored_filepath"])
    if os.path.exists(stored_path):
        try:
            with open(stored_path, "rb") as bf:
                img_bytes = bf.read()
            phash_val = compute_image_phash(img_bytes)
        except Exception:
            phash_val = None

    # Check for duplicate evidence across any inspection visit
    is_dup = False
    dup_ref = None
    existing_dup = db.query(InspectionEvidence).filter(
        InspectionEvidence.file_hash == f_hash,
        InspectionEvidence.visit_id != vid
    ).first()

    if existing_dup:
        is_dup = True
        dup_ref = f"Exact duplicate of evidence ID #{existing_dup.id} in Inspection #{existing_dup.visit_id}"

    # Parse capture timestamp if provided
    capture_dt = None
    if captured_at:
        try:
            capture_dt = datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        except Exception:
            capture_dt = datetime.utcnow()

    evidence = InspectionEvidence(
        visit_id=vid,
        application_id=visit.application_id,
        evidence_type=evidence_type,
        file_name=upload_res["original_filename"],
        file_path=stored_path,
        file_hash=f_hash,
        file_size=upload_res["file_size"],
        uploaded_by=user.email,
        remarks=remarks,
        gps_latitude=latitude,
        gps_longitude=longitude,
        gps_accuracy=accuracy,
        captured_at=capture_dt,
        is_duplicate=is_dup,
        duplicate_reference=dup_ref,
        phash=phash_val,
        ai_analysis_status="PENDING",
        verification_status="PENDING"
    )
    db.add(evidence)

    # Update visit status to EVIDENCE_UPLOADED if not already further along
    if visit.proof_submission_status in ["NOT_SUBMITTED", None]:
        visit.proof_submission_status = "EVIDENCE_UPLOADED"

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_EVIDENCE_UPLOADED",
        from_stage="EVC_SCHEDULED",
        to_stage=visit.status or "EVC_SCHEDULED",
        details=f"Uploaded photo '{upload_res['original_filename']}' ({evidence_type}) SHA-256: {f_hash[:16]}..."
    )

    db.commit()
    db.refresh(evidence)
    return evidence


@app.post("/api/evc/evidence/{eid}/analyze", response_model=InspectionEvidenceOut)
@app.post("/api/v1/evc/evidence/{eid}/analyze", response_model=InspectionEvidenceOut)
async def analyze_inspection_evidence(
    eid: int,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    """
    Executes AI vision analysis on an uploaded inspection photograph.
    Extracts visual observations, institutional features, category compliance,
    and returns structured, verifiable findings.
    """
    ev = db.get(InspectionEvidence, eid)
    if not ev:
        raise HTTPException(status_code=404, detail="Inspection evidence record not found.")

    visit = db.get(EVCVisit, ev.visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Associated inspection visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "evc_expert":
        check_evc_assignment(user, app_rec, db)
    elif user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    resolved_path = resolve_storage_path(ev.file_path or ev.file_name)
    if not resolved_path or not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="Physical evidence image file not found on storage.")

    with open(resolved_path, "rb") as f:
        file_bytes = f.read()

    analysis = await analyze_evc_image(
        file_bytes=file_bytes,
        filename=ev.file_name,
        institution_name=visit.institution_name,
        evidence_category=ev.evidence_type or "CAMPUS_BUILDINGS"
    )

    # If duplicate was flagged, append warning
    obs = analysis.get("observations", [])
    warnings = analysis.get("warnings", [])
    if ev.is_duplicate and ev.duplicate_reference:
        warnings.append(f"INTEGRITY ALERT: {ev.duplicate_reference}")

    ev.ai_analysis_status = analysis.get("status", "COMPLETED")
    ev.ai_analysis_result = json.dumps(analysis)
    ev.ai_observations = "\n".join(obs)
    ev.ai_warnings = "\n".join(warnings)

    # Check if all photos for this visit have completed AI analysis
    all_evs = db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == visit.id).all()
    if all(e.ai_analysis_status in ["COMPLETED", "UNAVAILABLE", "FAILED"] for e in all_evs):
        if visit.proof_submission_status in ["NOT_SUBMITTED", "EVIDENCE_UPLOADED"]:
            visit.proof_submission_status = "AI_COMPLETED"

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_AI_ANALYSIS_COMPLETED",
        from_stage=visit.status or "EVC_SCHEDULED",
        to_stage=visit.status or "EVC_SCHEDULED",
        details=f"AI Vision evaluated photo #{eid} ({ev.evidence_type}). Status: {ev.ai_analysis_status}"
    )

    db.commit()
    db.refresh(ev)
    return ev


@app.post("/api/evc/{vid}/location", response_model=EVCVisitOut)
@app.post("/api/v1/evc/{vid}/location", response_model=EVCVisitOut)
def record_evc_location(
    vid: int,
    req: EVCLocationCaptureRequest,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    """
    Records device/browser reported GPS coordinates for the physical visit
    and calculates distance against the registered institution baseline coordinates.
    """
    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "evc_expert":
        check_evc_assignment(user, app_rec, db)
    elif user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    # Look up institution coordinates
    inst = db.query(Institution).filter(Institution.name == visit.institution_name).first()

    visit.gps_latitude = req.latitude
    visit.gps_longitude = req.longitude
    visit.gps_accuracy = req.accuracy
    visit.gps_captured_at = req.captured_at or datetime.utcnow()

    if inst and inst.latitude is not None and inst.longitude is not None:
        dist_km = calculate_haversine_distance(
            req.latitude, req.longitude,
            inst.latitude, inst.longitude
        )
        visit.gps_distance_km = dist_km
        visit.location_status = "WITHIN_PROXIMITY" if dist_km <= 5.0 else "DISTANCE_EXCEEDED"
    else:
        visit.gps_distance_km = None
        visit.location_status = "BASELINE_UNAVAILABLE"

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_LOCATION_CAPTURED",
        from_stage=visit.status or "EVC_SCHEDULED",
        to_stage=visit.status or "EVC_SCHEDULED",
        details=f"Captured GPS ({req.latitude:.4f}, {req.longitude:.4f}). Distance: {visit.gps_distance_km} km. Status: {visit.location_status}"
    )

    db.commit()
    db.refresh(visit)
    return visit


@app.get("/api/evc/{vid}/proof", response_model=EVCVisitProofDossierOut)
@app.get("/api/v1/evc/{vid}/proof", response_model=EVCVisitProofDossierOut)
def get_evc_visit_proof_dossier(
    vid: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Retrieves the complete EVC visit proof dossier including inspection metadata,
    photographs with AI assessments, location evidence, and synthesized combined report.
    """
    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    # RBAC access verification
    if user.role == "institution" and not has_institution_access(user, app_rec):
        raise HTTPException(status_code=403, detail="Forbidden. Cannot access other institutions' inspection proof.")
    elif user.role == "officer":
        check_officer_jurisdiction(user, app_rec)
    elif user.role in ["evc", "evc_expert"]:
        check_evc_assignment(user, app_rec, db)

    inst = db.query(Institution).filter(Institution.name == visit.institution_name).first()
    evidences = db.query(InspectionEvidence).filter(
        InspectionEvidence.visit_id == vid
    ).order_by(InspectionEvidence.created_at.desc()).all()

    # Populate download URLs
    evidence_outs = []
    for e in evidences:
        e_dict = {
            "id": e.id,
            "visit_id": e.visit_id,
            "application_id": e.application_id,
            "evidence_type": e.evidence_type,
            "file_name": e.file_name,
            "file_path": e.file_path,
            "file_hash": e.file_hash,
            "file_size": e.file_size,
            "uploaded_by": e.uploaded_by,
            "remarks": e.remarks,
            "gps_latitude": e.gps_latitude,
            "gps_longitude": e.gps_longitude,
            "gps_accuracy": e.gps_accuracy,
            "captured_at": e.captured_at,
            "ai_analysis_status": e.ai_analysis_status or "PENDING",
            "ai_analysis_result": e.ai_analysis_result,
            "ai_observations": e.ai_observations,
            "ai_warnings": e.ai_warnings,
            "is_duplicate": e.is_duplicate or False,
            "duplicate_reference": e.duplicate_reference,
            "download_url": f"/api/v1/evc/evidence/{e.id}/download",
            "verification_status": e.verification_status or "PENDING",
            "verified_by": e.verified_by,
            "verified_at": e.verified_at,
            "created_at": e.created_at
        }
        evidence_outs.append(InspectionEvidenceOut(**e_dict))

    assessment = compute_combined_evc_assessment(visit, evidences, inst)

    return EVCVisitProofDossierOut(
        visit=visit,
        institution_address=inst.address if inst else None,
        institution_latitude=inst.latitude if inst else None,
        institution_longitude=inst.longitude if inst else None,
        evidences=evidence_outs,
        combined_assessment=assessment
    )


@app.post("/api/evc/{vid}/proof/submit", response_model=EVCVisitProofDossierOut)
@app.post("/api/v1/evc/{vid}/proof/submit", response_model=EVCVisitProofDossierOut)
def submit_evc_visit_proof(
    vid: int,
    req: EVCProofSubmitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    """
    Submits completed physical visit proof dossier with mandatory EVC declaration
    for Regional Officer / Administrator verification.
    """
    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "evc_expert":
        check_evc_assignment(user, app_rec, db)
    elif user.role == "institution":
        raise HTTPException(status_code=403, detail="Institutions cannot submit EVC inspection proof.")

    # Must have at least 1 photograph
    photo_count = db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == vid).count()
    if photo_count < 1:
        raise HTTPException(status_code=400, detail="Cannot submit visit proof without at least one uploaded photograph.")

    if visit.proof_submission_status == "ACCEPTED":
        raise HTTPException(status_code=400, detail="Inspection proof has already been verified and accepted.")

    visit.proof_submission_status = "SUBMITTED"
    visit.proof_submitted_at = datetime.utcnow()
    visit.proof_declaration = req.declaration.strip()
    visit.status = "COMPLETED"

    # Notify Regional Officers and Administrators
    alert = Alert(
        title=f"EVC Visit Proof Submitted: {visit.institution_name}",
        message=f"EVC Expert {user.name} submitted visit proof for Application #{visit.application_id} ({photo_count} photos). Awaiting officer verification.",
        severity="INFO",
        target_role="officer",
        institution_name=visit.institution_name,
        application_id=visit.application_id,
        trigger_type="EVC_PROOF"
    )
    db.add(alert)

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_PROOF_SUBMITTED",
        from_stage=visit.status or "EVC_SCHEDULED",
        to_stage="EVC_COMPLETED",
        details=f"EVC Expert {user.name} submitted inspection proof with declaration for {visit.institution_name}."
    )

    db.commit()
    db.refresh(visit)
    return get_evc_visit_proof_dossier(vid=vid, db=db, user=user)


@app.post("/api/evc/{vid}/proof/verify", response_model=EVCVisitProofDossierOut)
@app.post("/api/v1/evc/{vid}/proof/verify", response_model=EVCVisitProofDossierOut)
def verify_evc_visit_proof(
    vid: int,
    req: EVCProofVerifyRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    """
    Regional Officer / Admin endpoint to verify submitted EVC physical visit proof:
    ACCEPT, REQUEST_ADDITIONAL_EVIDENCE, or REJECT with statutory remarks.
    EVC Experts are strictly barred from verifying their own submissions.
    """
    if user.role == "evc_expert":
        raise HTTPException(
            status_code=403,
            detail="Forbidden. EVC Experts are strictly prohibited from approving or verifying their own submitted inspection proof."
        )

    visit = db.get(EVCVisit, vid)
    if not visit:
        raise HTTPException(status_code=404, detail="EVC visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    action = req.action.upper().strip()
    if action not in ["ACCEPT", "REQUEST_ADDITIONAL_EVIDENCE", "REJECT"]:
        raise HTTPException(
            status_code=400,
            detail="Action must be one of 'ACCEPT', 'REQUEST_ADDITIONAL_EVIDENCE', or 'REJECT'."
        )

    if action in ["REQUEST_ADDITIONAL_EVIDENCE", "REJECT"] and (not req.remarks or len(req.remarks.strip()) < 5):
        raise HTTPException(
            status_code=400,
            detail=f"Detailed remarks (minimum 5 characters) are mandatory when action is '{action}'."
        )

    remarks = req.remarks.strip() if req.remarks else None

    if action == "ACCEPT":
        visit.proof_submission_status = "ACCEPTED"
        visit.evidence_verification_status = "VERIFIED"
    elif action == "REQUEST_ADDITIONAL_EVIDENCE":
        visit.proof_submission_status = "ADDITIONAL_EVIDENCE_REQUIRED"
        visit.evidence_verification_status = "PENDING"
    elif action == "REJECT":
        visit.proof_submission_status = "REJECTED"
        visit.evidence_verification_status = "REJECTED"

    visit.proof_decided_by = user.email
    visit.proof_decided_at = datetime.utcnow()
    visit.proof_decision_remarks = remarks

    # Notify EVC Expert of decision
    alert_title = f"EVC Proof Decision: {action.replace('_', ' ').title()}"
    alert_msg = f"Regional Officer {user.name} reviewed visit proof for {visit.institution_name}: {action}. Remarks: {remarks or 'None'}"
    alert = Alert(
        title=alert_title,
        message=alert_msg,
        severity="WARNING" if action != "ACCEPT" else "INFO",
        target_role="evc_expert",
        institution_name=visit.institution_name,
        application_id=visit.application_id,
        trigger_type="EVC_PROOF"
    )
    db.add(alert)

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action=f"EVC_PROOF_{action}",
        from_stage=visit.status or "EVC_COMPLETED",
        to_stage=visit.status or "EVC_COMPLETED",
        details=f"Officer {user.name} set proof status to '{action}'. Remarks: {remarks or 'N/A'}"
    )

    db.commit()
    db.refresh(visit)
    return get_evc_visit_proof_dossier(vid=vid, db=db, user=user)


@app.delete("/api/evc/evidence/{eid}")
@app.delete("/api/v1/evc/evidence/{eid}")
def delete_inspection_evidence(
    eid: int,
    db: Session = Depends(get_db),
    user: User = Depends(evc_or_officer)
):
    """
    Deletes an unsubmitted inspection photograph before final verification submission.
    """
    ev = db.get(InspectionEvidence, eid)
    if not ev:
        raise HTTPException(status_code=404, detail="Inspection evidence not found.")

    visit = db.get(EVCVisit, ev.visit_id)
    if not visit:
        raise HTTPException(status_code=404, detail="Associated visit not found.")

    app_rec = db.get(Application, visit.application_id)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Associated application not found.")

    if user.role == "evc_expert":
        check_evc_assignment(user, app_rec, db)
    elif user.role == "officer":
        check_officer_jurisdiction(user, app_rec)

    # Cannot delete if already submitted or accepted
    if visit.proof_submission_status in ["SUBMITTED", "ACCEPTED"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete evidence after proof has been submitted for verification. Request additional evidence from officer if corrections are required."
        )

    # Delete physical file from storage
    if ev.file_path:
        delete_stored_document(ev.file_path)

    db.delete(ev)

    record_audit_event(
        db=db,
        application_id=visit.application_id,
        actor=user.email,
        actor_role=user.role,
        action="EVC_EVIDENCE_DELETED",
        from_stage=visit.status or "EVC_SCHEDULED",
        to_stage=visit.status or "EVC_SCHEDULED",
        details=f"Deleted evidence photograph '{ev.file_name}' (ID #{eid}) from visit #{visit.id}"
    )

    db.commit()
    return {"deleted": True, "evidence_id": eid}





@app.post("/api/documents/{did}/retry-processing", response_model=DocumentReviewOut)
@app.post("/api/v1/documents/{did}/retry-processing", response_model=DocumentReviewOut)
async def retry_document_processing(
    did: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Safely retries OCR and parsing on an uploaded document file without creating duplicates."""
    doc = db.get(Document, did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document record not found.")

    if user.role == "institution" and not has_institution_access(user, doc):
        raise HTTPException(status_code=403, detail="Forbidden.")

    actual_path = resolve_storage_path(doc.file_path) if doc.file_path else None
    if not actual_path or not os.path.exists(actual_path):
        raise HTTPException(status_code=400, detail="Document file payload not found on disk for reprocessing.")

    with open(actual_path, "rb") as f:
        file_bytes = f.read()

    parsed = parse_document_content(file_bytes, doc.document_name)
    doc.extracted_text = parsed["extracted_text"][:10000]
    doc.file_hash = parsed["file_hash"]
    doc.processing_status = "COMPLETED" if parsed["is_readable"] else parsed["extraction_status"]

    ai_result = await review_document(
        document_name=doc.document_name,
        document_type=doc.document_type,
        text=parsed["extracted_text"]
    )
    doc.ai_summary = ai_result.get("summary")
    doc.ai_findings = json.dumps(ai_result)
    doc.ai_confidence = float(ai_result.get("confidence_score", 0.9))

    db.commit()
    db.refresh(doc)

    findings = db.query(ScrutinyFinding).filter(ScrutinyFinding.document_id == did).all()
    return DocumentReviewOut(
        document_id=doc.id,
        application_id=doc.application_id,
        document_name=doc.document_name,
        document_type=doc.document_type,
        document_category=doc.document_category,
        file_size=doc.file_size,
        mime_type=doc.mime_type,
        uploaded_by=doc.uploaded_by,
        version=doc.version,
        is_latest=doc.is_latest,
        file_hash=doc.file_hash,
        processing_status=doc.processing_status,
        review_status=doc.review_status,
        reviewer_notes=doc.reviewer_notes,
        reviewed_by=doc.reviewed_by,
        reviewed_at=doc.reviewed_at,
        ai_summary=doc.ai_summary,
        ai_confidence=doc.ai_confidence,
        ai_analysis=ai_result,
        findings=findings,
        created_at=doc.created_at
    )

@app.get("/api/applications/{aid}/approved-documents", response_model=List[DocumentOut])
@app.get("/api/v1/applications/{aid}/approved-documents", response_model=List[DocumentOut])
def get_approved_documents(aid: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Retrieves verified and approved documents for the given application."""
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")
    if user.role == "institution" and not has_institution_access(user, app_rec):
        raise HTTPException(status_code=403, detail="Forbidden.")

    docs = db.query(Document).filter(
        Document.application_id == aid,
        Document.review_status.in_(["ACCEPTED", "VERIFIED"])
    ).order_by(Document.created_at.desc()).all()
    return docs

# --- Document Replacement & Version Control ---

@app.post("/api/applications/{aid}/documents/{did}/replace")
@app.post("/api/v1/applications/{aid}/documents/{did}/replace")
async def replace_application_document(
    aid: int,
    did: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    old_doc = db.get(Document, did)
    if not old_doc or old_doc.application_id != aid:
        raise HTTPException(status_code=404, detail="Target document not found for this application.")
    
    app_rec = db.get(Application, aid)
    if not app_rec:
        raise HTTPException(status_code=404, detail="Application not found.")
    
    if user.role == "institution" and not has_institution_access(user, app_rec):
        raise HTTPException(status_code=403, detail="Forbidden.")
    
    if app_rec.status in ["COMPLETED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Cannot replace documents on finalized applications.")
    
    upload_res = await process_and_store_upload(file)
    f_hash = upload_res.get("file_hash")
    
    # Mark old version as not latest
    old_doc.is_latest = False
    new_version = old_doc.version + 1
    
    # Run AI screening on replaced document
    ai_result = await review_document(
        document_name=upload_res["original_filename"],
        document_type=old_doc.document_type,
        text=upload_res["extracted_text"]
    )
    
    new_doc = Document(
        application_id=aid,
        institution_name=app_rec.institution_name,
        document_name=upload_res["original_filename"],
        document_type=old_doc.document_type,
        file_path=upload_res["stored_filepath"],
        file_size=upload_res["file_size"],
        mime_type=upload_res["mime_type"],
        uploaded_by=user.email,
        version=new_version,
        is_latest=True,
        file_hash=f_hash,
        processing_status="COMPLETED",
        extracted_text=upload_res["extracted_text"][:10000],
        ai_summary=ai_result.get("summary"),
        ai_findings=json.dumps(ai_result),
        ai_confidence=float(ai_result.get("confidence_score", 0.9)),
        review_status="PENDING"
    )
    db.add(new_doc)
    
    record_audit_event(
        db=db,
        application_id=aid,
        actor=user.email,
        actor_role=user.role,
        action="DOC_REPLACED",
        from_stage=app_rec.current_stage,
        to_stage=app_rec.current_stage,
        details=f"Replaced '{old_doc.document_name}' v{old_doc.version} with '{upload_res['original_filename']}' v{new_version} (SHA-256: {f_hash[:16]}...)"
    )
    
    db.commit()
    db.refresh(new_doc)
    return new_doc

@app.post("/api/applications/{aid}/decision", response_model=ApplicationOut)
def application_decision_alias(
    aid: int,
    req: OfficerDecisionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(officer_or_admin)
):
    return officer_record_decision(aid=aid, req=req, db=db, user=user)

@app.get("/api/email/status")
def get_system_email_status(user: User = Depends(officer_or_admin)):
    """Exposes real SMTP and notification delivery status for administrators."""
    return get_email_status()


# --- Storage Diagnostics, Reconciliation & Integrity Endpoints ---

@app.get("/api/storage/diagnostics")
def storage_diagnostics(user: User = Depends(officer_or_admin)):
    """Returns local document storage diagnostics and directory health."""
    return get_storage_diagnostics()


@app.get("/api/documents/{did}/integrity")
def check_document_integrity(
    did: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Verifies physical file on disk matches its recorded SHA-256 hash."""
    doc = db.get(Document, did)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    if not doc.file_hash:
        return {"document_id": did, "integrity": "NO_RECORDED_HASH", "valid": False}

    ref = doc.stored_filename or doc.file_path or doc.document_name
    valid = verify_file_integrity(ref, doc.file_hash)
    return {
        "document_id": did,
        "document_name": doc.document_name,
        "file_hash": doc.file_hash,
        "integrity_verified": valid,
        "status": "VALID" if valid else "TAMPER_OR_CORRUPT"
    }


@app.post("/api/storage/reconcile")
def storage_reconcile(db: Session = Depends(get_db), user: User = Depends(admin_only)):
    """Admin utility to reconcile database document records with disk files."""
    docs = db.query(Document).all()
    doc_dicts = [
        {
            "id": d.id,
            "document_name": d.document_name,
            "stored_filename": d.stored_filename,
            "file_path": d.file_path,
            "file_hash": d.file_hash
        }
        for d in docs
    ]
    return reconcile_storage(doc_dicts)


@app.get("/api/evc/evidence/{eid}/download")
@app.get("/api/v1/evc/evidence/{eid}/download")
def download_evidence_file(
    eid: int,
    token: Optional[str] = Query(None),
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    db: Session = Depends(get_db)
):
    """Downloads or previews original inspection evidence file safely with RBAC checks and token support for <img> tags."""
    user = None
    if creds:
        try:
            payload = jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
            uid = int(payload.get("sub"))
            user = db.get(User, uid)
        except Exception:
            pass
    elif token:
        try:
            payload = jwt.decode(token, SECRET, algorithms=[ALGORITHM])
            uid = int(payload.get("sub"))
            user = db.get(User, uid)
        except Exception:
            pass

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Authentication required to view or download inspection evidence.")

    ev = db.get(InspectionEvidence, eid)
    if not ev:
        raise HTTPException(status_code=404, detail="Inspection evidence not found.")

    if ev.application_id:
        app_rec = db.get(Application, ev.application_id)
        if app_rec:
            if user.role == "institution" and not has_institution_access(user, app_rec):
                raise HTTPException(status_code=403, detail="Forbidden. Cannot access other institutions' inspection evidence.")
            elif user.role == "officer":
                check_officer_jurisdiction(user, app_rec)
            elif user.role in ["evc", "evc_expert"]:
                check_evc_assignment(user, app_rec, db)

    try:
        ref = ev.file_path or ev.file_name
        resolved_path = resolve_storage_path(ref)
    except Exception:
        resolved_path = None

    if not resolved_path or not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="Original evidence file not found on storage.")

    ext = os.path.splitext(ev.file_name or "")[1].lower()
    if ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    elif ext == ".webp":
        media_type = "image/webp"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=resolved_path,
        filename=ev.file_name,
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{ev.file_name}"'}
    )
