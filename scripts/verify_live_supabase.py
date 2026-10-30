#!/usr/bin/env python3
"""
PRAVAHA — Production Supabase & Storage End-to-End Verification Script
Run this script in an authorized development or deployment environment where outbound
network access to Supabase PostgreSQL (ports 5432 / 6543) is permitted.

Usage:
    python scripts/verify_live_supabase.py
"""

import os
import sys
import uuid
import socket
import hashlib
from datetime import datetime

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# Load environment
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BACKEND_DIR, ".env"))
except ImportError:
    pass

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def mask_connection_string(conn_str: str) -> str:
    """Masks database password in connection strings for secure logging."""
    if "@" in conn_str and ":" in conn_str:
        prefix, rest = conn_str.split("@", 1)
        if ":" in prefix:
            proto_user = prefix.rsplit(":", 1)[0]
            return f"{proto_user}:***@{rest}"
    return "***"

def main():
    print("=" * 70)
    print("PRAVAHA — Supabase Live Verification in Authorized Environment")
    print("=" * 70)

    db_provider = os.getenv("DATABASE_PROVIDER", "sqlite").lower().strip()
    db_url = os.getenv("DATABASE_URL", "")

    print(f"[*] Target Database Provider: {db_provider}")
    print(f"[*] Connection URL (Masked): {mask_connection_string(db_url)}")

    if db_provider != "supabase":
        print("[!] DATABASE_PROVIDER is not set to 'supabase'. Please update backend/.env")
        return 1

    # 1. Parse host and port for pre-flight network check
    try:
        host_port = db_url.split("@")[-1].split("/")[0].split("?")[0]
        if ":" in host_port:
            host, port = host_port.split(":")
            port = int(port)
        else:
            host, port = host_port, 5432
        print(f"[*] Pre-flight socket check: {host}:{port} ...", end=" ", flush=True)
        s = socket.socket()
        s.settimeout(5)
        s.connect((host, port))
        s.close()
        print("CONNECTED (TCP Handshake OK)")
    except Exception as sock_err:
        print(f"FAILED\n[!] TCP connection failed: {sock_err}")
        print("[!] Verify your outbound firewall allows traffic to port", port)
        return 1

    # 2. Live SQLAlchemy / psycopg2 Connection & Query Test
    print("[*] Testing live PostgreSQL query (SELECT 1;)...", end=" ", flush=True)
    engine = create_engine(db_url, connect_args={"connect_timeout": 10}, pool_pre_ping=True)
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version();")).scalar()
            print("SUCCESS")
            print(f"[*] PostgreSQL Version: {result[:60]}...")
    except Exception as e:
        print(f"FAILED\n[!] Live SQL connection error: {e}")
        return 1

    # 3. Apply Schema Migrations
    print("[*] Running schema migrations...", end=" ", flush=True)
    from app.db import Base, run_schema_migrations
    from app.models import User, Institution, Document, Application
    Base.metadata.create_all(engine)
    run_schema_migrations(engine)
    print("SUCCESS (Tables created/verified)")

    # 4. Write & Read Isolation Verification
    print("[*] Executing test record write / read round-trip...", end=" ", flush=True)
    Session = sessionmaker(bind=engine)
    test_id = uuid.uuid4().hex[:8]
    test_email = f"audit_test_{test_id}@pravaha-audit.internal"

    with Session() as session:
        # Write test user
        test_user = User(
            email=test_email,
            name=f"Verification Agent {test_id}",
            password_hash="verified_hash",
            role="institution",
            institution_name=f"Audit Tech {test_id}",
            is_active=True
        )
        session.add(test_user)
        session.commit()
        user_db_id = test_user.id

    # Read back from database
    with Session() as session:
        queried_user = session.get(User, user_db_id)
        assert queried_user is not None, "Failed to retrieve newly written record"
        assert queried_user.email == test_email, "Queried record email mismatch"
        # Clean up test record to preserve clean database state
        session.delete(queried_user)
        session.commit()
    print(f"SUCCESS (Record ID {user_db_id} written, verified, and safely removed)")

    # 5. Local Storage & Cryptographic Verification
    print("[*] Testing local document storage and hash integrity...", end=" ", flush=True)
    from app.document_storage import save_uploaded_document, resolve_storage_path, delete_stored_document
    test_bytes = f"Pravaha Verification Hash Payload {test_id}".encode("utf-8")
    expected_hash = hashlib.sha256(test_bytes).hexdigest()

    saved_meta = save_uploaded_document(
        filename=f"verify_{test_id}.txt",
        file_bytes=test_bytes,
        application_id=999999,
        document_type="AUDIT_VERIFICATION"
    )
    assert saved_meta["file_hash"] == expected_hash, "Hash mismatch"
    phys_path = resolve_storage_path(saved_meta["stored_filename"])
    assert os.path.exists(phys_path), "Stored file missing from disk"
    delete_stored_document(saved_meta["stored_filename"])
    print("SUCCESS (File written, SHA-256 verified, cleaned up)")

    print("\n" + "=" * 70)
    print("ALL LIVE SUPABASE AND STORAGE INTEGRATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
    return 0

if __name__ == "__main__":
    sys.exit(main())

