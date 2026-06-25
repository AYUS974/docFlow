"""OCR a PDF into a searchable PDF using OCRmyPDF (Tesseract + Ghostscript).

OCRmyPDF adds an invisible text layer over the page images so the content
becomes selectable/searchable without changing how the page looks. This is the
same engine class Sejda/Stirling-PDF use for OCR.
"""
from __future__ import annotations

import os
import tempfile

import ocrmypdf


def ocr_pdf(data: bytes, language: str = "eng", force: bool = False) -> bytes:
    """Return a searchable copy of the PDF.

    language: Tesseract language code(s), e.g. "eng" or "eng+deu".
    force:    re-OCR pages that already contain text (force_ocr). When False,
              pages with an existing text layer are passed through (skip_text)
              so mixed PDFs don't error.
    """
    with tempfile.TemporaryDirectory() as td:
        in_path = os.path.join(td, "in.pdf")
        out_path = os.path.join(td, "out.pdf")
        with open(in_path, "wb") as f:
            f.write(data)

        kwargs: dict = {
            "language": language or "eng",
            "progress_bar": False,
            "optimize": 1,
        }
        if force:
            kwargs["force_ocr"] = True
        else:
            # Don't fail when some/all pages already have a text layer.
            kwargs["skip_text"] = True

        ocrmypdf.ocr(in_path, out_path, **kwargs)

        with open(out_path, "rb") as f:
            return f.read()
