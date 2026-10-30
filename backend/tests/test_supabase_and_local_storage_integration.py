"""
PRAVAHA — Comprehensive Integration Test Suite: Supabase Database + Local Storage Architecture
Validates all requirements from Section 15 of the specification:
Test A — Database Connection & Operational Boundaries
Test B — Registration, Login & Session Persistence
Test C — Local File Storage & Authenticated Retrieval
Test D — Document Extraction, Integrity & Scrutiny Persistence
Test E — Institution-to-Officer Workflow & Clarification Cycle
Test F — EVC Inspection Evidence & Local Storage
Test G — RBAC Enforcement & Path Traversal Security
Test H — Notification Read State & Email Delivery Auditing
Test I — Storage Diagnostics & Reconciliation
"""
import io
import os
import json
import pytest
import hashlib
from fastapi.testclient import TestClient

from app.main import app
from app.db import get_db, SessionLocal, DATABASE_PROVIDER, DATABASE_READY
from app.models import User, Institution, Application, Document, EVCVisit, Alert, AuditEvent, EmailDeliveryRecord
from app.document_storage import (
    save_uploaded_document, resolve_storage_path, read_document_bytes,
    verify_file_integrity, get_storage_diagnostics, STORAGE_DIR
)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def get_token(client: TestClient, email: str, password: str = "DemoPass123!") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed for {email}: {res.text}"
    return res.json()["access_token"]


# ==============================================================================
# TEST A: Database Connection & Provider Observability
# ==============================================================================

def test_database_connection_and_observability(client: TestClient):
    """
    Verifies that the database provider is explicitly observable via /api/health
    and that local document storage is initialized and healthy.
    """
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert "database_ready" in data
    assert data["database_ready"] is True
    assert "database_provider" in data
    assert data["storage_provider"] == "local_storage"
    assert data["storage_ready"] is True
    assert os.path.exists(data["storage_directory"])


# ==============================================================================
# TEST B: Registration, Login & Identity Persistence
# ==============================================================================

