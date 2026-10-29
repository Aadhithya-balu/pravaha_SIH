import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

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
raw_url = os.getenv("DATABASE_URL", "sqlite:///./ps4.db")

# Automatically resolve local SQLite database relative to backend folder for consistency
if raw_url.startswith("sqlite:///./"):
    rel_path = raw_url.replace("sqlite:///./", "")
    abs_path = os.path.join(BASE_DIR, rel_path).replace("\\", "/")
    URL = f"sqlite:///{abs_path}"
elif raw_url.startswith("postgres://"):
    # Normalize Supabase / Heroku postgres:// schema to standard postgresql:// for SQLAlchemy
    URL = raw_url.replace("postgres://", "postgresql://", 1)
else:
    URL = raw_url

# Production Safety Assertion: Never silently use SQLite in production
if APP_ENV == "production" and URL.startswith("sqlite"):
    raise RuntimeError(
        "FATAL: Production mode (APP_ENV=production) requires a persistent PostgreSQL DATABASE_URL. "
        "Local SQLite is strictly prohibited in production mode to prevent silent data loss."
    )

engine_kwargs = {}
if URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    print(f"[DATABASE] Environment: DEVELOPMENT | Engine: SQLite ({URL})")
else:
    # PostgreSQL / Supabase pool configuration
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    print(f"[DATABASE] Environment: {APP_ENV.upper()} | Engine: PostgreSQL Pooler")

try:
    engine = create_engine(URL, **engine_kwargs)
    if APP_ENV == "production":
        with engine.connect() as test_conn:
            test_conn.execute(text("SELECT 1;"))
            print("[DATABASE] Production PostgreSQL connection verified successfully.")
except Exception as conn_err:
    if APP_ENV == "production":
        raise RuntimeError(
            f"FATAL: Failed to connect to production PostgreSQL database: {conn_err}. "
            "PRAVAHA will not silently fall back to an empty SQLite database in production."
        )
    else:
        raise conn_err
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def run_schema_migrations(eng):
    """
    Safely adds new columns to existing SQLite/Postgres tables if they don't already exist.
    Guarantees zero data loss on schema updates.
    """
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
                if "version" not in cols:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1;"))
                if "is_latest" not in cols:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN is_latest BOOLEAN DEFAULT 1;"))
                if "file_hash" not in cols:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN file_hash VARCHAR(64);"))
                if "processing_status" not in cols:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN processing_status VARCHAR(40) DEFAULT 'COMPLETED';"))

            conn.commit()

        elif dialect == "postgresql":
            # PostgreSQL / Supabase migration commands using IF NOT EXISTS
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
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;",
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE;",
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);",
                "ALTER TABLE documents ADD COLUMN IF NOT EXISTS processing_status VARCHAR(40) DEFAULT 'COMPLETED';",
            ]
            for mig in migrations:
                try:
                    conn.execute(text(mig))
                except Exception:
                    pass
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
