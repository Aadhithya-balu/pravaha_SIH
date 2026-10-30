import os
import io
import uuid
import re
import hashlib
from typing import Dict, Any, Tuple, List, Optional
from fastapi import HTTPException, UploadFile

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

try:
    from PIL import Image
    import pytesseract
except ImportError:
    Image = None
    pytesseract = None

UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads"))
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit


def is_tesseract_available() -> bool:
    """Checks whether tesseract OCR binary is reachable and operational."""
    if pytesseract is None:
        return False
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def sanitize_filename(filename: str) -> str:
    """Removes path traversal and unsafe characters from filenames."""
    base = os.path.basename(filename)
    safe = re.sub(r"[^a-zA-Z0-9_\.-]", "_", base)
    return safe[:100] or "unnamed_file.pdf"


def extract_pages_from_pdf(content: bytes) -> Tuple[str, int, List[Dict[str, Any]], bool]:
    """
    Safely extracts page-by-page text, total page count, structured pages list,
    and a flag indicating whether the text layer is readable.
    Prefers PyMuPDF (fitz) with fallback to pypdf.
    """
    if not content:
        return ("", 0, [], False)

    # 1. Try PyMuPDF (fitz) first for high fidelity extraction
    if fitz is not None:
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            num_pages = len(doc)
            pages_data: List[Dict[str, Any]] = []
            pages_text: List[str] = []
            total_extracted_chars = 0
            has_tesseract = is_tesseract_available()

            for i, page in enumerate(doc):
                page_text = page.get_text() or ""
                clean_text = page_text.strip()

                # If page text is negligible and Tesseract OCR is available, try OCR on pixmap
                if len(clean_text) < 20 and has_tesseract and Image is not None:
                    try:
                        pix = page.get_pixmap(dpi=150)
                        img = Image.open(io.BytesIO(pix.tobytes("png")))
                        ocr_text = pytesseract.image_to_string(img) or ""
                        if len(ocr_text.strip()) > len(clean_text):
                            clean_text = f"[OCR Extracted]\n{ocr_text.strip()}"
                    except Exception:
                        pass

                pages_data.append({
                    "page_number": i + 1,
                    "text": clean_text,
                    "char_count": len(clean_text)
                })
                total_extracted_chars += len(clean_text)
                if clean_text:
                    pages_text.append(f"[Page {i+1}]\n{clean_text}")

            extracted = "\n\n".join(pages_text).strip()
            is_readable = bool(extracted and total_extracted_chars >= 20)
            if not is_readable:
                notice = f"[Notice: PDF containing {num_pages} page(s) has non-extractable text, vector drawings, or is a scanned image]."
                return (notice, num_pages, pages_data, False)

            return (extracted, num_pages, pages_data, True)
        except Exception:
            pass  # Fall through to pypdf

    # 2. Fallback to pypdf
    if pypdf is not None:
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

    return ("[Notice: Neither PyMuPDF nor pypdf library is available for PDF text extraction]", 0, [], False)


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


def extract_text_from_image(content: bytes, filename: str) -> Tuple[str, bool, str]:
    """Extracts text from scanned image file using OCR if available or structured metadata."""
    has_tess = is_tesseract_available()
    img_info = ""
    img_text = ""
    if Image is not None:
        try:
            img = Image.open(io.BytesIO(content))
            width, height = img.size
            img_format = img.format or "IMAGE"
            img_info = f"Scanned Image '{filename}' (Dimensions: {width}x{height}px, Format: {img_format})"
            if has_tess:
                img_text = (pytesseract.image_to_string(img) or "").strip()
        except Exception:
            pass

    if img_text:
        return (f"[Page 1 - OCR Ingested]\n{img_text}", True, "OCR_SUCCESS")
    elif has_tess:
        return (f"[{img_info or filename}: Optical scan completed. No legible textual layer detected.]", False, "SCANNED_NO_TEXT")
    else:
        return (f"[{img_info or filename}: Scanned image received and cataloged for statutory scrutiny.]", False, "SCANNED_IMAGE_DETECTED")


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


def parse_document_content(content: bytes, filename: str) -> Dict[str, Any]:
    """
    Core document parsing pipeline used for both upload and re-processing.
    Returns extracted_text, unit_count, is_readable, extraction_status, pages_data, file_hash.
    """
    safe_name = sanitize_filename(filename)
    ext = os.path.splitext(safe_name)[1].lower()
    file_hash = hashlib.sha256(content).hexdigest()

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
    elif ext in [".png", ".jpg", ".jpeg", ".tiff", ".bmp"]:
        extracted_text, is_readable, extraction_status = extract_text_from_image(content, safe_name)
        unit_count = 1
        pages_data = [{"page_number": 1, "text": extracted_text, "char_count": len(extracted_text)}]
    else:
        extracted_text = f"Document '{safe_name}' ({len(content)} bytes). Scrutiny review required."
        is_readable = False
        extraction_status = "MANUAL_REVIEW_REQUIRED"

    return {
        "original_filename": safe_name,
        "file_hash": file_hash,
        "file_size": len(content),
        "extracted_text": extracted_text,
        "unit_count": unit_count,
        "is_readable": is_readable,
        "extraction_status": extraction_status,
        "pages_data": pages_data
    }


async def process_and_store_upload(file: UploadFile) -> Dict[str, Any]:
    """
    Ingests an uploaded document:
    1. Validates size (<= 10MB)
    2. Validates allowed file extension (.pdf, .docx, .doc, .txt, .png, .jpg, .jpeg)
    3. Saves file with secure UUID filename in UPLOAD_DIR
    4. Extracts text safely using appropriate format parser
    5. Calculates cryptographic SHA-256 hash
    6. Returns metadata, readability status, and extracted text
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

    parse_result = parse_document_content(content, safe_name)

    return {
        "original_filename": safe_name,
        "stored_filename": stored_name,
        "stored_filepath": stored_path,
        "file_size": file_size,
        "file_hash": parse_result["file_hash"],
        "mime_type": file.content_type or "application/octet-stream",
        "extracted_text": parse_result["extracted_text"],
        "unit_count": parse_result["unit_count"],
        "is_readable": parse_result["is_readable"],
        "extraction_status": parse_result["extraction_status"],
        "pages_data": parse_result["pages_data"]
    }
