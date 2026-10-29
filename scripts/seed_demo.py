"""
Seed Demo Runner for SIH26262 PRAVAHA.
Usage: python scripts/seed_demo.py
"""
import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
sys.path.insert(0, backend_dir)

try:
    from dotenv import load_dotenv
    env_file = os.path.join(backend_dir, ".env")
    if os.path.exists(env_file):
        load_dotenv(env_file)
except ImportError:
    pass

from app.db import Base, engine, SessionLocal, run_schema_migrations
from app.seed import seed_database

def main():
    print("==================================================")
    print("  PRAVAHA SIH26262: Seeding Demo Database")
    print(f"  Target Engine: {engine.url.render_as_string(hide_password=True)}")
    print("==================================================")
    Base.metadata.create_all(bind=engine)
    run_schema_migrations(engine)
    db = SessionLocal()
    try:
        seed_database(db, force=True)
        print("  Demo accounts:")
        print("    1. Institution:  college@demo.local  / DemoPass123!")
        print("    2. RO / Admin:   officer@demo.local  / DemoPass123!")
        print("    3. EVC Expert:   evc@demo.local      / DemoPass123!")
        print("==================================================")
    finally:
        db.close()

if __name__ == "__main__":
    main()
