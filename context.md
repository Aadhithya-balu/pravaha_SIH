# Pravaha — AICTE Regulatory Approval Workflow & Scrutiny Engine
## Complete Project Context & Architecture Documentation (for LLM / ChatGPT Context Window)

> **Smart India Hackathon (SIH) Prototype — Problem Statement 4 (PS4)**  
> **Repository:** `PS4_AICTE_FullStack_Scaffold` (Pravaha)  
> **Target Regulatory Body:** All India Council for Technical Education (AICTE), Ministry of Education, Govt. of India.  
> **Core Mission:** Eliminate delays, subjectivity, and lack of transparency in technical education regulatory approvals by digitizing the lifecycle: scrutiny automation, AI-assisted document verification, EVC inspection tracking, compliance monitoring, and automated escalation.

---

## 1. Executive Summary & Core Objectives

AICTE processes tens of thousands of institutional applications annually across technical universities and colleges in India. Historically, this involves cumbersome physical documents, manual verification of land/fire/infrastructure norms, unrecorded committee inspections, and delayed deficiency resolutions.

**Pravaha** solves this through a unified digital platform featuring:
1. **Configurable Regulatory Workflow Engine**: Deterministic, 10-stage regulatory state machine enforcing strict transition rules and preventing unauthorized status modifications.
2. **Mandatory Deficiency & Return Justification**: Officers cannot arbitrarily reject or delay applications; every return requires recorded deficiency remarks and allows tracked rectifications.
3. **AI-Assisted Document Scrutiny**: LLM-powered review (OpenAI / Gemini / Anthropic) paired with a deterministic domain-specific rule engine. It extracts metadata (land tenure, survey numbers, fire NOC validity, faculty ratios), flags non-compliance, and embeds mandatory legal disclaimers.
4. **Expert Visiting Committee (EVC) Tracking**: Digital constitution of inspection panels, scheduling across Physical/Virtual/Hybrid modes, and auditable on-site inspection reporting.
5. **Continuous Compliance & Lease Tracker**: Real-time monitoring of time-bound undertakings, building safety certificates, and land lease expiry (< 30 years vs >= 30 years).
6. **Automated SLA & Escalation Engine**: Real-time deadline monitoring generating tiered alerts (Warning, High, Critical) to regional officers and bureau heads when scrutinies or compliances breach SLAs.
7. **Strict Server-Side RBAC & Data Isolation**: Institutional applicants can only view and mutate their own institution's dossiers, while regional officers and bureau heads have scoped jurisdiction.

---

## 2. Technology Stack

### Backend
- **Framework:** FastAPI 0.115+ (Python 3.11 / 3.14)
- **ASGI Server:** Uvicorn with standard workers
- **Database & ORM:** SQLAlchemy 2.0 (SQLite for local dev/testing; PostgreSQL ready via `DATABASE_URL`)
- **Data Validation & Settings:** Pydantic v2 & `pydantic-settings`
- **Authentication:** JWT tokens via `python-jose` (HS256)
- **Password Security:** PBKDF2 HMAC-SHA256 with 310,000 iterations and unique cryptographic salt
- **Document Ingestion:** `pypdf>=6.0`, `python-docx>=1.0`, `lxml`
- **AI Integrations:** Flexible provider abstraction (`ai_service.py`) supporting OpenAI, Google Gemini, Anthropic, or an offline deterministic fallback engine
- **Testing:** Pytest, HTTPX, FastAPI `TestClient`

### Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Custom Vanilla CSS Design System (GovTech Indian Tricolor palette: Ashoka Blue `#003366`, India Saffron `#FF9933`, Emerald Green `#138808`, Slate neutrals)
- **Typography:** DM Sans, Manrope, Inter
- **Icons:** Lucide React
- **HTTP Client:** Fetch wrapper with bearer token injection and RFC-7807 error parsing
- **Data Export:** RFC-4180 compliant CSV export with formula injection sanitization (`=`, `+`, `-`, `@`)

---

## 3. Directory & File Structure

