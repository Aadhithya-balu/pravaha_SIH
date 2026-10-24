# PS4 — AICTE Approval Workflow Automation & Compliance Monitoring Platform

**Smart India Hackathon (SIH) Prototype**  
**Problem Statement 4 (PS4):** Regulatory workflow automation, document scrutiny, EVC inspection tracking, and automated compliance monitoring for the All India Council for Technical Education (AICTE).

---

## 1. Executive Summary & Capabilities

This platform transforms manual, fragmented AICTE regulatory scrutiny into an auditable, transparent digital workflow. Key capabilities include:

- **Configurable Regulatory Workflow Engine**: Enforces stage transitions across 10 lifecycle stages (`SUBMITTED`, `SCRUTINY`, `RE_SCRUTINY`, `EVC_PENDING`, `EVC_SCHEDULED`, `EVC_COMPLETED`, `SAC_SHC_REVIEW`, `COMPLIANCE_PENDING`, `COMPLETED`, `RETURNED_FOR_CLARIFICATION`).
- **Server-Enforced Role-Based Access Control (RBAC)**: Strict server-side permission validation and tenant data isolation for institutions, regional officers, bureau officers, EVC experts, and administrators.
- **Mandatory Justification for Returns**: Scrutinizing officers cannot arbitrarily return cases; clear, auditable deficiency remarks are mandatory, allowing applicants to resubmit with rectifications.
- **AI-Assisted Document Scrutiny**: LLM-powered document review module (supporting OpenAI/Gemini/Anthropic with an advanced deterministic fallback mode). Extracts metadata, flags regulatory discrepancies (e.g. lease < 30 years), generates human verification checklists, and embeds regulatory disclaimers.
- **EVC Inspection Scheduling**: Committee constitution, visit mode selection (Physical/Virtual/Hybrid), calendar tracking, and inspection report submission.
- **Unified Compliance & Lease Expiry Tracker**: Live monitoring of time-bound undertakings, land lease validity, and safety clearances with applicant evidence submission and officer verification.
- **Automated Deadline & Escalation Engine**: Real-time evaluation of approaching deadlines and overdue scrutinies, triggering role-targeted alerts, with a manual trigger for SIH live evaluation.
- **Reports & Safe CSV Export**: Executive throughput analytics and RFC-4180 CSV export with formula injection sanitization.

---

## 2. Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript + Vite
- **Icons**: Lucide React
- **Design System**: Responsive Government-Technology UI (Ashoka Blue, Saffron, Emerald, accessible contrast, clean typography with DM Sans & Manrope)
- **State Management**: Reactive React Hooks with modular tab routing

### Backend
- **Framework**: Python 3.11+ / FastAPI
- **Database ORM**: SQLAlchemy 2.0 (SQLite by default; PostgreSQL supported via `DATABASE_URL`)
- **Validation**: Pydantic v2
- **Authentication**: JWT (`python-jose`) with PBKDF2 HMAC-SHA256 password hashing (310,000 iterations)
- **AI Provider**: Provider abstraction (`ai_service.py`) supporting real LLM APIs and deterministic fallback
- **Testing**: Pytest + FastAPI TestClient + HTTPX

---

## 3. Quick Start

### Option A: Single Command Full-Stack Launch (Recommended)
You can launch both the FastAPI backend and Vite frontend concurrently with a single command:

```bash
# From the project root or inside frontend:
npm run dev:all
```
- Frontend UI: `http://localhost:5173`
- Backend API Docs: `http://127.0.0.1:8000/docs`

---

### Option B: Separate Terminals

#### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt pytest httpx python-multipart

# Copy environment template
cp .env.example .env

# Run backend development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
- Interactive Swagger API Documentation: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

#### 2. Frontend Setup (New Terminal)
```bash
cd frontend

# Install npm packages (if first time)
npm install

# Start Vite dev server
npm run dev
```
- Open application in browser: `http://localhost:5173`

---

