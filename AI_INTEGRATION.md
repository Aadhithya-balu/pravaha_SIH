# PRAVAHA — AI Architecture & Groq Integration Specification
**High-Speed Regulatory Document Scrutiny & Explainable GovTech AI Layer**  
*Problem Statement Code: SIH26262 | Smart India Hackathon 2024 / 2026*  
*Module Location: `backend/app/ai_service.py`*

---

## 1. Architectural Philosophy: Explainable AI with Deterministic Governance

Pravaha integrates Large Language Models (LLMs) strictly as an **assistive document analysis and candidate extraction layer**, never as an autonomous statutory authority.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DETERMINISTIC REGULATORY ENGINE                      │
│                                                                        │
│ • Statutory workflow state machine transitions (Draft -> Completed)    │
│ • Legal deadline and SLA calculations (15-day scrutiny, 30-day EVC)    │
│ • Role-Based Access Control (RBAC) & tenant isolation                  │
│ • 30-year land lease mathematical delta verification                   │
│ • Cryptographic SHA-256 audit hash chaining                            │
│ • Final regulatory decisions (Statutory Approval Order Issuance)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Evaluates & Gates
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   GROQ CLOUD AI ASSISTANT LAYER                        │
│                                                                        │
│ • Document text extraction (PDF via pypdf / DOCX via python-docx)      │
│ • Candidate field extraction with explicit provenance & evidence       │
│ • Executive summary of institutional proposals                         │
│ • Cross-document discrepancy identification & deficiency drafting      │
│ • Targeted verification questions for human scrutinizing officer       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Groq AI Provider Configuration

Pravaha integrates official Groq Cloud API endpoints for ultra-low latency inference, enabling real-time document analysis during live jury scrutiny.

### Environment Variables (`backend/.env`)

| Variable | Description | Default Value | Required |
| :--- | :--- | :--- | :--- |
| `GROQ_API_KEY` | Official Groq Cloud API Key (format: `gsk_...`) | *None* | Yes (for live AI) |
| `GROQ_MODEL` | Fast reasoning or large context model | `llama-3.3-70b-versatile` | Optional |
| `AI_PROVIDER` | Provider selector (`groq`, `openai`, `gemini`, `none`) | `groq` | Optional |
| `AI_BASE_URL` | API endpoint URL | `https://api.groq.com/openai/v1/chat/completions` | Optional |

### Supported Groq Models
- `llama-3.3-70b-versatile` (Default — comprehensive multi-page legal reasoning)
- `llama-3.1-8b-instant` (Ultra-low latency — instant candidate prefill)
- `mixtral-8x7b-32768` (High context capacity)

> **Security Rule:** `GROQ_API_KEY` is exclusively read by the FastAPI backend (`backend/app/ai_service.py`). It is **never** bundled into Vite variables, frontend source code, browser requests, or client responses.

---

## 3. Upload-to-Extraction Processing Pipeline

1. **Upload & Validation:**
   - Institution or Officer uploads a PDF, DOCX, or TXT file via `/api/documents/upload` or `/api/v1/applications/{aid}/documents`.
   - Backend validates MIME type, file size (< 10 MB limit), and request authorization.
2. **Text & Table Extraction:**
   - `pypdf` extracts structured page text, page counts, and inspects for scanned/unreadable text layers.
   - `python-docx` extracts body paragraphs and table matrix rows.
   - If a PDF is a scanned image with non-extractable text, the engine explicitly reports:  
     `"[Notice: PDF has non-extractable text, vector drawings, or is a scanned image]"`.
3. **Prompt Injection Defense & Sanitization:**
   - Input text is sanitized (`sanitize_input`): control characters stripped, prompt injection phrases (`DAN mode`, `ignore instructions`) neutralized, text bounded to 25,000 characters.
   - Text is passed within `<UNTRUSTED_DOCUMENT_CONTENT>` boundary tags.
4. **Groq LPU Inference:**
   - Dispatches an asynchronous JSON-mode request to Groq Cloud endpoint.
   - Groq returns structured candidate fields, executive summary, and potential non-compliances.
5. **Schema Validation & Provenance Merging:**
   - Backend validates the response schema (`summary`, `extracted_fields`, `potential_inconsistencies`, `confidence_score`).
   - Merges Groq fields with deterministic regex candidate fields.
   - Stamps each candidate field with its provenance (`AI_EXTRACTED_GROQ` vs `DETERMINISTIC_PARSED`), source document, verbatim evidence quote, and confidence assessment.
6. **Persistence & UI Visualization:**
   - Persists extraction results in `Document.ai_summary`, `Document.ai_findings`, and `Document.ai_confidence`.
   - Returns structured payload to frontend `DocumentReviewTab` for 1-click form prefill.

---

## 4. Honest Fallback When Groq Is Unconfigured

If `GROQ_API_KEY` is absent or the cloud provider experiences an HTTP/rate-limit error:
- **No Faked AI:** The platform never fabricates LLM responses or claims live AI was used.
- **Truthful Status:** The response explicitly returns:
  ```json
  {
    "mode": "demo_mode",
    "provider": "deterministic_local",
    "model": "rule-engine-v1.2",
    "mode_fallback_reason": "Live Groq AI is unconfigured (set GROQ_API_KEY in backend/.env). Document evaluated via deterministic APH regulatory rules."
  }
  ```
- **Deterministic Rule Engine:** The local rules engine validates 30-year lease clauses, survey numbers, building areas, and fire safety expiry dates deterministically.