```
PS4_AICTE_FullStack_Scaffold/
├── package.json               # Root package script running both servers via dev-all
├── README.md                  # Comprehensive user & developer manual
├── context.md                 # Full context file for ChatGPT / LLMs (this file)
├── scripts/
│   └── dev-all.js             # Concurrently orchestrates backend (venv uvicorn) + frontend (vite)
├── backend/
│   ├── requirements.txt       # Python dependencies (fastapi, uvicorn, sqlalchemy, pypdf, docx, etc.)
│   ├── pytest.ini             # Pytest configuration
│   ├── .env.example           # Environment variable template
│   ├── ps4.db                 # SQLite database instance
│   ├── uploads/               # Stored uploaded files (PDFs, DOCX, images)
│   ├── tests/
│   │   ├── test_ps4.py        # Core API, auth, and scrutiny unit tests
│   │   ├── test_v1_institution.py # Institution lifecycle & document upload tests
│   │   └── test_workflow_v1.py # Transition validation and RBAC tests
│   └── app/
│       ├── __init__.py
│       ├── db.py              # Engine setup, session generator, schema migrations
│       ├── models.py          # SQLAlchemy ORM models (User, Application, Document, etc.)
│       ├── schemas.py         # Pydantic request/response schemas
│       ├── main.py            # FastAPI entry point, routes, middleware, RBAC dependencies
│       ├── workflow.py        # Workflow engine, stage transition rules, role validations
│       ├── scrutiny.py        # End-to-end scrutiny pipeline & APH rule engine
│       ├── doc_extractor.py   # PDF / DOCX / TXT text extraction and sanitization
│       ├── ai_service.py      # LLM provider wrapper & deterministic domain fallback
│       ├── escalation.py      # SLA evaluator, deadline checker, automated alert generator
│       └── seed.py            # Initial seed data for demo accounts, institutions, applications
└── frontend/
    ├── package.json           # Frontend dependencies (react, lucide-react, vite, etc.)
    ├── vite.config.ts         # Vite build configuration
    ├── index.html             # HTML entry point with Indian GovTech branding
    └── src/
        ├── main.tsx           # React DOM bootstrap
        ├── App.tsx            # Main shell, tab router, auth state, 1-click role switcher
        ├── api.ts             # API client, token management, typed helper functions
        ├── types.ts           # TypeScript interfaces matching backend models & schemas
        ├── styles.css         # Complete UI design system, themes, and micro-animations
        └── components/
            ├── Header.tsx                 # AICTE official portal header & role indicator
            ├── Sidebar.tsx                # Role-aware navigation sidebar
            ├── OverviewTab.tsx            # Executive KPI metrics, stage breakdowns, urgent alerts
            ├── ApplicationsTab.tsx        # Filterable application dossier table with action buttons
            ├── ApplicationDetailModal.tsx # Multi-tab detailed modal (Overview, Docs, AI, EVC, Audit)
            ├── DocumentReviewTab.tsx      # Document viewer with AI analysis & checklist verifier
            ├── EvcTab.tsx                 # Expert Visiting Committee scheduling & reports
            ├── ComplianceTab.tsx          # Undertakings, lease countdown, evidence submission
            ├── AlertsTab.tsx              # SLA breach notifications and escalation center
            ├── ReportsTab.tsx             # Analytical charts and safe CSV export
            └── RoleMatrixTab.tsx          # Interactive visual matrix of server-enforced RBAC
```

---

## 4. Role-Based Access Control (RBAC) Matrix

The system enforces 5 distinct roles:

| Role Name | Scope / Persona | Key Permissions |
|---|---|---|
| `institution` | College / University Principal | Create application, upload documents, view own dossier, submit deficiency rectifications, submit compliance evidence |
| `officer` | AICTE Regional Officer | Review applications in region, run AI scrutiny, request clarification/deficiency, approve/reject EoA, refer to EVC, schedule EVC |
| `bureau` | AICTE HQ Bureau Head | National oversight, approve new programmes/levels, override stage transitions, review disputed cases, system-wide analytics |
| `evc_expert` | Inspection Committee Expert | View assigned inspections, input physical/virtual verification notes, submit EVC final recommendation report |
| `admin` | AICTE Systems Administrator | Full system administration, trigger escalation sweeps, manage user accounts, inspect audit trails |

---

## 5. Regulatory Workflow State Machine

The workflow is governed by `backend/app/workflow.py` and models the AICTE Approval Process Handbook (APH 2024-2027).

