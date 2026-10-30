"""
PRAVAHA — Local Document Storage Service
Handles secure, authenticated local filesystem storage for original uploaded documents
(PDFs, DOCX, TXT, images) while metadata and references persist in the authoritative database.
Enforces size limits, SHA-256 integrity, path traversal prevention, and atomic failure rollbacks.
"""
import os
import io
import re
import uuid
import hashlib
import shutil
import logging
from typing import Dict, Any, List, Optional, Tuple
from fastapi import HTTPException

logger = logging.getLogger("pravaha.storage")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Configurable centralized local storage path
DEFAULT_STORAGE_REL = os.path.join("storage", "documents")
STORAGE_ENV_PATH = os.getenv("LOCAL_DOCUMENT_STORAGE_PATH", DEFAULT_STORAGE_REL)

if os.path.isabs(STORAGE_ENV_PATH):
    STORAGE_DIR = os.path.normpath(STORAGE_ENV_PATH)
else:
    STORAGE_DIR = os.path.normpath(os.path.join(BASE_DIR, STORAGE_ENV_PATH))

MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "image/png",
    "image/jpeg",
    "application/octet-stream"
}


def get_storage_dir() -> str:
    """Returns the active verified storage directory path."""
    return STORAGE_DIR


def sanitize_filename(filename: str) -> str:
    """Strips path traversal sequences and unsafe characters from filenames."""
    base = os.path.basename(filename)
    safe = re.sub(r"[^a-zA-Z0-9_\.-]", "_", base)
    return safe[:120] or "unnamed_document.pdf"


def init_storage() -> Dict[str, Any]:
    """
    Initializes and verifies the persistent document storage directory at application startup.
    Performs writability and read-back health checks.
    Automatically falls back to local application storage or temp directory if the configured
    path has permission restrictions (e.g. non-root container environments like Render).
    """
    global STORAGE_DIR
    import tempfile

    candidates = [
        STORAGE_DIR,
        os.path.normpath(os.path.join(BASE_DIR, "storage", "documents")),
        os.path.normpath(os.path.join(tempfile.gettempdir(), "pravaha_storage"))
    ]

    last_err = None
    for cand in candidates:
        try:
            os.makedirs(cand, exist_ok=True)
            test_file = os.path.join(cand, f".health_check_{uuid.uuid4().hex[:8]}")
            with open(test_file, "w") as f:
                f.write("OK")
            if os.path.exists(test_file):
                os.remove(test_file)

            if cand != STORAGE_DIR:
                logger.warning(
                    f"[STORAGE WARNING] Configured path '{STORAGE_DIR}' is not writable ({last_err}). "
                    f"Successfully fell back to writable directory: {cand}"
                )
                print(
                    f"[STORAGE WARNING] Configured path '{STORAGE_DIR}' was not writable ({last_err}). "
                    f"Fell back to: {cand}",
                    flush=True
                )
                STORAGE_DIR = cand
            else:
                logger.info(f"[STORAGE] Verified persistent local document storage at: {STORAGE_DIR}")
                print(f"[STORAGE] Verified persistent local document storage at: {STORAGE_DIR}", flush=True)

            return {
                "status": "ready",
                "directory": STORAGE_DIR,
                "max_upload_size_mb": MAX_UPLOAD_SIZE_MB,
                "writable": True
            }
        except Exception as e:
            last_err = e
            logger.warning(f"[STORAGE] Could not initialize directory at {cand}: {e}")
            continue

    logger.error(f"[STORAGE FATAL] All storage directories failed. Last error: {last_err}")
    print(f"[STORAGE FATAL] All storage directories failed. Last error: {last_err}", flush=True)
    return {
        "status": "error",
        "directory": STORAGE_DIR,
        "error": str(last_err),
        "writable": False
    }


def compute_sha256(content: bytes) -> str:
    """Computes the SHA-256 cryptographic hash of document bytes."""
    return hashlib.sha256(content).hexdigest()


