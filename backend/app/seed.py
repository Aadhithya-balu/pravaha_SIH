from datetime import date, timedelta, datetime
import hashlib, secrets
from sqlalchemy.orm import Session
from .models import User, Institution, Application, AuditEvent, Document, EVCVisit, ComplianceItem, Alert


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310000)
    return salt.hex() + ":" + digest.hex()


def seed_database(db: Session):
    if db.query(User).count() > 0:
        return

    # 1. Seed Users for all 5 roles
    default_pass = password_hash("DemoPass123!")
    users = [
        User(
            email="officer@demo.local",
            name="Dr. Rajesh Verma",
            password_hash=default_pass,
            role="officer",
            region="Northern",
            designation="Regional Officer (RO-North)"
        ),
        User(
            email="college@demo.local",
            name="Prof. Anand Deshmukh",
            password_hash=default_pass,
            role="institution",
            institution_name="ABC Engineering College",
            region="Northern",
            designation="Principal & Authorized Signatory"
        ),
        User(
            email="bureau@demo.local",
            name="Dr. Sunita Rao",
            password_hash=default_pass,
            role="bureau",
            region="HQ",
            designation="Advisor & Bureau Head (Approval Bureau)"
        ),
        User(
            email="evc@demo.local",
            name="Prof. S. Ramanujan",
            password_hash=default_pass,
            role="evc_expert",
            region="Northern",
            designation="Senior EVC Committee Chairperson"
        ),
        User(
            email="admin@demo.local",
            name="AICTE System Administrator",
            password_hash=default_pass,
            role="admin",
            region="HQ",
            designation="Lead IT Systems Administrator"
        )
    ]
    db.add_all(users)
    db.flush()

    user_map = {u.role: u for u in users}

    # 2. Seed Institutions
    institutions = [
        Institution(
            code="1-10023451",
            name="ABC Engineering College",
            region="Northern",
            state="Uttar Pradesh",
            address="Sector 62, Institutional Area, Noida 201309",
            contact_email="principal@abccollege.demo.local",
            contact_phone="+91-120-2400100",
            institution_type="Engineering & Technology"
        ),
        Institution(
            code="1-20098712",
            name="Sunrise Institute of Technology",
            region="Western",
            state="Maharashtra",
            address="Plot 14, Hinjewadi Phase 1, Pune 411057",
            contact_email="director@sunrise.demo.local",
            contact_phone="+91-20-6600200",
            institution_type="Engineering & Technology"
        ),
        Institution(
            code="1-30045678",
            name="Greenfield Polytechnic",
            region="Southern",
            state="Karnataka",
            address="Ring Road, Electronic City, Bengaluru 560100",
            contact_email="admin@greenfieldpoly.demo.local",
            contact_phone="+91-80-4100300",
            institution_type="Polytechnic / Diploma"
        ),
        Institution(
            code="1-40012399",
            name="Apex School of Management & Research",
            region="Central",
            state="Madhya Pradesh",
            address="Bypass Road, Arera Hills, Bhopal 462011",
            contact_email="dean@apexmgmt.demo.local",
            contact_phone="+91-755-2550400",
            institution_type="Management"
        ),
        Institution(
            code="1-50078901",
            name="Himalayan Institute of Pharmaceutical Sciences",
            region="Northern",
            state="Uttarakhand",
            address="Chakrata Road, Dehradun 248007",
            contact_email="principal@himalayanpharma.demo.local",
            contact_phone="+91-135-2770500",
            institution_type="Pharmacy"
        )
    ]
    db.add_all(institutions)
    db.flush()

    # 3. Seed Applications with diverse stages
    today = date.today()
    apps = [
        Application(
            reference="AICTE-2026-1001",
            institution_name="ABC Engineering College",
            application_type="Extension of Approval",
            current_stage="SCRUTINY",
            status="IN_PROGRESS",
            assigned_to="Regional Officer",
            assigned_role="officer",
            region="Northern",
            submission_date=today - timedelta(days=10),
            due_date=today + timedelta(days=5),
            notes="Annual Extension of Approval for AY 2026-27 with existing intake of 420 seats across 5 B.Tech programs.",
            deficiency_count=0,
            academic_year="2026-2027",
            created_by=user_map["institution"].id
        ),
        Application(
            reference="AICTE-2026-1002",
            institution_name="Sunrise Institute of Technology",
            application_type="New Course",
            current_stage="EVC_SCHEDULED",
            status="IN_PROGRESS",
            assigned_to="EVC Inspection Panel",
            assigned_role="evc_expert",
            region="Western",
            submission_date=today - timedelta(days=15),
            due_date=today + timedelta(days=3),
            notes="Application for introducing B.Tech in Artificial Intelligence & Machine Learning (60 seats). Laboratory equipment inspection required.",
            deficiency_count=1,
            academic_year="2026-2027",
            created_by=user_map["institution"].id
        ),
        Application(
            reference="AICTE-2026-1003",
            institution_name="Greenfield Polytechnic",
            application_type="Compliance Submission",
            current_stage="COMPLIANCE_PENDING",
            status="OVERDUE",
            assigned_to="Institution",
            assigned_role="institution",
            region="Southern",
            submission_date=today - timedelta(days=25),
            due_date=today - timedelta(days=3),
            notes="Mandatory undertaking submission regarding faculty cadre ratio and biometric attendance system implementation.",
            deficiency_count=2,
            academic_year="2026-2027",
            created_by=user_map["institution"].id
        ),
        Application(
            reference="AICTE-2026-1004",
            institution_name="Apex School of Management & Research",
            application_type="New Institution",
            current_stage="SAC_SHC_REVIEW",
            status="IN_PROGRESS",
            assigned_to="Bureau Officer",
            assigned_role="bureau",
            region="Central",
            submission_date=today - timedelta(days=30),
            due_date=today + timedelta(days=8),
            notes="New standalone management institution seeking approval for 120 MBA seats. EVC report completed; under Standing Hearing Committee examination.",
            deficiency_count=0,
            academic_year="2026-2027",
            created_by=user_map["admin"].id
        ),
        Application(
            reference="AICTE-2026-1005",
            institution_name="Himalayan Institute of Pharmaceutical Sciences",
            application_type="Institutional Change",
            current_stage="RETURNED_FOR_CLARIFICATION",
            status="RETURNED",
            assigned_to="Institution",
            assigned_role="institution",
            region="Northern",
            submission_date=today - timedelta(days=18),
            due_date=today + timedelta(days=4),
            notes="Application returned due to missing registered land conversion order from the District Revenue Authority.",
            deficiency_count=1,
            academic_year="2026-2027",
            created_by=user_map["officer"].id
        ),
        Application(
            reference="AICTE-2026-1006",
            institution_name="ABC Engineering College",
            application_type="Extension of Approval",
            current_stage="COMPLETED",
            status="COMPLETED",
            assigned_to="Closed",
            assigned_role="officer",
            region="Northern",
            submission_date=today - timedelta(days=45),
            due_date=today - timedelta(days=15),
            notes="Prior year approval cycle successfully completed. Formal Approval Order AICTE/NRO/2026/EOA-1006 issued.",
            deficiency_count=0,
            academic_year="2025-2026",
            created_by=user_map["institution"].id
        )
    ]
    db.add_all(apps)
    db.flush()

    # 4. Seed Audit Events
    audit_events = [
        AuditEvent(
            application_id=apps[0].id,
            actor="college@demo.local",
            actor_role="institution",
            action="SUBMITTED",
            from_stage=None,
            to_stage="SCRUTINY",
            details="Initial online application submitted with statutory fees and self-disclosure documents."
        ),
        AuditEvent(
            application_id=apps[0].id,
            actor="officer@demo.local",
            actor_role="officer",
            action="START_SCRUTINY",
            from_stage="SUBMITTED",
            to_stage="SCRUTINY",
            details="Assigned to Regional Officer for primary document verification and land norms scrutiny."
        ),
        AuditEvent(
            application_id=apps[1].id,
            actor="officer@demo.local",
            actor_role="officer",
            action="SEND_EVC",
            from_stage="SCRUTINY",
            to_stage="EVC_PENDING",
            details="Scrutiny passed. Referred to Expert Visiting Committee for physical infrastructure verification."
        ),
        AuditEvent(
            application_id=apps[1].id,
            actor="officer@demo.local",
            actor_role="officer",
            action="SCHEDULE_EVC",
            from_stage="EVC_PENDING",
            to_stage="EVC_SCHEDULED",
            details="EVC visit scheduled for inspection of AI/ML computational laboratories and server facilities."
        ),
        AuditEvent(
            application_id=apps[4].id,
            actor="officer@demo.local",
            actor_role="officer",
            action="RETURN",
            from_stage="SCRUTINY",
            to_stage="RETURNED_FOR_CLARIFICATION",
            details="Returned: Revenue department land conversion order (CLU) is incomplete; provide attested copy within 7 days."
        )
    ]
    db.add_all(audit_events)

    # 5. Seed Documents
    sample_lease_text = (
        "REGISTERED LEASE DEED\n"
        "This Deed of Lease is executed on 15 March 2020 by Shri Ramakant Sharma (Lessor) "
        "in favour of Shri Krishna Educational Society / ABC Engineering College (Lessee).\n"
        "Plot / Khasra No. 412/1 and 413, measuring 7.50 Acres situated at Sector 62, Noida.\n"
        "The lease tenure is for a term of 33 Years commencing 01 April 2020 and valid until 31 March 2053.\n"
        "The land shall be irrevocably utilised solely for technical educational institutions approved by AICTE.\n"
        "Registered at Sub-Registrar Office Noida under Deed No. 4589/2020 Book No. 1."
    )
    sample_fire_text = (
        "GOVERNMENT OF UTTAR PRADESH — CHIEF FIRE OFFICER CLEARANCE\n"
        "No. CFO/GBN/NOC/2025/112 Date: 12 August 2025.\n"
        "Fire Safety Certificate issued for ABC Engineering College, Sector 62, Noida.\n"
        "The premises comprising Academic Block A (G+4) and Block B (G+3) have been inspected "
        "and found compliant with National Building Code (NBC) 2016 Part 4 norms.\n"
        "Installed systems: Wet risers, automatic fire alarms, smoke detectors, 50,000L underground tank.\n"
        "Certificate valid for a period of 1 year, expiring on 11 August 2026."
    )
    documents = [
        Document(
            application_id=apps[0].id,
            institution_name="ABC Engineering College",
            document_name="Registered_Land_Lease_Deed_2020.pdf",
            document_type="LEASE_DEED",
            file_size=2450000,
            mime_type="application/pdf",
            uploaded_by="college@demo.local",
            extracted_text=sample_lease_text,
            ai_summary="Registered lease deed of 7.50 Acres for 33 years in favour of ABC Engineering College.",
            ai_confidence=0.92,
            review_status="ACCEPTED",
            reviewer_notes="Verified: 33 years tenure satisfies AICTE minimum 30 years norm.",
            reviewed_by="officer@demo.local",
            reviewed_at=datetime.utcnow() - timedelta(days=2)
        ),
        Document(
            application_id=apps[0].id,
            institution_name="ABC Engineering College",
            document_name="Fire_Safety_NOC_2025_26.pdf",
            document_type="FIRE_NOC",
            file_size=1200000,
            mime_type="application/pdf",
            uploaded_by="college@demo.local",
            extracted_text=sample_fire_text,
            ai_summary="Fire safety certificate valid up to 11 August 2026 issued by CFO Gautam Buddha Nagar.",
            ai_confidence=0.95,
            review_status="PENDING",
            reviewer_notes=None
        )
    ]
    db.add_all(documents)

    # 6. Seed EVC Visits
    evc_visits = [
        EVCVisit(
            application_id=apps[1].id,
            institution_name="Sunrise Institute of Technology",
            committee_members="Prof. S. Ramanujan (Chairperson, IIT Bombay nominee), Dr. Kavita Sharma (Expert, VJTI Mumbai), Sh. Alok Nath (AICTE Regional Officer)",
            scheduled_date=today + timedelta(days=3),
            visit_mode="PHYSICAL",
            status="SCHEDULED",
            assigned_by="officer@demo.local"
        ),
        EVCVisit(
            application_id=apps[3].id,
            institution_name="Apex School of Management & Research",
            committee_members="Dr. Arvind Mehrotra (IIM Indore), Prof. Meenakshi Sundaram (MANIT Bhopal)",
            scheduled_date=today - timedelta(days=5),
            visit_mode="PHYSICAL",
            status="COMPLETED",
            report_summary="Campus infrastructure verified. Digital library, auditorium, and 4 lecture halls meet APH norms. Faculty recruitment in progress.",
            recommendations="Recommended for approval of 120 MBA seats subject to submission of faculty appointment orders.",
            assigned_by="officer@demo.local"
        )
    ]
    db.add_all(evc_visits)

    # 7. Seed Compliance Items & Expiry Tracker
    compliance_items = [
        ComplianceItem(
            institution_name="ABC Engineering College",
            application_id=apps[0].id,
            item_type="LEASE_DOCUMENT",
            description="Submission of Registered Land Lease Deed with validity extending beyond 30 years.",
            due_date=today + timedelta(days=12),
            status="VERIFIED",
            submission_evidence="Registered Deed No. 4589/2020 submitted and verified against Sub-Registrar records.",
            submitted_at=datetime.utcnow() - timedelta(days=3),
            verified_by="officer@demo.local",
            verified_at=datetime.utcnow() - timedelta(days=2),
            officer_comments="Confirmed valid until 31 March 2053 (33 years tenure)."
        ),
        ComplianceItem(
            institution_name="Sunrise Institute of Technology",
            application_id=apps[1].id,
            item_type="UNDERTAKING",
            description="Affidavit regarding implementation of 7th CPC salary scales for newly appointed AI/ML faculty.",
            due_date=today + timedelta(days=6),
            status="SUBMITTED",
            submission_evidence="Notarised affidavit on Rs. 100 non-judicial stamp paper uploaded with Governing Body resolution dated 10 Oct 2026.",
            submitted_at=datetime.utcnow() - timedelta(days=1),
            verified_by=None,
            officer_comments=None
        ),
        ComplianceItem(
            institution_name="Greenfield Polytechnic",
            application_id=apps[2].id,
            item_type="FIRE_SAFETY_NOC",
            description="Renewal of annual Fire & Life Safety clearance certificate from State Fire Services Directorate.",
            due_date=today - timedelta(days=3),
            status="OVERDUE",
            submission_evidence=None,
            submitted_at=None,
            verified_by=None,
            officer_comments="Past due date. Escalated to Regional Officer for immediate statutory notice."
        ),
        ComplianceItem(
            institution_name="Himalayan Institute of Pharmaceutical Sciences",
            application_id=apps[4].id,
            item_type="LAND_CONVERSION",
            description="Change of Land Use (CLU) order from District Revenue Collector for educational establishment.",
            due_date=today + timedelta(days=15),
            status="PENDING",
            submission_evidence=None,
            submitted_at=None,
            verified_by=None,
            officer_comments=None
        )
    ]
    db.add_all(compliance_items)

    # 8. Seed Alerts
    alerts = [
        Alert(
            title="EVC Inspection Scheduled: Sunrise Institute",
            message="Expert committee visit scheduled for 27 Oct 2026. Chairperson: Prof. S. Ramanujan.",
            severity="INFO",
            target_role="evc_expert",
            institution_name="Sunrise Institute of Technology",
            application_id=apps[1].id,
            trigger_type="EVC_REMINDER"
        ),
        Alert(
            title="Compliance Overdue: Greenfield Polytechnic",
            message="Annual Fire Safety NOC submission is overdue by 3 days. Statutory warning triggered.",
            severity="CRITICAL",
            target_role="officer",
            institution_name="Greenfield Polytechnic",
            application_id=apps[2].id,
            trigger_type="COMPLIANCE_OVERDUE"
        ),
        Alert(
            title="Clarification Response Awaited: AICTE-2026-1005",
            message="Himalayan Institute must resubmit attested Land Conversion order to proceed with scrutiny.",
            severity="WARNING",
            target_role="institution",
            institution_name="Himalayan Institute of Pharmaceutical Sciences",
            application_id=apps[4].id,
            trigger_type="CLARIFICATION_PENDING"
        ),
        Alert(
            title="Scrutiny Deadline Approaching: AICTE-2026-1001",
            message="ABC Engineering College Extension of Approval scrutiny due in 5 days.",
            severity="WARNING",
            target_role="officer",
            institution_name="ABC Engineering College",
            application_id=apps[0].id,
            trigger_type="DEADLINE_APPROACHING"
        )
    ]
    db.add_all(alerts)
    db.commit()
