import os
import io
import uuid
import re
from typing import Dict, Any, Tuple
from fastapi import HTTPException, UploadFile
import pypdf
import docx

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit


def sanitize_filename(filename: str) -> str:
    """Removes path traversal and unsafe characters from filenames."""
    base = os.path.basename(filename)
    safe = re.sub(r"[^a-zA-Z0-9_\.-]", "_", base)
    return safe[:100] or "unnamed_file.pdf"


def extract_text_from_pdf(content: bytes) -> Tuple[str, int]:
    """Safely extracts text and page count from PDF binary data."""
    if not content:
        return ("", 0)
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        num_pages = len(reader.pages)
        pages_text = []
        for i, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    pages_text.append(f"[Page {i+1}]\n{page_text}")
            except Exception:
                continue
        extracted = "\n\n".join(pages_text).strip()
        if not extracted:
            extracted = f"[Notice: PDF containing {num_pages} page(s) has non-extractable text, vector drawings, or is a scanned image]."
        return (extracted, num_pages)
    except Exception as e:
        return (f"[Notice: Unable to parse PDF structure: {str(e)}]", 0)


def extract_text_from_docx(content: bytes) -> Tuple[str, int]:
    """Safely extracts text and paragraph count from DOCX binary data."""
    if not content:
        return ("", 0)
    try:
        doc = docx.Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        return ("\n".join(paragraphs).strip(), len(paragraphs))
    except Exception as e:
        return (f"[Notice: Unable to parse DOCX structure: {str(e)}]", 0)


def extract_text_from_txt(content: bytes) -> Tuple[str, int]:
    """Decodes plain text with fallback encodings."""
    if not content:
        return ("", 0)
    for enc in ["utf-8", "latin-1", "cp1252"]:
        try:
            text = content.decode(enc)
            return (text.strip(), len(text.splitlines()))
        except UnicodeDecodeError:
            continue
    return (content.decode("utf-8", errors="ignore").strip(), 0)


async def process_and_store_upload(file: UploadFile) -> Dict[str, Any]:
    """
    Ingests an uploaded document:
    1. Validates size (<= 10MB)
    2. Validates allowed file extension (.pdf, .docx, .doc, .txt, .png, .jpg, .jpeg)
    3. Saves file with secure UUID filename in UPLOAD_DIR
    4. Extracts text safely using appropriate format parser
    5. Returns metadata and extracted text
    """
    safe_name = sanitize_filename(file.filename or "upload.pdf")
    ext = os.path.splitext(safe_name)[1].lower()
    allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".png", ".jpg", ".jpeg"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Permitted extensions: {', '.join(sorted(allowed_exts))}"
        )

    content = await file.read()
    file_size = len(content)
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum permitted limit of 10MB (Current size: {round(file_size / (1024*1024), 2)}MB)"
        )
    if file_size == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty (0 bytes). Please upload a valid document."
        )

    # Generate unique stored filename
    stored_name = f"{uuid.uuid4().hex}_{safe_name}"
    stored_path = os.path.join(UPLOAD_DIR, stored_name)

    # Save to disk
    with open(stored_path, "wb") as f:
        f.write(content)

    # Extract text based on file format
    extracted_text = ""
    unit_count = 0
    if ext == ".pdf":
        extracted_text, unit_count = extract_text_from_pdf(content)
    elif ext in [".docx", ".doc"]:
        extracted_text, unit_count = extract_text_from_docx(content)
    elif ext == ".txt":
        extracted_text, unit_count = extract_text_from_txt(content)
    else:
        extracted_text = f"Image document '{safe_name}' ({file_size} bytes). Visual scrutiny by authorized officer required."

    return {
        "original_filename": safe_name,
        "stored_filename": stored_name,
        "stored_filepath": stored_path,
        "file_size": file_size,
        "mime_type": file.content_type or "application/octet-stream",
        "extracted_text": extracted_text,
        "unit_count": unit_count
    }
