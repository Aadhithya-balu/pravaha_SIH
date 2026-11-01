import random
from datetime import date, timedelta
"""
test_evc_staff_assignment.py
Comprehensive test suite verifying Section 1-5 of the Team Feedback specification:
- EVC Staff Eligibility & Deficiency Checks
- AI-based Auto Allocation with explainable rationale
- Officer Manual Assignment with Roster & Validation
- EVC Staff Accept & Decline Lifecycle with audit history
- Self-service Staff Availability toggle
- Strict Role Matrix & RBAC Protection (Admin-only Role Matrix, Officer-only allocation)
"""

import io
import uuid
import pytest
from starlette.testclient import TestClient
from app.main import app
from app.db import get_db, SessionLocal
from app.models import User, Application, Document, ScrutinyFinding, EVCVisit, EVCAssignmentHistory, Alert


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_evc_full_lifecycle_and_rbac(client):
    # 1. Setup Auth Tokens
    # Admin
    admin_login = client.post("/api/auth/login", json={"email": "admin@demo.local", "password": "DemoPass123!"})
    assert admin_login.status_code == 200, admin_login.text
    admin_tok = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_tok}"}

    # Officer
    officer_login = client.post("/api/auth/login", json={"email": "officer@demo.local", "password": "DemoPass123!"})
    assert officer_login.status_code == 200, officer_login.text
    officer_tok = officer_login.json()["access_token"]
    officer_headers = {"Authorization": f"Bearer {officer_tok}"}

    # EVC Expert 1
    evc_login = client.post("/api/auth/login", json={"email": "evc@demo.local", "password": "DemoPass123!"})
    assert evc_login.status_code == 200, evc_login.text
    evc_tok = evc_login.json()["access_token"]
    evc_headers = {"Authorization": f"Bearer {evc_tok}"}

    # EVC Expert 2
    evc2_login = client.post("/api/auth/login", json={"email": "evc2@demo.local", "password": "DemoPass123!"})
    assert evc2_login.status_code == 200, evc2_login.text
    evc2_tok = evc2_login.json()["access_token"]
    evc2_headers = {"Authorization": f"Bearer {evc2_tok}"}

    # -------------------------------------------------------------
    # SECTION 3: ROLE MATRIX STRICT RBAC
    # -------------------------------------------------------------
    # Admin MUST have access
    admin_rm_res = client.get("/api/admin/role-matrix", headers=admin_headers)
    assert admin_rm_res.status_code == 200
    assert admin_rm_res.json()["status"] == "AUTHORIZED"
    assert len(admin_rm_res.json()["matrix"]) > 0

    # Officer CANNOT have access (strictly admin-only)
    officer_rm_res = client.get("/api/admin/role-matrix", headers=officer_headers)
    assert officer_rm_res.status_code == 403, f"Officer received {officer_rm_res.status_code} instead of 403"

    # EVC CANNOT have access
    evc_rm_res = client.get("/api/admin/role-matrix", headers=evc_headers)
    assert evc_rm_res.status_code == 403, f"EVC received {evc_rm_res.status_code} instead of 403"

    # -------------------------------------------------------------
    # SECTION 5: STAFF AVAILABILITY MANAGEMENT
    # -------------------------------------------------------------
    # EVC 1 sets self availability to AVAILABLE
    avail_res = client.post(
        "/api/evc/staff/availability",
        json={"availability_status": "AVAILABLE"},
        headers=evc_headers
    )
    assert avail_res.status_code == 200
    assert avail_res.json()["availability_status"] == "AVAILABLE"

    # EVC 2 sets self availability to UNAVAILABLE
    avail_res2 = client.post(
        "/api/evc/staff/availability",
        json={"availability_status": "UNAVAILABLE"},
        headers=evc2_headers
    )
    assert avail_res2.status_code == 200
    assert avail_res2.json()["availability_status"] == "UNAVAILABLE"

    # Fetch staff list via Officer
    staff_res = client.get("/api/evc/staff", headers=officer_headers)
    assert staff_res.status_code == 200
    staff_list = staff_res.json()
    assert len(staff_list) >= 2
    evc1_obj = next(s for s in staff_list if s["email"] == "evc@demo.local")
    evc2_obj = next(s for s in staff_list if s["email"] == "evc2@demo.local")
    assert evc1_obj["availability_status"] == "AVAILABLE"
    assert evc2_obj["availability_status"] == "UNAVAILABLE"

    # -------------------------------------------------------------
    # SECTION 1 & 2: APPLICATION JOURNEY & ELIGIBILITY ENFORCEMENT
    # -------------------------------------------------------------
    # Register new institution and submit application
    uid = uuid.uuid4().hex[:6]
    inst_res = client.post("/api/auth/register", json={
        "email": f"inst_{uid}@test.ac.in",
        "password": "Password123!",
        "contact_name": "Registrar",
        "institution_name": f"Test Technical College {uid}",
        "phone": "+91-9988776655",
        "region": "Northern",
        "state": "Delhi",
        "city": "New Delhi",
        "institution_type": "Government"
    })
    assert inst_res.status_code == 201
    inst_tok = inst_res.json()["access_token"]
    inst_headers = {"Authorization": f"Bearer {inst_tok}"}

    app_res = client.post("/api/v1/applications", json={
        "application_type": "New Programme/Level",
        "academic_year": "2026-2027",
        "notes": "Application for B.Tech in Artificial Intelligence & Data Science",
        "is_draft": False
    }, headers=inst_headers)
    assert app_res.status_code == 201
    app_id = app_res.json()["id"]

    # In SCRUTINY stage before scrutiny run and without docs, app is NOT eligible for EVC
    elig_res = client.get(f"/api/applications/{app_id}/evc-eligibility", headers=officer_headers)
    assert elig_res.status_code == 200
    elig_data = elig_res.json()
    assert elig_data["eligible"] is False
    assert len(elig_data["reasons"]) >= 1

    # Attempt AI auto-assign on ineligible app -> Must fail with 400
    auto_fail = client.post(f"/api/applications/{app_id}/evc/auto-assign", json={}, headers=officer_headers)
    assert auto_fail.status_code == 400
    assert "not eligible for EVC staff assignment" in auto_fail.json()["detail"]

    # EVC Expert attempts to assign -> Must fail with 403 (Officer/Admin only)
    evc_assign_unauth = client.post(
        f"/api/applications/{app_id}/evc/auto-assign",
        json={},
        headers=evc_headers
    )
    assert evc_assign_unauth.status_code == 403

    # Upload required land document
    doc_res = client.post(
        f"/api/v1/applications/{app_id}/documents",
        files={"file": ("land.pdf", io.BytesIO(b"%PDF-1.4 Land Deed Valid 5 Acres"), "application/pdf")},
        data={"document_type": "Land Document"},
        headers=inst_headers
    )
    assert doc_res.status_code in [200, 201]

    # Advance application through scrutiny to EVC_PENDING
    with SessionLocal() as db:
        app_obj = db.get(Application, app_id)
        app_obj.current_stage = "EVC_PENDING"
        db.commit()

    # Verify eligibility now passes
    elig_res2 = client.get(f"/api/applications/{app_id}/evc-eligibility", headers=officer_headers)
    assert elig_res2.status_code == 200
    assert elig_res2.json()["eligible"] is True

    # -------------------------------------------------------------
    # SECTION 1B: MANUAL ASSIGNMENT VALIDATION
    # -------------------------------------------------------------
    # Attempting to manually assign unavailable staff member (evc2) must fail with 400
    man_fail = client.post(
        f"/api/applications/{app_id}/evc/manual-assign",
        json={
            "staff_id": evc2_obj["id"],
            "proposed_date": str(date.today() + timedelta(days=random.randint(40, 80))),
            "remarks": "Assigned to Dr. Expert 2"
        },
        headers=officer_headers
    )
    assert man_fail.status_code == 400
    assert "UNAVAILABLE" in man_fail.json()["detail"]

    # -------------------------------------------------------------
    # SECTION 1B: AI AUTO ASSIGNMENT
    # -------------------------------------------------------------
    # Run AI Auto Assign
    auto_assign_res = client.post(
        f"/api/applications/{app_id}/evc/auto-assign",
        json={"proposed_date": str(date.today() + timedelta(days=random.randint(81, 120))), "remarks": "AI Auto-Allocation Run"},
        headers=officer_headers
    )
    assert auto_assign_res.status_code == 200, auto_assign_res.text
    assign_result = auto_assign_res.json()
    assert assign_result["assigned_staff_id"] is not None
    assert assign_result["assignment_method"] in ["AI", "AI_AUTO"]
    assert assign_result["assignment_status"] == "ASSIGNMENT_PENDING"
    assert "Assigned" in assign_result["assignment_reason"]
    visit_id = assign_result["id"]

    assigned_staff_id = assign_result["assigned_staff_id"]
    assigned_staff_obj = next(s for s in staff_list if s["id"] == assigned_staff_id)
    assert assigned_staff_obj["availability_status"] == "AVAILABLE"

    assignee_login = client.post("/api/auth/login", json={"email": assigned_staff_obj["email"], "password": "DemoPass123!"})
    assert assignee_login.status_code == 200
    assignee_headers = {"Authorization": f"Bearer {assignee_login.json()['access_token']}"}

    # Verify audit history logged the assignment
    hist_res = client.get(f"/api/applications/{app_id}/evc/history", headers=officer_headers)
    assert hist_res.status_code == 200
    hist_entries = hist_res.json()
    assert len(hist_entries) >= 1
    assert hist_entries[0]["assignment_status"] == "ASSIGNMENT_PENDING"
    assert hist_entries[0]["staff_email"] == assigned_staff_obj["email"]

    # -------------------------------------------------------------
    # SECTION 1C: STAFF AVAILABILITY CONFIRMATION (DECLINE SCENARIO)
    # -------------------------------------------------------------
    # Unauthorized EVC attempts to respond to assignee's visit -> Forbidden
    unauth_resp = client.post(
        f"/api/evc/{visit_id}/respond",
        json={"action": "ACCEPT"},
        headers=evc2_headers if assigned_staff_obj["email"] != "evc2@demo.local" else evc_headers
    )
    assert unauth_resp.status_code == 403

    # Assigned staff declines with reason
    decline_res = client.post(
        f"/api/evc/{visit_id}/respond",
        json={"action": "DECLINE", "reason": "Conflict with academic symposium on proposed date."},
        headers=assignee_headers
    )
    assert decline_res.status_code == 200
    decline_data = decline_res.json()
    assert decline_data["assignment_status"] == "DECLINED"

    # Application should now be eligible for reassignment
    elig_res3 = client.get(f"/api/applications/{app_id}/evc-eligibility", headers=officer_headers)
    assert elig_res3.status_code == 200
    assert elig_res3.json()["eligible"] is True

    # -------------------------------------------------------------
    # SECTION 1B: MANUAL ASSIGNMENT & ACCEPTANCE SCENARIO
    # -------------------------------------------------------------
    # Officer manually assigns EVC1
    man_assign_res = client.post(
        f"/api/applications/{app_id}/evc/manual-assign",
        json={
            "staff_id": evc1_obj["id"],
            "proposed_date": str(date.today() + timedelta(days=random.randint(121, 160))),
            "remarks": "Rescheduled date confirmed over telephone"
        },
        headers=officer_headers
    )
    assert man_assign_res.status_code == 200, man_assign_res.text
    assert man_assign_res.json()["assignment_method"] == "MANUAL"
    assert man_assign_res.json()["assignment_status"] == "ASSIGNMENT_PENDING"
    man_visit_id = man_assign_res.json()["id"]

    # EVC1 accepts the assignment
    accept_res = client.post(
        f"/api/evc/{man_visit_id}/respond",
        json={"action": "ACCEPT"},
        headers=evc_headers
    )
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["assignment_status"] == "ACCEPTED"

    # Verify staff availability status is now BUSY
    staff_res_after = client.get("/api/evc/staff", headers=officer_headers)
    evc1_updated = next(s for s in staff_res_after.json() if s["email"] == "evc@demo.local")
    assert evc1_updated["availability_status"] == "BUSY"

    # Check history contains both DECLINED and ACCEPTED records
    final_hist_res = client.get(f"/api/applications/{app_id}/evc/history", headers=officer_headers)
    final_hist = final_hist_res.json()
    statuses = [h["assignment_status"] for h in final_hist]
    assert "DECLINED" in statuses
    assert "ACCEPTED" in statuses
