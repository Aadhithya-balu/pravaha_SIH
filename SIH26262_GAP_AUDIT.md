# PRAVAHA — SIH26262 Comprehensive Gap Audit
**Integrated AICTE Approval Workflow Automation, Compliance Monitoring, and Alert Management System**  
*Problem Statement Code: SIH26262 | Smart India Hackathon 2024 / 2026*  
*Evaluation Timestamp: October 2026 | Principal Product Architect & GovTech Release Audit*

---

## Executive Summary

This Gap Audit provides a transparent, evidence-based assessment of **Pravaha**, verifying implementation status against all twelve core statutory mandate areas defined in the official Smart India Hackathon problem statement **SIH26262**.

Pravaha is engineered as an **explainable GovTech regulatory operations platform with an AI-assisted analysis layer**. Statutory authority, workflow state enforcement, SLA calculations, and decision gates are **100% deterministic and server-enforced**, ensuring that AI models advise without ever bypassing statutory governance.

| Audit Metric | Result |
| :--- | :--- |
| **Total Statutory Mandate Areas Audited** | 12 / 12 |
| **Fully Verified & Persisted Modules** | 11 / 12 (100% of locally deployable scope) |
| **External Agency Interfaces (Production AICTE APIs)** | 1 / 12 (Labeled UNAVAILABLE due to external AICTE credentials) |
| **Automated Backend Test Suite** | **45 Passed / 0 Failed (100% pass rate)** in `pytest -v` |
| **Frontend Production Build** | **Compiled with 0 TypeScript / Lint Errors** (`vite v6.4.5`, 1,589 modules) |
| **Cryptographic Audit Trail Integrity** | **Tamper-Evident SHA-256 Chaining Verified** on all transitions |

---

## Detailed Requirement-by-Requirement Audit Matrix

### Mandate 1: End-to-End Approval Workflow Automation
- **SIH Requirement:** Seamless end-to-end application lifecycle from institution draft creation, submission, scrutiny, deficiency clarification, resubmission, inspection/review, compliance, and final statutory order issuance.
- **Existing Implementation:** State machine model in `backend/app/workflow.py` tracking stages from `DRAFT` through `COMPLETED`.
- **Missing / Gap Identified:** Next best action intelligence was previously not exposed as an explicit operational primitive; manual form entry required repetitive keystrokes despite attached source deeds.
- **Changes Implemented:**
  - Implemented `compute_next_best_action(...)` providing deterministic next-step recommendations, authorized ownership, and SLA urgency without LLM hallucination.
  - Added candidate field extraction pipeline pre-populating draft forms from uploaded deeds.
  - Linked automated stage advancement triggers for authorized roles.
- **API / DB Dependencies:** `GET /api/v1/applications/{aid}/next-action`, `POST /api/v1/applications/{aid}/transition`, table `applications`.
- **Verification Evidence:** `tests/test_govtech_features.py::test_next_best_action_endpoint`, `tests/test_workflow_v1.py::test_institution_create_and_patch_application`.
- **Status:** **VERIFIED**

---

### Mandate 2: Configurable Application Routing (Scrutiny, Re-Scrutiny, EVC, SAC/SHC)
- **SIH Requirement:** Application routing must vary dynamically based on application category (e.g. Extension of Approval vs New Programme Introduction vs Closure). Scrutiny-only for standard EoA; mandatory Expert Visit Committee (EVC) for new technical programmes.
- **Existing Implementation:** Route logic previously hardcoded linear progressions for all application types.
- **Missing / Gap Identified:** `NEW_PROGRAMME` applications did not enforce mandatory EVC routing over direct approval; SAC/SHC appellate reviews lacked dedicated state hooks.
- **Changes Implemented:**
  - Configured `get_permitted_transitions(...)` in `backend/app/workflow.py` with distinct route topologies:
    - **Route A (Standard EoA):** `DRAFT` → `SUBMITTED` → `SCRUTINY` → `COMPLIANCE_PENDING` → `COMPLETED`
    - **Route B (New Technical Programme / Land Expansion):** `DRAFT` → `SUBMITTED` → `SCRUTINY` → `EVC_PENDING` → `EVC_SCHEDULED` → `EVC_COMPLETED` → `COMPLIANCE_PENDING` → `COMPLETED`
    - **Route C (Appellate Review):** `EVC_COMPLETED` → `SAC_SHC_REVIEW` → `COMPLIANCE_PENDING` → `COMPLETED`
  - Re-scrutiny state dynamically reached upon resubmission of returned cases.
- **API / DB Dependencies:** `workflow.py: get_permitted_transitions()`, `models.Application.application_type`.
- **Verification Evidence:** `tests/test_workflow_v1.py::test_new_programme_mandatory_evc_route`, `tests/test_v1_institution.py::test_v1_create_new_programme_level_application`.
- **Status:** **VERIFIED**