### Workflow Stages (10 Stages)
1. `DRAFT`: Applicant preparing application and uploading required certificates.
2. `SUBMITTED`: Formally submitted by college; awaiting regional scrutiny.
3. `SCRUTINY`: Primary document inspection by regional scrutiny committee.
4. `RE_SCRUTINY`: Secondary review in case of disputed credentials or escalated clarification.
5. `EVC_PENDING`: Referred for Expert Visiting Committee inspection.
6. `EVC_SCHEDULED`: Committee formed; inspection date and mode set.
7. `EVC_COMPLETED`: Inspection concluded; expert report submitted.
8. `SAC_SHC_REVIEW`: Standing Appellate Committee (SAC) / Standing Hearing Committee (SHC) review.
9. `COMPLIANCE_PENDING`: Scrutiny/EVC passed; pending submission/verification of undertakings.
10. `COMPLETED`: Final approval granted or formal rejection recorded.
11. `RETURNED_FOR_CLARIFICATION`: Application sent back to applicant with specific deficiency remarks.

### Application Statuses (6 Statuses)
- `DRAFT`
- `IN_PROGRESS`
- `RETURNED`
- `OVERDUE`
- `COMPLETED`
- `REJECTED`

### Approval Routes: EoA vs New Programme
- **Extension of Approval (EoA):** Fast-track route for existing accredited institutions. EVC inspection is waived unless flagged by random audit or whistleblower complaints. Scrutiny focuses on Fire NOC, faculty cadre ratio, and annual self-disclosure.
- **New Programme / Level / New Institution:** High-scrutiny route. Requires mandatory 30+ year registered land lease, building stability certificate, state govt NOC, university affiliation NOC, and mandatory EVC physical inspection.

---

## 6. Database Models & Schema Specifications

