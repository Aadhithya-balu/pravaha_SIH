import pytest
import os
import json
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app
from app.ai_service import get_ai_config, review_document, analyze_document_llm


@pytest.fixture
def client():
    return TestClient(app)


def test_groq_config_auto_detection():
    # Test 1: GROQ_API_KEY provided -> resolves to groq
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_mock_key_12345", "AI_PROVIDER": ""}, clear=False):
        cfg = get_ai_config()
        assert cfg["provider"] == "groq"
        assert cfg["api_key"] == "gsk_test_mock_key_12345"
        assert "llama" in cfg["model"] or "groq" in cfg["base_url"]
        assert cfg["base_url"] == "https://api.groq.com/openai/v1/chat/completions"

    # Test 2: Custom GROQ_MODEL
    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_key", "GROQ_MODEL": "llama-3.1-8b-instant"}, clear=False):
        cfg = get_ai_config()
        assert cfg["provider"] == "groq"
        assert cfg["model"] == "llama-3.1-8b-instant"

    # Test 3: No keys provided -> resolves to none
    with patch.dict(os.environ, {
        "GROQ_API_KEY": "",
        "OPENAI_API_KEY": "",
        "GEMINI_API_KEY": "",
        "GOOGLE_API_KEY": "",
        "ANTHROPIC_API_KEY": "",
        "AI_API_KEY": "",
        "AI_PROVIDER": ""
    }, clear=False):
        cfg = get_ai_config()
        assert cfg["provider"] == "none"
        assert cfg["api_key"] == ""


@pytest.mark.asyncio
async def test_honest_fallback_when_groq_unconfigured():
    # Without API keys, review_document must honestly report deterministic mode without faking AI
    with patch.dict(os.environ, {
        "GROQ_API_KEY": "",
        "OPENAI_API_KEY": "",
        "AI_API_KEY": "",
        "AI_PROVIDER": ""
    }, clear=False):
        res = await review_document(
            document_name="Sample_Lease_Deed.pdf",
            document_type="LEASE_DEED",
            text="Plot 412, measuring 7.50 Acres. Lease tenure 33 Years."
        )
        assert res["mode"] in ["demo_mode", "deterministic_fallback"]
        assert res["provider"] in ["deterministic_local", "deterministic_rule_engine"]
        assert "unconfigured" in res["mode_fallback_reason"].lower()
        assert "disclaimer" in res


@pytest.mark.asyncio
async def test_mocked_groq_real_llm_execution():
    # When Groq key is set and API responds 200, return structured real_llm analysis
    mock_groq_payload = {
        "choices": [
            {
                "message": {
                    "content": json.dumps({
                        "summary": "Official Lease Deed for 33 years executed in favour of ABC Engineering College.",
                        "extracted_fields": {
                            "Institution Name": "ABC Engineering College",
                            "Lease Tenure": "33 Years",
                            "Land Area": "7.50 Acres"
                        },
                        "missing_information": [],
                        "potential_inconsistencies": [],
                        "verification_questions": ["Confirm physical registration with Sub-Registrar"],
                        "confidence_score": 0.94
                    })
                }
            }
        ]
    }

    mock_response = AsyncMock()
    mock_response.status_code = 200
    mock_response.json = lambda: mock_groq_payload

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_key_abc", "AI_PROVIDER": "groq"}, clear=False):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_response
            res = await analyze_document_llm(
                document_name="Registered_Lease_Deed.pdf",
                document_type="LEASE_DEED",
                text="Plot 412, 7.50 Acres. Lease for 33 Years in favour of ABC Engineering College."
            )
            assert res["mode"] == "real_llm"
            assert res["provider"] == "groq"
            assert res["summary"].startswith("Official Lease Deed")
            assert res["confidence_score"] == 0.94
            assert len(res["candidate_fields"]) > 0


@pytest.mark.asyncio
async def test_groq_failure_graceful_handling():
    # When Groq returns HTTP 429 rate limit or 500 error, report failure honestly with deterministic fallback
    mock_error_resp = AsyncMock()
    mock_error_resp.status_code = 429
    mock_error_resp.text = "Rate limit reached for requests per minute (TPM)"

    with patch.dict(os.environ, {"GROQ_API_KEY": "gsk_test_key_abc", "AI_PROVIDER": "groq"}, clear=False):
        with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = mock_error_resp
            res = await analyze_document_llm(
                document_name="Registered_Lease_Deed.pdf",
                document_type="LEASE_DEED",
                text="Plot 412, 7.50 Acres. Lease for 33 Years."
            )
            assert res["mode"] == "deterministic_fallback"
            assert res["provider"] == "groq"
            assert "429" in res["mode_fallback_reason"]


def test_combined_officer_admin_login_and_access(client):
    # Test login for the 3 primary demo roles
    # 1. Institution Applicant
    resp_inst = client.post("/api/auth/login", json={"email": "college@demo.local", "password": "DemoPass123!"})
    assert resp_inst.status_code == 200
    token_inst = resp_inst.json()["access_token"]

    # 2. Combined Regional Officer / Admin
    resp_ro = client.post("/api/auth/login", json={"email": "officer@demo.local", "password": "DemoPass123!"})
    assert resp_ro.status_code == 200
    token_ro = resp_ro.json()["access_token"]
    assert resp_ro.json()["role"] == "officer"

    # 3. EVC Expert
    resp_evc = client.post("/api/auth/login", json={"email": "evc@demo.local", "password": "DemoPass123!"})
    assert resp_evc.status_code == 200
    token_evc = resp_evc.json()["access_token"]
    assert resp_evc.json()["role"] == "evc_expert"

    # Verify Regional Officer has administrative operational clearance
    headers_ro = {"Authorization": f"Bearer {token_ro}"}
    dash_resp = client.get("/api/dashboard", headers=headers_ro)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert "total_applications" in dash_data

    # Verify Institution cannot access officer-only scrutiny endpoints
    headers_inst = {"Authorization": f"Bearer {token_inst}"}
    esc_resp = client.post("/api/escalation/run-check", headers=headers_inst)
    assert esc_resp.status_code == 403
