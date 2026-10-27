import io
import pytest
from datetime import date, timedelta
from fastapi.testclient import TestClient

from app.main import app
from app.db import Base, engine, get_db
from app.seed import seed_database
from app.models import User, Application, Document, AuditEvent


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


def test_next_best_action_endpoint(client):
    officer_token = get_token(client, "officer@demo.local")
    # Application 1 is in SCRUTINY stage
    res = client.get("/api/applications/1/next-action", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "action_code" in data
    assert "action_label" in data
    assert "target_role" in data
    assert "reason" in data
    assert data["target_role"] == "officer"
    assert data["is_user_authorized"] is True


def test_application_list_includes_next_action(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.get("/api/applications", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    apps = res.json()
    assert len(apps) > 0
    first = apps[0]
    assert "next_action" in first
    assert first["next_action"] is not None
    assert "action_code" in first["next_action"]
    assert "action_label" in first["next_action"]


def test_extracted_candidate_fields_and_prefill(client):
    inst_token = get_token(client, "college@demo.local")
    # 1. Fetch extracted fields for application 1
    res = client.get("/api/applications/1/extracted-fields", headers={"Authorization": f"Bearer {inst_token}"})
    assert res.status_code == 200
    fields = res.json()
    assert isinstance(fields, list)
    for f in fields:
        assert "field_key" in f
        assert "provenance" in f
        assert "confidence_label" in f
        assert "source_document" in f

    # 2. Apply confirmed fields to application
    apply_payload = {
        "fields": {
            "land_survey_no": "Khasra No. 412/1 and 413",
            "lease_tenure": "33 Years",
            "fire_safety_noc_status": "Valid until August 2026"
        }
    }
    apply_res = client.post(
        "/api/applications/1/apply-extracted-fields",
        json=apply_payload,
        headers={"Authorization": f"Bearer {inst_token}"}
    )
    assert apply_res.status_code == 200
    data = apply_res.json()
    assert data["status"] == "success"
    assert "form_data" in data
    assert data["form_data"]["lease_tenure"] == "33 Years"


def test_bottleneck_analytics_endpoint(client):
    officer_token = get_token(client, "officer@demo.local")
    res = client.get("/api/analytics/bottlenecks", headers={"Authorization": f"Bearer {officer_token}"})
    assert res.status_code == 200
    data = res.json()
    assert "total_active_applications" in data
    assert "sla_compliance_rate" in data
    assert "stage_analytics" in data
    assert "region_workload" in data
    assert "identified_bottlenecks" in data
    assert isinstance(data["stage_analytics"], list)
    if data["stage_analytics"]:
        s = data["stage_analytics"][0]
        assert "stage" in s
        assert "count" in s
        assert "avg_age_days" in s


def test_recent_audit_events_endpoint(client):
    officer_token = get_token(client, 'officer@demo.local')
    res = client.get('/api/audit/recent?limit=5', headers={'Authorization': f'Bearer {officer_token}'})
    assert res.status_code == 200
    events = res.json()
    assert isinstance(events, list)
    if events:
        first = events[0]
        assert 'application_id' in first
        assert 'action' in first
        assert 'actor' in first
        assert 'application_reference' in first
