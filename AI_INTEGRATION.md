# PRAVAHA — AI Architecture & Integration Specification
**Multi-Provider Explainable AI Layer & Deterministic Regulatory Safeguards**  
*Problem Statement Code: SIH26262 | Smart India Hackathon 2024 / 2026*  
*Module Location: `backend/app/ai_service.py`*

---

## 1. Architectural Philosophy: Explainable AI with Deterministic Governance

Pravaha integrates Large Language Models (LLMs) strictly as an **explainable assistance and intelligence layer**, never as an autonomous statutory authority. 

### Division of Responsibilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DETERMINISTIC REGULATORY ENGINE                      │
│                                                                        │
│ • Statutory workflow state machine transitions (Draft -> Closed)       │
│ • Legal deadline and SLA calculations (15-day scrutiny, 30-day EVC)    │
│ • Role-Based Access Control (RBAC) & jurisdictional isolation          │
│ • 30-year land lease mathematical delta verification                   │
│ • Cryptographic SHA-256 audit hash chaining                            │
│ • Final regulatory decision recording (Grant / Reject Approval)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evaluates & Gates
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      EXPLAINABLE AI ASSISTANT LAYER                    │
│                                                                        │
│ • Unstructured document text & table extraction (PDF / DOCX)           │
│ • Candidate field extraction with explicit provenance & evidence       │
│ • Contextual summarization of institutional proposals                  │
│ • Cross-document discrepancy identification & discrepancy drafting     │
│ • Review questions generated for human scrutinizer oversight           │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Supported AI Providers & Models

Pravaha provides a unified, pluggable multi-provider abstraction supporting three major enterprise LLM providers, alongside a robust deterministic offline fallback.

| Provider | Environment Selector (`AI_PROVIDER`) | Default Model (`AI_MODEL`) | Required Environment Key |
| :--- | :--- | :--- | :--- |
| **OpenAI** | `openai` | `gpt-4o-mini` *(or `gpt-4o`)* | `OPENAI_API_KEY` |
| **Google Gemini** | `gemini` | `gemini-1.5-flash` *(or `gemini-1.5-pro`)* | `GEMINI_API_KEY` |
| **Anthropic** | `anthropic` | `claude-3-5-sonnet-20241022` | `ANTHROPIC_API_KEY` |
| **Deterministic Fallback** | `demo` *(or unset)* | `rule-engine-v1.4` | None *(Runs 100% offline)* |

---

## 3. Configuration & Environment Variables

Provider selection is managed through standard environment variables in `backend/.env`:

```env
# ==========================================
# PRAVAHA AI PROVIDER CONFIGURATION
# ==========================================

# Choose one: "openai", "gemini", "anthropic", or "demo"
AI_PROVIDER=demo

# Optional: override default model
AI_MODEL=

# Provider Credentials (populate the one corresponding to AI_PROVIDER)
OPENAI_API_KEY=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Maximum text context analyzed by LLM (characters)
AI_MAX_CONTEXT_CHARS=15000
```

> **Security Rule:** Never commit API keys to version control. Keys must be provisioned via deployment secrets or local `.env` files. The backend log sanitizer strictly strips secrets and bearer tokens from application logs.

---

## 4. Real Invocation Pipeline

When an institution applicant or scrutinizing officer uploads a document, the document traverses the following pipeline in `backend/app/ai_service.py`:

```
Uploaded Document (.pdf / .docx)
               │
               ▼
1. Text Ingestion & Extraction (pypdf / python-docx)
               │
               ▼
2. Sanitization & Prompt Injection Shield
   - Enforce 15,000 character length bounding
   - Strip prompt manipulation markers (e.g., "Ignore previous instructions")
   - Encapsulate document text in strictly isolated XML tags `<document_source>`
               │
               ▼
3. Provider Resolution & Key Verification
   ├─► Valid key present: Invoke live provider SDK with JSON schema enforcement
   └─► Key missing or network error: Gracefully invoke Deterministic Rule Engine
               │
               ▼
4. Output Normalization & Provenance Tagging
   - Map extracted fields to explicit provenance states
   - Pair candidate fields with exact verbatim source quotes
               │
               ▼
5. Officer Scrutiny Dossier Delivery (UI displays exact execution mode)
```

---

## 5. Honest AI Labeling & Execution Modes

Pravaha guarantees complete transparency regarding model execution. The frontend displays distinct badges based on backend response metadata:

