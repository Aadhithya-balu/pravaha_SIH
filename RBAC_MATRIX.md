# PRAVAHA — Role-Based Access Control (RBAC) & Data Isolation Matrix
**Statutory Authority, Jurisdictional Isolation, and Security Boundaries**  
*Problem Statement Code: SIH26262 | Smart India Hackathon 2024 / 2026*  
*Enforcement Location: `backend/app/main.py` (Server-side Dependencies & Filters)*

---

## 1. Statutory Role Architecture

Pravaha enforces a strict, hierarchical role-based governance model aligned directly with the **AICTE Approval Process Handbook (APH)** operational workflow. Permissions are validated on the backend via FastAPI dependency injection (`get_current_user`) and cannot be bypassed by client-side manipulation.

```
                    ┌───────────────────────────────┐
                    │      BUREAU / COMPETENT       │
                    │           AUTHORITY           │
                    │  (Appeals, SAC/SHC, Overrides)│
                    └───────────────┬───────────────┘
                                    │
                                    ▼
┌───────────────────────────────┐       ┌───────────────────────────────┐
│       REGIONAL OFFICER        │       │       EVC EXPERT MEMBER       │
│ (Regional Scrutiny, Defect    │       │ (Committee Inspections, Site  │
│  Notices, Compliance Review)  │       │  Observations, Report Filing) │
└───────────────┬───────────────┘       └───────────────┬───────────────┘
                │                                       │
                ▼                                       ▼
┌───────────────────────────────────────────────────────────────────────┐
│                         INSTITUTION APPLICANT                         │
│  (Draft Creation, Evidence Upload, Clarification Resubmission)        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Jurisdictional Isolation Boundaries

### 2.1 Institution Isolation Boundary
- **Rule:** An institution user can **only** query, modify, and receive notifications for applications where `application.institution_name == user.institution_name`.
- **Denial Behavior:** Direct requests referencing another institution's `application_id` return **HTTP 403 Forbidden** with an immediate security audit record logged.
- **Authority Barrier:** Institution users cannot execute workflow transitions, approve findings, or verify compliance undertakings.

### 2.2 Regional Jurisdictional Isolation Boundary
- **Rule:** A Regional Officer assigned to a specific region (e.g. `Southern`, `Northern`, `Western`) can only review applications belonging to colleges in their jurisdiction (`application.region == user.region`), unless assigned with `HQ` (Headquarters) authority.
- **Denial Behavior:** Officers attempting to review or modify applications outside their designated regional jurisdiction are blocked with **HTTP 403 Forbidden**.

### 2.3 EVC Expert Committee Isolation Boundary
- **Rule:** EVC Expert members can **only** access inspection records and submit evaluation reports for visits where their name or email is explicitly recorded in `evc_visit.committee_members`.
- **Denial Behavior:** Accessing unassigned visits or attempting to alter the overarching application state returns **HTTP 403 Forbidden**.

---

## 3. Comprehensive RBAC Matrix

| Resource | Action / Endpoint | `institution` | `officer` | `bureau` | `evc_expert` | `admin` | Denial HTTP Code |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Application Draft** | `POST /api/v1/applications/draft` | **ALLOW** (Own) | DENY | DENY | DENY | **ALLOW** | 403 Forbidden |
| **Application Submit** | `POST /api/v1/applications/{id}/submit` | **ALLOW** (Own) | DENY | DENY | DENY | **ALLOW** | 403 Forbidden |
| **View Application Dossier**| `GET /api/v1/applications/{id}` | **ALLOW** (Own) | **ALLOW** (Region) | **ALLOW** (All) | **ALLOW** (Assigned) | **ALLOW** | 403 Forbidden |
| **Document Upload** | `POST /api/v1/applications/{id}/documents` | **ALLOW** (Own) | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Run Scrutiny Pipeline** | `POST /api/scrutiny/run/{id}` | DENY | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Return for Clarification**| `POST /api/applications/{id}/transition` (`RETURN`) | DENY | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Resubmit Rectification**| `POST /api/v1/applications/{id}/resubmit` | **ALLOW** (Own) | DENY | DENY | DENY | **ALLOW** | 403 Forbidden |
| **Schedule EVC Visit** | `POST /api/v1/evc/visits` | DENY | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Submit EVC Report** | `POST /api/v1/evc/visits/{vid}/report` | DENY | **ALLOW** (Region) | **ALLOW** (All) | **ALLOW** (Assigned) | **ALLOW** | 403 Forbidden |
| **Submit Compliance Proof**| `POST /api/compliance/{cid}/submit-evidence` | **ALLOW** (Own) | DENY | DENY | DENY | **ALLOW** | 403 Forbidden |
| **Verify Compliance** | `POST /api/compliance/{cid}/verify` | DENY | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Statutory Approval Order**| `POST /api/v1/applications/{id}/decision` | DENY | **ALLOW** (Region) | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Override / SAC Appeal** | `POST /api/applications/{id}/transition` (`SAC_SHC_REVIEW`) | DENY | DENY | **ALLOW** (All) | DENY | **ALLOW** | 403 Forbidden |
| **Export Formula-Safe CSV**| `GET /api/reports/export-csv` | DENY | **ALLOW** | **ALLOW** | DENY | **ALLOW** | 403 Forbidden |
| **Verify Audit Hash Chain**| `GET /api/v1/applications/{id}/audit/verify` | **ALLOW** (Own) | **ALLOW** (Region) | **ALLOW** (All) | **ALLOW** (Assigned) | **ALLOW** | 403 Forbidden |

---

## 4. Server-Side Enforcement Mechanisms

### 4.1 Dependency Injection Validation
Every protected endpoint utilizes FastAPI's `Depends(get_current_user)` returning a validated JWT user model. Applications are fetched through scoped queries:

```python
# Institution Data Scoping Example
q = db.query(Application)
if current_user.role == "institution":
    q = q.filter(Application.institution_name == current_user.institution_name)
elif current_user.role == "officer" and current_user.region and current_user.region != "HQ":
    q = q.filter(Application.region == current_user.region)
```

### 4.2 Cross-Role Privilege Elevation Prevention
1. **No Client Role-Switching in Production:** The UI displays the active user badge and designation derived strictly from the backend token.
2. **Transition Authority Validation:** Workflow actions check `user.role in permitted_roles`. If an applicant attempts to trigger `ADVANCE_TO_SCRUTINY`, the server throws `HTTP 403: Role 'institution' is not permitted to execute action 'ADVANCE_TO_SCRUTINY'`.
3. **Immutable Decisions:** Once an application reaches `COMPLETED` with a statutory approval or rejection order, subsequent transition attempts are blocked to prevent duplicate or conflicting determinations.

---

## 5. Security & Verification Test Coverage

The following automated tests in `backend/tests/test_workflow_integrity.py` and `backend/tests/test_ps4.py` certify RBAC integrity:

- `test_institution_cross_access_forbidden`: Confirms that institution accounts receive HTTP 403 when requesting data of peer colleges.
- `test_evc_expert_jurisdiction_isolation`: Confirms that EVC experts cannot submit reports for visits outside their committee roster.
- `test_institution_cannot_advance_stage_without_officer`: Confirms that institutions cannot self-advance scrutiny stages.
- `test_prevention_of_duplicate_or_contradictory_final_decisions`: Confirms that final decisions are locked against unauthorized overrides.
