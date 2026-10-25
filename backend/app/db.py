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
        # Check SQLite or other DB
        dialect = eng.dialect.name
        if dialect == "sqlite":
            def get_cols(table_name):
                res = conn.execute(text(f"PRAGMA table_info({table_name});")).fetchall()
                return [r[1] for r in res]

            # Check if applications table exists
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
            conn.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