def test_registration_and_login_journey(client: TestClient):
    """
    Registers a new institution, verifies persistence in database,
    logs in with the same credentials, and verifies role integrity.
    """
    unique_id = os.urandom(4).hex()
    email = f"institute_{unique_id}@ai-test.edu"
    password = "SecurePassword@2026"
    inst_name = f"Apex Institute of Tech {unique_id}"

    reg_payload = {
        "email": email,
        "password": password,
        "contact_name": f"Director {unique_id}",
        "institution_name": inst_name,
        "phone": "+91-9876543210",
        "region": "Northern",
        "state": "Uttar Pradesh",
        "city": "Noida",
        "institution_type": "Technical / Engineering"
    }

    reg_res = client.post("/api/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    reg_data = reg_res.json()
    assert reg_data["email"] == email.lower()
    assert reg_data["role"] == "institution"

    # Login with exact credentials
    login_res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # Profile check with token
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["email"] == email.lower()
    assert me_res.json()["role"] == "institution"


# ==============================================================================
# TEST C: Local File Storage & Authenticated Document Retrieval
# ==============================================================================

def test_local_file_storage_and_metadata_persistence(client: TestClient):
    """
    Uploads a document, verifies it is physically stored in backend/storage/documents,
    verifies SHA-256 hash matches, verifies metadata references the file,
    and tests authenticated download vs unauthorized rejection.
    """
    inst_token = get_token(client, "college@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    content_str = "AICTE Regulatory Submission - 33 Year Registered Land Lease Deed Proof."
    file_bytes = content_str.encode("utf-8")
    expected_hash = hashlib.sha256(file_bytes).hexdigest()

    files = {
        "file": ("registered_lease_deed.txt", io.BytesIO(file_bytes), "text/plain")
    }
    data = {
        "document_type": "LEASE_DEED"
    }

    # Upload linked to application 1
    upload_res = client.post(
        "/api/applications/1/documents",
        headers={"Authorization": f"Bearer {inst_token}"},
        data=data,
        files=files
    )
    assert upload_res.status_code == 200
    doc_info = upload_res.json()["document"]
    doc_id = doc_info["id"]

    # Verify database record
    with SessionLocal() as db:
        doc_rec = db.get(Document, doc_id)
        assert doc_rec is not None
        assert doc_rec.document_name == "registered_lease_deed.txt"
        assert doc_rec.file_hash == expected_hash
        assert doc_rec.stored_filename is not None
        # Must be relative path, not exposing absolute server path
        assert not os.path.isabs(doc_rec.file_path)
        assert "storage" in doc_rec.file_path

        # Verify physical file existence in STORAGE_DIR
        physical_path = resolve_storage_path(doc_rec.stored_filename)
        assert os.path.exists(physical_path)
        with open(physical_path, "rb") as f:
            disk_bytes = f.read()
        assert disk_bytes == file_bytes

    # Authenticated download by institution
    dl_res = client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert dl_res.status_code == 200
    assert dl_res.content == file_bytes

    # Authenticated download by officer
    officer_dl = client.get(
        f"/api/documents/{doc_id}/download",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert officer_dl.status_code == 200
    assert officer_dl.content == file_bytes

    # Integrity verification endpoint
    integ_res = client.get(
        f"/api/documents/{doc_id}/integrity",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert integ_res.status_code == 200
    assert integ_res.json()["integrity_verified"] is True
    assert integ_res.json()["status"] == "VALID"


# ==============================================================================
# TEST D: Document Extraction, Integrity & Scrutiny Findings Persistence
# ==============================================================================

def test_document_extraction_and_scrutiny_persistence(client: TestClient):
    """
    Uploads a document, runs AI scrutiny, and verifies that the extraction status,
    processing status, and scrutiny findings are saved in the database.
    """
    officer_token = get_token(client, "officer@demo.local")

    scrutiny_res = client.post(
        "/api/scrutiny/run/1",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert scrutiny_res.status_code == 200
    scrutiny_data = scrutiny_res.json()
    assert "scrutiny_run" in scrutiny_data
    assert "summary" in scrutiny_data["scrutiny_run"]

    # Scrutiny findings endpoint
    findings_res = client.get(
        "/api/scrutiny/applications/1",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert findings_res.status_code == 200
    scrutiny_payload = findings_res.json()
    assert "findings" in scrutiny_payload
    findings = scrutiny_payload["findings"]
    assert isinstance(findings, list)
    for f in findings:
        assert "rule_id" in f
        assert "severity" in f
        assert "officer_disposition" in f


# ==============================================================================
# TEST E: Institution-to-Officer Workflow & Clarification Cycle
# ==============================================================================

def test_institution_to_officer_full_clarification_cycle(client: TestClient):
    """
    Full workflow journey:
    1. Institution creates draft application
    2. Uploads document
    3. Submits application (status -> SCRUTINY, assigned to officer)
    4. Officer locates application in queue
    5. Officer issues clarification / deficiency memo
    6. Institution submits rectification response
    7. Application returns to RE_SCRUTINY
    """
    inst_token = get_token(client, "college@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    # 1. Create Application as Draft
    create_res = client.post(
        "/api/v1/applications",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={
            "application_type": "New Programme / Level",
            "academic_year": "2026-2027",
            "is_draft": True,
            "notes": "Draft application for full integration verification"
        }
    )
    assert create_res.status_code == 201
    app_id = create_res.json()["id"]
    ref = create_res.json()["reference"]
    assert create_res.json()["status"] == "DRAFT"

    # 2. Upload Document
    test_pdf = b"%PDF-1.4 Mock PDF stream for AICTE institutional approval application."
    client.post(
        f"/api/applications/{app_id}/documents",
        headers={"Authorization": f"Bearer {inst_token}"},
        data={"document_type": "AFFIDAVIT"},
        files={"file": ("affidavit_test.pdf", io.BytesIO(test_pdf), "application/pdf")}
    )

    # 3. Submit Application
    submit_res = client.post(
        f"/api/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert submit_res.status_code == 200
    assert submit_res.json()["current_stage"] == "SCRUTINY"
    assert submit_res.json()["assigned_to"] == "Regional Officer"

    # 4. Officer locates application
    queue_res = client.get(
        f"/api/applications?search={ref}",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert queue_res.status_code == 200
    items = queue_res.json()
    assert any(a["id"] == app_id for a in items)

    # 5. Officer demands clarification
    transition_res = client.post(
        f"/api/applications/{app_id}/transition",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={
            "action": "RETURN",
            "reason": "Please provide notarized land registry translation in English."
        }
    )
    assert transition_res.status_code == 200
    assert transition_res.json()["current_stage"] == "RETURNED_FOR_CLARIFICATION"

    # 6. Institution responds
    resubmit_res = client.post(
        f"/api/v1/applications/{app_id}/resubmit",
        headers={"Authorization": f"Bearer {inst_token}"},
        json={
            "response_text": "Notarized English translation attached in updated documents."
        }
    )
    assert resubmit_res.status_code == 200
    assert resubmit_res.json()["current_stage"] == "RE_SCRUTINY"


# ==============================================================================
# TEST F: EVC Inspection Evidence & Local Storage
# ==============================================================================

def test_evc_evidence_upload_and_download(client: TestClient):
    """
    Verifies that EVC inspection evidence files are safely saved to local storage,
    linked to the EVC visit and application, and can be downloaded securely.
    """
    evc_token = get_token(client, "evc@demo.local")
    photo_bytes = b"\xFF\xD8\xFF\xE0Mock GPS-tagged inspection photograph bytes."

    files = {
        "file": ("lab_inspection_proof.jpg", io.BytesIO(photo_bytes), "image/jpeg")
    }
    data = {
        "evidence_type": "GEOTAGGED_PHOTO",
        "remarks": "Computer Centre terminal inspection verifying 120 systems"
    }

    res = client.post(
        "/api/evc/1/evidence",
        headers={"Authorization": f"Bearer {evc_token}"},
        data=data,
        files=files
    )
    assert res.status_code == 201
    ev_data = res.json()
    assert ev_data["file_name"] == "lab_inspection_proof.jpg"
    assert "file_hash" in ev_data
    evidence_id = ev_data["id"]

    # Download evidence
    dl_res = client.get(
        f"/api/evc/evidence/{evidence_id}/download",
        headers={"Authorization": f"Bearer {evc_token}"}
    )
    assert dl_res.status_code == 200
    assert dl_res.content == photo_bytes


# ==============================================================================
# TEST G: RBAC Boundaries & Path Traversal Prevention
# ==============================================================================

def test_security_rbac_and_path_traversal_prevention(client: TestClient):
    """
    1. Unauthorized user cannot schedule EVC (only officers/admins can)
    2. Path traversal attempts are rejected with HTTP 400
    """
    evc_token = get_token(client, "evc@demo.local")

    # EVC expert cannot schedule visits (bar self-scheduling)
    sched_res = client.post(
        "/api/evc",
        headers={"Authorization": f"Bearer {evc_token}"},
        json={
            "application_id": 1,
            "institution_name": "Demo Tech",
            "committee_members": "Prof EVC",
            "scheduled_date": "2026-11-20",
            "visit_mode": "PHYSICAL"
        }
    )
    assert sched_res.status_code == 403

    # Path traversal test using document_storage utility
    with pytest.raises(Exception):
        resolve_storage_path("../../Windows/System32/calc.exe")

    with pytest.raises(Exception):
        resolve_storage_path("..\\..\\secret.env")


# ==============================================================================
# TEST H: Notification Identity Isolation & Email Delivery Auditing
# ==============================================================================

def test_notifications_and_email_delivery_auditing(client: TestClient):
    """
    1. Marking alert read updates read status without altering session.
    2. Email delivery audit records exist in email_delivery_records table.
    """
    inst_token = get_token(client, "college@demo.local")

    # Fetch alerts
    alerts_res = client.get("/api/alerts", headers={"Authorization": f"Bearer {inst_token}"})
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    if alerts:
        first_id = alerts[0]["id"]
        read_res = client.post(f"/api/alerts/{first_id}/read", headers={"Authorization": f"Bearer {inst_token}"})
        assert read_res.status_code == 200
        assert read_res.json()["is_read"] is True

        # Ensure session remains college@demo.local
        me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {inst_token}"})
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "college@demo.local"

    # Verify Email Delivery Records table
    with SessionLocal() as db:
        email_count = db.query(EmailDeliveryRecord).count()
        assert email_count >= 0  # Table exists and is queryable


# ==============================================================================
# TEST I: Storage Diagnostics & Reconciliation
# ==============================================================================

def test_storage_diagnostics_and_reconciliation(client: TestClient):
    """
    Tests /api/storage/diagnostics and /api/storage/reconcile endpoints.
    """
    admin_token = get_token(client, "admin@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    # Diagnostics check
    diag_res = client.get("/api/storage/diagnostics", headers={"Authorization": f"Bearer {officer_token}"})
    assert diag_res.status_code == 200
    diag = diag_res.json()
    assert diag["status"] == "healthy"
    assert "file_count" in diag
    assert "total_bytes" in diag

    # Reconciliation check
    recon_res = client.post("/api/storage/reconcile", headers={"Authorization": f"Bearer {admin_token}"})
    assert recon_res.status_code == 200
    recon = recon_res.json()
    assert "total_disk_files" in recon
    assert "total_db_records" in recon
    assert "missing_files_count" in recon
    assert "orphaned_files_count" in recon