## 4. Demo Accounts & Evaluation Credentials

All demo accounts share the prototype password: `DemoPass123!`  
*(The top bar also includes a **1-click Role Switcher** for instant testing during evaluation).*

| Role | Email | Name & Designation | Authority & Scope |
|---|---|---|---|
| **Regional Officer** | `officer@demo.local` | Dr. Rajesh Verma (RO-North) | Scrutiny transitions, return cases, schedule EVC, verify compliance |
| **Applicant Institution** | `college@demo.local` | Prof. Anand Deshmukh (Principal, ABC Engg) | Strict data isolation (own cases only), upload docs, resubmit returned cases |
| **Bureau Officer (HQ)** | `bureau@demo.local` | Dr. Sunita Rao (Advisor, Approval Bureau) | SAC / SHC hearings, final approval issuance, national throughput reports |
| **EVC Expert** | `evc@demo.local` | Prof. S. Ramanujan (Committee Chairperson) | Conduct inspection visits, file laboratory & infrastructure findings |
| **Administrator** | `admin@demo.local` | AICTE IT Administrator | Master data management, user roles, system escalation trigger |

---

## 5. Automated Test Suite

Run the automated pytest test suite to verify all critical security, workflow, and data isolation flows:

```bash
cd backend
.venv\Scripts\python -m pytest -v tests/test_ps4.py
```

### Tested Scenarios (16/16 Passed):
- `test_login_success`: Validates JWT token issuance and user profile.
- `test_login_failure_wrong_password`: Rejects invalid credentials.
- `test_login_failure_nonexistent_user`: Rejects non-existent accounts.
- `test_institution_cannot_verify_compliance`: Enforces 403 Forbidden when an institution attempts to verify compliance items.
- `test_officer_can_verify_compliance`: Allows authorized officer to mark compliance items verified.
- `test_institution_data_isolation`: Confirms institution user only receives their own college records.
- `test_institution_cannot_view_other_institution_details`: Rejects cross-tenant inspection attempts (403).
- `test_create_application_by_institution`: Generates reference (`AICTE-2026-XXXX`) and routes to Scrutiny.
- `test_valid_workflow_transition_by_officer`: Advances case from `SCRUTINY` to `EVC_PENDING`.
- `test_invalid_workflow_transition_rejected`: Rejects unauthorized transition routes (400).
- `test_return_without_reason_rejected`: Rejects return action if mandatory reason is missing (400).
- `test_return_with_valid_reason_succeeds`: Transitions case to `RETURNED_FOR_CLARIFICATION`.
- `test_audit_event_recorded`: Verifies immutable audit trail creation.
- `test_escalation_engine_run`: Evaluates deadline scanner, triggering alerts and updating overdue statuses.
- `test_ai_document_check`: Confirms AI structured extraction, identifying short lease tenures (< 30 years).
- `test_csv_export`: Validates RFC CSV generation and spreadsheet formula injection sanitization.

---

## 6. Regulatory Workflow Engine & Transition Rules

The application implements an illustrative regulatory state machine complying with AICTE Approval Process Handbook (APH) norms:

```
[SUBMITTED]
     │ (START_SCRUTINY)
     ▼
[SCRUTINY] ──(RETURN: reason required)──► [RETURNED_FOR_CLARIFICATION]
     │                                            │
     ├─(SEND_EVC)──► [EVC_PENDING]                │ (RESUBMIT: with explanation)
     │                     │ (SCHEDULE_EVC)       ▼
     │                     ▼                 [SCRUTINY]
     │              [EVC_SCHEDULED]
     │                     │ (COMPLETE_EVC)
     │                     ▼
     │              [EVC_COMPLETED]
     │                     │ (FORWARD_SAC)
     │                     ▼
     ├─────────────► [SAC_SHC_REVIEW]
     │                     │ (SAC_APPROVE)
     │                     ▼
     └─────────────► [COMPLIANCE_PENDING]
                           │ (COMPLIANCE_CLEAR)
                           ▼
                      [COMPLETED]
```