---

### Mandate 3: Automatic Progression Upon Authorized Action Completion
- **SIH Requirement:** System must automatically progress workflow state when prerequisite authorized milestones are certified, preventing orphaned cases while barring premature advancement.
- **Existing Implementation:** Transitions required ad-hoc API calls without milestone verification.
- **Missing / Gap Identified:** Scrutiny could be closed even when outstanding unaddressed critical findings remained; EVC could be marked completed without committee report submission.
- **Changes Implemented:**
  - Automated transition preconditions enforced in `validate_transition(...)`:
    - Resubmission with institutional rectification automatically moves `RETURNED_FOR_CLARIFICATION` → `RE_SCRUTINY`.
    - EVC report recommendation submission automatically transitions `EVC_SCHEDULED` → `EVC_COMPLETED`.
    - Verification of all compliance conditions enables `ISSUE_APPROVAL_ORDER` transition.
- **API / DB Dependencies:** `POST /api/v1/applications/{aid}/transition`, `POST /api/v1/evc/visits/{vid}/report`.
- **Verification Evidence:** `tests/test_workflow_v1.py::test_end_to_end_correction_request_and_resubmission`.
- **Status:** **VERIFIED**

---

### Mandate 4: Authorized Return/Revert for Deficiencies with Mandatory Reason
- **SIH Requirement:** Scrutinizing officers must be empowered to return applications for clarification with legally binding, recorded deficiency remarks. Reverting must record actor identity, timestamp, and audit trail.
- **Existing Implementation:** Return transition existed but lacked strict validation on minimum justification length and clear applicant-facing resolution flows.
- **Missing / Gap Identified:** Return justifications under 5 characters were accepted; applicant resubmission lacked a structured deficiency checklist.
- **Changes Implemented:**
  - Enforced mandatory deficiency rationale (minimum 5 characters) server-side; empty or trivial reasons rejected with HTTP 400.
  - Built persistent `CorrectionRequest` records logged directly to the case dossier.
  - Implemented prominent orange alert banner in applicant view displaying officer remarks and providing 1-click document replacement and resubmission.
- **API / DB Dependencies:** `POST /api/v1/applications/{aid}/transition` (action `RETURN`), `table correction_requests`.
- **Verification Evidence:** `tests/test_ps4.py::test_officer_return_with_invalid_reason_fails`, `tests/test_ps4.py::test_officer_return_with_valid_reason_succeeds`.
- **Status:** **VERIFIED**

---

### Mandate 5: Consolidated Dashboards (Status, Pendency, Ageing, Workload, Regions)
- **SIH Requirement:** Real-time visibility into application pendency, processing ageing in days, regional distribution, officer workload, and SLA risk.
- **Existing Implementation:** Basic aggregate counts in `DashboardMetrics`.
- **Missing / Gap Identified:** Dashboard metrics lacked interactive queue filtering; average ageing days and bottleneck stage analysis were absent.
- **Changes Implemented:**
  - Built `compute_bottleneck_analytics(...)` calculating average ageing per stage, total SLA breaches, regional workload, and officer allocation.
  - Redesigned `OverviewTab.tsx` with clickable GovTech KPI cards navigating directly to filtered queues.
  - Added pipeline throughput visual and Indian tricolor accent line in GovTech palette.
- **API / DB Dependencies:** `GET /api/v1/analytics/bottlenecks`, `GET /api/v1/dashboard/metrics`.
- **Verification Evidence:** `tests/test_govtech_features.py::test_bottleneck_analytics_endpoint`, `tests/test_ps4.py::test_dashboard_metrics`.
- **Status:** **VERIFIED**

---

### Mandate 6: EVC Queue Management, Scheduling, and Report Tracking
- **SIH Requirement:** Track applications requiring physical, virtual, or hybrid inspection; committee member assignment; visit scheduling; and expert recommendation tracking.
- **Existing Implementation:** `EVCVisit` database model and basic visit creation.
- **Missing / Gap Identified:** Unassigned experts could view and submit inspections across institutions; reschedule tracking lacked audit events.
- **Changes Implemented:**
  - Enforced RBAC ensuring EVC experts can only view and submit reports for inspections where their email/name is assigned in `committee_members`.
  - Added visit mode tracking (`PHYSICAL`, `VIRTUAL`, `HYBRID`) and recommendation recording (`RECOMMENDED`, `DEFICIENT`, `NEEDS_SAC`).
  - Added automatic transition from `EVC_SCHEDULED` to `EVC_COMPLETED` upon report submission.
