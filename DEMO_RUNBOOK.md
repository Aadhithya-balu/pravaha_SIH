# PRAVAHA — SIH26262 End-to-End Demonstration Runbook
**Official Evaluation & Evaluation Jury Demonstration Manual**  
*Problem Statement Code: SIH26262 | Integrated AICTE Approval Workflow Automation*  
*Target Environment: Local Development & Live Demonstration Testbed*

---

## 1. Startup & Environment Verification

### 1.1 Backend Startup
Open a PowerShell terminal in the repository root:
```powershell
# Navigate to backend directory
cd C:\PS4_AICTE_FullStack_Scaffold\backend

# Activate Python virtual environment
.\.venv\Scripts\Activate.ps1

# Run FastAPI backend service on port 8000
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Health Check:* Open `http://127.0.0.1:8000/api/health` in your browser.  
*Expected Output:* `{"status": "ok", "service": "Pravaha SIH26262 Regulatory Backend"}`

### 1.2 Frontend Startup
Open a second PowerShell terminal:
```powershell
# Navigate to frontend directory
cd C:\PS4_AICTE_FullStack_Scaffold\frontend

# Start Vite dev server on port 5173
npm run dev
```
*Application URL:* Open `http://localhost:5173/` in your browser.

---

## 2. Certified Demo User Accounts

All accounts are pre-seeded in the database with the common password: **`DemoPass123!`**

| Role | Email Login | Password | Jurisdiction / Region | Designation |
| :--- | :--- | :--- | :--- | :--- |
| **Institution Applicant** | `college@demo.local` | `DemoPass123!` | Southern (`Sri Sairam Institute`) | Principal / Registrar |
| **Regional Officer** | `officer@demo.local` | `DemoPass123!` | Southern | Regional Scrutiny Officer |
| **Bureau / Appellate** | `bureau@demo.local` | `DemoPass123!` | HQ (National) | Director (Approval Bureau) |
| **EVC Expert** | `evc@demo.local` | `DemoPass123!` | Southern | Senior Committee Inspector |
| **System Administrator** | `admin@demo.local` | `DemoPass123!` | All Jurisdictions | National System Administrator |

---

## 3. Demonstration Scenarios

---

### SCENARIO 1: End-to-End Scrutiny, Officer Return, Resubmission & Approval
**Objective:** Prove workflow state enforcement, candidate field prefill, return justification, applicant rectification, and final statutory order issuance.

#### Step 1: Login as Institution Applicant
1. Navigate to `http://localhost:5173/`.
2. Login with `college@demo.local` / `DemoPass123!`.
3. Notice top banner: Restrained GovTech palette with subtle Indian tricolor accent and prototype demonstration disclaimer.

#### Step 2: Ingest Document & Auto-Prefill Application
1. Click **Applications** in the navigation bar.
2. Click **+ New Application**.
3. In the creation modal, click the demo helper button **"Load Sample Land Deed & Ingest"**.
4. Observe candidate field extraction: Notice `EXTRACTED_FROM_DOCUMENT` and `DETERMINISTIC_PARSED` provenance tags.
5. Click **"Apply & Prefill Form"**: Notice Survey Number (`42/1A, 42/1B`) and Land Lease Tenure (`33 Years`) instantly prefill into the application fields!
6. Click **Create Application Draft**.

#### Step 3: View Dossier & Submit for Scrutiny
1. In the application list, click the newly created application (e.g. `APP-2026-SR-901`).
2. Notice the **Next Best Action Banner**:  
   - Action: `Submit Application for Scrutiny` (Target Role: `institution`).
3. Click **Execute: Submit Application for Scrutiny**.
4. Case transitions from `DRAFT` to `SUBMITTED`.

#### Step 4: Login as Regional Officer & Return for Clarification
1. Logout and login as `officer@demo.local` / `DemoPass123!`.
2. Click **Scrutiny Workbench**.
3. Open the submitted application.
4. Advance the case to `SCRUTINY`.
5. Under Available Actions, click **Return for Clarification**.
6. Enter mandatory deficiency remark:  
   `"Registered lease deed page 4 seal is blurry. Please upload certified copy with clear Sub-Registrar endorsement."`
7. Click **Confirm Return**.
8. Notice status immediately transitions to `RETURNED_FOR_CLARIFICATION`.

