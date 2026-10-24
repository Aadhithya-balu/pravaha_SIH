import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, ComplianceItem, Alert


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with next(get_db()) as db:
        seed_database(db)


@pytest.fixture
def client():
    return TestClient(app)


def get_token(client, email, password="DemoPass123!"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


# 1. Login Tests
def test_login_success(client):
    res = client.post("/api/auth/login", json={"email": "officer@demo.local", "password": "DemoPass123!"})
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "officer"
    assert data["name"] == "Dr. Rajesh Verma"


def test_login_failure_wrong_password(client):
    res = client.post("/api/auth/login", json={"email": "officer@demo.local", "password": "WrongPassword"})
    assert res.status_code == 401
    assert "Invalid credentials" in res.json()["detail"]


def test_login_failure_nonexistent_user(client):
    res = client.post("/api/auth/login", json={"email": "unknown@demo.local", "password": "DemoPass123!"})
    assert res.status_code == 401


# 2. Role-based Access & Permission Restrictions
def test_institution_cannot_verify_compliance(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/compliance/1/verify",
        json={"action": "VERIFY", "officer_comments": "Hacked verify"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 403


def test_officer_can_verify_compliance(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.post(
        "/api/compliance/2/verify",
        json={"action": "VERIFY", "officer_comments": "Verified compliant with 7th CPC norms."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 200
    assert res.json()["status"] == "VERIFIED"


# 3. Institution Data Isolation
def test_institution_data_isolation(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.get("/api/applications", headers={"Authorization": f"Bearer {inst_token}"})
    assert res.status_code == 200
    apps = res.json()
    # All returned applications must belong to ABC Engineering College
    for a in apps:
        assert a["institution_name"] == "ABC Engineering College"


def test_institution_cannot_view_other_institution_details(client):
    inst_token = get_token(client, "college@demo.local")
    # Application 2 belongs to Sunrise Institute of Technology
    res = client.get("/api/applications/2", headers={"Authorization": f"Bearer {inst_token}"})
    assert res.status_code == 403


# 4. Application Creation
def test_create_application_by_institution(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/applications",
        json={
            "application_type": "New Course",
            "notes": "Testing new M.Tech course in Cyber Security",
            "due_date": str(date.today() + timedelta(days=20))
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 201
    data = res.json()
    assert data["institution_name"] == "ABC Engineering College"
    assert data["reference"].startswith("AICTE-")
    assert data["current_stage"] == "SCRUTINY"


# 5. Workflow Transitions (Valid and Invalid)
def test_valid_workflow_transition_by_officer(client):
    officer_token = get_token(client, "officer@demo.local")
    # Application 1 is in SCRUTINY
    res = client.post(
        "/api/applications/1/transition",
        json={"action": "SEND_EVC", "reason": "Infrastructure inspection required"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["current_stage"] == "EVC_PENDING"


def test_invalid_workflow_transition_rejected(client):
    officer_token = get_token(client, "officer@demo.local")
    # Application 1 is now in EVC_PENDING; SCRUTINY_PASS is invalid here
    res = client.post(
        "/api/applications/1/transition",
        json={"action": "SCRUTINY_PASS", "reason": "Invalid action test"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 400
    assert "not permitted from stage" in res.json()["detail"]


# 6. Return-for-Clarification Mandatory Reason Validation
def test_return_without_reason_rejected(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.post(
        "/api/applications/1/transition",
        json={"action": "RETURN", "reason": ""},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 400
    assert "mandatory" in res.json()["detail"].lower()


def test_return_with_valid_reason_succeeds(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.post(
        "/api/applications/1/transition",
        json={"action": "RETURN", "reason": "Land registration document page 4 is illegible. Please re-upload."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["current_stage"] == "RETURNED_FOR_CLARIFICATION"
    assert data["status"] == "RETURNED"


# 7. Audit Event Creation
def test_audit_event_recorded(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.get("/api/applications/1/audit", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    events = res.json()
    assert len(events) >= 2
    actions = [e["action"] for e in events]
    assert "RETURN" in actions


# 8. Escalation & Deadline Checks
def test_escalation_engine_run(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.post("/api/escalation/run-check", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "evaluated_applications" in data
    assert "created_alerts" in data


# 9. AI Document Review (Deterministic Fallback & Schema)
def test_ai_document_check(client):
    officer_token = get_token(client, "officer@demo.local")
    sample_text = (
        "Registered Lease Deed executed between Lessor Shri A and Lessee ABC Trust. "
        "Lease tenure: 15 years. Khasra No. 102, measuring 4.5 Acres. Sub-Registrar seal."
    )
    res = client.post(
        "/api/documents/check-text",
        json={"document_name": "test_lease.pdf", "document_type": "LEASE_DEED", "extracted_text": sample_text},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["mode"] in ["demo_mode", "real_llm"]
    assert "summary" in data
    assert "extracted_fields" in data
    assert "potential_inconsistencies" in data
    assert "disclaimer" in data
    # 15 years tenure is less than 30 years, so discrepancy must be flagged!
    discrepancies = " ".join(data["potential_inconsistencies"])
    assert "30" in discrepancies or "tenure" in discrepancies.lower()


# 10. CSV Export Formula Injection Sanitization
def test_csv_export(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.get("/api/reports/export-csv?report_type=applications", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/csv")
    content = res.text
    assert "Reference,Institution Name" in content