---

## 7. AI Document Assistance & Security Safeguards

- **Configuration**:
  - Set `AI_PROVIDER=openai` (or `gemini`), `AI_API_KEY=your_key`, and `AI_MODEL=gpt-4o-mini` in `.env` to enable live LLM analysis.
  - If no API key is configured, the system operates in **`DEMO MODE (Deterministic Fallback)`**, performing automated rule-based regex and legal clause evaluation.
- **Prompt Injection Defense**:
  - Uploaded document text is sanitized with control character removal and directive stripping (`[REDACTED_PROMPT_DIRECTIVE]`).
  - System prompts instruct the LLM to treat document text as untrusted data and ignore embedded instructions.
- **Statutory Guardrail**:
  - The UI and API explicitly display: *"AI output is assistance only; authorised officials retain all statutory decisions under the applicable APH."* AI cannot approve or reject applications automatically.

---

## 8. REST API Endpoints Reference

| Method | Endpoint | Description | Permitted Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Fetch active profile and permissions | Authenticated |
| `GET` | `/api/dashboard` | Aggregated KPIs and stage distribution | Authenticated (scoped) |
| `GET` | `/api/applications` | List applications (with search & filters) | Authenticated (scoped) |
| `POST` | `/api/applications` | Create new application | Institution, Officer, Admin |
| `GET` | `/api/applications/{id}` | Application details, stepper, and audit history | Authenticated (scoped) |
| `POST` | `/api/applications/{id}/transition` | Execute stage transition with reason | Officer, Bureau, Admin, Inst |
| `GET` | `/api/applications/{id}/audit` | Immutable audit log | Authenticated (scoped) |
| `POST` | `/api/documents/check-text` | AI regulatory compliance check | Authenticated |
| `POST` | `/api/documents/upload` | Multipart document upload & AI review | Authenticated |
| `POST` | `/api/documents/{id}/review` | Scrutiny officer disposition (Accept/Correction) | Officer, Admin |
| `GET` | `/api/compliance` | List undertakings and lease validity items | Authenticated (scoped) |
| `POST` | `/api/compliance/{id}/submit-evidence` | Institution submits documentary evidence | Institution, Admin |
| `POST` | `/api/compliance/{id}/verify` | Officer verifies or rejects evidence | Officer, Admin |
| `GET` | `/api/evc` | List EVC inspection queue and reports | Authenticated (scoped) |
| `POST` | `/api/evc` | Schedule EVC inspection visit | Officer, EVC Expert, Admin |
| `POST` | `/api/evc/{id}/update` | Record EVC findings and recommendations | EVC Expert, Officer, Admin |
| `GET` | `/api/alerts` | List role-targeted regulatory alerts | Authenticated (scoped) |
| `POST` | `/api/alerts/{id}/read` | Mark notification as read | Authenticated |
| `POST` | `/api/escalation/run-check` | Manual trigger for deadline evaluation engine | Officer, Bureau, Admin |
| `GET` | `/api/reports/export-csv` | Download RFC-4180 sanitized CSV reports | Officer, Bureau, Admin |

---

## 9. Known Limitations & Next Steps

1. **Storage Backend**: Document uploads in this prototype are stored with metadata in SQLite/PostgreSQL. In production, connect an S3-compatible object store (e.g., AWS S3, MinIO) with virus scanning and client-side encryption.
2. **OCR Integration**: OCR is currently performed via text extraction. Integrating Tesseract OCR or Google Document AI will enable processing scanned non-searchable stamp papers.
3. **Email / SMS Gateway**: Alerts are currently delivered via the in-app notification center. Connecting an SMS/Email gateway (NIC SMS gateway or SendGrid) will enable external multichannel dispatch.
4. **Digital Signatures (DSC / e-Sign)**: Future integration with Aadhaar e-Sign or DSC tokens for statutory Approval Orders.