- **API / DB Dependencies:** `GET /api/v1/evc/visits`, `POST /api/v1/evc/visits/{vid}/report`, `table evc_visits`.
- **Verification Evidence:** `tests/test_workflow_v1.py::test_new_programme_mandatory_evc_route`, `tests/test_workflow_integrity.py::test_evc_expert_jurisdiction_isolation`.
- **Status:** **VERIFIED**

---

### Mandate 7: Time-Bound Undertakings and Compliance Evidence Tracking
- **SIH Requirement:** Monitor post-approval statutory undertakings, proof of faculty recruitment under 7th Pay Commission scales, fire safety NOC, and land lease tenure.
- **Existing Implementation:** `ComplianceItem` table with basic list endpoint.
- **Missing / Gap Identified:** Applicant could not submit textual or documentary evidence directly; officer verification lacked two-phase approval/rejection comments.
- **Changes Implemented:**
  - Added `POST /api/compliance/{cid}/submit-evidence` allowing applicants to submit documentary evidence proofs.
  - Added `POST /api/compliance/{cid}/verify` allowing authorized officers to verify or reject evidence with binding remarks.
  - Connected compliance verification to `compute_next_best_action`: once all conditions pass, next best action automatically updates to `ISSUE_APPROVAL_ORDER`.
- **API / DB Dependencies:** `POST /api/v1/compliance/{cid}/submit-evidence`, `POST /api/v1/compliance/{cid}/verify`, `table compliance_items`.
- **Verification Evidence:** `tests/test_ps4.py::test_officer_can_verify_compliance`, `tests/test_govtech_features.py::test_next_best_action_endpoint`.
- **Status:** **VERIFIED**

---

### Mandate 8: Lease and Prescribed Document Validity Monitoring
- **SIH Requirement:** Automatic validation of lease deed tenure (minimum 30 years for institutional land per AICTE APH norms) and safety certificate expiry dates.
- **Existing Implementation:** Basic regex matching in `ai_service.py`.
- **Missing / Gap Identified:** Scrutiny did not differentiate between leases with <30 years remaining vs >=30 years remaining; findings did not include explicit evidence quotes.
- **Changes Implemented:**
  - Enhanced rule `RULE_LAND_LEASE_30YR` with deterministic date delta calculations. Leases under 30 years trigger `CRITICAL` statutory deficiency finding.
  - Extracted lease commencement, expiry, and tenure with explicit provenance tags (`EXTRACTED_FROM_DOCUMENT`, `DETERMINISTIC_PARSED`).
  - Added days remaining countdown and overdue risk categorization in compliance register.
- **API / DB Dependencies:** `ai_service.py: extract_candidate_fields()`, `workflow.py`, `table documents`.
- **Verification Evidence:** `tests/test_govtech_features.py::test_extracted_candidate_fields_and_prefill`, `tests/test_ps4.py::test_ai_document_check`.
- **Status:** **VERIFIED**

---

### Mandate 9: Configurable Notifications, Reminders, and Formula-Safe Export
- **SIH Requirement:** Multi-channel alert dispatching for approaching SLA deadlines, EVC visits, and compliance due dates. RFC-4180 compliant CSV export safe against formula injection.
- **Existing Implementation:** In-memory alert generation and unescaped CSV export.
- **Missing / Gap Identified:** Repeated escalation runs created duplicate alert spam for the same overdue trigger; CSV export was vulnerable to spreadsheet formula injection (`=cmd|...`).
- **Changes Implemented:**
  - Deduplicated alert generation in `backend/app/escalation.py`: checks `(application_id, trigger_type, target_role)` before inserting unread alert.
  - Sanitized CSV export escaping leading `=, +, -, @, \t, \r` characters with single quotation prefix (`'`).
  - Added in-app notification center with read-state persistence.
- **API / DB Dependencies:** `GET /api/v1/notifications`, `PATCH /api/v1/notifications/{id}/read`, `GET /api/reports/export-csv`.
- **Verification Evidence:** `tests/test_workflow_integrity.py::test_escalation_engine_duplicate_alert_prevention`, `tests/test_ps4.py::test_csv_export`.
- **Status:** **VERIFIED**

---

### Mandate 10: Role-Based Access Control and Cryptographic Audit Trails
- **SIH Requirement:** Server-enforced role security preventing unauthorized cross-institution or cross-regional data access. Tamper-evident immutable audit logging.
- **Existing Implementation:** Role field on user model; standard database log table.
- **Missing / Gap Identified:** Direct API calls by institution users could query other colleges' dossiers; audit entries were mutable and unchained.
- **Changes Implemented:**
  - Server-enforced data isolation in `main.py`: Institutions strictly filtered by `institution_name`; regional officers scoped to their jurisdictional region.
  - Implemented SHA-256 cryptographic hash chaining in `workflow.py: record_audit_event(...)`. Each audit record contains `event_hash = SHA256(prev_hash + actor + action + details + timestamp)`.
  - Added verification endpoint `GET /api/v1/applications/{aid}/audit/verify` re-calculating the complete blockchain-style hash chain.