#### Step 5: Applicant Rectification & Resubmission
1. Logout and login as `college@demo.local`.
2. Open the application dossier.
3. Observe the prominent orange **Deficiency Alert Banner** showing the exact officer remarks.
4. Click **Resubmit Case** (or upload corrected document first).
5. Enter institutional rectification explanation:  
   `"Clear certified true copy of registered lease deed uploaded with Sub-Registrar seal."`
6. Click **Resubmit Application**.
7. Observe stage progresses automatically to `RE_SCRUTINY`.

#### Step 6: Officer Re-Scrutiny & Statutory Approval Order
1. Logout and login as `officer@demo.local`.
2. Open the dossier: Notice the **Next Best Action** is `Complete Re-Scrutiny`.
3. Advance through scrutiny to `COMPLIANCE_PENDING` (or direct approval).
4. Click the **Audit Trail & Hash Chain** tab:
   - Click **Verify Cryptographic Chain**.
   - Observe live SHA-256 verification:  
     `"✓ Cryptographic Integrity Verified Intact (All events chained with SHA-256)"`.
5. Issue final approval order. Outcome: `APPROVED`.

---

### SCENARIO 2: New Technical Programme Route with Mandatory EVC Inspection
**Objective:** Prove configurable routing (Route B) where new programmes strictly mandate an on-site Expert Visit Committee inspection before approval.

1. Login as `college@demo.local`.
2. Create application selecting type **"New Technical Programme Introduction"**.
3. Upload DPR (Detailed Project Report) and submit.
4. Login as `officer@demo.local`.
5. Run Scrutiny: Notice that the system **does not** allow skipping EVC. The mandatory route enforces transition from `SCRUTINY` → `EVC_PENDING`.
6. Click **Schedule EVC Inspection**:
   - Set Inspection Mode: `PHYSICAL`.
   - Committee Experts: `evc@demo.local, Prof. K. Ramanathan (IIT Madras)`.
   - Scheduled Date: Select tomorrow's date.
   - Click **Confirm EVC Schedule**.
7. Logout and login as `evc@demo.local`:
   - Click **EVC Operations**.
   - Only assigned inspections for `evc@demo.local` are visible!
   - Click **Submit Inspection Report**: Enter findings (`RECOMMENDED - All labs and computing infrastructure verified compliant with APH Appendix 4`).
   - Click **Submit Committee Recommendation**.
8. Application automatically advances to `EVC_COMPLETED` ready for final competent authority decision.

---

### SCENARIO 3: Compliance & Lease Validity Monitoring (30-Year Rule)
**Objective:** Prove time-bound undertaking tracking, lease tenure validation, and overdue escalation.

1. Login as `officer@demo.local`.
2. Click **Compliance & Undertakings**:
   - Observe the Compliance Register tracking:
     - 30-Year Land Lease Tenure Check
     - Fire Safety Clearance NOC Expiry Countdown
     - Faculty 7th Pay Commission Scale Undertaking
3. Notice items approaching deadline (<30 days) highlighted with amber warnings.
4. Click **Reports & Analytics**:
   - Scroll to **Operational Bottlenecks & SLA Risk Intelligence**.
   - Review Identified Bottlenecks: Shows stage backlogs, average ageing days, SLA limits, and resource rebalancing recommendations.
   - Click **Export Applications CSV** or **Export Compliance CSV**: Observe RFC-4180 formula-safe CSV downloaded instantly.

---

## 4. Reset & Safe Restore Procedure

Pravaha maintains non-destructive synthetic seed scripts. If you wish to reset demo state back to pristine default data without deleting user accounts:

```powershell
# Navigate to backend directory
cd C:\PS4_AICTE_FullStack_Scaffold\backend

# Execute idempotent re-seed script
.\.venv\Scripts\python.exe -c "from app.seed import seed_all; from app.db import SessionLocal; db = SessionLocal(); seed_all(db); db.close(); print('Pravaha DB Pristine Reset Complete!')"
```

---

## 5. Fallback Instructions (100% Offline AI Operation)

If internet connectivity is unavailable during a hackathon evaluation, Pravaha runs flawlessly in offline mode:
- In `backend/.env`, set `AI_PROVIDER=demo`.
- The deterministic scrutiny engine will extract candidate fields, calculate lease durations, identify missing NOCs, and generate review questions completely offline with zero latency.
- The UI will honestly display `Execution Mode: Deterministic Engine (Offline Fallback)`, ensuring full transparency with the evaluation jury.