def save_uploaded_document(
    content: bytes,
    original_filename: str,
    content_type: Optional[str] = None
) -> Dict[str, Any]:
    """
    Safely persists uploaded document bytes to local storage:
    1. Validates size constraints (rejects 0 bytes, enforces MAX_UPLOAD_SIZE_MB)
    2. Validates permitted file extension
    3. Generates sanitized, unguessable internal stored filename
    4. Computes SHA-256 checksum for audit and integrity verification
    5. Saves bytes to disk
    6. Returns metadata including relative storage path (never exposes absolute server paths)
    """
    safe_name = sanitize_filename(original_filename)
    ext = os.path.splitext(safe_name)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Permitted extensions: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    file_size = len(content)
    if file_size == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty (0 bytes). Please upload a valid regulatory document."
        )

    if file_size > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum permitted limit of {MAX_UPLOAD_SIZE_MB}MB (Current size: {round(file_size / (1024*1024), 2)}MB)"
        )

    # Calculate SHA-256
    file_hash = compute_sha256(content)

    # Generate unique stored filename
    stored_filename = f"{uuid.uuid4().hex}_{safe_name}"
    abs_path = os.path.join(STORAGE_DIR, stored_filename)

    # Relative path for portable database storage
    rel_path = os.path.relpath(abs_path, BASE_DIR).replace("\\", "/")

    try:
        with open(abs_path, "wb") as f:
            f.write(content)
    except Exception as e:
        logger.error(f"[STORAGE] Failed to write file to disk: {e}")
        raise HTTPException(status_code=500, detail=f"Storage write error: Failed to save file to local disk.")

    return {
        "original_filename": safe_name,
        "stored_filename": stored_filename,
        "relative_path": rel_path,
        "absolute_path": abs_path,
        "file_size": file_size,
        "file_hash": file_hash,
        "mime_type": content_type or "application/octet-stream"
    }


def delete_stored_document(stored_filename_or_rel_path: str) -> bool:
    """
    Safely deletes a stored document file (used during failure recovery / rollback).
    """
    try:
        abs_path = resolve_storage_path(stored_filename_or_rel_path)
        if os.path.exists(abs_path):
            os.remove(abs_path)
            logger.info(f"[STORAGE] Cleaned up file: {abs_path}")
            return True
    except Exception as e:
        logger.warning(f"[STORAGE] Could not delete stored file '{stored_filename_or_rel_path}': {e}")
    return False


def resolve_storage_path(stored_reference: str) -> str:
    """
    Resolves a stored filename or relative path to its absolute filesystem path.
    Enforces strict path traversal prevention: ensures the target is inside STORAGE_DIR.
    """
    if not stored_reference or not stored_reference.strip():
        raise HTTPException(status_code=400, detail="Invalid empty storage reference.")

    clean_ref = stored_reference.strip().replace("\\", "/")
    
    # Reject directory traversal sequences explicitly
    if ".." in clean_ref or clean_ref.startswith("/") or (len(clean_ref) > 1 and clean_ref[1] == ":"):
        # If it's an absolute path, only permit if it resides directly within STORAGE_DIR
        norm_input = os.path.normpath(clean_ref)
        if not norm_input.startswith(STORAGE_DIR):
            raise HTTPException(status_code=400, detail="Path traversal attempt detected. Access denied.")

    base_name = os.path.basename(clean_ref)
    target_abs = os.path.normpath(os.path.join(STORAGE_DIR, base_name))

    # Verify target stays inside STORAGE_DIR
    try:
        common = os.path.commonpath([target_abs, STORAGE_DIR])
        if common != STORAGE_DIR:
            raise HTTPException(status_code=400, detail="Path traversal attempt detected. Access denied.")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid path specification across drive boundaries.")

    return target_abs


