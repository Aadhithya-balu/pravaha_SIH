import io
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, Document, AuditEvent, ScrutinyFinding, EVCVisit


@pytest.fixture(scope="module", autouse=True)
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


# ==============================================================================
# 1. Tamper-Evident Audit Trail & Verification
# ==============================================================================

def test_tamper_evident_audit_hash_chain_and_verify_endpoint(client):
    inst_token = get_token(client, "college@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    # Verify audit chain for seeded application 1
    verify_res = client.get(
        "/api/v1/applications/1/audit/verify",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert verify_res.status_code == 200
    data = verify_res.json()
    assert data["chain_intact"] is True
    assert data["tamper_evident"] is True
    assert data["total_events"] > 0

    # Tamper with an event directly in the database
    with next(get_db()) as db:
        ev = db.query(AuditEvent).filter(AuditEvent.application_id == 1).first()
        assert ev is not None
        original_details = ev.details
        ev.details = "TAMPERED_DETAILS_BY_MALICIOUS_ACTOR"
        db.commit()

    # Chain verification must now detect tampering
    tampered_res = client.get(
        "/api/v1/applications/1/audit/verify",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert tampered_res.status_code == 200
    tampered_data = tampered_res.json()
    assert tampered_data["chain_intact"] is False
    assert "mismatch" in tampered_data["reason"].lower()

    # Restore the event
    with next(get_db()) as db:
        ev = db.query(AuditEvent).filter(AuditEvent.application_id == 1).first()
        ev.details = original_details
        db.commit()


# ==============================================================================
# 2. Regional Officer Jurisdiction Boundaries
# ==============================================================================

def test_regional_officer_jurisdiction_boundaries(client):
    officer_token = get_token(client, "officer@demo.local")  # Northern region officer

    # Application 1 is in Northern region -> Allowed
    app1_res = client.get(
        "/api/v1/officer/applications/1",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert app1_res.status_code == 200

    # Application 2 is in Western region (Sunrise Institute) -> Must be 403 Forbidden
    app2_res = client.get(
        "/api/v1/officer/applications/2",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert app2_res.status_code == 403
    assert "jurisdiction" in app2_res.json()["detail"].lower()

    # Attempting scrutiny run on Application 2 -> 403 Forbidden
    scrutiny_res = client.post(
        "/api/v1/officer/applications/2/scrutiny",
        json={"run_type": "INITIAL"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert scrutiny_res.status_code == 403

    # Attempting advance on Application 2 -> 403 Forbidden
    advance_res = client.post(
        "/api/v1/officer/applications/2/advance",
        json={"target_stage": "COMPLETED", "reason": "Cross-jurisdiction illegal advance"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert advance_res.status_code == 403


# ==============================================================================
# 3. Finding Disposition & Mandatory Waiver Justification
# ==============================================================================

def test_finding_disposition_mandatory_waiver_justification(client):
    officer_token = get_token(client, "officer@demo.local")

    # Run scrutiny on application 1 to ensure findings exist
    client.post(
        "/api/v1/officer/applications/1/scrutiny",
        json={"run_type": "INITIAL"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )

    with next(get_db()) as db:
        finding = db.query(ScrutinyFinding).filter(ScrutinyFinding.application_id == 1).first()
        assert finding is not None
        finding_id = finding.id

    # Attempt waiver without remarks -> 400 Bad Request
    fail_res = client.post(
        f"/api/v1/officer/findings/{finding_id}/disposition",
        json={"disposition": "WAIVED", "disposition_notes": ""},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert fail_res.status_code == 400
    assert "mandatory" in fail_res.json()["detail"].lower()

    # Proper waiver with statutory remarks -> 200 OK
    pass_res = client.post(
        f"/api/v1/officer/findings/{finding_id}/disposition",
        json={
            "disposition": "WAIVED",
            "disposition_notes": "Statutory concession granted under AICTE Land Relaxation Norms 2026."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert pass_res.status_code == 200
    assert pass_res.json()["officer_disposition"] == "WAIVED"


# ==============================================================================
# 4. Duplicate / Contradictory Final Decision Prevention
# ==============================================================================

def test_prevention_of_duplicate_or_contradictory_final_decisions(client):
    officer_token = get_token(client, "officer@demo.local")

    # Application 1 is in Northern region, not yet completed
    # Attempting rejection without speaking order remarks -> 400 Bad Request
    fail_dec = client.post(
        "/api/v1/officer/applications/1/decision",
        json={
            "decision": "REJECTED",
            "remarks": ""
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert fail_dec.status_code == 400
    assert "speaking order" in fail_dec.json()["detail"].lower()

    # First valid decision: APPROVED
    dec1_res = client.post(
        "/api/v1/officer/applications/1/decision",
        json={
            "decision": "APPROVED",
            "remarks": "All regulatory requirements verified and approved by Regional Committee.",
            "approval_order_reference": "AICTE/NRO/2026/EOA-001"
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert dec1_res.status_code == 200
    assert dec1_res.json()["decision_outcome"] == "APPROVED"
    assert dec1_res.json()["current_stage"] == "COMPLETED"

    # Second decision attempt on same case -> 400 duplicate rejected
    dec2_res = client.post(
        "/api/v1/officer/applications/1/decision",
        json={
            "decision": "REJECTED",
            "remarks": "Conflicting reversal attempt after approval order."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert dec2_res.status_code == 400
    assert "duplicate or contradictory" in dec2_res.json()["detail"].lower()


# ==============================================================================
# 5. Escalation Engine Duplicate Alert Prevention
# ==============================================================================

def test_escalation_engine_duplicate_alert_prevention(client):
    officer_token = get_token(client, "officer@demo.local")

    # Run 1
    res1 = client.post("/api/escalation/run-check", headers={"Authorization": f"Bearer {officer_token}"})
    assert res1.status_code == 200
    created_1 = res1.json()["created_alerts"]

    # Run 2 immediately after -> Should not recreate duplicate alerts for the same events
    res2 = client.post("/api/escalation/run-check", headers={"Authorization": f"Bearer {officer_token}"})
    assert res2.status_code == 200
    created_2 = res2.json()["created_alerts"]
    assert created_2 == 0


# ==============================================================================
# 6. Document Download & Tenant Isolation
# ==============================================================================

def test_document_download_and_tenant_isolation(client):
    inst1_token = get_token(client, "college@demo.local")  # ABC Engineering College
    officer_token = get_token(client, "officer@demo.local")

    with next(get_db()) as db:
        doc1 = db.query(Document).filter(Document.institution_name == "ABC Engineering College").first()
        assert doc1 is not None
        doc1_id = doc1.id

    # Institution 1 downloads its own document
    dl_res = client.get(
        f"/api/v1/documents/{doc1_id}/download",
        headers={"Authorization": f"Bearer {inst1_token}"}
    )
    assert dl_res.status_code == 200
    assert len(dl_res.content) > 0

    # Regional officer in Northern region downloads Northern document -> 200 OK
    officer_dl = client.get(
        f"/api/v1/documents/{doc1_id}/download",
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert officer_dl.status_code == 200
