import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, Document, StageRemark, RegulatoryCategory, EVCVisit


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
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
# 1. Official Institution Registration Tests
# ==============================================================================

def test_institution_registration_success(client):
    unique_id = uuid.uuid4().hex[:6]
    payload = {
        "institution_name": f"Kalinga Tech Institute {unique_id}",
        "institution_type": "ENGINEERING_COLLEGE",
        "institution_code": f"AICTE-1-{unique_id.upper()}",
        "region": "Eastern",
        "state": "Odisha",
        "city": "Bhubaneswar",
        "contact_name": "Dr. Pradeep Mishra",
        "email": f"registrar_{unique_id}@demo.local",
        "phone": "+91 98765 43210",
        "password": "SecurePassword123!"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "institution"  # Must strictly be institution role
    assert data["institution_name"] == f"Kalinga Tech Institute {unique_id}"


def test_institution_registration_duplicate_email(client):
    payload = {
        "institution_name": "Duplicate Attempt College",
        "institution_type": "MANAGEMENT_INSTITUTE",
        "region": "Northern",
        "state": "Delhi",
        "city": "New Delhi",
        "contact_name": "Officer Incharge",
        "email": "college@demo.local",  # already seeded
        "phone": "9999999999",
        "password": "Password123!"
    }
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 409
    assert "already registered" in res.json()["detail"].lower()


# ==============================================================================
# 2. Searchable Regulatory Categories Tests
# ==============================================================================

def test_regulatory_categories_search(client):
    inst_token = get_token(client, "college@demo.local")
    headers = {"Authorization": f"Bearer {inst_token}"}

    # Fetch all categories
    res = client.get("/api/regulatory-categories", headers=headers)
    assert res.status_code == 200
    categories = res.json()
    assert len(categories) >= 5

    # Test keyword search
    res_search = client.get("/api/regulatory-categories?search=Intake", headers=headers)
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert any("INTAKE" in cat["category_code"] for cat in search_data)


# ==============================================================================
# 3. Stage Remarks & Chronological Discussion Tests
# ==============================================================================

def test_stage_remarks_visibility_and_creation(client):
    officer_token = get_token(client, "officer@demo.local")
    inst_token = get_token(client, "college@demo.local")

    # Officer posts internal remark
    post_internal = client.post(
        "/api/applications/1/remarks",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={
            "stage": "SCRUTINY",
            "remark": "Confidential legal verification pending with state board.",
            "visibility": "INTERNAL_OFFICER_ONLY"
        }
    )
    assert post_internal.status_code == 201

    # Officer posts applicant-visible remark
    post_public = client.post(
        "/api/applications/1/remarks",
        headers={"Authorization": f"Bearer {officer_token}"},
        json={
            "stage": "SCRUTINY",
            "remark": "Please clarify building floor area certificate in annexure B.",
            "visibility": "APPLICANT_VISIBLE"
        }
    )
    assert post_public.status_code == 201

    # Institution retrieves remarks - must ONLY see APPLICANT_VISIBLE remarks
    inst_res = client.get("/api/applications/1/remarks", headers={"Authorization": f"Bearer {inst_token}"})
    assert inst_res.status_code == 200
    inst_remarks = inst_res.json()
    for rem in inst_remarks:
        assert rem["visibility"] == "APPLICANT_VISIBLE"
        assert "Confidential legal verification" not in rem["comment_text"]

    # Officer retrieves remarks - must see BOTH internal and public remarks
    officer_res = client.get("/api/applications/1/remarks", headers={"Authorization": f"Bearer {officer_token}"})
    assert officer_res.status_code == 200
    officer_remarks = officer_res.json()
    assert any(r["visibility"] == "INTERNAL_OFFICER_ONLY" for r in officer_remarks)


# ==============================================================================
# 4. EVC Inspection Evidence Upload Tests
# ==============================================================================

def test_evc_evidence_upload(client):
    evc_token = get_token(client, "evc@demo.local")
    file_bytes = b"Sample GPS geotagged photo proof of college library infrastructure."

    files = {
        "file": ("library_site_photo.jpg", io.BytesIO(file_bytes), "image/jpeg")
    }
    data = {
        "evidence_type": "PHOTO_GEO",
        "description": "Central reading hall inspection verifying 150 seat capacity",
        "gps_latitude": 28.6139,
        "gps_longitude": 77.2090
    }

    res = client.post(
        "/api/evc/1/evidence",
        headers={"Authorization": f"Bearer {evc_token}"},
        data=data,
        files=files
    )
    assert res.status_code == 201
    resp_data = res.json()
    assert resp_data["evidence_type"] == "PHOTO_GEO"
    assert "file_hash" in resp_data
    assert len(resp_data["file_hash"]) == 64  # Valid SHA-256 hex string


# ==============================================================================
# 5. Document Versioning & Replacement Tests
# ==============================================================================

def test_document_replacement_and_versioning(client):
    inst_token = get_token(client, "college@demo.local")
    replacement_file = b"AICTE Land Certificate - Corrected Survey Number Revision 2"

    files = {
        "file": ("land_certificate_v2.pdf", io.BytesIO(replacement_file), "application/pdf")
    }

    res = client.post(
        "/api/applications/1/documents/1/replace",
        headers={"Authorization": f"Bearer {inst_token}"},
        files=files
    )
    assert res.status_code == 200
    doc_data = res.json()
    assert doc_data["version"] >= 2
    assert doc_data["is_latest"] is True
    assert "file_hash" in doc_data
    assert len(doc_data["file_hash"]) == 64


# ==============================================================================
# 6. Strict RBAC Enforcement Tests
# ==============================================================================

def test_evc_cannot_access_or_modify_system_users(client):
    evc_token = get_token(client, "evc@demo.local")
    headers = {"Authorization": f"Bearer {evc_token}"}

    # EVC expert must not be allowed to perform administrative operations
    res = client.post("/api/admin/system-rules", headers=headers, json={"key": "test", "value": "val"})
    assert res.status_code in [401, 403, 404]


def test_applicant_cannot_decide_approval(client):
    inst_token = get_token(client, "college@demo.local")
    headers = {"Authorization": f"Bearer {inst_token}"}

    # Institution applicant cannot execute final approval decision
    res = client.post(
        "/api/applications/1/decision",
        headers=headers,
        json={"outcome": "APPROVED", "remarks": "Unauthorized self-approval"}
    )
    assert res.status_code in [403, 405]
