import os
import io
import uuid
import re
from typing import Dict, Any, Tuple, List, Optional
from fastapi import HTTPException, UploadFile

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit


def sanitize_filename(filename: str) -> str:
    """Removes path traversal and unsafe characters from filenames."""
    base = os.path.basename(filename)
    safe = re.sub(r"[^a-zA-Z0-9_\.-]", "_", base)
    return safe[:100] or "unnamed_file.pdf"


def extract_pages_from_pdf(content: bytes) -> Tuple[str, int, List[Dict[str, Any]], bool]:
    """
    Safely extracts page-by-page text, total page count, structured pages list,
    and a flag indicating whether the text layer is readable.
    """
    if not content:
        return ("", 0, [], False)
    if pypdf is None:
        return ("[Notice: pypdf library is not available for PDF text extraction]", 0, [], False)
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        num_pages = len(reader.pages)
        pages_data: List[Dict[str, Any]] = []
        pages_text: List[str] = []
        total_extracted_chars = 0

        for i, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                clean_text = page_text.strip()
                pages_data.append({
                    "page_number": i + 1,
                    "text": clean_text,
                    "char_count": len(clean_text)
                })
                total_extracted_chars += len(clean_text)
                if clean_text:
                    pages_text.append(f"[Page {i+1}]\n{clean_text}")
            except Exception:
                pages_data.append({
                    "page_number": i + 1,
                    "text": "",
                    "char_count": 0
                })
                continue

        extracted = "\n\n".join(pages_text).strip()
        is_readable = bool(extracted and total_extracted_chars >= 20)
        if not is_readable:
            notice = f"[Notice: PDF containing {num_pages} page(s) has non-extractable text, vector drawings, or is a scanned image]."
            return (notice, num_pages, pages_data, False)

        return (extracted, num_pages, pages_data, True)
    except Exception as e:
        error_msg = f"[Notice: Unable to parse PDF structure: {str(e)}]"
        return (error_msg, 0, [], False)


def extract_text_from_pdf(content: bytes) -> Tuple[str, int]:
    """Safely extracts text and page count from PDF binary data (backward compatible)."""
    text, num_pages, _, _ = extract_pages_from_pdf(content)
    return (text, num_pages)


def extract_text_from_docx(content: bytes) -> Tuple[str, int]:
    """Safely extracts text and paragraph/table row count from DOCX binary data."""
    if not content:
        return ("", 0)
    if docx is None:
        return ("[Notice: python-docx library is not available for DOCX text extraction]", 0)
    try:
        doc = docx.Document(io.BytesIO(content))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        extracted = "\n".join(paragraphs).strip()
        return (extracted, len(paragraphs))
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


def find_page_number_for_quote(
    quote: str,
    full_text: str,
    pages_data: Optional[List[Dict[str, Any]]] = None
) -> Optional[int]:
    """
    Accurately determines the 1-based page number where a given quote appears.
    Never invents page numbers: returns None if not deterministically found.
    """
    if not quote or not quote.strip():
        return None

    clean_quote = quote.strip().lower()

    # 1. Search in structured pages_data if available
    if pages_data:
        for p in pages_data:
            p_text = (p.get("text") or "").lower()
            if clean_quote in p_text or (len(clean_quote) > 30 and clean_quote[:30] in p_text):
                return int(p["page_number"])

    # 2. Search for [Page X] tags in full_text preceding the quote
    if "[Page " in full_text:
        idx = full_text.lower().find(clean_quote)
        if idx == -1 and len(clean_quote) > 30:
            idx = full_text.lower().find(clean_quote[:30])

        if idx != -1:
            preceding_text = full_text[:idx]
            page_matches = re.findall(r"\[Page\s+(\d+)\]", preceding_text)
            if page_matches:
                return int(page_matches[-1])

    return None


async def process_and_store_upload(file: UploadFile) -> Dict[str, Any]:
    """
    Ingests an uploaded document:
    1. Validates size (<= 10MB)
    2. Validates allowed file extension (.pdf, .docx, .doc, .txt, .png, .jpg, .jpeg)
    3. Saves file with secure UUID filename in UPLOAD_DIR
    4. Extracts text safely using appropriate format parser
    5. Returns metadata, readability status, and extracted text
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
    is_readable = True
    extraction_status = "SUCCESS"
    pages_data: List[Dict[str, Any]] = []

    if ext == ".pdf":
        extracted_text, unit_count, pages_data, is_readable = extract_pages_from_pdf(content)
        if not is_readable:
            extraction_status = "UNREADABLE_OR_SCANNED"
    elif ext in [".docx", ".doc"]:
        extracted_text, unit_count = extract_text_from_docx(content)
        is_readable = bool(extracted_text.strip() and not extracted_text.startswith("[Notice:"))
        if not is_readable:
            extraction_status = "UNREADABLE_OR_EMPTY"
    elif ext == ".txt":
        extracted_text, unit_count = extract_text_from_txt(content)
        is_readable = bool(extracted_text.strip())
        if not is_readable:
            extraction_status = "EMPTY"
    else:
        extracted_text = f"Image document '{safe_name}' ({file_size} bytes). Visual scrutiny by authorized officer required."
        is_readable = False
        extraction_status = "IMAGE_MANUAL_REVIEW_REQUIRED"

    return {
        "original_filename": safe_name,
        "stored_filename": stored_name,
        "stored_filepath": stored_path,
        "file_size": file_size,
        "mime_type": file.content_type or "application/octet-stream",
        "extracted_text": extracted_text,
        "unit_count": unit_count,
        "is_readable": is_readable,
        "extraction_status": extraction_status,
        "pages_data": pages_data
    }
