import json
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from .models import Application, Document, ScrutinyRun, ScrutinyFinding
from .ai_service import review_document, RULESET_VERSION
from .doc_extractor import find_page_number_for_quote


# --- AICTE Approval Process Handbook (APH 2024-2027) Regulatory Definitions ---

ROUTE_EOA = "Extension of Approval"
ROUTE_NEW_PROGRAMME = "New Programme / Level"

MANDATORY_DOCUMENTS_BY_ROUTE: Dict[str, List[Dict[str, Any]]] = {
    ROUTE_EOA: [
        {
            "type": "EOA_SELF_DISCLOSURE",
            "name": "Annual Self-Disclosure / Undertaking",
            "rule": "APH-2024-CH2-S2.1",
            "aliases": ["EOA_SELF_DISCLOSURE", "SELF_DISCLOSURE", "ANNUAL_DISCLOSURE", "UNDERTAKING"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Sec 2.1"
        },
        {
            "type": "PREVIOUS_APPROVAL",
            "name": "AICTE EoA Letter of Preceding Academic Year",
            "rule": "APH-2024-CH2-S2.2",
            "aliases": ["PREVIOUS_APPROVAL", "EOA_LETTER", "PREVIOUS_EOA"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Sec 2.2"
        },
        {
            "type": "BUILDING_SAFETY_FIRE_NOC",
            "name": "Fire & Life Safety Certificate / NOC",
            "rule": "APH-2024-CH2-FIRE",
            "aliases": ["BUILDING_SAFETY_FIRE_NOC", "FIRE_NOC", "FIRE_SAFETY", "FIRE_CLEARANCE"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Fire Safety Norms & NBC 2016"
        },
        {
            "type": "FACULTY_LIST",
            "name": "Faculty Cadre & Salary Compliance Roster",
            "rule": "APH-2024-CH2-FACULTY",
            "aliases": ["FACULTY_LIST", "FACULTY_ROSTER", "FACULTY_APPOINTMENT_PLAN"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Faculty Cadre Norms"
        },
        {
            "type": "ANTI_RAGGING_AFFIDAVIT",
            "name": "Mandatory Anti-Ragging Undertaking",
            "rule": "APH-2024-ANNEX-RAGGING",
            "aliases": ["ANTI_RAGGING_AFFIDAVIT", "ANTI_RAGGING", "UNDERTAKING", "AFFIDAVIT"],
            "source_reference": "AICTE Anti-Ragging Regulations 2009 & APH 2024-2027"
        }
    ],
    ROUTE_NEW_PROGRAMME: [
        {
            "type": "LAND_OWNERSHIP_DEED",
            "name": "Land Title Deed / Registered Lease (>= 30 Years or Freehold)",
            "rule": "APH-2024-CH2-LAND",
            "aliases": ["LAND_OWNERSHIP_DEED", "LEASE_DEED", "LAND_DEED", "TITLE_DEED", "LAND_TITLE"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Section 2.1 (Land Norms)"
        },
        {
            "type": "BUILDING_PLAN_OCCUPANCY",
            "name": "Approved Building Plan & Occupancy Certificate",
            "rule": "APH-2024-CH2-BUILDING",
            "aliases": ["BUILDING_PLAN_OCCUPANCY", "BUILDING_PLAN", "OCCUPANCY_CERTIFICATE"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Built-up Area Norms"
        },
        {
            "type": "STATE_GOVT_NOC",
            "name": "No Objection Certificate (NOC) from State Government",
            "rule": "APH-2024-CH2-STATE-NOC",
            "aliases": ["STATE_GOVT_NOC", "STATE_NOC", "GOVT_NOC"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Sec 2.3"
        },
        {
            "type": "AFFILIATING_UNIVERSITY_NOC",
            "name": "NOC / Affiliation Consent from University",
            "rule": "APH-2024-CH2-AFFILIATION",
            "aliases": ["AFFILIATING_UNIVERSITY_NOC", "UNIVERSITY_NOC", "AFFILIATION_NOC", "AFFILIATION_LETTER"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Sec 2.3"
        },
        {
            "type": "EQUIPMENT_LAB_LIST",
            "name": "Curriculum-aligned Laboratory Equipment Invoices",
            "rule": "APH-2024-CH2-LABS",
            "aliases": ["EQUIPMENT_LAB_LIST", "LAB_EQUIPMENT", "LAB_INVOICES", "LAB_READINESS"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Laboratory Norms"
        },
        {
            "type": "FACULTY_APPOINTMENT_PLAN",
            "name": "Core Faculty Recruitment & Appointment Plan",
            "rule": "APH-2024-CH2-FACULTY-PLAN",
            "aliases": ["FACULTY_APPOINTMENT_PLAN", "FACULTY_PLAN", "FACULTY_LIST"],
            "source_reference": "AICTE APH 2024-2027 Ch. II Faculty Cadre Norms"
        }
    ]
}


def normalize_application_route(app_type: str) -> str:
    """Normalizes variations of application type strings to official APH routes."""
    s = (app_type or "").lower()
    if "new" in s or "programme" in s or "level" in s or "course" in s:
        return ROUTE_NEW_PROGRAMME
    return ROUTE_EOA


async def execute_scrutiny_pipeline(
    application_id: int,
    db: Session,
    actor_email: str,
    run_type: str = "INITIAL",
    reference_date: Optional[date] = None
) -> Dict[str, Any]:
    """
    Executes explainable, evidence-linked regulatory scrutiny:
    1. Checks mandatory documents per APH 2024-2027 route rules.
    2. Inspects uploaded documents for readability, certificate dates, tenure, and regulatory norms.
    3. Links evidence quotes and exact page references where available.
    4. Evaluates inspection risk (mandatory EVC for New Programme; deficiency-triggered audit for EoA).
    5. Persists ScrutinyRun and ScrutinyFinding records in database.
    6. Updates application deficiency count.
    """
    app = db.get(Application, application_id)
    if not app:
        raise ValueError(f"Application {application_id} not found.")

    route = normalize_application_route(app.application_type)
    req_docs = MANDATORY_DOCUMENTS_BY_ROUTE.get(route, MANDATORY_DOCUMENTS_BY_ROUTE[ROUTE_EOA])

    # Fetch all uploaded documents for this application
    uploaded_docs = db.query(Document).filter(Document.application_id == application_id).all()
    uploaded_by_type: Dict[str, List[Document]] = {}
    for d in uploaded_docs:
        d_type = (d.document_type or "").upper()
        uploaded_by_type.setdefault(d_type, []).append(d)

    findings: List[Dict[str, Any]] = []
    missing_docs: List[str] = []
    ai_assisted = False
    model_provider = "deterministic_local"
    model_name = "rule-engine-v1.2"

    # --- Step 1. Deterministic check: Mandatory Documents & Requirements by Route ---
    requirements_checklist: List[Dict[str, Any]] = []
    for req in req_docs:
        aliases = [a.upper() for a in req.get("aliases", [req["type"]])]
        matching: List[Document] = []
        for alias in aliases:
            if alias in uploaded_by_type:
                matching.extend(uploaded_by_type[alias])

        # Also search by document name keywords as fallback
        if not matching:
            req_name_lower = req["name"].lower()
            for d in uploaded_docs:
                d_name_lower = d.document_name.lower()
                if ("fire" in req_name_lower and "fire" in d_name_lower) or \
                   ("lease" in req_name_lower and ("lease" in d_name_lower or "land" in d_name_lower or "deed" in d_name_lower)) or \
                   ("ragging" in req_name_lower and ("ragging" in d_name_lower or "affidavit" in d_name_lower)) or \
                   ("project" in req_name_lower and ("project" in d_name_lower or "dpr" in d_name_lower)) or \
                   ("affiliation" in req_name_lower and ("affiliation" in d_name_lower or "university" in d_name_lower)) or \
                   ("equipment" in req_name_lower and ("equipment" in d_name_lower or "lab" in d_name_lower)):
                    matching.append(d)
                    break

        if not matching:
            missing_docs.append(req["name"])
            requirements_checklist.append({
                "rule_id": req["rule"],
                "name": req["name"],
                "type": req["type"],
                "status": "MISSING",
                "evidence_document": None,
                "source_reference": req["source_reference"],
                "notes": f"Mandatory document '{req['name']}' is not yet uploaded."
            })
            findings.append({
                "rule_id": req["rule"],
                "document_type": req["type"],
                "document_id": None,
                "source_document": None,
                "page_number": None,
                "severity": "DEFICIENCY",
                "category": "MISSING_DOCUMENT",
                "description": f"Mandatory regulatory document '{req['name']}' ({req['type']}) is missing from institutional submission.",
                "evidence_quote": None,
                "expected_requirement": f"Upload of verified copy of {req['name']} per {req['source_reference']}.",
                "observed_value": "Document not uploaded or not identified in application repository.",
                "suggested_action": f"Applicant institution must upload a verified copy of '{req['name']}' before case can advance.",
                "is_provisional": False,
                "source_reference": req["source_reference"]
            })
        else:
            doc_matched = matching[0]
            requirements_checklist.append({
                "rule_id": req["rule"],
                "name": req["name"],
                "type": req["type"],
                "status": "PASS",
                "evidence_document": doc_matched.document_name,
                "source_reference": req["source_reference"],
                "notes": f"Attached verified filing: '{doc_matched.document_name}'."
            })

    # --- Step 2. Scrutiny of Uploaded Documents (Readability, Dates, Extraction) ---
    for doc in uploaded_docs:
        text = doc.extracted_text or ""
        doc_type_upper = (doc.document_type or "OTHER").upper()

        # Check for unreadable / scanned binary
        if not text.strip() or "pypdf library is not available" in text.lower():
            findings.append({
                "rule_id": f"APH-DOC-{doc_type_upper[:10]}-UNREADABLE",
                "document_type": doc.document_type,
                "document_id": doc.id,
                "source_document": doc.document_name,
                "page_number": None,
                "severity": "WARNING",
                "category": "EXTRACTION_FAILURE",
                "description": f"Uploaded document '{doc.document_name}' contains non-extractable text, vector drawings, or is a scanned image without an OCR layer.",
                "evidence_quote": None,
                "expected_requirement": "Digitally readable document containing extractable legal text.",
                "observed_value": "Non-extractable text / scanned image format.",
                "suggested_action": f"Officer must conduct visual inspection of '{doc.document_name}' or request a machine-readable searchable PDF.",
                "is_provisional": False,
                "source_reference": "AICTE APH 2024-2027 General Document Norms"
            })

        # Run AI service review (real LLM if configured, otherwise deterministic rule engine)
        ai_res = await review_document(
            document_name=doc.document_name,
            document_type=doc.document_type,
            text=text,
            reference_date=reference_date
        )

        if ai_res.get("mode") == "real_llm":
            ai_assisted = True
            model_provider = ai_res.get("provider", "openai")
            model_name = ai_res.get("model", "gpt-4o-mini")

        # Cache AI summary and findings on document record
        doc.ai_summary = ai_res.get("summary")
        doc.ai_findings = json.dumps(ai_res)
        doc.ai_confidence = float(ai_res.get("confidence_score", 0.85))

        # Integrate structured findings from document review
        doc_structured = ai_res.get("structured_findings", [])
        if doc_structured:
            for sf in doc_structured:
                # Attach document reference and locate page number if not already set
                quote = sf.get("evidence_quote")
                page_no = sf.get("page_number")
                if page_no is None and quote:
                    page_no = find_page_number_for_quote(quote, text)

                findings.append({
                    "rule_id": sf.get("rule_id", f"APH-DOC-{doc_type_upper[:10]}"),
                    "document_type": sf.get("document_type", doc.document_type),
                    "document_id": doc.id,
                    "source_document": doc.document_name,
                    "page_number": page_no,
                    "severity": sf.get("severity", "WARNING"),
                    "category": sf.get("category", "INCONSISTENCY"),
                    "description": f"[{doc.document_name}] {sf.get('description', '')}",
                    "evidence_quote": quote,
                    "expected_requirement": sf.get("expected_requirement", f"Compliance with APH {doc.document_type} standards."),
                    "observed_value": sf.get("observed_value", sf.get("description", "")),
                    "suggested_action": sf.get("suggested_action", f"Officer must review '{doc.document_name}'."),
                    "is_provisional": sf.get("is_provisional", False),
                    "source_reference": sf.get("source_reference", "AICTE APH 2024-2027")
                })
        else:
            # Fallback mapping from potential_inconsistencies if structured_findings was empty
            for inc in ai_res.get("potential_inconsistencies", []):
                if "no immediate discrepancies" in inc.lower():
                    continue
                severity = "DEFICIENCY" if ("mandates" in inc.lower() or "expired" in inc.lower() or "missing" in inc.lower()) else "WARNING"
                findings.append({
                    "rule_id": f"APH-DOC-{doc_type_upper[:10]}",
                    "document_type": doc.document_type,
                    "document_id": doc.id,
                    "source_document": doc.document_name,
                    "page_number": None,
                    "severity": severity,
                    "category": "REGULATORY_NON_COMPLIANCE" if severity == "DEFICIENCY" else "INCONSISTENCY",
                    "description": f"[{doc.document_name}] {inc}",
                    "evidence_quote": text[:180] if len(text) > 0 else None,
                    "expected_requirement": f"Valid compliance under APH {doc.document_type} norms.",
                    "observed_value": inc,
                    "suggested_action": f"Officer must review '{doc.document_name}' and seek institutional clarification if required.",
                    "is_provisional": False,
                    "source_reference": "AICTE APH 2024-2027"
                })

    # --- Step 3. Route-Specific Procedural Rules ---
    # Preliminary deficiency count from document scrutiny
    prelim_deficiencies = sum(1 for f in findings if f["severity"] == "DEFICIENCY")

    if route == ROUTE_NEW_PROGRAMME:
        # Mandatory EVC for New Programme / Level per Chapter II Section 2.3
        findings.append({
            "rule_id": "APH-2024-CH2-EVC-MANDATE",
            "document_type": "PROCEDURE",
            "document_id": None,
            "source_document": None,
            "page_number": None,
            "severity": "INFO",
            "category": "PROCEDURAL_REQUIREMENT",
            "description": "Per AICTE APH 2024-2027 Chapter II Section 2.3, introduction of a New Programme/Level mandatorily requires on-site physical/virtual verification by an Expert Visit Committee (EVC).",
            "evidence_quote": None,
            "expected_requirement": "Mandatory Expert Visit Committee (EVC) verification prior to granting approval for New Programme / Level.",
            "observed_value": f"Application Type: '{app.application_type}' requires EVC verification.",
            "suggested_action": "Schedule EVC visit upon clearance of primary scrutiny findings.",
            "is_provisional": False,
            "source_reference": "AICTE APH 2024-2027 Ch. II Section 2.3"
        })

    elif route == ROUTE_EOA:
        # EoA Inspection Risk Check: Do not treat every EoA as automatically exempt from inspection
        if prelim_deficiencies > 0:
            findings.append({
                "rule_id": "APH-2024-CH2-EOA-INSPECTION",
                "document_type": "PROCEDURE",
                "document_id": None,
                "source_document": None,
                "page_number": None,
                "severity": "WARNING",
                "category": "PROCEDURAL_REQUIREMENT",
                "description": (
                    f"Per AICTE APH 2024-2027 Chapter II Section 2.5, Extension of Approval (EoA) cases with outstanding "
                    f"regulatory, safety, or faculty deficiencies ({prelim_deficiencies} identified) are liable for physical/virtual "
                    "Expert Visit Committee (EVC) verification or Standing Hearing Committee (SHC) review."
                ),
                "evidence_quote": None,
                "expected_requirement": "Zero unresolved critical deficiencies for expedited desk approval under self-disclosure norms.",
                "observed_value": f"{prelim_deficiencies} active deficiency/deficiencies detected during scrutiny.",
                "suggested_action": "Regional Officer must seek rectification or recommend the case for surprise/deficiency-triggered EVC audit.",
                "is_provisional": False,
                "source_reference": "AICTE APH 2024-2027 Ch. II Section 2.5 (Inspection and Scrutiny of Running Institutions)"
            })
        else:
            findings.append({
                "rule_id": "APH-2024-CH2-EOA-DESK",
                "document_type": "PROCEDURE",
                "document_id": None,
                "source_document": None,
                "page_number": None,
                "severity": "INFO",
                "category": "PROCEDURAL_REQUIREMENT",
                "description": "Routine Extension of Approval qualifies for desk clearance based on self-disclosure, subject to 5-10% post-approval random sample EVC audit under APH 2024-2027.",
                "evidence_quote": None,
                "expected_requirement": "Annual self-disclosure verification.",
                "observed_value": "No critical deficiencies identified in submitted documentation.",
                "suggested_action": "Proceed with standard desk scrutiny clearance.",
                "is_provisional": False,
                "source_reference": "AICTE APH 2024-2027 Ch. II Section 2.1"
            })

    # --- Step 4. Determine Scrutiny Run Status & Deficiencies ---
    final_deficiency_count = sum(1 for f in findings if f["severity"] == "DEFICIENCY")
    status = "DEFICIENCIES_FOUND" if final_deficiency_count > 0 else "PASSED"

    summary_text = (
        f"AICTE APH 2024-2027 Scrutiny ({route}): Evaluated {len(uploaded_docs)} document(s). "
        f"Detected {len(missing_docs)} missing mandatory document(s) and {len(findings)} total finding(s) "
        f"({final_deficiency_count} deficiency/deficiencies). Status: {status}."
    )

    # --- Step 5. Persist ScrutinyRun ---
    run = ScrutinyRun(
        application_id=application_id,
        run_type=run_type,
        conducted_by=actor_email,
        status=status,
        summary=summary_text,
        missing_docs=json.dumps(missing_docs),
        rule_results=json.dumps({
            "total_findings": len(findings),
            "deficiencies": final_deficiency_count,
            "warnings": sum(1 for f in findings if f["severity"] == "WARNING"),
            "missing_count": len(missing_docs),
            "total_mandatory": len(req_docs),
            "requirements_checklist": requirements_checklist,
            "uploaded_docs_count": len(uploaded_docs),
            "route": route
        }),
        ai_assisted=ai_assisted,
        model_provider=model_provider,
        model_name=model_name,
        ruleset_version=RULESET_VERSION,
        created_at=datetime.utcnow()
    )
    db.add(run)
    db.flush()

    # --- Step 5b. Clean up older PENDING findings for this application ---
    db.query(ScrutinyFinding).filter(
        ScrutinyFinding.application_id == application_id,
        ScrutinyFinding.officer_disposition == "PENDING"
    ).delete(synchronize_session=False)

    # --- Step 6. Persist ScrutinyFindings ---
    persisted_findings: List[ScrutinyFinding] = []
    for f in findings:
        item = ScrutinyFinding(
            scrutiny_run_id=run.id,
            application_id=application_id,
            document_id=f.get("document_id"),
            rule_id=f["rule_id"],
            document_type=f["document_type"],
            severity=f["severity"],
            category=f["category"],
            description=f["description"],
            evidence_quote=f.get("evidence_quote"),
            source_document=f.get("source_document"),
            page_number=f.get("page_number"),
            expected_requirement=f.get("expected_requirement"),
            observed_value=f.get("observed_value"),
            suggested_action=f.get("suggested_action"),
            is_provisional=f.get("is_provisional", False),
            source_reference=f.get("source_reference"),
            officer_disposition="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(item)
        persisted_findings.append(item)

    # Update application deficiency count
    app.deficiency_count = final_deficiency_count
    db.commit()
    db.refresh(run)

    return {
        "scrutiny_run": {
            "id": run.id,
            "application_id": run.application_id,
            "run_type": run.run_type,
            "conducted_by": run.conducted_by,
            "status": run.status,
            "summary": run.summary,
            "missing_docs": missing_docs,
            "ai_assisted": run.ai_assisted,
            "model_provider": run.model_provider,
            "model_name": run.model_name,
            "ruleset_version": run.ruleset_version,
            "created_at": run.created_at.isoformat()
        },
        "findings": [
            {
                "id": pf.id,
                "rule_id": pf.rule_id,
                "document_type": pf.document_type,
                "document_id": pf.document_id,
                "source_document": pf.source_document,
                "page_number": pf.page_number,
                "severity": pf.severity,
                "category": pf.category,
                "description": pf.description,
                "evidence_quote": pf.evidence_quote,
                "expected_requirement": pf.expected_requirement,
                "observed_value": pf.observed_value,
                "suggested_action": pf.suggested_action,
                "is_provisional": pf.is_provisional,
                "source_reference": pf.source_reference,
                "officer_disposition": pf.officer_disposition,
                "disposition_notes": pf.disposition_notes,
                "disposed_by": pf.disposed_by,
                "disposed_at": pf.disposed_at.isoformat() if pf.disposed_at else None
            }
            for pf in persisted_findings
        ],
        "deficiency_count": final_deficiency_count,
        "disclaimer": "AI/Automated scrutiny output is assistive only; authorized AICTE officials retain statutory authority."
    }
