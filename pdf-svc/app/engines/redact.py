"""True PDF redaction using PyMuPDF.

Unlike drawing a black rectangle (which leaves the underlying text extractable),
`apply_redactions()` removes the text/vector/image content that intersects each
redaction rectangle from the page content stream, then we sanitize the file.

Redaction rectangles arrive as fractions (0..1) of the page size with a
top-left origin (matching pdf.js / canvas coordinates). This avoids any
DPI / zoom / origin mismatch between the browser and the PDF engine.
"""
from __future__ import annotations

import fitz  # PyMuPDF


def redact_pdf(data: bytes, redactions: list[dict]) -> bytes:
    """Apply redactions and return sanitized PDF bytes.

    redactions: [{ "page": <1-based int>,
                   "rects": [{ "x0":f, "y0":f, "x1":f, "y1":f }, ...] }]
    Fractions are clamped to [0,1]; the page's own rect (origin + size) is used
    so rotated/offset MediaBoxes still map correctly.
    """
    doc = fitz.open(stream=data, filetype="pdf")
    try:
        by_page: dict[int, list[dict]] = {}
        for entry in redactions:
            page_no = int(entry.get("page", 0))
            rects = entry.get("rects") or []
            if rects:
                by_page.setdefault(page_no, []).extend(rects)

        for page_no, rects in by_page.items():
            idx = page_no - 1
            if idx < 0 or idx >= doc.page_count:
                continue
            page = doc[idx]
            pr = page.rect  # page rectangle in points (accounts for offset)
            w, h = pr.width, pr.height
            added = 0
            for rc in rects:
                try:
                    x0 = pr.x0 + _clamp(rc["x0"]) * w
                    y0 = pr.y0 + _clamp(rc["y0"]) * h
                    x1 = pr.x0 + _clamp(rc["x1"]) * w
                    y1 = pr.y0 + _clamp(rc["y1"]) * h
                except (KeyError, TypeError, ValueError):
                    continue
                rect = fitz.Rect(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))
                if rect.is_empty or rect.is_infinite:
                    continue
                # Black fill over the redacted region; underlying content removed.
                page.add_redact_annot(rect, fill=(0, 0, 0))
                added += 1
            if added:
                # Remove text + vector graphics; black out any images touched.
                page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_PIXELS)

        # garbage=4 + clean rebuilds/compresses and drops orphaned objects.
        return doc.tobytes(garbage=4, deflate=True, clean=True)
    finally:
        doc.close()


def _clamp(value) -> float:
    v = float(value)
    if v < 0.0:
        return 0.0
    if v > 1.0:
        return 1.0
    return v
