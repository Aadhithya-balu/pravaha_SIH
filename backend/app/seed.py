from datetime import date, timedelta, datetime
import hashlib
import secrets
from sqlalchemy.orm import Session
from .models import User, Institution, Application, AuditEvent, Document, EVCVisit, ComplianceItem, Alert, RegulatoryCategory


def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 310000)
    return salt.hex() + ":" + digest.hex()


def seed_database(db: Session, force: bool = False):
    """
    Idempotent seeding of realistic synthetic demo records for SIH26262.
    Inserts required demo personas and representative application lifecycle records
    without deleting existing user records.
    """
    default_pass = password_hash("DemoPass123!")

    # 1. Primary Demo Personas (Applicant, Combined Regional Officer / Admin, EVC Expert)
    desired_users = [
        {
            "email": "officer@demo.local",
            "name": "Dr. Rajesh Verma",
            "role": "officer",
            "region": "Northern",
            "designation": "Regional Officer & Systems Administrator"
        },
        {
            "email": "college@demo.local",
            "name": "Prof. Anand Deshmukh",
            "role": "institution",
            "institution_name": "ABC Engineering College",
            "region": "Northern",
            "designation": "Principal & Authorized Signatory"
        },
        {
            "email": "evc@demo.local",
            "name": "Prof. S. Ramanujan",
            "role": "evc_expert",
            "region": "Northern",
            "designation": "Senior EVC Committee Chairperson"
        },
        {
            "email": "admin@demo.local",
            "name": "AICTE System Administrator",
            "role": "admin",
            "region": "HQ",
            "designation": "Lead IT Systems Administrator"
        },
        {
            "email": "bureau@demo.local",
            "name": "Dr. Sunita Rao",
            "role": "bureau",
            "region": "HQ",
            "designation": "Advisor & Bureau Head (Approval Bureau)"
        }
    ]

    for u_data in desired_users:
        existing_u = db.query(User).filter(User.email == u_data["email"]).first()
        if not existing_u:
            new_u = User(
                email=u_data["email"],
                name=u_data["name"],
                password_hash=default_pass,
                role=u_data["role"],
                institution_name=u_data.get("institution_name"),
                region=u_data["region"],
                designation=u_data["designation"]
            )
            db.add(new_u)
        else:
            # Update designation and metadata
            existing_u.name = u_data["name"]
            existing_u.designation = u_data["designation"]
            if u_data.get("institution_name"):
                existing_u.institution_name = u_data["institution_name"]

    db.flush()
    users = db.query(User).all()
    user_map = {u.email: u for u in users}
    role_map = {u.role: u for u in users}

    # 2. Seed Institutions
    institutions_data = [
        {
            "code": "1-10023451",
            "name": "ABC Engineering College",
            "region": "Northern",
            "state": "Uttar Pradesh",
            "address": "Sector 62, Institutional Area, Noida 201309",
            "contact_email": "principal@abccollege.demo.local",
            "contact_phone": "+91-120-2400100",
            "institution_type": "Engineering & Technology"
        },
        {
            "code": "1-20098712",
            "name": "Sunrise Institute of Technology",
            "region": "Western",
            "state": "Maharashtra",
            "address": "Plot 14, Hinjewadi Phase 1, Pune 411057",
            "contact_email": "director@sunrise.demo.local",
            "contact_phone": "+91-20-6600200",
            "institution_type": "Engineering & Technology"
        },
        {
            "code": "1-30045678",
            "name": "Greenfield Polytechnic",
            "region": "Southern",
            "state": "Karnataka",
            "address": "Ring Road, Electronic City, Bengaluru 560100",
            "contact_email": "admin@greenfieldpoly.demo.local",
            "contact_phone": "+91-80-4100300",
            "institution_type": "Polytechnic / Diploma"
        },
        {
            "code": "1-40012399",
            "name": "Apex School of Management & Research",
            "region": "Central",
            "state": "Madhya Pradesh",
            "address": "Bypass Road, Arera Hills, Bhopal 462011",
            "contact_email": "dean@apexmgmt.demo.local",
            "contact_phone": "+91-755-2550400",
            "institution_type": "Management"
        },
        {
            "code": "1-50078901",
            "name": "Himalayan Institute of Pharmaceutical Sciences",
            "region": "Northern",
            "state": "Uttarakhand",
            "address": "Chakrata Road, Dehradun 248007",
            "contact_email": "principal@himalayanpharma.demo.local",
            "contact_phone": "+91-135-2770500",
            "institution_type": "Pharmacy"
        }
    ]

    for inst in institutions_data:
        if not db.query(Institution).filter(Institution.code == inst["code"]).first():
            db.add(Institution(**inst))
    db.flush()

    # 3. Seed 8 Synthetic Application Cases Covering Full Regulatory Lifecycle
    today = date.today()
    apps_data = [
        # Case 1: Application currently under scrutiny (ABC Engineering College, EoA)
        {
            "reference": "AICTE-2026-1001",
            "institution_name": "ABC Engineering College",
            "application_type": "Extension of Approval",
            "current_stage": "SCRUTINY",
            "status": "IN_PROGRESS",
            "assigned_to": "Dr. Rajesh Verma",
            "assigned_role": "officer",
            "region": "Northern",
            "submission_date": today - timedelta(days=10),
            "due_date": today + timedelta(days=5),
            "notes": "Annual Extension of Approval for AY 2026-27 with existing intake of 420 seats across 5 B.Tech programs.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 2: Application with inspection scheduled (Sunrise Institute, New Course)
        {
            "reference": "AICTE-2026-1002",
            "institution_name": "Sunrise Institute of Technology",
            "application_type": "New Course",
            "current_stage": "EVC_SCHEDULED",
            "status": "IN_PROGRESS",
            "assigned_to": "Prof. S. Ramanujan",
            "assigned_role": "evc_expert",
            "region": "Western",
            "submission_date": today - timedelta(days=15),
            "due_date": today + timedelta(days=3),
            "notes": "Application for introducing B.Tech in Artificial Intelligence & Machine Learning (60 seats). Laboratory equipment inspection required.",
            "deficiency_count": 1,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 3: Compliance overdue (Greenfield Polytechnic)
        {
            "reference": "AICTE-2026-1003",
            "institution_name": "Greenfield Polytechnic",
            "application_type": "Compliance Submission",
            "current_stage": "COMPLIANCE_PENDING",
            "status": "OVERDUE",
            "assigned_to": "Institution",
            "assigned_role": "institution",
            "region": "Southern",
            "submission_date": today - timedelta(days=25),
            "due_date": today - timedelta(days=3),
            "notes": "Mandatory undertaking submission regarding faculty cadre ratio and biometric attendance system implementation.",
            "deficiency_count": 2,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 4: Standing Hearing Committee / Bureau review (Apex School)
        {
            "reference": "AICTE-2026-1004",
            "institution_name": "Apex School of Management & Research",
            "application_type": "New Institution",
            "current_stage": "SAC_SHC_REVIEW",
            "status": "IN_PROGRESS",
            "assigned_to": "Dr. Sunita Rao",
            "assigned_role": "bureau",
            "region": "Central",
            "submission_date": today - timedelta(days=30),
            "due_date": today + timedelta(days=8),
            "notes": "New standalone management institution seeking approval for 120 MBA seats. EVC report completed; under Standing Hearing Committee examination.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["admin@demo.local"].id
        },
        # Case 5: Application returned for clarification (Himalayan Institute)
        {
            "reference": "AICTE-2026-1005",
            "institution_name": "Himalayan Institute of Pharmaceutical Sciences",
            "application_type": "Institutional Change",
            "current_stage": "RETURNED_FOR_CLARIFICATION",
            "status": "RETURNED",
            "assigned_to": "Institution",
            "assigned_role": "institution",
            "region": "Northern",
            "submission_date": today - timedelta(days=18),
            "due_date": today + timedelta(days=4),
            "notes": "Application returned due to missing registered land conversion order from the District Revenue Authority.",
            "deficiency_count": 1,
            "academic_year": "2026-2027",
            "created_by": user_map["officer@demo.local"].id
        },
        # Case 6: Completed approval order (ABC Engineering College, Prior Cycle)
        {
            "reference": "AICTE-2026-1006",
            "institution_name": "ABC Engineering College",
            "application_type": "Extension of Approval",
            "current_stage": "COMPLETED",
            "status": "COMPLETED",
            "assigned_to": "Closed",
            "assigned_role": "officer",
            "region": "Northern",
            "submission_date": today - timedelta(days=45),
            "due_date": today - timedelta(days=15),
            "notes": "Prior year approval cycle successfully completed. Formal Approval Order AICTE/NRO/2026/EOA-1006 issued.",
            "deficiency_count": 0,
            "academic_year": "2025-2026",
            "decision_outcome": "APPROVED",
            "decision_remarks": "All statutory norms under AICTE APH verified and found compliant.",
            "decision_by": "Dr. Rajesh Verma",
            "decision_date": datetime.utcnow() - timedelta(days=15),
            "created_by": user_map["college@demo.local"].id
        },
        # Case 7: Draft application (ABC Engineering College, Draft state)
        {
            "reference": "AICTE-2026-1007",
            "institution_name": "ABC Engineering College",
            "application_type": "New Programme / Level",
            "current_stage": "DRAFT",
            "status": "DRAFT",
            "assigned_to": "Institution Draft",
            "assigned_role": "institution",
            "region": "Northern",
            "submission_date": today - timedelta(days=2),
            "due_date": today + timedelta(days=20),
            "notes": "Draft proposal for Post-Graduate M.Tech in Cyber Security & Data Privacy. Preparing land and faculty documentation.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 8: Submitted application awaiting initial scrutiny assignment
        {
            "reference": "AICTE-2026-1008",
            "institution_name": "ABC Engineering College",
            "application_type": "Extension of Approval",
            "current_stage": "SUBMITTED",
            "status": "IN_PROGRESS",
            "assigned_to": "Regional Officer Queue",
            "assigned_role": "officer",
            "region": "Northern",
            "submission_date": today - timedelta(days=1),
            "due_date": today + timedelta(days=14),
            "notes": "Fresh submission for AY 2026-27 with updated building safety and faculty undertaking documents attached.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 9: Corrected application awaiting re-scrutiny
        {
            "reference": "AICTE-2026-1009",
            "institution_name": "ABC Engineering College",
            "application_type": "Extension of Approval",
            "current_stage": "RE_SCRUTINY",
            "status": "IN_PROGRESS",
            "assigned_to": "Dr. Rajesh Verma",
            "assigned_role": "officer",
            "region": "Northern",
            "submission_date": today - timedelta(days=12),
            "due_date": today + timedelta(days=7),
            "notes": "Clarification resubmitted with attested Sub-Registrar Lease verification certificate and CFO endorsement.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        },
        # Case 10: Application awaiting EVC scheduling
        {
            "reference": "AICTE-2026-1010",
            "institution_name": "Sunrise Institute of Technology",
            "application_type": "New Course",
            "current_stage": "EVC_PENDING",
            "status": "IN_PROGRESS",
            "assigned_to": "EVC Inspection Panel",
            "assigned_role": "evc_expert",
            "region": "Western",
            "submission_date": today - timedelta(days=8),
            "due_date": today + timedelta(days=10),
            "notes": "Scrutiny cleared. Referred for Expert Visit Committee committee composition and inspection date scheduling.",
            "deficiency_count": 0,
            "academic_year": "2026-2027",
            "created_by": user_map["college@demo.local"].id
        }
    ]

    for a_data in apps_data:
        existing_a = db.query(Application).filter(Application.reference == a_data["reference"]).first()
        if not existing_a:
            db.add(Application(**a_data))
        else:
            # Sync stages and metadata
            for k, v in a_data.items():
                setattr(existing_a, k, v)
    db.flush()

    # Get application map
    apps = {a.reference: a for a in db.query(Application).all()}

    # Seed Cryptographic Tamper-Evident Audit Trail Events
    if "AICTE-2026-1001" in apps:
        app1 = apps["AICTE-2026-1001"]
        if not db.query(AuditEvent).filter(AuditEvent.application_id == app1.id).first():
            seeded_events = [
                AuditEvent(
                    application_id=app1.id,
                    actor="college@demo.local",
                    actor_role="institution",
                    action="SUBMITTED",
                    from_stage=None,
                    to_stage="SCRUTINY",
                    details="Initial online application submitted with statutory fees and self-disclosure documents."
                ),
                AuditEvent(
                    application_id=app1.id,
                    actor="officer@demo.local",
                    actor_role="officer",
                    action="START_SCRUTINY",
                    from_stage="SUBMITTED",
                    to_stage="SCRUTINY",
                    details="Assigned to Regional Officer for primary document verification and land norms scrutiny."
                )
            ]
            if "AICTE-2026-1002" in apps:
                app2 = apps["AICTE-2026-1002"]
                seeded_events.extend([
                    AuditEvent(
                        application_id=app2.id,
                        actor="officer@demo.local",
                        actor_role="officer",
                        action="SEND_EVC",
                        from_stage="SCRUTINY",
                        to_stage="EVC_PENDING",
                        details="Scrutiny passed. Referred to Expert Visiting Committee for physical infrastructure verification."
                    ),
                    AuditEvent(
                        application_id=app2.id,
                        actor="officer@demo.local",
                        actor_role="officer",
                        action="SCHEDULE_EVC",
                        from_stage="EVC_PENDING",
                        to_stage="EVC_SCHEDULED",
                        details="EVC visit scheduled for inspection of AI/ML computational laboratories and server facilities."
                    )
                ])
            if "AICTE-2026-1005" in apps:
                app5 = apps["AICTE-2026-1005"]
                seeded_events.append(
                    AuditEvent(
                        application_id=app5.id,
                        actor="officer@demo.local",
                        actor_role="officer",
                        action="RETURN",
                        from_stage="SCRUTINY",
                        to_stage="RETURNED_FOR_CLARIFICATION",
                        details="Returned: Revenue department land conversion order (CLU) is incomplete; provide attested copy within 7 days."
                    )
                )

            # Compute tamper-evident hash chain for all seeded audit events
            app_prev_hashes = {}
            for ev in seeded_events:
                prev = app_prev_hashes.get(ev.application_id, "GENESIS")
                ev.prev_hash = prev
                payload = f"{ev.application_id}|{ev.actor}|{ev.actor_role}|{ev.action}|{ev.from_stage or ''}|{ev.to_stage or ''}|{ev.details}|{ev.prev_hash}"
                ev.event_hash = hashlib.sha256(payload.encode("utf-8")).hexdigest()
                app_prev_hashes[ev.application_id] = ev.event_hash

            db.add_all(seeded_events)
            db.flush()

    # 4. Seed Documents for Cases
    sample_lease_text = (
        "REGISTERED LEASE DEED (SYNTHETIC DEMO RECORD FOR SIH26262 EVALUATION)\n"
        "This Deed of Lease is executed on 15 March 2020 by Shri Ramakant Sharma (Lessor) "
        "in favour of Shri Krishna Educational Society / ABC Engineering College (Lessee).\n"
        "Plot / Khasra No. 412/1 and 413, measuring 7.50 Acres situated at Sector 62, Institutional Area, Noida, Uttar Pradesh.\n"
        "The lease tenure is for a term of 33 Years commencing 01 April 2020 and valid until 31 March 2053.\n"
        "The land shall be irrevocably utilised solely for technical educational institutions approved by AICTE.\n"
        "Registered at Sub-Registrar Office Noida under Deed No. 4589/2020 Book No. 1 Volume 82.\n"
        "Notice: This is synthetic institutional data for SIH evaluation."
    )
    sample_fire_text = (
        "GOVERNMENT OF UTTAR PRADESH — CHIEF FIRE OFFICER CLEARANCE (DEMO RECORD)\n"
        "No. CFO/GBN/NOC/2025/112 Date: 12 August 2025.\n"
        "Fire Safety Certificate issued for ABC Engineering College, Sector 62, Noida.\n"
        "The premises comprising Academic Block A (G+4) and Block B (G+3) have been inspected "
        "and found compliant with National Building Code (NBC) 2016 Part 4 norms.\n"
        "Installed systems: Wet risers, automatic fire alarms, smoke detectors, 50,000L underground tank.\n"
        "Certificate valid for a period of 1 year, expiring on 11 August 2026.\n"
        "Notice: Synthetic institutional data for SIH evaluation."
    )

    if "AICTE-2026-1001" in apps:
        app1 = apps["AICTE-2026-1001"]
        existing_doc = db.query(Document).filter(Document.application_id == app1.id, Document.document_name == "Registered_Land_Lease_Deed_2020.pdf").first()
        if not existing_doc:
            db.add(Document(
                application_id=app1.id,
                institution_name=app1.institution_name,
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
            ))
            db.add(Document(
                application_id=app1.id,
                institution_name=app1.institution_name,
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
            ))

    # 5. Seed EVC Inspection Record
    if "AICTE-2026-1002" in apps:
        app2 = apps["AICTE-2026-1002"]
        existing_evc = db.query(EVCVisit).filter(EVCVisit.application_id == app2.id).first()
        if not existing_evc:
            db.add(EVCVisit(
                application_id=app2.id,
                institution_name=app2.institution_name,
                committee_members="Prof. S. Ramanujan (Chairperson, IIT Bombay nominee), Dr. Kavita Sharma (Expert, VJTI Mumbai), Sh. Alok Nath (AICTE Regional Officer)",
                scheduled_date=today + timedelta(days=3),
                visit_mode="PHYSICAL",
                status="SCHEDULED",
                assigned_by="officer@demo.local"
            ))

    # 6. Seed Compliance Items
    if "AICTE-2026-1001" in apps:
        app1 = apps["AICTE-2026-1001"]
        existing_comp = db.query(ComplianceItem).filter(ComplianceItem.application_id == app1.id).first()
        if not existing_comp:
            db.add(ComplianceItem(
                institution_name=app1.institution_name,
                application_id=app1.id,
                item_type="LEASE_DOCUMENT",
                description="Submission of Registered Land Lease Deed with validity extending beyond 30 years.",
                due_date=today + timedelta(days=12),
                status="VERIFIED",
                submission_evidence="Registered Deed No. 4589/2020 submitted and verified against Sub-Registrar records.",
                submitted_at=datetime.utcnow() - timedelta(days=3),
                verified_by="officer@demo.local",
                verified_at=datetime.utcnow() - timedelta(days=2),
                officer_comments="Confirmed valid until 31 March 2053 (33 years tenure)."
            ))

    if "AICTE-2026-1003" in apps:
        app3 = apps["AICTE-2026-1003"]
        existing_comp3 = db.query(ComplianceItem).filter(ComplianceItem.application_id == app3.id).first()
        if not existing_comp3:
            db.add(ComplianceItem(
                institution_name=app3.institution_name,
                application_id=app3.id,
                item_type="FIRE_SAFETY_NOC",
                description="Renewal of annual Fire & Life Safety clearance certificate from State Fire Services Directorate.",
                due_date=today - timedelta(days=3),
                status="OVERDUE",
                submission_evidence=None,
                submitted_at=None,
                verified_by=None,
                officer_comments="Past due date. Escalated to Regional Officer for immediate statutory notice."
            ))

    # 7. Seed Alerts
    if not db.query(Alert).first():
        alerts = [
            Alert(
                title="EVC Inspection Scheduled: Sunrise Institute",
                message="Expert committee visit scheduled for 27 Oct 2026. Chairperson: Prof. S. Ramanujan.",
                severity="INFO",
                target_role="evc_expert",
                institution_name="Sunrise Institute of Technology",
                application_id=apps["AICTE-2026-1002"].id if "AICTE-2026-1002" in apps else None,
                trigger_type="EVC_REMINDER"
            ),
            Alert(
                title="Compliance Overdue: Greenfield Polytechnic",
                message="Annual Fire Safety NOC submission is overdue by 3 days. Statutory warning triggered.",
                severity="CRITICAL",
                target_role="officer",
                institution_name="Greenfield Polytechnic",
                application_id=apps["AICTE-2026-1003"].id if "AICTE-2026-1003" in apps else None,
                trigger_type="COMPLIANCE_OVERDUE"
            ),
            Alert(
                title="Clarification Response Awaited: AICTE-2026-1005",
                message="Himalayan Institute must resubmit attested Land Conversion order to proceed with scrutiny.",
                severity="WARNING",
                target_role="institution",
                institution_name="Himalayan Institute of Pharmaceutical Sciences",
                application_id=apps["AICTE-2026-1005"].id if "AICTE-2026-1005" in apps else None,
                trigger_type="CLARIFICATION_PENDING"
            ),
            Alert(
                title="Scrutiny Deadline Approaching: AICTE-2026-1001",
                message="ABC Engineering College Extension of Approval scrutiny due in 5 days.",
                severity="WARNING",
                target_role="officer",
                institution_name="ABC Engineering College",
                application_id=apps["AICTE-2026-1001"].id if "AICTE-2026-1001" in apps else None,
                trigger_type="DEADLINE_APPROACHING"
            )
        ]
        db.add_all(alerts)


    # 8. Seed Standard AICTE Regulatory Categories
    if not db.query(RegulatoryCategory).first():
        import json
        categories = [
            RegulatoryCategory(
                category_code="EOA",
                title="Extension of Approval (EoA)",
                institution_type="Engineering & Technology, Management, Pharmacy",
                description="Annual extension of approval for running institutions under AICTE Approval Process Handbook (APH 2024-2027) Chapter II.",
                required_documents_json=json.dumps([
                    {"type": "EOA_SELF_DISCLOSURE", "name": "Annual Self-Disclosure / Undertaking", "rule": "APH-2024-CH2-S2.1", "mandatory": True},
                    {"type": "PREVIOUS_APPROVAL", "name": "AICTE EoA Letter of Preceding Academic Year", "rule": "APH-2024-CH2-S2.2", "mandatory": True},
                    {"type": "BUILDING_SAFETY_FIRE_NOC", "name": "Fire & Life Safety Certificate / NOC", "rule": "APH-2024-CH2-FIRE", "mandatory": True},
                    {"type": "FACULTY_LIST", "name": "Faculty Cadre & Salary Compliance Roster", "rule": "APH-2024-CH2-FACULTY", "mandatory": True},
                    {"type": "ANTI_RAGGING_AFFIDAVIT", "name": "Mandatory Anti-Ragging Undertaking", "rule": "APH-2024-ANNEX-RAGGING", "mandatory": True}
                ]),
                workflow_sequence_json=json.dumps(["DRAFT", "SUBMITTED", "SCRUTINY", "SAC_SHC_REVIEW", "COMPLETED"]),
                sla_days=15,
                is_active=True
            ),
            RegulatoryCategory(
                category_code="NEW_PROGRAMME",
                title="Introduction of New Programme / Level",
                institution_type="Degree Engineering, MCA, Post-Graduate",
                description="Statutory approval for starting a new degree program, emerging technology specialization, or shift.",
                required_documents_json=json.dumps([
                    {"type": "LAND_OWNERSHIP_DEED", "name": "Land Title Deed / Registered Lease (>= 30 Years)", "rule": "APH-2024-CH2-LAND", "mandatory": True},
                    {"type": "BUILDING_PLAN_OCCUPANCY", "name": "Approved Building Plan & Occupancy Certificate", "rule": "APH-2024-CH2-BUILDING", "mandatory": True},
                    {"type": "STATE_GOVT_NOC", "name": "No Objection Certificate from State Government", "rule": "APH-2024-CH2-STATE-NOC", "mandatory": True},
                    {"type": "AFFILIATING_UNIVERSITY_NOC", "name": "Consent of Affiliation from University", "rule": "APH-2024-CH2-AFFILIATION", "mandatory": True},
                    {"type": "EQUIPMENT_LAB_LIST", "name": "Laboratory Equipment Invoices & Physical Readiness", "rule": "APH-2024-CH2-LABS", "mandatory": True},
                    {"type": "FACULTY_APPOINTMENT_PLAN", "name": "Core Faculty Recruitment & Appointment Plan", "rule": "APH-2024-CH2-FACULTY-PLAN", "mandatory": True}
                ]),
                workflow_sequence_json=json.dumps(["DRAFT", "SUBMITTED", "SCRUTINY", "EVC_PENDING", "EVC_SCHEDULED", "EVC_COMPLETED", "SAC_SHC_REVIEW", "COMPLETED"]),
                sla_days=30,
                is_active=True
            ),
            RegulatoryCategory(
                category_code="INTAKE_VARIATION",
                title="Increase in Intake / Additional Division",
                institution_type="Approved Technical Institutions",
                description="Expansion of approved intake seats in existing accredited departments.",
                required_documents_json=json.dumps([
                    {"type": "PREVIOUS_APPROVAL", "name": "Current EoA Sanction Order", "rule": "APH-2024-INTAKE-1", "mandatory": True},
                    {"type": "BUILDING_PLAN_OCCUPANCY", "name": "Instructional Carpet Area Verification", "rule": "APH-2024-INTAKE-AREA", "mandatory": True},
                    {"type": "FACULTY_LIST", "name": "Qualified Cadre Ratio Compliance Roster", "rule": "APH-2024-INTAKE-FACULTY", "mandatory": True}
                ]),
                workflow_sequence_json=json.dumps(["DRAFT", "SUBMITTED", "SCRUTINY", "SAC_SHC_REVIEW", "COMPLETED"]),
                sla_days=21,
                is_active=True
            ),
            RegulatoryCategory(
                category_code="CHANGE_SITE",
                title="Change of Site / Permanent Campus Relocation",
                institution_type="Technical & Polytechnic Institutions",
                description="Transfer of operation from temporary transit accommodation to permanent self-owned campus.",
                required_documents_json=json.dumps([
                    {"type": "LAND_OWNERSHIP_DEED", "name": "New Campus Land Title Deed (>= 30 Years)", "rule": "APH-2024-SITE-LAND", "mandatory": True},
                    {"type": "BUILDING_PLAN_OCCUPANCY", "name": "Municipal Approved Building Blueprints & Fire NOC", "rule": "APH-2024-SITE-FIRE", "mandatory": True},
                    {"type": "STATE_GOVT_NOC", "name": "State Government Re-siting Authorization", "rule": "APH-2024-SITE-NOC", "mandatory": True}
                ]),
                workflow_sequence_json=json.dumps(["DRAFT", "SUBMITTED", "SCRUTINY", "EVC_PENDING", "EVC_SCHEDULED", "EVC_COMPLETED", "SAC_SHC_REVIEW", "COMPLETED"]),
                sla_days=30,
                is_active=True
            ),
            RegulatoryCategory(
                category_code="CLOSURE",
                title="Closure of Programme / Institution",
                institution_type="All AICTE Institutions",
                description="Progressive phase-out or formal closure of educational programme with student safeguards.",
                required_documents_json=json.dumps([
                    {"type": "EOA_SELF_DISCLOSURE", "name": "Governing Body Resolution for Closure", "rule": "APH-2024-CLOSURE-RES", "mandatory": True},
                    {"type": "AFFILIATING_UNIVERSITY_NOC", "name": "No-Objection Certificate from Affiliating University", "rule": "APH-2024-CLOSURE-NOC", "mandatory": True}
                ]),
                workflow_sequence_json=json.dumps(["DRAFT", "SUBMITTED", "SCRUTINY", "SAC_SHC_REVIEW", "COMPLETED"]),
                sla_days=15,
                is_active=True
            )
        ]
        db.add_all(categories)

    db.commit()
    print("Database seeding completed successfully: all demo personas and lifecycle cases are ready.")
