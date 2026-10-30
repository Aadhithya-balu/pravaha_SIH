import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient

from app.main import app, calculate_haversine_distance, compute_combined_evc_assessment
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, EVCVisit, InspectionEvidence, AuditEvent
from app.ai_service import compute_image_phash


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    Base.metadata.create_all(engine)
    db = next(get_db())
    try:
        # Reset visit 1 and clean up test evidences so limit (15) and status are fresh
        db.query(InspectionEvidence).filter(InspectionEvidence.visit_id == 1).delete()
        v1 = db.query(EVCVisit).filter(EVCVisit.id == 1).first()
        if v1:
            v1.proof_submission_status = "NOT_SUBMITTED"
            v1.status = "SCHEDULED"
            v1.proof_decided_by = None
            v1.proof_decided_at = None
            v1.proof_declaration = None
            v1.proof_decision_remarks = None
            v1.gps_latitude = None
            v1.gps_longitude = None
            v1.location_status = None
        db.commit()
        seed_database(db)
    finally:
        db.close()


@pytest.fixture
def client():
    return TestClient(app)


def get_token(client, email, password="DemoPass123!"):
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return res.json()["access_token"]


def make_test_png(color=(20, 120, 220), size=(80, 80)):
    buf = io.BytesIO()
    img = Image.new("RGB", size, color)
    img.save(buf, format="PNG")
    return buf.getvalue()


# ==============================================================================
# 1. Coordinate Distance & Perceptual Hash Unit Tests
# ==============================================================================

def test_haversine_distance_calculation():
    # New Delhi AICTE HQ to Connaught Place (~1.8 km)
    lat1, lon1 = 28.5355, 77.1585  # AICTE HQ Vasant Kunj
    lat2, lon2 = 28.5400, 77.1650
    dist = calculate_haversine_distance(lat1, lon1, lat2, lon2)
    assert 0.5 < dist < 1.5

    # Same location must be 0
    assert calculate_haversine_distance(28.5, 77.2, 28.5, 77.2) == 0.0


def test_phash_computation():
    img_bytes1 = make_test_png(color=(255, 0, 0), size=(100, 100))
    img_bytes2 = make_test_png(color=(255, 0, 0), size=(50, 50))  # Same color, different resolution
    img_bytes3 = make_test_png(color=(0, 255, 0), size=(100, 100))

    h1 = compute_image_phash(img_bytes1)
    h2 = compute_image_phash(img_bytes2)
    assert h1 is not None
    assert len(h1) == 16  # 64-bit hex
    # Identical solid images should have same perceptual hash
    assert h1 == h2


# ==============================================================================
# 2. Upload Evidence Tests (Assigned EVC vs Unassigned vs Institution)
# ==============================================================================