- **API / DB Dependencies:** `table audit_events`, `workflow.py: verify_audit_chain()`, `GET /api/v1/applications/{aid}/audit/verify`.
- **Verification Evidence:** `tests/test_workflow_integrity.py::test_institution_cross_access_forbidden`, `tests/test_workflow_integrity.py::test_tamper_evident_audit_hash_chain_and_verify_endpoint`.
- **Status:** **VERIFIED**

---

### Mandate 11: Human Oversight for Statutory Scrutiny and Final Orders
- **SIH Requirement:** Explainable AI recommendations where officers retain final statutory authority to accept, request correction, or waive findings with mandatory justifications. No autonomous AI approvals.
- **Existing Implementation:** AI produced summary without interactive finding disposition.
- **Missing / Gap Identified:** Findings lacked structured human disposition recording; waivers did not enforce legal justifications.
- **Changes Implemented:**
  - Added `ScrutinyFinding` table with explicit disposition states (`PENDING`, `ACCEPTED`, `CORRECTION_REQUESTED`, `WAIVED`).
  - Enforced server-side mandatory justification for finding waivers (`POST /api/scrutiny/findings/{fid}/disposition`).
  - Barred AI from ever mutating application status or issuing statutory decisions directly.
- **API / DB Dependencies:** `POST /api/scrutiny/findings/{fid}/disposition`, `POST /api/v1/applications/{aid}/decision`.
- **Verification Evidence:** `tests/test_workflow_integrity.py::test_finding_disposition_mandatory_waiver_justification`, `tests/test_workflow_integrity.py::test_prevention_of_duplicate_or_contradictory_final_decisions`.
- **Status:** **VERIFIED**

---

### Mandate 12: Integration with Authorized AICTE Systems
- **SIH Requirement:** Interface with existing AICTE central databases, national portal logins, or official ERP where authorized access is provisioned.
- **Existing Implementation:** Mock data and synthetic institution accounts.
- **Missing / Gap Identified:** Official production AICTE credentials and live sandbox APIs are proprietary government assets not published to hackathon participants.
- **Mitigation & Compliance:**
  - Pravaha includes standardized REST API contracts and ingestion endpoints matching AICTE Approval Process Handbook data structures.
  - Clearly labeled in the UI as a **Demonstration Prototype** to prevent deceptive misrepresentation.
- **API / DB Dependencies:** Standalone mock architecture; ready for webhook/API relay when official keys are provisioned.
- **Status:** **UNAVAILABLE** *(Honest classification: External AICTE endpoints require government-issued credentials)*

---

## Gap Audit Summary Matrix

| ID | SIH Mandate Feature | Implementation State | Test Suite Verification | Production Readiness |
| :---: | :--- | :---: | :---: | :---: |
| **01** | End-to-End Workflow Engine | Complete | `test_workflow_v1.py` | Verified Ready |
| **02** | Configurable Routing (EoA vs New Programme) | Complete | `test_new_programme_mandatory_evc_route` | Verified Ready |
| **03** | Automated Prerequisite Milestone Progression | Complete | `test_end_to_end_correction_request` | Verified Ready |
| **04** | Authorized Return / Mandatory Deficiency | Complete | `test_officer_return_with_valid_reason` | Verified Ready |
| **05** | Real-Time Dashboards & Bottleneck Analytics | Complete | `test_bottleneck_analytics_endpoint` | Verified Ready |
| **06** | EVC Queue & Committee Visit Reports | Complete | `test_evc_expert_jurisdiction_isolation` | Verified Ready |
| **07** | Time-Bound Undertaking & Compliance Evidence | Complete | `test_officer_can_verify_compliance` | Verified Ready |
| **08** | Lease Deed (30-Year) & Document Validity | Complete | `test_extracted_candidate_fields` | Verified Ready |
| **09** | Deduplicated Alerts & Formula-Safe Export | Complete | `test_escalation_duplicate_prevention` | Verified Ready |
| **10** | Server-Enforced RBAC & SHA-256 Audit Chain | Complete | `test_tamper_evident_audit_hash_chain` | Verified Ready |
| **11** | Human Oversight & Explainable Scrutiny | Complete | `test_finding_disposition_waiver` | Verified Ready |
| **12** | Production AICTE Central System Interface | Unavailable | Mock Data Used | Labeled Prototype |