Defined in [models.py](file:///c:/PS4_AICTE_FullStack_Scaffold/backend/app/models.py):

### 1. `User` (`users`)
- `id` (Integer, PK)
- `email` (String, unique, indexed)
- `name` (String)
- `password_hash` (String, PBKDF2)
- `role` (String: `institution`, `officer`, `bureau`, `evc_expert`, `admin`)
- `institution_name` (String, nullable)
- `region` (String: Northern, Western, Southern, Eastern, South-Western, etc.)
- `designation` (String)
- `is_active` (Boolean)
- `created_at` (DateTime)

### 2. `Institution` (`institutions`)
- `id` (Integer, PK)
- `code` (String, unique, AICTE Permanent ID e.g. `1-1097234511`)
- `name` (String, unique)
- `region` (String)
- `state` (String)
- `address` (Text)
- `contact_email` (String)
- `contact_phone` (String)
- `institution_type` (String)
- `created_at` (DateTime)

### 3. `Application` (`applications`)
- `id` (Integer, PK)
- `reference` (String, unique e.g. `AICTE/2026/RO-NO/001`)
- `institution_name` (String, indexed)
- `application_type` (String: `Extension of Approval (EoA)`, `New Programme / Level`, etc.)
- `current_stage` (String, default `SCRUTINY`)
- `status` (String, default `IN_PROGRESS`)
- `assigned_to` (String)
- `assigned_role` (String)
- `region` (String)
- `submission_date` (Date)
- `due_date` (Date, nullable)
- `notes` (Text)
- `deficiency_count` (Integer, default 0)
- `academic_year` (String, default `2026-2027`)
- `form_data` (Text, JSON of dynamic form fields)
- `decision_outcome` (String, nullable: `APPROVED`, `REJECTED`)
- `decision_remarks` (Text, nullable)
- `decision_by` (String, nullable)
- `decision_date` (DateTime, nullable)
- `created_by` (ForeignKey to `users.id`)
- `created_at`, `updated_at` (DateTime)

### 4. `Document` (`documents`)
- `id` (Integer, PK)
- `application_id` (ForeignKey to `applications.id`, nullable)
- `institution_name` (String)
- `document_name` (String)
- `document_type` (String: `LEASE_DEED`, `FIRE_SAFETY_NOC`, `BUILDING_PLAN`, `FACULTY_LIST`, etc.)
- `file_path` (String, nullable)
- `file_size` (Integer)
- `mime_type` (String)
- `uploaded_by` (String)
- `extracted_text` (Text, extracted via `pypdf` or `docx`)
- `ai_summary` (Text, nullable)
- `ai_findings` (Text, nullable JSON)
- `ai_confidence` (Float, nullable)
- `review_status` (String: `PENDING`, `ACCEPTED`, `CORRECTION_REQUIRED`)
- `reviewer_notes` (Text, nullable)
- `reviewed_by` (String, nullable)
- `reviewed_at` (DateTime, nullable)
- `created_at` (DateTime)

### 5. `ScrutinyRun` (`scrutiny_runs`) & `ScrutinyFinding` (`scrutiny_findings`)
- Captures automated scrutiny evaluation results.
- `rule_id` (e.g., `APH-2024-LAND-TENURE`, `APH-2024-FIRE-SAFETY`)
- `severity` (`INFO`, `WARNING`, `DEFICIENCY`)
- `category` (`MISSING_DOCUMENT`, `REGULATORY_NON_COMPLIANCE`, `INCONSISTENCY`)
- `description` & `evidence_quote`
- `suggested_action` & `officer_disposition` (`PENDING`, `ACCEPTED`, `WAIVED`, `CORRECTION_REQUESTED`)

### 6. `AuditEvent` (`audit_events`)
- Tamper-evident logging of every state change, document upload, decision, and officer action.
- Stores `application_id`, `actor`, `actor_role`, `action`, `from_stage`, `to_stage`, `details`, `created_at`.

### 7. `EVCVisit` (`evc_visits`)
- Expert Visiting Committee records.
- Fields: `committee_members` (JSON or delimited string), `scheduled_date`, `visit_mode` (`PHYSICAL`, `VIRTUAL`, `HYBRID`), `status` (`SCHEDULED`, `COMPLETED`, `POSTPONED`), `report_summary`, `recommendations`.

### 8. `ComplianceItem` (`compliance_items`)
- Tracks ongoing or post-approval conditions (e.g. 90-day structural safety certificate submission, land conversion certificate).
- Fields: `item_type`, `description`, `due_date`, `status` (`PENDING`, `SUBMITTED`, `VERIFIED`, `REJECTED`, `OVERDUE`), `submission_evidence`, `verified_by`.

### 9. `Alert` (`alerts`)
- System & SLA alerts.
- Fields: `title`, `message`, `severity` (`INFO`, `WARNING`, `HIGH`, `CRITICAL`), `target_role`, `is_read`, `trigger_type` (`DEADLINE_OVERDUE`, `DEADLINE_APPROACHING`, `LEASE_EXPIRING`, `EVC_APPROACHING`).

---

## 7. AI Scrutiny & Ingestion Pipeline

### Text Extraction (`backend/app/doc_extractor.py`)
- Safe filename sanitization preventing directory traversal (`re.sub(r"[^a-zA-Z0-9_\.-]", "_", base)`).
- File size boundary checks (enforces $\le 10\text{ MB}$).
- Format support:
  - **PDF:** `pypdf.PdfReader` with page-by-page text extraction, page counting, and fallback for scanned non-OCR PDFs.
  - **DOCX / DOC:** `docx.Document` reading paragraphs and tabular data.
  - **TXT:** Multi-encoding fallback (`utf-8`, `latin-1`, `cp1252`).
  - **Images:** Registered as requiring visual scrutiny.
- Safe import guards preventing crashes if optional binary dependencies are missing.

### AI Engine & Deterministic Rule Engine (`backend/app/ai_service.py`)
- **LLM Provider Wrapper:** Connects to OpenAI (`gpt-4o-mini`), Google Gemini (`gemini-1.5-flash`), or Anthropic.
- **Prompt Injection Defense:** Filters system-override strings (`ignore previous instructions`, `system:`) and truncates payloads to 15,000 characters.
- **Deterministic Regulatory Analyzer (Offline Fallback):**
  - **Land Lease Verification:** Checks for minimum 30-year lease period requirement. Flags leases with $<30$ years or expiring within 1 year.
  - **Survey / Khasra Extraction:** Extracts plot and land survey numbers.
  - **Fire & Life Safety NOC:** Evaluates expiry dates and issuing municipal authority.
  - **Building Stability:** Checks structural engineer license numbers and seismic safety endorsements.
  - **Disclaimers:** Every AI output attaches statutory legal notices ensuring human officer oversight.

### Scrutiny Pipeline Execution (`backend/app/scrutiny.py`)
- Inspects mandatory document lists based on application route (EoA vs New Programme).
- Compares attached documents against APH requirements.
- Generates `ScrutinyRun` and `ScrutinyFinding` records in database.
- Calculates overall deficiency count.

---

## 8. SLA & Escalation Engine (`backend/app/escalation.py`)

A background evaluator that checks deadlines and generates actionable alerts:
1. **Application Deadlines:**
   - Breached ($< 0$ days): Sets status to `OVERDUE`, creates `HIGH` severity alert to regional officer.
   - Approaching ($0 - 7$ days): Creates `WARNING` alert.
2. **Compliance Items:**
   - Overdue items: Marked `OVERDUE`, creates alerts for officer and applicant.
   - Approaching items ($0 - 14$ days): Proactive reminder to applicant.
3. **EVC Inspections:**
   - Inspections scheduled within $3$ days trigger alerts to experts and regional coordinators.
4. **Lease Validity:**
   - Registered land leases expiring within $90$ days generate critical compliance warnings.

---

## 9. REST API Endpoints Overview

| Method | Endpoint | Description | Role Access |
|---|---|---|---|
| `GET` | `/api/health` | System health check & active routes | Public |
| `POST` | `/api/auth/login` | JWT login with email & password | Public |
| `GET` | `/api/auth/me` | Fetch logged-in user profile & role | Authenticated |
| `GET` | `/api/applications` | List applications (with filtering by stage, status, region) | Authenticated (scoped by role) |
| `POST` | `/api/applications` | Create new application dossier | `institution`, `admin` |
| `GET` | `/api/applications/{id}` | Detailed application with documents, audit trail, transitions | Authenticated |
| `PATCH` | `/api/applications/{id}` | Update draft application details | `institution`, `admin` |
| `POST` | `/api/applications/{id}/transition` | Execute stage transition (e.g. approve, return, refer to EVC) | Role-restricted per workflow rule |
| `POST` | `/api/applications/{id}/deficiency` | Record deficiency remarks / return application | `officer`, `bureau`, `admin` |
| `POST` | `/api/documents/upload` | Upload & extract document (PDF/DOCX) | `institution`, `officer`, `admin` |
| `GET` | `/api/documents/{id}/review` | Run AI / deterministic document scrutiny | `officer`, `bureau`, `admin` |
| `POST` | `/api/scrutiny/run/{id}` | Run full scrutiny pipeline for an application | `officer`, `bureau`, `admin` |
| `GET` | `/api/evc/visits` | List all EVC visits | `officer`, `bureau`, `evc_expert`, `admin` |
| `POST` | `/api/evc/visits` | Schedule new EVC inspection | `officer`, `admin` |
| `POST` | `/api/evc/visits/{id}/report` | Submit EVC inspection report & recommendation | `evc_expert`, `officer`, `admin` |
| `GET` | `/api/compliance/items` | List compliance & undertaking items | Authenticated |
| `POST` | `/api/compliance/items/{id}/submit` | Submit evidence for compliance requirement | `institution`, `admin` |
| `POST` | `/api/compliance/items/{id}/verify` | Verify or reject submitted evidence | `officer`, `bureau`, `admin` |
| `GET` | `/api/alerts` | Get targeted alerts for current user role | Authenticated |
| `POST` | `/api/alerts/{id}/read` | Mark alert as read | Authenticated |
| `POST` | `/api/escalation/run` | Manually trigger deadline & escalation check | Authenticated |
| `GET` | `/api/reports/dashboard` | High-level metrics, stage distribution, SLA rates | Authenticated |
| `GET` | `/api/reports/export/csv` | Safe CSV export with formula injection sanitization | Authenticated |

---

## 10. Frontend Architecture & Design System

### Layout & Navigation
- **`Header.tsx`**: Government of India / AICTE portal header with live user profile, region badge, and a **1-click Role Switcher** dropdown for evaluation.
- **`Sidebar.tsx`**: Dynamic navigation displaying badge counters for active applications, pending EVC visits, compliance items, and urgent alerts.

### Tabs & Views
- **`OverviewTab.tsx`**: High-level KPI summary cards (Total Applications, In Progress, Due Soon, Overdue, Returns), visual stage breakdown, and urgent alert feed.
- **`ApplicationsTab.tsx`**: Full data table with quick filters (Status, Stage, Application Type, Search), SLA urgency badges, and quick-action triggers.
- **`ApplicationDetailModal.tsx`**: Central dossier workspace with sub-tabs:
  1. *Details & Status:* Form data, academic year, assigned officer, timeline.
  2. *Documents & AI Review:* List of uploaded files, AI extraction status, upload dropzone.
  3. *Workflow Transitions:* Available actions button bar based on current user role and stage rules.
  4. *Deficiency & Clarifications:* View and submit deficiency rectifications.
  5. *Audit Trail:* Chronological, tamper-evident action history with actor timestamps.
- **`DocumentReviewTab.tsx`**: Standalone document evaluation tool. Displays AI-generated document summary, extracted metadata table, missing items checklist, potential discrepancies, and verification questions.
- **`EvcTab.tsx`**: Committee formation, visit mode badges (Physical, Virtual, Hybrid), inspection date scheduling, and expert report submission.
- **`ComplianceTab.tsx`**: Land lease expiry countdown tracker, fire safety clearances, applicant evidence upload, and officer sign-off.
- **`AlertsTab.tsx`**: Escalation hub categorized by severity (`CRITICAL`, `HIGH`, `WARNING`, `INFO`).
- **`ReportsTab.tsx`**: Regulatory throughput metrics and safe RFC-4180 CSV export.
- **`RoleMatrixTab.tsx`**: Interactive visual breakdown of all 5 roles across the 10 stages.

---

## 11. Pre-Configured Evaluation Accounts

All accounts share the default prototype password: **`DemoPass123!`**

| Role | Email | Name & Designation | Jurisdiction |
|---|---|---|---|
| **Regional Officer** | `officer@demo.local` | Dr. Rajesh Verma (Regional Officer) | Northern Region (Delhi, UP, Haryana) |
| **College Applicant** | `applicant@demo.local` | Prof. Anita Sharma (Principal) | Delhi Institute of Technology & Science |
| **Bureau Head** | `bureau@demo.local` | Dr. V. K. Saraswat (Bureau Head) | AICTE Headquarters (National) |
| **EVC Expert** | `evc_expert@demo.local` | Prof. K. S. Ramanathan (Senior Expert) | Expert Visiting Committee Panel |
| **Administrator** | `admin@demo.local` | Suresh Nair (System Administrator) | National AICTE Data Center |

---

## 12. Security & Compliance Safeguards

1. **Password Hashing:** Uses `hashlib.pbkdf2_hmac("sha256")` with 310,000 iterations and a 16-byte random salt per user.
2. **Stateless JWT Tokens:** Encrypted with HS256, containing user ID, role, region, and institution affiliation.
3. **Data Isolation (Multi-Tenancy):** Institution users can never query or view applications belonging to other institutions.
4. **Prompt Injection Defense:** Strict regex redactions for system overrides; input length capping to prevent denial-of-service on LLM APIs.
5. **CSV Formula Injection Mitigation:** All CSV exports sanitize cells starting with `=`, `+`, `-`, `@` by prepending a single quote `'` to prevent remote execution when opened in Microsoft Excel.
6. **Path Traversal Protection:** All document uploads sanitize filenames to strictly alphanumeric characters, underscores, and dashes, storing them with unique UUID prefixes.

---

## 13. How to Run Locally

### Full-Stack Single Command
```bash
# From repository root:
npm run dev:all
```
- **Frontend:** http://localhost:5173
- **Backend API:** http://127.0.0.1:8000
- **Swagger Docs:** http://127.0.0.1:8000/docs

### Backend Only
```bash
cd backend
# Activate virtual environment
.\.venv\Scripts\activate   # Windows
source .venv/bin/activate  # macOS / Linux

# Run server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Running Test Suite
```bash
cd backend
pytest -v
```

---

## 14. Prompts & Queries to Feed ChatGPT / LLM
When working on this project with ChatGPT, you can use prompts such as:
- *"Using the architecture and models in context.md, help me write a new test case for EVC inspection report submission."*
- *"Based on the workflow transition rules in context.md, explain how an institution resubmits a returned application."*
- *"Show me how to add a new document type (e.g. Structural Stability Certificate) to the mandatory document list and AI scrutiny rules."*
- *"Help me add a new frontend chart to ReportsTab.tsx that shows approval ratios by region."*