def test_assigned_evc_can_upload_evidence(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    png_bytes = make_test_png((10, 80, 150))
    files = {"file": ("gate_entrance.png", io.BytesIO(png_bytes), "image/png")}
    data = {"evidence_type": "ENTRANCE_SIGNBOARD", "remarks": "Main entrance gate photograph"}

    res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert res.status_code == 201, res.text
    evidence = res.json()
    assert evidence["evidence_type"] == "ENTRANCE_SIGNBOARD"
    assert evidence["file_hash"] is not None
    assert evidence["is_duplicate"] is False
    assert evidence["phash"] is not None


def test_unassigned_evc_cannot_upload_evidence(client):
    # evc2 is Southern region, not assigned to Visit 1 (Western)
    token = get_token(client, "evc2@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    png_bytes = make_test_png()
    files = {"file": ("unauthorized.png", io.BytesIO(png_bytes), "image/png")}
    data = {"evidence_type": "CAMPUS_BUILDINGS"}

    res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert res.status_code == 403
    assert "not assigned" in res.json()["detail"].lower()


def test_institution_user_cannot_upload_evc_evidence(client):
    token = get_token(client, "college@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    png_bytes = make_test_png()
    files = {"file": ("college_attempt.png", io.BytesIO(png_bytes), "image/png")}
    data = {"evidence_type": "CAMPUS_BUILDINGS"}

    res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert res.status_code == 403


# ==============================================================================
# 3. Validation: File Format & Size Limits
# ==============================================================================

def test_unsupported_file_format_rejected(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    fake_pdf = b"%PDF-1.4 dummy content"
    files = {"file": ("document.pdf", io.BytesIO(fake_pdf), "application/pdf")}
    data = {"evidence_type": "CLASSROOMS"}

    res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert res.status_code == 400
    assert "only jpeg, png, and webp" in res.json()["detail"].lower()


def test_file_larger_than_10mb_rejected(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # 11 MB dummy buffer
    oversized = io.BytesIO(b"0" * (11 * 1024 * 1024))
    files = {"file": ("oversized.png", oversized, "image/png")}
    data = {"evidence_type": "CLASSROOMS"}

    res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert res.status_code == 400
    assert "10mb" in res.json()["detail"].lower() or "size" in res.json()["detail"].lower()


# ==============================================================================
# 4. Duplicate Image Detection (SHA-256)
# ==============================================================================

def test_sha256_duplicate_image_flagged(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    unique_color = (123, 234, 45)
    img_data = make_test_png(unique_color)

    # First upload on visit 1
    files1 = {"file": ("library_view1.png", io.BytesIO(img_data), "image/png")}
    data1 = {"evidence_type": "LIBRARY", "remarks": "First copy"}
    res1 = client.post("/api/v1/evc/1/evidence", headers=headers, files=files1, data=data1)
    assert res1.status_code == 201

    # Second upload with identical bytes to visit 2 (different inspection)
    adm_token = get_token(client, "admin@demo.local")
    adm_headers = {"Authorization": f"Bearer {adm_token}"}
    files2 = {"file": ("library_view2.png", io.BytesIO(img_data), "image/png")}
    data2 = {"evidence_type": "LIBRARY", "remarks": "Duplicate copy from earlier visit"}
    res2 = client.post("/api/v1/evc/2/evidence", headers=adm_headers, files=files2, data=data2)
    assert res2.status_code == 201
    ev2 = res2.json()
    assert ev2["is_duplicate"] is True
    assert ev2["duplicate_reference"] is not None


# ==============================================================================
# 5. Geolocation Proximity & Threshold Warnings
# ==============================================================================

def test_geolocation_capture_within_proximity(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Sunrise Institute of Technology Pune baseline is approx (18.5913, 73.7389)
    # Post coordinate 100 meters away
    payload = {
        "latitude": 18.5920,
        "longitude": 73.7395,
        "accuracy": 15.0
    }
    res = client.post("/api/v1/evc/1/location", headers=headers, json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["location_status"] == "WITHIN_PROXIMITY"
    assert data["gps_distance_km"] < 1.0


def test_geolocation_capture_distance_exceeded(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Post coordinate in Delhi (1170 km away from Pune baseline)
    payload = {
        "latitude": 28.6139,
        "longitude": 77.2090,
        "accuracy": 20.0
    }
    res = client.post("/api/v1/evc/1/location", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["location_status"] == "DISTANCE_EXCEEDED"
    assert data["gps_distance_km"] > 500.0


# ==============================================================================
# 6. AI Vision Screening & Fallback
# ==============================================================================

def test_ai_vision_screening_execution(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Upload evidence to test AI
    img_data = make_test_png((40, 160, 220))
    files = {"file": ("lab_inspection.png", io.BytesIO(img_data), "image/png")}
    data = {"evidence_type": "LABORATORIES_WORKSHOPS"}
    up_res = client.post("/api/v1/evc/1/evidence", headers=headers, files=files, data=data)
    assert up_res.status_code == 201
    eid = up_res.json()["id"]

    # Trigger AI analysis
    res = client.post(f"/api/v1/evc/evidence/{eid}/analyze", headers=headers)
    assert res.status_code == 200
    ai_data = res.json()
    assert ai_data["ai_analysis_status"] in ["COMPLETED", "UNAVAILABLE"]
    assert "ai_observations" in ai_data


# ==============================================================================
# 7. Visit Proof Dossier Endpoint
# ==============================================================================

def test_get_visit_proof_dossier(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/v1/evc/1/proof", headers=headers)
    assert res.status_code == 200
    dossier = res.json()
    assert "visit" in dossier
    assert "evidences" in dossier
    assert "combined_assessment" in dossier
    assert dossier["visit"]["institution_name"] == "Sunrise Institute of Technology"


# ==============================================================================
# 8. Declaration & Submission Integrity
# ==============================================================================

def test_submission_fails_without_declaration(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Declaration too short (< 10 chars)
    payload = {"declaration": "short"}
    res = client.post("/api/v1/evc/1/proof/submit", headers=headers, json=payload)
    assert res.status_code == 422


def test_successful_proof_submission(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "declaration": "I hereby solemnly declare that all photographs and coordinates were captured during actual physical inspection."
    }
    res = client.post("/api/v1/evc/1/proof/submit", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["visit"]["proof_submission_status"] == "SUBMITTED"
    assert data["visit"]["proof_declaration"] is not None


def test_cannot_delete_evidence_after_submission(client):
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch dossier to find evidence ID
    d_res = client.get("/api/v1/evc/1/proof", headers=headers)
    evidences = d_res.json()["evidences"]
    assert len(evidences) > 0
    eid = evidences[0]["id"]

    # Attempt to delete after visit proof has been submitted
    del_res = client.delete(f"/api/v1/evc/evidence/{eid}", headers=headers)
    assert del_res.status_code == 400
    assert "submitted" in del_res.json()["detail"].lower() and "cannot delete" in del_res.json()["detail"].lower()


# ==============================================================================
# 9. RBAC & Verification Authority: EVC Self-Approval Block & Jurisdiction
# ==============================================================================

def test_evc_cannot_verify_own_proof(client):
    # EVC expert strictly barred from approving their own submitted proof
    token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "action": "ACCEPT",
        "remarks": "Self approval attempt"
    }
    res = client.post("/api/v1/evc/1/proof/verify", headers=headers, json=payload)
    assert res.status_code == 403
    assert "access denied" in res.json()["detail"].lower() or "prohibited" in res.json()["detail"].lower() or "forbidden" in res.json()["detail"].lower()


def test_ro_from_other_region_cannot_verify_proof(client):
    # Visit 1 belongs to Western region (Sunrise Institute of Technology)
    # officer_south is Southern region officer
    token = get_token(client, "officer_south@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "action": "ACCEPT",
        "remarks": "Southern officer approving northern/western visit"
    }
    res = client.post("/api/v1/evc/1/proof/verify", headers=headers, json=payload)
    assert res.status_code == 403
    assert "jurisdiction" in res.json()["detail"].lower()


# ==============================================================================
# 10. RO Additional Evidence Request & Re-upload Lifecycle
# ==============================================================================

def test_ro_requires_mandatory_remarks_for_additional_evidence(client):
    token = get_token(client, "admin@demo.local")
    headers = {"Authorization": f"Bearer {token}"}

    # Empty remarks must be rejected
    payload = {
        "action": "REQUEST_ADDITIONAL_EVIDENCE",
        "remarks": "   "
    }
    res = client.post("/api/v1/evc/1/proof/verify", headers=headers, json=payload)
    assert res.status_code == 400
    assert "mandatory" in res.json()["detail"].lower()


def test_ro_request_additional_evidence_allows_reupload(client):
    admin_token = get_token(client, "admin@demo.local")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    payload = {
        "action": "REQUEST_ADDITIONAL_EVIDENCE",
        "remarks": "Please upload additional photographs of the computer server room and library."
    }
    res = client.post("/api/v1/evc/1/proof/verify", headers=admin_headers, json=payload)
    assert res.status_code == 200
    assert res.json()["visit"]["proof_submission_status"] == "ADDITIONAL_EVIDENCE_REQUIRED"

    # Now EVC can upload the supplementary photograph
    evc_token = get_token(client, "evc@demo.local")
    evc_headers = {"Authorization": f"Bearer {evc_token}"}

    supp_img = make_test_png((80, 200, 100))
    files = {"file": ("server_room.png", io.BytesIO(supp_img), "image/png")}
    data = {"evidence_type": "LABORATORIES_WORKSHOPS", "remarks": "Supplementary server room photo"}
    reup_res = client.post("/api/v1/evc/1/evidence", headers=evc_headers, files=files, data=data)
    assert reup_res.status_code == 201

    # EVC re-submits proof
    sub_res = client.post(
        "/api/v1/evc/1/proof/submit",
        headers=evc_headers,
        json={"declaration": "I solemnly confirm all supplementary photographs are authentic."}
    )
    assert sub_res.status_code == 200
    assert sub_res.json()["visit"]["proof_submission_status"] == "SUBMITTED"


# ==============================================================================
# 11. Final RO Acceptance & Tamper-Evident Locking
# ==============================================================================

def test_ro_accept_proof_locks_inspection(client):
    admin_token = get_token(client, "admin@demo.local")
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    payload = {
        "action": "ACCEPT",
        "remarks": "All physical visit photographs and GPS coordinates verified in accordance with AICTE approval norms."
    }
    res = client.post("/api/v1/evc/1/proof/verify", headers=admin_headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["visit"]["proof_submission_status"] == "ACCEPTED"
    assert data["visit"]["proof_decided_by"] is not None

    # Locked: EVC attempting to re-submit must fail
    evc_token = get_token(client, "evc@demo.local")
    evc_headers = {"Authorization": f"Bearer {evc_token}"}
    locked_res = client.post(
        "/api/v1/evc/1/proof/submit",
        headers=evc_headers,
        json={"declaration": "Trying to modify after acceptance"}
    )
    assert locked_res.status_code == 400
    assert "already been verified and accepted" in locked_res.json()["detail"].lower()


# ==============================================================================
# 12. Audit Trail & Notification Verification
# ==============================================================================

def test_audit_trail_recorded_for_all_proof_transitions(client):
    admin_token = get_token(client, "admin@demo.local")
    headers = {"Authorization": f"Bearer {admin_token}"}

    res = client.get("/api/audit/recent?limit=50", headers=headers)
    assert res.status_code == 200
    logs = res.json()
    actions = [log.get("action") for log in logs]

    assert "EVC_EVIDENCE_UPLOADED" in actions
    assert "EVC_LOCATION_CAPTURED" in actions
    assert "EVC_PROOF_SUBMITTED" in actions
    assert "EVC_PROOF_ACCEPT" in actions
