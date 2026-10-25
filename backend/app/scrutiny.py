import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from .models import Application, Document, ScrutinyRun, ScrutinyFinding
from .ai_service import review_document


# --- AICTE Approval Process Handbook (APH 2024-2027) Regulatory Definitions ---

ROUTE_EOA = "Extension of Approval"
ROUTE_NEW_PROGRAMME = "New Programme / Level"

MANDATORY_DOCUMENTS_BY_ROUTE: Dict[str, List[Dict[str, str]]] = {
    ROUTE_EOA: [
        {"type": "EOA_SELF_DISCLOSURE", "name": "Annual Self-Disclosure / Undertaking", "rule": "APH-2024-CH2-S2.1"},
        {"type": "PREVIOUS_APPROVAL", "name": "AICTE EoA Letter of Preceding Academic Year", "rule": "APH-2024-CH2-S2.2"},
        {"type": "BUILDING_SAFETY_FIRE_NOC", "name": "Fire & Life Safety Certificate / NOC", "rule": "APH-2024-CH2-FIRE"},
        {"type": "FACULTY_LIST", "name": "Faculty Cadre & Salary Compliance Roster", "rule": "APH-2024-CH2-FACULTY"},
        {"type": "ANTI_RAGGING_AFFIDAVIT", "name": "Mandatory Anti-Ragging Undertaking", "rule": "APH-2024-ANNEX-RAGGING"}
    ],
    ROUTE_NEW_PROGRAMME: [
        {"type": "LAND_OWNERSHIP_DEED", "name": "Land Title Deed / Registered Lease (>= 30 Years)", "rule": "APH-2024-CH2-LAND"},
        {"type": "BUILDING_PLAN_OCCUPANCY", "name": "Approved Building Plan & Occupancy Certificate", "rule": "APH-2024-CH2-BUILDING"},
        {"type": "STATE_GOVT_NOC", "name": "No Objection Certificate (NOC) from State Government", "rule": "APH-2024-CH2-STATE-NOC"},
        {"type": "AFFILIATING_UNIVERSITY_NOC", "name": "NOC / Affiliation Consent from University", "rule": "APH-2024-CH2-AFFILIATION"},
        {"type": "EQUIPMENT_LAB_LIST", "name": "Curriculum-aligned Laboratory Equipment Invoices", "rule": "APH-2024-CH2-LABS"},
        {"type": "FACULTY_APPOINTMENT_PLAN", "name": "Core Faculty Recruitment & Appointment Plan", "rule": "APH-2024-CH2-FACULTY-PLAN"}
    ]
}


def normalize_application_route(app_type: str) -> str:
    """Normalizes variations of application type strings to official APH routes."""
    s = app_type.lower()
    if "new" in s or "programme" in s or "level" in s or "course" in s:
        return ROUTE_NEW_PROGRAMME
    return ROUTE_EOA


