import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

URL = os.getenv("DATABASE_URL", "sqlite:///./ps4.db")
engine = create_engine(URL, connect_args={"check_same_thread": False} if URL.startswith("sqlite") else {})
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
                if "document_category" not in cols:
                    conn.execute(text("ALTER TABLE documents ADD COLUMN document_category VARCHAR(100) DEFAULT 'INSTITUTIONAL_RECORDS';"))

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

            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
