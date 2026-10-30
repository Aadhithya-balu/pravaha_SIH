import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, Document, EVCVisit, InspectionEvidence, ComplianceItem, StageRemark


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


# 1. Institution Profile & Mandatory College Name Tests

def test_institution_profile_endpoint(client):
    inst_token = get_token(client, "college@demo.local")
    res = client.get("/api/institutions/profile", headers={"Authorization": f"Bearer {inst_token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "ABC Engineering College"
    assert data["code"] is not None
    assert data["region"] == "Northern"
    assert data["contact_email"] is not None


def test_mandatory_college_name_validation(client):
    officer_token = get_token(client, "officer@demo.local")
    # Officer creating application with empty institution_name should be rejected with 400
    res = client.post(
        "/api/applications",
        json={
            "institution_name": "",
            "application_type": "Extension of Approval",
            "academic_year": "2026-2027"
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert res.status_code == 400
    assert "mandatory" in res.json()["detail"].lower() or "required" in res.json()["detail"].lower()


# 2. Document Category Selection, Persistence, and Approved Documents Tests

def test_document_category_and_approved_documents(client):
    inst_token = get_token(client, "college@demo.local")
    officer_token = get_token(client, "officer@demo.local")

    # Create an application
    create_res = client.post(
        "/api/applications",
        json={
            "application_type": "Extension of Approval",
            "notes": "Testing document category persistence",
            "academic_year": "2026-2027"
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert create_res.status_code == 201
    aid = create_res.json()["id"]

    # Upload document with custom category
    pdf_content = b"%PDF-1.4 sample land lease document with registered tenure of 33 years"
    upload_res = client.post(
        f"/api/applications/{aid}/documents",
        files={"file": ("lease_deed_category_test.pdf", pdf_content, "application/pdf")},
        data={
            "document_type": "LEASE_DEED",
            "document_category": "LAND_LEASE_DOCUMENTS"
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert upload_res.status_code == 200
    doc_data = upload_res.json()["document"]
    did = doc_data["id"]
    assert doc_data["document_category"] == "LAND_LEASE_DOCUMENTS"
    assert doc_data["file_hash"] is not None

    # Review document as accepted
    rev_res = client.post(
        f"/api/documents/{did}/review",
        json={"review_status": "ACCEPTED", "reviewer_notes": "Statutory land lease verified."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert rev_res.status_code == 200

    # Check approved documents endpoint
    approved_res = client.get(
        f"/api/applications/{aid}/approved-documents",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert approved_res.status_code == 200
    approved_list = approved_res.json()
    assert len(approved_list) >= 1
    assert any(d["id"] == did for d in approved_list)


# 3. Document Retry Processing Test

def test_document_retry_processing(client):
    inst_token = get_token(client, "college@demo.local")
    # Upload general document
    upload_res = client.post(
        "/api/documents/upload",
        files={"file": ("retry_sample.txt", b"Building plan and fire clearance sample text", "text/plain")},
        data={"document_type": "BUILDING_PLAN", "document_category": "INFRASTRUCTURE_RECORDS"},
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert upload_res.status_code == 200
    did = upload_res.json()["document"]["id"]

    # Retry processing
    retry_res = client.post(
        f"/api/documents/{did}/retry-processing",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert retry_res.status_code == 200
    res_data = retry_res.json()
    assert res_data["document_id"] == did
    assert res_data["processing_status"] in ["COMPLETED", "SUCCESS"]
    assert res_data["document_category"] == "INFRASTRUCTURE_RECORDS"


# 4. EVC Scheduling, Rescheduling, Missed Visit & Approve Next Stage Tests

def test_evc_full_lifecycle_and_approve_next_stage(client):
    officer_token = get_token(client, "officer@demo.local")
    evc_token = get_token(client, "evc@demo.local")
    inst_token = get_token(client, "college@demo.local")

    # 1. Create a New Programme Application
    create_res = client.post(
        "/api/applications",
        json={
            "application_type": "New Programme / Level",
            "notes": "EVC Lifecycle Test Case",
            "academic_year": "2026-2027"
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert create_res.status_code == 201
    aid = create_res.json()["id"]

    # Move application to EVC_SCHEDULED
    sched_date = (date.today() + timedelta(days=5)).isoformat()
    sched_res = client.post(
        "/api/evc",
        json={
            "application_id": aid,
            "committee_members": "Prof. S. Ramanujan (evc@demo.local), Dr. P. C. Ray",
            "scheduled_date": sched_date,
            "visit_mode": "PHYSICAL",
            "location_details": "Main Academic Block, ABC College Campus"
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert sched_res.status_code == 201
    vid = sched_res.json()["id"]

    # 2. Test Rescheduling with mandatory reason
    new_date = (date.today() + timedelta(days=7)).isoformat()
    resched_res = client.post(
        f"/api/evc/{vid}/reschedule",
        json={
            "new_date": new_date,
            "reason": "Administrative committee member flight delay due to inclement weather",
            "visit_mode": "PHYSICAL"
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert resched_res.status_code == 200
    assert resched_res.json()["scheduled_date"] == new_date
    assert "inclement weather" in resched_res.json()["missed_reason"]

    # 3. Test Missed Visit does NOT falsely mark complete
    missed_res = client.post(
        f"/api/evc/{vid}/update",
        json={
            "status": "POSTPONED",
            "visit_occurred": "DID_NOT_OCCUR",
            "missed_reason": "Severe rainfall prevented physical access to campus"
        },
        headers={"Authorization": f"Bearer {evc_token}"}
    )
    assert missed_res.status_code == 200
    assert missed_res.json()["status"] == "POSTPONED"
    assert missed_res.json()["visit_occurred"] == "DID_NOT_OCCUR"

    # Attempt to Approve Next Stage when visit did NOT occur -> Must be BLOCKED with 400
    blocked_approve = client.post(
        f"/api/evc/{vid}/approve-next-stage",
        json={"remarks": "Attempting advance without inspection"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert blocked_approve.status_code == 400
    assert "did not occur" in blocked_approve.json()["detail"].lower()

    # 4. Record actual completed visit
    complete_res = client.post(
        f"/api/evc/{vid}/update",
        json={
            "status": "COMPLETED",
            "visit_occurred": "OCCURRED",
            "actual_date": date.today().isoformat(),
            "report_summary": "Comprehensive physical verification of laboratories and computing facilities completed.",
            "recommendations": "Recommend grant of approval for intake of 60 seats.",
            "inspection_outcome": "RECOMMENDED"
        },
        headers={"Authorization": f"Bearer {evc_token}"}
    )
    assert complete_res.status_code == 200
    assert complete_res.json()["status"] == "COMPLETED"
    assert complete_res.json()["visit_occurred"] == "OCCURRED"

    # 5. Attempt to Approve Next Stage WITHOUT evidence -> Must be BLOCKED with 400
    no_evidence_res = client.post(
        f"/api/evc/{vid}/approve-next-stage",
        json={"remarks": "Advancing without evidence"},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert no_evidence_res.status_code == 400
    assert "evidence" in no_evidence_res.json()["detail"].lower()

    # 6. Upload Inspection Evidence
    evidence_res = client.post(
        f"/api/evc/{vid}/evidence",
        files={"file": ("lab_inspection_photo.png", b"PNG fake geotagged photo bytes", "image/png")},
        data={"evidence_type": "GEOTAGGED_PHOTO", "remarks": "High performance computing lab verified"},
        headers={"Authorization": f"Bearer {evc_token}"}
    )
    assert evidence_res.status_code == 201
    eid = evidence_res.json()["id"]

    # Verify evidence
    verify_ev_res = client.post(
        f"/api/evc/evidence/{eid}/verify",
        json={"action": "VERIFY", "remarks": "Geotagged timestamp and coordinates authenticated."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert verify_ev_res.status_code == 200
    assert verify_ev_res.json()["verification_status"] == "VERIFIED"

    # 7. Now trigger "Approve Next Stage" -> MUST SUCCEED
    advance_res = client.post(
        f"/api/evc/{vid}/approve-next-stage",
        json={"remarks": "EVC inspection findings and geotagged evidence verified. Advancing to SAC review."},
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert advance_res.status_code == 200
    adv_data = advance_res.json()
    assert adv_data["current_stage"] == "SAC_SHC_REVIEW"


# 5. Remarks, Resubmission History, and Post-Approval Compliance Tests

def test_stage_remarks_and_post_approval_compliance(client):
    officer_token = get_token(client, "officer@demo.local")
    inst_token = get_token(client, "college@demo.local")

    # 1. Create Application
    create_res = client.post(
        "/api/applications",
        json={
            "application_type": "Extension of Approval",
            "notes": "Testing remarks and post-approval compliance",
            "academic_year": "2026-2027"
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    aid = create_res.json()["id"]

    # 2. Add Stage Remark
    rem_res = client.post(
        f"/api/applications/{aid}/remarks",
        json={
            "stage": "SCRUTINY",
            "comment_text": "Faculty roster requires verification against council portal.",
            "action_type": "SCRUTINY_FINDING",
            "visibility": "APPLICANT_VISIBLE"
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert rem_res.status_code == 201
    parent_rem_id = rem_res.json()["id"]
    assert rem_res.json()["action_type"] == "SCRUTINY_FINDING"

    # 3. Add Reply Remark
    reply_res = client.post(
        f"/api/applications/{aid}/remarks",
        json={
            "stage": "SCRUTINY",
            "comment_text": "Roster cross-checked with latest biometric punch records.",
            "action_type": "REVIEW_COMMENT",
            "parent_remark_id": parent_rem_id
        },
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert reply_res.status_code == 201
    assert reply_res.json()["parent_remark_id"] == parent_rem_id

    # 4. Fetch chronological remarks
    list_res = client.get(
        f"/api/applications/{aid}/remarks",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert list_res.status_code == 200
    rems = list_res.json()
    assert len(rems) >= 2

    # 5. Officer records final APPROVAL decision
    decision_res = client.post(
        f"/api/applications/{aid}/decision",
        json={
            "decision": "APPROVED",
            "remarks": "All AICTE APH Chapter II norms met satisfactorily. EoA granted."
        },
        headers={"Authorization": f"Bearer {officer_token}"}
    )
    assert decision_res.status_code == 200
    assert decision_res.json()["decision_outcome"] == "APPROVED"
    assert decision_res.json()["status"] == "COMPLETED"

    # 6. Verify post-approval compliance obligations were automatically generated
    comp_res = client.get(
        f"/api/compliance?application_id={aid}",
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert comp_res.status_code == 200
    comp_items = comp_res.json()
    assert len(comp_items) >= 4  # Fire NOC, faculty roster, anti-ragging, fee compliance
    types = [c["item_type"] for c in comp_items]
    assert "FIRE_SAFETY_NOC" in types
    assert "UNDERTAKINGS" in types or "UNDERTAKING" in types
