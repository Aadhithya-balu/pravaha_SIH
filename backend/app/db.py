import os
import re
import logging
from typing import Dict, Any, Optional
from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

logger = logging.getLogger("pravaha.db")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ensure backend/.env is automatically loaded if present
try:
    from dotenv import load_dotenv
    env_file = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_file):
        load_dotenv(env_file)
except ImportError:
    pass

APP_ENV = os.getenv("APP_ENV", "development").lower().strip()
raw_provider = os.getenv("DATABASE_PROVIDER", "").lower().strip()
raw_url = os.getenv("DATABASE_URL", "sqlite:///./ps4.db").strip()

# Detect or normalize database provider
if raw_provider in ["supabase", "postgresql", "postgres"]:
    DATABASE_PROVIDER = "supabase"
elif raw_provider == "sqlite":
    DATABASE_PROVIDER = "sqlite"
else:
    # Auto-detect from URL if not explicitly specified
    if "supabase.co" in raw_url or "pooler.supabase.com" in raw_url or raw_url.startswith("postgres"):
        DATABASE_PROVIDER = "supabase"
    else:
        DATABASE_PROVIDER = "sqlite"

# Build authoritative connection URL
if DATABASE_PROVIDER == "sqlite":
    if raw_url.startswith("sqlite:///./"):
        rel_path = raw_url.replace("sqlite:///./", "")
        abs_path = os.path.join(BASE_DIR, rel_path).replace("\\", "/")
        URL = f"sqlite:///{abs_path}"
    elif raw_url.startswith("sqlite:///"):
        URL = raw_url
    else:
        abs_path = os.path.join(BASE_DIR, "ps4.db").replace("\\", "/")
        URL = f"sqlite:///{abs_path}"
else:
    # Supabase / PostgreSQL provider
    import urllib.parse
    norm_url = raw_url
    if norm_url.startswith("postgres://"):
        norm_url = norm_url.replace("postgres://", "postgresql://", 1)

    # Automatically fix unencoded '@' inside password (e.g. Pravaha@2026 -> Pravaha%402026)
    if norm_url.startswith("postgresql://") and "://" in norm_url:
        proto, rest = norm_url.split("://", 1)
        if rest.count("@") > 1:
            user_pass, host_rest = rest.rsplit("@", 1)
            if ":" in user_pass:
                user, password = user_pass.split(":", 1)
                password = urllib.parse.unquote(password)
                quoted_pass = urllib.parse.quote(password, safe="")
                norm_url = f"{proto}://{user}:{quoted_pass}@{host_rest}"

    # Strip pgbouncer query parameter if psycopg is used
    if "pgbouncer=" in norm_url:
        norm_url = re.sub(r"[?&]pgbouncer=[^&]*", "", norm_url)
        if "?" not in norm_url and "&" in norm_url:
            norm_url = norm_url.replace("&", "?", 1)

    URL = norm_url

# Production Safety Assertion: Never silently use SQLite in production
if APP_ENV == "production" and DATABASE_PROVIDER == "sqlite":
    raise RuntimeError(
        "FATAL: Production mode (APP_ENV=production) requires authoritative Supabase PostgreSQL (DATABASE_PROVIDER=supabase). "
        "Local SQLite is strictly prohibited in production mode to prevent silent data loss."
    )

engine_kwargs = {}
DATABASE_READY = False
DATABASE_ERROR: Optional[str] = None
engine = None

if DATABASE_PROVIDER == "sqlite":
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    print(f"[DATABASE] Environment: {APP_ENV.upper()} | Provider: SQLITE | URL: {URL}", flush=True)
else:
    # PostgreSQL / Supabase pool configuration
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    engine_kwargs["connect_args"] = {"connect_timeout": 6}
    print(f"[DATABASE] Environment: {APP_ENV.upper()} | Provider: SUPABASE (PostgreSQL Pooler)", flush=True)