1. **`mode: "real_llm"`**  
   Returned only when a live cloud LLM (OpenAI, Gemini, Anthropic) successfully processes the document text. The exact `provider` and `model` are transmitted in the response payload.
2. **`mode: "demo_mode"` / `execution_mode: "deterministic"`**  
   Returned when no API keys are provisioned. The system honestly discloses that deterministic rule parsing was utilized.
3. **`mode: "demo_mode"` / `execution_mode: "deterministic_fallback"`**  
   Returned if an active cloud provider fails (e.g. rate limit, invalid key, network timeout). Contains `mode_fallback_reason` explaining why fallback was activated without disrupting the officer's workflow.

---

## 6. Response Schema (`AiAnalysisResult`)

```json
{
  "mode": "real_llm",
  "execution_mode": "real_llm",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "document_name": "Land_Lease_Deed_Kancheepuram.pdf",
  "document_type": "LEASE_DEED",
  "summary": "33-year registered land lease deed for Survey Nos. 42/1A & 42/1B, executed in favour of Sri Sairam Educational Trust.",
  "extracted_fields": {
    "institution_name": "Sri Sairam Institute of Advanced Technology",
    "survey_number": "42/1A, 42/1B",
    "district": "Kancheepuram",
    "lease_period_years": "33",
    "lease_commencement": "2024-04-01",
    "lease_expiry": "2057-03-31"
  },
  "candidate_fields": [
    {
      "field_key": "survey_number",
      "field_label": "Land Survey / Khasra Number",
      "extracted_value": "42/1A, 42/1B",
      "provenance": "EXTRACTED_FROM_DOCUMENT",
      "source_document": "Land_Lease_Deed_Kancheepuram.pdf",
      "evidence_quote": "Survey Nos. 42/1A and 42/1B situated at Kancheepuram Taluk",
      "confidence_label": "HIGH",
      "confidence": 0.95,
      "target_form_field": "survey_numbers"
    },
    {
      "field_key": "lease_tenure",
      "field_label": "Lease Tenure (Years)",
      "extracted_value": "33",
      "provenance": "DETERMINISTIC_PARSED",
      "source_document": "Land_Lease_Deed_Kancheepuram.pdf",
      "evidence_quote": "for a continuous period of 33 (thirty-three) years commencing from",
      "confidence_label": "HIGH",
      "confidence": 0.98,
      "target_form_field": "lease_tenure"
    }
  ],
  "missing_information": [],
  "potential_inconsistencies": [],
  "verification_questions": [
    "Verify whether the lessor possesses unencumbered title on Survey No 42/1A."
  ],
  "confidence_score": 0.94,
  "disclaimer": "AI-assisted scrutiny findings are advisory. Statutory determination rests with the Scrutiny Committee under AICTE APH Regulations."
}
```

---

## 7. Security, Prompt Injection & Privacy Controls

1. **Prompt Injection Mitigation:**  
   User-uploaded documents are treated strictly as untrusted data inputs. Text is parsed into a sandboxed data segment delimited by `<document_content>` tags, accompanied by a system directive enforcing that instructions embedded inside the document must be disregarded.
2. **Context Bounding:**  
   Document text is truncated to 15,000 characters to prevent denial-of-wallet / context-overflow attacks.
3. **Data Privacy & Redaction:**  
   Application logs do not persist document bodies or raw LLM completions. Only cryptographic metadata, token usage stats, and deterministic finding IDs are persisted.

---

## 8. Verification Procedure: How to Test Live vs Fallback

### Test A: Verified Fallback Execution (Default)
1. Run backend without setting provider keys (`AI_PROVIDER=demo`).
2. Navigate to Scrutiny Workbench or upload a document in an application dossier.
3. Observe document analysis: metadata reports `mode: "demo_mode"`, `execution_mode: "deterministic"`. All regulatory findings and candidate field extractions work 100% reliably.

### Test B: Live OpenAI Invocation
1. Export environment variable in `backend/.env`:
   ```bash
   AI_PROVIDER=openai
   OPENAI_API_KEY=sk-proj-...
   AI_MODEL=gpt-4o-mini
   ```
2. Restart FastAPI server (`uvicorn app.main:app`).
3. Upload a sample lease or building certificate.
4. Verify response contains `mode: "real_llm"`, `provider: "openai"`, `model: "gpt-4o-mini"`.
