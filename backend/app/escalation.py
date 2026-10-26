from datetime import date, timedelta, datetime
from sqlalchemy.orm import Session
from .models import Application, ComplianceItem, EVCVisit, Alert


def run_escalation_engine(db: Session) -> dict:
    """
    Evaluates regulatory deadlines across applications, compliance requirements,
    and EVC inspections. Automatically triggers alerts and status updates.
    """
    today = date.today()
    created_alerts = 0
    updated_records = 0

    # 1. Check Applications
    apps = db.query(Application).filter(Application.status.in_(["IN_PROGRESS", "RETURNED", "OVERDUE"])).all()
    for a in apps:
        if a.due_date:
            days_diff = (a.due_date - today).days

            # Overdue check
            if days_diff < 0 and a.status != "COMPLETED":
                if a.status != "OVERDUE":
                    a.status = "OVERDUE"
                    updated_records += 1

                # Check duplicate alert for unresolved overdue event
                exists = db.query(Alert).filter(
                    Alert.application_id == a.id,
                    Alert.trigger_type == "DEADLINE_OVERDUE"
                ).first()

                if not exists:
                    db.add(Alert(
                        title=f"Application Overdue: {a.reference}",
                        message=f"{a.institution_name} ({a.application_type}) exceeded deadline on {a.due_date}. Immediate action required.",
                        severity="HIGH",
                        target_role="officer",
                        institution_name=a.institution_name,
                        application_id=a.id,
                        trigger_type="DEADLINE_OVERDUE"
                    ))
                    created_alerts += 1

            # Approaching deadline check (1-7 days remaining)
            elif 0 <= days_diff <= 7:
                exists = db.query(Alert).filter(
                    Alert.application_id == a.id,
                    Alert.trigger_type == "DEADLINE_APPROACHING"
                ).first()

                if not exists:
                    db.add(Alert(
                        title=f"Deadline Approaching: {a.reference}",
                        message=f"{a.institution_name} stage '{a.current_stage}' due in {days_diff} days ({a.due_date}).",
                        severity="WARNING",
                        target_role="officer",
                        institution_name=a.institution_name,
                        application_id=a.id,
                        trigger_type="DEADLINE_APPROACHING"
                    ))
                    created_alerts += 1

        # Check returned applications awaiting clarification
        if a.status == "RETURNED":
            exists = db.query(Alert).filter(
                Alert.application_id == a.id,
                Alert.trigger_type == "CLARIFICATION_PENDING"
            ).first()
            if not exists:
                db.add(Alert(
                    title=f"Clarification Response Awaited: {a.reference}",
                    message=f"Application {a.reference} requires institutional clarification before scrutiny can proceed.",
                    severity="WARNING",
                    target_role="institution",
                    institution_name=a.institution_name,
                    application_id=a.id,
                    trigger_type="CLARIFICATION_PENDING"
                ))
                created_alerts += 1

    # 2. Check Compliance Items & Undertakings
    compliance_items = db.query(ComplianceItem).filter(ComplianceItem.status.in_(["PENDING", "OVERDUE"])).all()
    for c in compliance_items:
        days_diff = (c.due_date - today).days

        if days_diff < 0 and c.status != "VERIFIED":
            if c.status != "OVERDUE":
                c.status = "OVERDUE"
                updated_records += 1

            exists = db.query(Alert).filter(
                Alert.institution_name == c.institution_name,
                Alert.trigger_type == "COMPLIANCE_OVERDUE",
                Alert.title == f"Compliance Overdue: {c.item_type}"
            ).first()

            if not exists:
                db.add(Alert(
                    title=f"Compliance Overdue: {c.item_type}",
                    message=f"{c.institution_name} failed to submit required '{c.description}' before due date {c.due_date}.",
                    severity="CRITICAL",
                    target_role="officer",
                    institution_name=c.institution_name,
                    application_id=c.application_id,
                    trigger_type="COMPLIANCE_OVERDUE"
                ))
                created_alerts += 1

        elif 0 <= days_diff <= 14:
            exists = db.query(Alert).filter(
                Alert.institution_name == c.institution_name,
                Alert.trigger_type == "COMPLIANCE_DUE_SOON",
                Alert.title == f"Compliance Due Soon: {c.item_type}"
            ).first()

            if not exists:
                db.add(Alert(
                    title=f"Compliance Due Soon: {c.item_type}",
                    message=f"Submission of '{c.description}' for {c.institution_name} is due on {c.due_date}.",
                    severity="WARNING",
                    target_role="institution",
                    institution_name=c.institution_name,
                    application_id=c.application_id,
                    trigger_type="COMPLIANCE_DUE_SOON"
                ))
                created_alerts += 1

    # 3. Check EVC Visits
    visits = db.query(EVCVisit).filter(EVCVisit.status == "SCHEDULED").all()
    for v in visits:
        days_diff = (v.scheduled_date - today).days
        if 0 <= days_diff <= 5:
            exists = db.query(Alert).filter(
                Alert.application_id == v.application_id,
                Alert.trigger_type == "EVC_REMINDER"
            ).first()

            if not exists:
                db.add(Alert(
                    title=f"EVC Inspection Approaching: {v.institution_name}",
                    message=f"Committee inspection scheduled for {v.scheduled_date} ({days_diff} days left). Panel: {v.committee_members}",
                    severity="INFO",
                    target_role="evc_expert",
                    institution_name=v.institution_name,
                    application_id=v.application_id,
                    trigger_type="EVC_REMINDER"
                ))
                created_alerts += 1

    db.commit()
    return {
        "status": "success",
        "timestamp": datetime.utcnow().isoformat(),
        "created_alerts": created_alerts,
        "updated_records": updated_records,
        "evaluated_applications": len(apps),
        "evaluated_compliance": len(compliance_items),
        "evaluated_evc": len(visits)
    }