async def execute_scrutiny_pipeline(
    application_id: int,
    db: Session,
    actor_email: str,
    run_type: str = "INITIAL"
) -> Dict[str, Any]:
    """
    Executes end-to-end regulatory scrutiny:
    1. Checks mandatory documents per APH 2024-2027 route rules.
    2. Runs deterministic checks against document texts and form metadata.
    3. Runs AI / LLM scrutiny analysis (or deterministic fallback) on attached documents.
    4. Persists ScrutinyRun and ScrutinyFinding records in database.
    5. Updates application deficiency count.
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
        uploaded_by_type.setdefault(d.document_type.upper(), []).append(d)

    findings: List[Dict[str, Any]] = []
    missing_docs: List[str] = []

    # 1. Deterministic check: Missing Mandatory Documents
    for req in req_docs:
        doc_type = req["type"]
        matching = uploaded_by_type.get(doc_type, [])
        # Check alias if general lease or general noc
        if not matching:
            if "LEASE" in doc_type or "LAND" in doc_type:
                matching = uploaded_by_type.get("LEASE_DEED", [])
            elif "FIRE" in doc_type:
                matching = uploaded_by_type.get("FIRE_NOC", [])

        if not matching:
            missing_docs.append(req["name"])
            findings.append({
                "rule_id": req["rule"],
                "document_type": req["type"],
                "severity": "DEFICIENCY",
                "category": "MISSING_DOCUMENT",
                "description": f"Mandatory regulatory document '{req['name']}' ({req['type']}) is missing from institutional submission.",
                "evidence_quote": None,
                "suggested_action": f"Applicant institution must upload a verified copy of {req['name']} before case can advance."
            })

    # 2. Scrutiny of Uploaded Documents (Text Analysis & AI Assist)
    ai_assisted = False
    for doc in uploaded_docs:
        text = doc.extracted_text or ""
        doc_type_upper = doc.document_type.upper()

        # Run AI service review
        ai_res = await review_document(
            document_name=doc.document_name,
            document_type=doc.document_type,
            text=text
        )
        if ai_res.get("mode") == "real_llm":
            ai_assisted = True

        # Cache AI summary and confidence on document record
        doc.ai_summary = ai_res.get("summary")
        doc.ai_findings = json.dumps(ai_res)
        doc.ai_confidence = float(ai_res.get("confidence_score", 0.9))

        # Integrate AI / Deterministic Inconsistencies into Scrutiny Findings
        for inc in ai_res.get("potential_inconsistencies", []):
            if "no immediate discrepancies" in inc.lower():
                continue
            severity = "DEFICIENCY" if ("mandates" in inc.lower() or "30" in inc or "missing" in inc.lower()) else "WARNING"
            findings.append({
                "rule_id": f"APH-DOC-{doc_type_upper[:10]}",
                "document_type": doc.document_type,
                "severity": severity,
                "category": "REGULATORY_NON_COMPLIANCE" if severity == "DEFICIENCY" else "INCONSISTENCY",
                "description": f"[{doc.document_name}] {inc}",
                "evidence_quote": text[:200] if len(text) > 0 else None,
                "suggested_action": f"Officer must review '{doc.document_name}' and seek institutional clarification if required."
            })

    # Route-specific deterministic checks
    if route == ROUTE_NEW_PROGRAMME:
        # Check mandatory requirement for EVC
        findings.append({
            "rule_id": "APH-2024-CH2-EVC-MANDATE",
            "document_type": "PROCEDURE",
            "severity": "INFO",
            "category": "PROCEDURAL_REQUIREMENT",
            "description": "Per AICTE APH 2024-2027 Chapter II Section 2.3, introduction of a New Programme/Level mandatorily requires on-site physical/virtual verification by an Expert Visit Committee (EVC).",
            "evidence_quote": None,
            "suggested_action": "Schedule EVC visit upon clearance of primary scrutiny findings."
        })

    # Determine Scrutiny Run Status
    deficiency_count = sum(1 for f in findings if f["severity"] == "DEFICIENCY")
    status = "DEFICIENCIES_FOUND" if deficiency_count > 0 else "PASSED"

    summary_text = (
        f"AICTE APH 2024-2027 Scrutiny ({route}): Evaluated {len(uploaded_docs)} document(s). "
        f"Detected {len(missing_docs)} missing mandatory document(s) and {len(findings)} total finding(s) "
        f"({deficiency_count} deficiency/deficiencies). Status: {status}."
    )

    # Persist ScrutinyRun
    run = ScrutinyRun(
        application_id=application_id,
        run_type=run_type,
        conducted_by=actor_email,
        status=status,
        summary=summary_text,
        missing_docs=json.dumps(missing_docs),
        rule_results=json.dumps({"total_findings": len(findings), "deficiencies": deficiency_count}),
        ai_assisted=ai_assisted,
        created_at=datetime.utcnow()
    )
    db.add(run)
    db.flush()

    # Persist ScrutinyFindings
    persisted_findings = []
    for f in findings:
        item = ScrutinyFinding(
            scrutiny_run_id=run.id,
            application_id=application_id,
            rule_id=f["rule_id"],
            document_type=f["document_type"],
            severity=f["severity"],
            category=f["category"],
            description=f["description"],
            evidence_quote=f.get("evidence_quote"),
            suggested_action=f.get("suggested_action"),
            officer_disposition="PENDING",
            created_at=datetime.utcnow()
        )
        db.add(item)
        persisted_findings.append(item)

    # Update application deficiency count
    app.deficiency_count = deficiency_count
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
            "created_at": run.created_at.isoformat()
        },
        "findings": [
            {
                "id": pf.id,
                "rule_id": pf.rule_id,
                "document_type": pf.document_type,
                "severity": pf.severity,
                "category": pf.category,
                "description": pf.description,
                "evidence_quote": pf.evidence_quote,
                "suggested_action": pf.suggested_action,
                "officer_disposition": pf.officer_disposition
            }
            for pf in persisted_findings
        ],
        "deficiency_count": deficiency_count,
        "disclaimer": "AI/Automated scrutiny output is assistive only; authorized AICTE officials retain statutory authority."
    }