def read_document_bytes(stored_reference: str) -> bytes:
    """
    Reads the original file bytes from disk given a stored reference.
    Validates existence and permissions.
    """
    abs_path = resolve_storage_path(stored_reference)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Original document file not found on local storage.")
    try:
        with open(abs_path, "rb") as f:
            return f.read()
    except Exception as e:
        logger.error(f"[STORAGE] Failed to read stored document {abs_path}: {e}")
        raise HTTPException(status_code=500, detail="Failed to read document from local storage.")


def verify_file_integrity(stored_reference: str, expected_hash: str) -> bool:
    """
    Verifies that the file on disk matches its recorded SHA-256 hash.
    Detects tampering or bit rot.
    """
    try:
        content = read_document_bytes(stored_reference)
        actual_hash = compute_sha256(content)
        return actual_hash.lower() == expected_hash.strip().lower()
    except Exception:
        return False


def get_storage_diagnostics() -> Dict[str, Any]:
    """
    Returns diagnostics on local document storage:
    capacity, total stored files, total bytes used, and directory accessibility.
    """
    try:
        if not os.path.exists(STORAGE_DIR):
            return {
                "status": "missing_directory",
                "directory": STORAGE_DIR,
                "file_count": 0,
                "total_bytes": 0
            }

        files = [f for f in os.listdir(STORAGE_DIR) if os.path.isfile(os.path.join(STORAGE_DIR, f))]
        total_bytes = sum(os.path.getsize(os.path.join(STORAGE_DIR, f)) for f in files)
        
        # Disk usage if available
        free_bytes = None
        try:
            usage = shutil.disk_usage(STORAGE_DIR)
            free_bytes = usage.free
        except Exception:
            pass

        return {
            "status": "healthy",
            "directory": STORAGE_DIR,
            "file_count": len(files),
            "total_bytes": total_bytes,
            "total_mb": round(total_bytes / (1024 * 1024), 2),
            "free_bytes": free_bytes,
            "max_file_size_mb": MAX_UPLOAD_SIZE_MB
        }
    except Exception as e:
        return {
            "status": "error",
            "directory": STORAGE_DIR,
            "error": str(e)
        }


def reconcile_storage(db_documents: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Reconciles database document records with physical files on disk:
    1. Identifies database records referencing missing disk files.
    2. Identifies orphaned disk files not referenced by any database record.
    3. Verifies SHA-256 checksums for all active records.
    """
    if not os.path.exists(STORAGE_DIR):
        return {"error": "Storage directory does not exist"}

    disk_files = set(os.listdir(STORAGE_DIR))
    db_referenced_files = set()
    missing_from_disk = []
    integrity_failures = []

    for doc in db_documents:
        stored_ref = doc.get("file_path") or doc.get("stored_filename") or ""
        base_name = os.path.basename(stored_ref.replace("\\", "/"))
        expected_hash = doc.get("file_hash")

        if not base_name or base_name not in disk_files:
            missing_from_disk.append({
                "document_id": doc.get("id"),
                "document_name": doc.get("document_name"),
                "expected_file": base_name
            })
        else:
            db_referenced_files.add(base_name)
            if expected_hash:
                abs_path = os.path.join(STORAGE_DIR, base_name)
                try:
                    with open(abs_path, "rb") as f:
                        curr_hash = hashlib.sha256(f.read()).hexdigest()
                    if curr_hash.lower() != expected_hash.lower():
                        integrity_failures.append({
                            "document_id": doc.get("id"),
                            "expected_hash": expected_hash,
                            "actual_hash": curr_hash
                        })
                except Exception as e:
                    integrity_failures.append({
                        "document_id": doc.get("id"),
                        "error": str(e)
                    })

    orphans = list(disk_files - db_referenced_files)
    # Exclude hidden files
    orphans = [o for o in orphans if not o.startswith(".")]

    return {
        "total_disk_files": len(disk_files),
        "total_db_records": len(db_documents),
        "missing_files_count": len(missing_from_disk),
        "missing_files": missing_from_disk,
        "orphaned_files_count": len(orphans),
        "orphaned_files": orphans,
        "integrity_failures_count": len(integrity_failures),
        "integrity_failures": integrity_failures
    }

