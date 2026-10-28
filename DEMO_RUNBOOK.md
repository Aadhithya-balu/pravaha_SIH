# PRAVAHA — SIH26262 End-to-End Demonstration Runbook
**Official SIH26262 Jury Evaluation & Operations Manual**  
*Problem Statement Code: SIH26262 | Integrated AICTE Approval Workflow Automation & Compliance System*  
*Demonstration Mode: Active | Synthetic Institutional Data*

---

## 1. Quick Startup Commands

To start the complete full-stack platform (FastAPI backend on port 8000 and Vite frontend on port 5173):

```powershell
# In repository root
npm run dev:all
```

Alternatively, start services individually in separate terminals:

```powershell
# Terminal 1 — Backend (FastAPI on http://127.0.0.1:8000)
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 — Frontend (Vite on http://localhost:5173)
cd frontend
npm run dev
```

### Seeding Demo Data (Idempotent)
To re-seed or ensure all 8 application lifecycle cases and 3 demo personas are present:

```powershell
npm run seed
# or: python scripts/seed_demo.py
```

---

## 2. Certified Demo User Accounts

All demo accounts use the standard password: **`DemoPass123!`**  
Quick one-click evaluation buttons are provided on the login page.

| Role | Email Login | Password | Jurisdiction / Scope | Demonstration Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **🏢 1. Institution Applicant** | `college@demo.local` | `DemoPass123!` | ABC Engineering College (Strict Tenant Isolation) | Application drafting, document upload, clarification resubmission |
| **⚖️ 2. Regional Officer / Admin** | `officer@demo.local` | `DemoPass123!` | Combined Scrutiny, Compliance & Governance (RO-North) | Document scrutiny, deficiency return, EVC referral, administrative approval |
| **🔍 3. EVC Expert** | `evc@demo.local` | `DemoPass123!` | Assigned Inspection Panels (Senior Committee Inspector) | Campus lab inspections, site observations, formal recommendations |

*(Note: `admin@demo.local` and `bureau@demo.local` are also active and share the same operational capabilities as the combined Regional Officer / Admin persona).*

---

## 3. Step-by-Step SIH Evaluation Walk-Through

### Scenario 1: Applicant Workflow — Draft, Document Upload, & Submission
1. Open [http://localhost:5173](http://localhost:5173).
2. Click **"🏢 1. Institution Applicant"** to log in as Prof. Anand Deshmukh (`college@demo.local`).
3. Notice the **PRAVAHA \| SIH26262 DEMO MODE** notice.
4. Navigate to **Application Dossiers**:
   - Open case `AICTE-2026-1007` (Draft proposal for M.Tech Cyber Security).
   - In the detail modal, review the form fields and upload a lease deed or compliance document.
   - Click **"Formally Submit Application"**.
   - Notice the green toast confirmation: *"Application submitted successfully."*
   - The application transitions to `SCRUTINY` state.

---

### Scenario 2: Officer Scrutiny & Groq AI Document Scrutiny
1. Use the topbar **Demo Persona** switcher to switch to **"RO / Admin"** (`officer@demo.local`).
2. Navigate to **Document Scrutiny** (AI Assistant tab):
   - Select application `AICTE-2026-1001` or upload a sample PDF/DOCX file.
   - Click **Run Regulatory Scrutiny Pipeline**.
   - If `GROQ_API_KEY` is configured in `backend/.env`, notice real-time LPU analysis (`mode: "real_llm"`, `provider: "groq"`).
   - If `GROQ_API_KEY` is empty, notice honest, deterministic evaluation (`mode: "demo_mode"`, `provider: "deterministic_local"`).
   - Review the candidate fields with explicit source evidence (Lease Tenure, Survey No, CFO Fire NOC expiry).
   - Click **1-Click Form Prefill** to merge candidate fields into the application record.
3. Open **Application Register** and select `AICTE-2026-1005` (Returned for Clarification):
   - Review deficiency history and institutional clarification.
   - Perform next action: **SCRUTINY_PASS** or **SEND_EVC**.

---

### Scenario 3: EVC Committee Scheduling & Report Filing
1. In the **RO / Admin** console, navigate to **EVC Committee Queue**.
2. Click **Schedule Inspection** for application `AICTE-2026-1010`:
   - Set Inspection Date, select Committee Chairperson (*Prof. S. Ramanujan*), choose Physical mode.
   - Click **Confirm EVC Scheduling**.
   - Notice success toast: *"Inspection scheduled successfully."*
3. Switch persona to **"EVC Expert"** (`evc@demo.local`):
   - Open **EVC Committee Queue** to view assigned inspections (`AICTE-2026-1002`).
   - Click **Submit Inspection Report**:
     - Enter campus infrastructure observations (Server rooms, AI lab equipment).
     - Select recommendation: **RECOMMENDED FOR APPROVAL (60 SEATS)**.
     - Submit report.
   - Notice audit trail event and timeline update.

---

### Scenario 4: SLA Deadlines, Escalations, and Audits
1. Switch back to **RO / Admin** (`officer@demo.local`).
2. Click **Scan Deadlines** in the top header.
3. Notice automated SLA calculation: overdue cases (`AICTE-2026-1003`) generate high-priority statutory warning alerts.
4. Navigate to **Reports & Export**:
   - Inspect Stage Pipeline Ageing and Bottleneck Intelligence diagnostics.
   - Click **Export Regulatory Register (CSV)** to download sanitized RFC-4180 audit records.

---

## 4. Mobile Screen Verification
The responsive layout has been verified across key viewport widths:
- **320px** (Ultra-compact mobile): Single column, scaled typography, no horizontal overflow.
- **375px & 390px** (iPhone / Android standard): Collapsible hamburger drawer, stacked action buttons, responsive cards.
- **768px** (Tablet portrait): Off-canvas mobile drawer with backdrop, 2-column KPI cards.
- **1024px** (Tablet landscape): Clean side navigation, responsive table scroll wrapper.
