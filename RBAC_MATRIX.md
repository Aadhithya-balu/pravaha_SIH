# PRAVAHA — Role-Based Access Control (RBAC) & Governance Matrix
**Statutory Authority Boundaries, Tenant Isolation, and Combined Officer/Admin Model**  
*Problem Statement Code: SIH26262 | Smart India Hackathon 2024 / 2026*  
*Enforcement Location: `backend/app/main.py`, `backend/app/workflow.py`*

---

## 1. Statutory Role Architecture

Pravaha enforces a strict, hierarchical role-based governance model aligned directly with the **AICTE Approval Process Handbook (APH)**. For demonstration and operational governance under SIH26262, the platform provides **3 canonical evaluation personas**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   REGIONAL OFFICER / ADMIN (COMBINED)                  │
│                                                                        │
│ • Regional Scrutiny & Candidate Field Review                           │
│ • Deficiency Return with Mandatory Justifications                      │
│ • Compliance Proof Verification (30-year lease, CFO NOC)               │
│ • EVC Inspection Committee Scheduling                                  │
│ • Statutory System Administration & System-wide Oversight              │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        INSTITUTION APPLICANT         │  │          EVC EXPERT          │
│                                      │  │                              │
│ • Strict Tenant Isolation            │  │ • Committee Isolation        │
│ • Application Drafting & Submission  │  │ • Campus Site Observations   │
│ • Regulatory Evidence Upload         │  │ • Lab Facility Reports       │
│ • Clarification Resubmission         │  │ • Formal Recommendations     │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Mandatory Jurisdictional Boundaries

### 2.1 Institution Tenant Isolation
- **Rule:** An applicant can **only** access applications, documents, and notifications where `institution_name == user.institution_name`.
- **Enforcement:** Enforced directly in SQL queries (`WHERE application.institution_name = :inst_name`) and object getters.
- **Denial Behavior:** Accessing another institution's ID immediately returns **HTTP 403 Forbidden**.
- **Boundaries:** Applicants cannot trigger scrutiny transitions, waive deficiencies, schedule EVC visits, or verify compliance proof.

### 2.2 Regional Officer / Admin Combined Role
- **Rule:** The combined Regional Officer and Administrator persona (`officer@demo.local`) possesses complete operational clearance for scrutiny, deficiency returns, compliance verification, and administrative management.
- **Enforcement:** In `require_roles`, `officer` and `admin` roles are interoperable for all operational and administrative routes.
- **Boundaries:** Does not permit spoofing applicant identities or bypassing mandatory deficiency justification requirements (minimum 5 characters).

### 2.3 EVC Expert Committee Isolation
- **Rule:** EVC Expert members can **only** view applications and submit reports for inspections where their name or email is recorded in `EVCVisit.committee_members`.
- **Enforcement:** `check_evc_assignment` verifies assignment prior to displaying inspection portfolios.
- **Denial Behavior:** Unassigned visits return **HTTP 403 Forbidden**.

---

## 3. Role Permission Matrix

| Capability / Action | Institution Applicant | Regional Officer / Admin | EVC Expert | Backend Guard Dependency |
| :--- | :---: | :---: | :---: | :--- |
| **Create Application Draft** | ✅ | ✅ | ❌ | `require_roles(["institution", "admin"])` |
| **Upload Application Documents** | ✅ (Own) | ✅ | ❌ | `user.institution_name` check |
| **Submit Application for Scrutiny** | ✅ (Own) | ❌ | ❌ | State validation: `DRAFT -> SCRUTINY` |
| **Execute Scrutiny Transitions** | ❌ | ✅ | ❌ | `require_roles(["officer", "admin"])` |
| **Return Application for Clarification**| ❌ | ✅ | ❌ | Minimum 5-char reason required |
| **Resubmit Returned Application** | ✅ (Own) | ❌ | ❌ | `user.institution_name` check |
| **Run Groq AI Scrutiny Pipeline** | ❌ | ✅ | ❌ | `require_roles(["officer", "admin"])` |
| **Schedule EVC Committee** | ❌ | ✅ | ❌ | `require_roles(["officer", "admin"])` |
| **Submit EVC Inspection Report** | ❌ | ✅ | ✅ (Assigned) | `check_evc_assignment` check |
| **Submit Compliance Evidence** | ✅ (Own) | ❌ | ❌ | `user.institution_name` check |
| **Verify Compliance Evidence** | ❌ | ✅ | ❌ | `require_roles(["officer", "admin"])` |
| **Issue Statutory Approval Order** | ❌ | ✅ | ❌ | Final decision guard |
| **Evaluate SLA Deadlines & Scan** | ❌ | ✅ | ❌ | `require_roles(["officer", "admin"])` |
| **Export Regulatory Register (CSV)** | ❌ | ✅ | ❌ | Sanitized CSV export guard |
