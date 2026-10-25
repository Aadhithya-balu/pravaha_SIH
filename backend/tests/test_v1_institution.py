import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database


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


# --- 1. EOA and New Programme/Level Creation Tests ---

def test_v1_create_eoa_application_as_draft(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "Extension of Approval (EOA)",
            "academic_year": "2026-2027",
            "notes": "Draft EOA renewal for academic year 2026-2027.",
            "is_draft": True
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["institution_name"] == "ABC Engineering College"
    assert data["application_type"] == "Extension of Approval (EOA)"
    assert data["current_stage"] == "DRAFT"
    assert data["status"] == "DRAFT"
    assert data["reference"].startswith("AICTE-2026-")


def test_v1_create_new_programme_level_application(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "New Programme/Level",
            "academic_year": "2026-2027",
            "notes": "Proposed New Programme: B.Tech in Artificial Intelligence & Machine Learning (60 seats).",
            "is_draft": True
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["institution_name"] == "ABC Engineering College"
    assert data["application_type"] == "New Programme/Level"
    assert data["status"] == "DRAFT"


def test_v1_validation_rejects_invalid_application_type(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "Invalid Unknown Type",
            "notes": "Testing invalid type rejection",
            "academic_year": "2026-2027"
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 422
    assert "Invalid application type" in res.json()["detail"]


def test_v1_validation_rejects_empty_notes_on_direct_submit(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "Extension of Approval (EOA)",
            "academic_year": "2026-2027",
            "notes": "   ",
            "is_draft": False
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res.status_code == 422
    assert "notes/details are required" in res.json()["detail"]


# --- 2. Document Upload & Application Submission Tests ---

def test_v1_submit_requires_document(client):
    inst_token = get_token(client, "college@demo.local")
    # Create draft
    create_res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "Extension of Approval (EOA)",
            "academic_year": "2026-2027",
            "notes": "EOA renewal ready to submit but missing documents.",
            "is_draft": True
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    app_id = create_res.json()["id"]

    # Attempt submit without any uploaded document -> should fail with 422
    sub_res = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert sub_res.status_code == 422
    assert "supporting document must be uploaded" in sub_res.json()["detail"]


def test_v1_upload_document_and_submit_journey(client):
    inst_token = get_token(client, "college@demo.local")
    
    # 1. Create draft EOA
    create_res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "Extension of Approval (EOA)",
            "academic_year": "2026-2027",
            "notes": "Complete EOA application with land deed and occupancy certificate.",
            "is_draft": True
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert create_res.status_code == 201
    app_id = create_res.json()["id"]

    # 2. Upload document to application
    file_content = b"Registered Land Lease Deed of ABC Engineering College. Tenure: 35 years valid through 2060."
    upload_res = client.post(
        f"/api/v1/applications/{app_id}/documents",
        files={"file": ("lease_deed_2026.pdf", file_content, "application/pdf")},
        data={"document_type": "LEASE_DEED", "document_name": "Registered Land Lease Deed 2026"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert upload_res.status_code == 200, upload_res.text
    assert upload_res.json()["document"]["document_name"] == "Registered Land Lease Deed 2026"
    assert "ai_analysis" in upload_res.json()

    # 3. Submit application
    submit_res = client.post(
        f"/api/v1/applications/{app_id}/submit",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert submit_res.status_code == 200, submit_res.text
    submitted_app = submit_res.json()
    assert submitted_app["current_stage"] == "SCRUTINY"
    assert submitted_app["status"] == "IN_PROGRESS"


# --- 3. Return, Correction Request, and Resubmission Flow ---

def test_v1_officer_returns_and_institution_resubmits_journey(client):
    inst_token = get_token(client, "college@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    # 1. Create and submit New Programme/Level application
    create_res = client.post(
        "/api/v1/applications",
        json={
            "application_type": "New Programme/Level",
            "academic_year": "2026-2027",
            "notes": "New M.Tech in Cyber Security course proposal.",
            "is_draft": True
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    app_id = create_res.json()["id"]

    # Attach document
    client.post(
        f"/api/v1/applications/{app_id}/documents",
        files={"file": ("faculty_cadre_plan.txt", b"Cadre ratio 1:15 plan with faculty list.", "text/plain")},
        data={"document_type": "FACULTY_LIST", "document_name": "Faculty Sanction Plan"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )

    # Submit
    client.post(f"/api/v1/applications/{app_id}/submit", headers={"Authorization": f"Bearer {inst_token}"})

    # 2. Officer inspects and returns case with deficiency remarks
    return_res = client.post(
        f"/api/applications/{app_id}/transition",
        json={
            "action": "RETURN",
            "reason": "Faculty cadre list lacks professor qualifications and AICTE approval numbers for head of department."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert return_res.status_code == 200
    assert return_res.json()["current_stage"] == "RETURNED_FOR_CLARIFICATION"
    assert return_res.json()["status"] == "RETURNED"

    # 3. Institution fetches details and inspects correction requests
    detail_res = client.get(f"/api/v1/applications/{app_id}", headers={"Authorization": f"Bearer {inst_token}"})
    assert detail_res.status_code == 200
    details = detail_res.json()
    assert details["application"]["status"] == "RETURNED"
    assert len(details["correction_requests"]) > 0
    assert "Faculty cadre list lacks professor qualifications" in details["correction_requests"][0]["reason"]

    # 4. Institution uploads corrected document
    upload_corr = client.post(
        f"/api/v1/applications/{app_id}/documents",
        files={"file": ("corrected_faculty_with_phd.pdf", b"Attested PhD certificates and AICTE IDs of all 6 professors.", "application/pdf")},
        data={"document_type": "FACULTY_LIST", "document_name": "Corrected Attested Faculty Sanction List"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert upload_corr.status_code == 200

    # 5. Institution resubmits application with explanation
    resubmit_res = client.post(
        f"/api/v1/applications/{app_id}/resubmit",
        json={
            "reason": "Uploaded attested PhD certificates and verified AICTE faculty IDs for all senior faculty members."
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert resubmit_res.status_code == 200
    resubmitted = resubmit_res.json()
    assert resubmitted["current_stage"] == "SCRUTINY"
    assert resubmitted["status"] == "IN_PROGRESS"

    # 6. Check workflow timeline
    timeline_res = client.get(f"/api/v1/applications/{app_id}/timeline", headers={"Authorization": f"Bearer {inst_token}"})
    assert timeline_res.status_code == 200
    actions = [e["action"] for e in timeline_res.json()]
    assert "DRAFT_SAVED" in actions
    assert "SUBMITTED" in actions
    assert "RETURN" in actions
    assert "RESUBMIT" in actions


# --- 4. Notifications Tests ---

def test_v1_notifications_and_mark_read(client):
    inst_token = get_token(client, "college@demo.local")
    
    # Fetch notifications
    notif_res = client.get("/api/v1/notifications", headers={"Authorization": f"Bearer {inst_token}"})
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert isinstance(notifs, list)

    if len(notifs) > 0:
        target_nid = notifs[0]["id"]
        # Mark read via PATCH /api/v1/notifications/:id/read
        read_res = client.patch(
            f"/api/v1/notifications/{target_nid}/read",
            headers={"Authorization": f"Bearer {inst_token}"}
        )
        assert read_res.status_code == 200
        assert read_res.json()["is_read"] is True


# --- 5. Data Isolation Tests ---

def test_v1_institution_data_isolation(client):
    inst_token = get_token(client, "college@demo.local")
    
    # ABC Engineering College should not be able to fetch or modify Sunrise Institute's application (id=2)
    res_get = client.get("/api/v1/applications/2", headers={"Authorization": f"Bearer {inst_token}"})
    assert res_get.status_code == 403

    res_patch = client.patch(
        "/api/v1/applications/2",
        json={"notes": "Malicious modification attempt"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert res_patch.status_code == 403