try:
    engine = create_engine(URL, **engine_kwargs)
    with engine.connect() as test_conn:
        test_conn.execute(text("SELECT 1;"))
    DATABASE_READY = True
    DATABASE_ERROR = None
    print(f"[DATABASE SUCCESS] Connected to authoritative database ({DATABASE_PROVIDER}).", flush=True)
except Exception as conn_err:
    DATABASE_READY = False
    DATABASE_ERROR = str(conn_err)
    if DATABASE_PROVIDER == "supabase":
        logger.error(
            f"[DATABASE FATAL] Failed to connect to Supabase PostgreSQL: {conn_err}. "
            "PRAVAHA will not silently fall back to an unpersisted or alternative database when configured for Supabase."
        )
        if APP_ENV == "production":
            raise RuntimeError(
                f"FATAL: Failed to connect to production Supabase PostgreSQL: {conn_err}. "
                "Silent fallback is strictly forbidden in production."
            )
    else:
        raise conn_err

if engine is not None:
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
else:
    SessionLocal = None


class Base(DeclarativeBase):
    pass


def get_database_diagnostics() -> Dict[str, Any]:
    """Returns database readiness, provider, and operational error details."""
    return {
        "database_ready": DATABASE_READY,
        "database_provider": DATABASE_PROVIDER,
        "environment": APP_ENV,
        "database_error": DATABASE_ERROR
    }


