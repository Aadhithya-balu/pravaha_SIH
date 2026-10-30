path = r'backend/app/main.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update /api/health to expose safe database readiness and provider
old_health = """@app.get("/api/health")
@app.get("/api/v1/health")
def health():
    return {
        "status": "ok",
        "service": "Pravaha AICTE Regulatory Workflow & Scrutiny Engine",
        "timestamp": datetime.utcnow().isoformat(),
        "routes_supported": ["Extension of Approval (EoA)", "New Programme / Level"]
    }"""

new_health = """@app.get("/api/health")
@app.get("/api/v1/health")
def health(db: Session = Depends(get_db)):
    db_ok = True
    provider = "sqlite"
    try:
        from sqlalchemy import text as sa_text
        db.execute(sa_text("SELECT 1"))
        db_url = os.getenv("DATABASE_URL", "")
        if "postgresql" in db_url or "supabase" in db_url:
            provider = "postgresql/supabase"
        else:
            provider = "sqlite"
    except Exception as e:
        db_ok = False
        provider = f"error: {e}"

    return {
        "status": "ok" if db_ok else "degraded",
        "service": "Pravaha AICTE Regulatory Workflow & Scrutiny Engine",
        "timestamp": datetime.utcnow().isoformat(),
        "database_ready": db_ok,
        "database_provider": provider,
        "environment": os.getenv("APP_ENV", "development"),
        "storage_provider": "supabase_storage",
        "routes_supported": ["Extension of Approval (EoA)", "New Programme / Level"]
    }"""

assert old_health in text, "could not find old_health"
text = text.replace(old_health, new_health, 1)

# 2. Update submit_application to set assigned_to and assigned_role
old_submit = """    prev_stage = a.current_stage
    a.current_stage = "SCRUTINY"
    a.status = "IN_PROGRESS"
    a.submission_date = date.today()"""

new_submit = """    prev_stage = a.current_stage
    a.current_stage = "SCRUTINY"
    a.status = "IN_PROGRESS"
    a.assigned_to = "Regional Officer"
    a.assigned_role = "officer"
    a.submission_date = date.today()"""

assert old_submit in text, "could not find old_submit"
text = text.replace(old_submit, new_submit, 1)

# 3. In transition_application: create EVCVisit if SCHEDULE_EVC
old_trans = """    # If returned, persist CorrectionRequest and notify institution
    if new_status == "RETURNED" or req.action.upper() == "RETURN":"""

new_trans = """    # If EVC is scheduled, ensure an EVCVisit record exists for the panel
    if new_stage == "EVC_SCHEDULED" or req.action.upper() == "SCHEDULE_EVC":
        existing_visit = db.query(EVCVisit).filter(EVCVisit.application_id == aid).first()
        if not existing_visit:
            new_visit = EVCVisit(
                application_id=aid,
                institution_name=a.institution_name,
                committee_members=req.reason.strip() if req.reason else "Dr. EVC Expert (evc@demo.local), Prof. K. Sharma",
                scheduled_date=date.today() + timedelta(days=7),
                visit_mode="PHYSICAL",
                status="SCHEDULED",
                assigned_by=user.email
            )
            db.add(new_visit)
            db.flush()

    # If returned, persist CorrectionRequest and notify institution
    if new_status == "RETURNED" or req.action.upper() == "RETURN":"""

assert old_trans in text, "could not find old_trans"
text = text.replace(old_trans, new_trans, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied backend health, submit, and EVC transition updates successfully!")