def run_schema_migrations(eng):
    """
    Safely adds new columns and tables to existing SQLite/Postgres tables if they don't already exist.
    Guarantees zero data loss on schema updates.
    """
    if not DATABASE_READY:
        logger.warning("[MIGRATIONS] Skipping schema migrations because database is not connected.")
        return

    try:
        with eng.connect() as conn:
            dialect = eng.dialect.name
            if dialect == "sqlite":
                def get_cols(table_name):
                    res = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
                    return [r[1] for r in res]

                tables = [r[0] for r in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table';")).fetchall()]
                if "applications" in tables:
                    cols = get_cols("applications")
                    if "form_data" not in cols:
                        conn.execute(text("ALTER TABLE applications ADD COLUMN form_data TEXT;"))
                    if "decision_outcome" not in cols:
                        conn.execute(text("ALTER TABLE applications ADD COLUMN decision_outcome VARCHAR(40);"))
                    if "decision_remarks" not in cols:
                        conn.execute(text("ALTER TABLE applications ADD COLUMN decision_remarks TEXT;"))
                    if "decision_by" not in cols:
                        conn.execute(text("ALTER TABLE applications ADD COLUMN decision_by VARCHAR(255);"))
                    if "decision_date" not in cols:
                        conn.execute(text("ALTER TABLE applications ADD COLUMN decision_date DATETIME;"))

                if "alerts" in tables:
                    cols = get_cols("alerts")
                    if "recipient_user_id" not in cols:
                        conn.execute(text("ALTER TABLE alerts ADD COLUMN recipient_user_id INTEGER;"))

                if "audit_events" in tables:
                    cols = get_cols("audit_events")
                    if "prev_hash" not in cols:
                        conn.execute(text("ALTER TABLE audit_events ADD COLUMN prev_hash VARCHAR(64);"))
                    if "event_hash" not in cols:
                        conn.execute(text("ALTER TABLE audit_events ADD COLUMN event_hash VARCHAR(64);"))

                if "scrutiny_runs" in tables:
                    cols = get_cols("scrutiny_runs")
                    if "model_provider" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_runs ADD COLUMN model_provider VARCHAR(80);"))
                    if "model_name" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_runs ADD COLUMN model_name VARCHAR(120);"))
                    if "ruleset_version" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_runs ADD COLUMN ruleset_version VARCHAR(80);"))

                if "scrutiny_findings" in tables:
                    cols = get_cols("scrutiny_findings")
                    if "document_id" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN document_id INTEGER;"))
                    if "source_document" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN source_document VARCHAR(255);"))
                    if "page_number" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN page_number INTEGER;"))
                    if "expected_requirement" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN expected_requirement TEXT;"))
                    if "observed_value" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN observed_value TEXT;"))
                    if "is_provisional" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN is_provisional BOOLEAN DEFAULT 0;"))
                    if "source_reference" not in cols:
                        conn.execute(text("ALTER TABLE scrutiny_findings ADD COLUMN source_reference VARCHAR(255);"))

                if "documents" in tables:
                    cols = get_cols("documents")
                    if "stored_filename" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN stored_filename VARCHAR(255);"))
                    if "version" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1;"))
                    if "is_latest" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN is_latest BOOLEAN DEFAULT 1;"))
                    if "file_hash" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64);"))
                    if "processing_status" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN processing_status VARCHAR(40) DEFAULT 'COMPLETED';"))
                    if "document_category" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN document_category VARCHAR(100) DEFAULT 'INSTITUTIONAL_RECORDS';"))
                    if "ocr_status" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN ocr_status VARCHAR(40) DEFAULT 'SUCCESS';"))
                    if "extracted_fields" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN extracted_fields TEXT;"))
                    if "authenticity_status" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN authenticity_status VARCHAR(50) DEFAULT 'UNVERIFIED';"))
                    if "regulatory_status" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN regulatory_status VARCHAR(50) DEFAULT 'PENDING_EVALUATION';"))
                    if "error_message" not in cols:
                        conn.execute(text("ALTER TABLE documents ADD COLUMN error_message TEXT;"))

                if "evc_visits" in tables:
                    cols = get_cols("evc_visits")
                    if "actual_date" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN actual_date DATE;"))
                    if "visit_occurred" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN visit_occurred VARCHAR(30) DEFAULT 'UNCONFIRMED';"))
                    if "missed_reason" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN missed_reason TEXT;"))
                    if "evidence_verification_status" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN evidence_verification_status VARCHAR(30) DEFAULT 'PENDING';"))
                    if "location_details" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN location_details TEXT;"))
                    if "structured_checklist" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN structured_checklist TEXT;"))
                    if "inspection_outcome" not in cols:
                        conn.execute(text("ALTER TABLE evc_visits ADD COLUMN inspection_outcome VARCHAR(40);"))

                if "inspection_evidences" in tables:
                    cols = get_cols("inspection_evidences")
                    if "verification_status" not in cols:
                        conn.execute(text("ALTER TABLE inspection_evidences ADD COLUMN verification_status VARCHAR(30) DEFAULT 'PENDING';"))
                    if "verified_by" not in cols:
                        conn.execute(text("ALTER TABLE inspection_evidences ADD COLUMN verified_by VARCHAR(255);"))
                    if "verified_at" not in cols:
                        conn.execute(text("ALTER TABLE inspection_evidences ADD COLUMN verified_at DATETIME;"))

                if "stage_remarks" in tables:
                    cols = get_cols("stage_remarks")
                    if "action_type" not in cols:
                        conn.execute(text("ALTER TABLE stage_remarks ADD COLUMN action_type VARCHAR(60) DEFAULT 'REVIEW_COMMENT';"))
                    if "parent_remark_id" not in cols:
                        conn.execute(text("ALTER TABLE stage_remarks ADD COLUMN parent_remark_id INTEGER;"))
                    if "is_resolved" not in cols:
                        conn.execute(text("ALTER TABLE stage_remarks ADD COLUMN is_resolved BOOLEAN DEFAULT 0;"))
                    if "resolution_notes" not in cols:
                        conn.execute(text("ALTER TABLE stage_remarks ADD COLUMN resolution_notes TEXT;"))

                # Create email_delivery_records if missing
                if "email_delivery_records" not in tables:
                    conn.execute(text("""
                        CREATE TABLE IF NOT EXISTS email_delivery_records (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            recipient VARCHAR(255) NOT NULL,
                            subject VARCHAR(255) NOT NULL,
                            template_type VARCHAR(80) NOT NULL,
                            application_reference VARCHAR(40),
                            status VARCHAR(40) DEFAULT 'QUEUED',
                            error_message TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        );
                    """))

                conn.commit()

            elif dialect == "postgresql":
                migrations = [
                    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS form_data TEXT;",
                    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_outcome VARCHAR(40);",
                    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_remarks TEXT;",
                    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_by VARCHAR(255);",
                    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_date TIMESTAMPTZ;",
                    "ALTER TABLE alerts ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER;",
                    "ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS prev_hash VARCHAR(64);",
                    "ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS event_hash VARCHAR(64);",
                    "ALTER TABLE scrutiny_runs ADD COLUMN IF NOT EXISTS model_provider VARCHAR(80);",
                    "ALTER TABLE scrutiny_runs ADD COLUMN IF NOT EXISTS model_name VARCHAR(120);",
                    "ALTER TABLE scrutiny_runs ADD COLUMN IF NOT EXISTS ruleset_version VARCHAR(80);",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS document_id INTEGER;",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS source_document VARCHAR(255);",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS page_number INTEGER;",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS expected_requirement TEXT;",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS observed_value TEXT;",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE scrutiny_findings ADD COLUMN IF NOT EXISTS source_reference VARCHAR(255);",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS stored_filename VARCHAR(255);",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status VARCHAR(40) DEFAULT 'COMPLETED';",
                                        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS document_category VARCHAR(100) DEFAULT 'INSTITUTIONAL_RECORDS';",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS actual_date DATE;",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS visit_occurred VARCHAR(30) DEFAULT 'UNCONFIRMED';",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS missed_reason TEXT;",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS evidence_verification_status VARCHAR(30) DEFAULT 'PENDING';",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS location_details TEXT;",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS structured_checklist TEXT;",
                    "ALTER TABLE evc_visits ADD COLUMN IF NOT EXISTS inspection_outcome VARCHAR(40);",
                    "ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'PENDING';",
                    "ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verified_by VARCHAR(255);",
                    "ALTER TABLE inspection_evidences ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;",
                    "ALTER TABLE stage_remarks ADD COLUMN IF NOT EXISTS action_type VARCHAR(60) DEFAULT 'REVIEW_COMMENT';",
                    "ALTER TABLE stage_remarks ADD COLUMN IF NOT EXISTS parent_remark_id INTEGER;",
                    "ALTER TABLE stage_remarks ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE;",
                    "ALTER TABLE stage_remarks ADD COLUMN IF NOT EXISTS resolution_notes TEXT;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS ocr_status VARCHAR(40) DEFAULT 'SUCCESS';",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS extracted_fields TEXT;",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS authenticity_status VARCHAR(50) DEFAULT 'UNVERIFIED';",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS regulatory_status VARCHAR(50) DEFAULT 'PENDING_EVALUATION';",
                    "ALTER TABLE documents ADD COLUMN IF NOT EXISTS error_message TEXT;",
                    """
                    CREATE TABLE IF NOT EXISTS public.email_delivery_records (
                        id SERIAL PRIMARY KEY,
                        recipient VARCHAR(255) NOT NULL,
                        subject VARCHAR(255) NOT NULL,
                        template_type VARCHAR(80) NOT NULL,
                        application_reference VARCHAR(40),
                        status VARCHAR(40) DEFAULT 'QUEUED',
                        error_message TEXT,
                        created_at TIMESTAMPTZ DEFAULT NOW()
                    );
                    """
                ]
                for mig in migrations:
                    try:
                        conn.execute(text(mig))
                    except Exception:
                        pass
                conn.commit()
    except Exception as e:
        logger.error(f"[MIGRATIONS] Error applying migrations: {e}")


def get_db():
    if not DATABASE_READY or SessionLocal is None:
        raise HTTPException(
            status_code=503,
            detail=f"Authoritative database '{DATABASE_PROVIDER}' is currently unreachable: {DATABASE_ERROR}. "
                   f"Silent fallback to an alternative database is disabled."
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
