"""DocFlow PDF processing service.

A stateless FastAPI sidecar that performs the PDF operations that pure-JS
pdf-lib cannot do correctly: true redaction (now), plus OCR / Office
conversion / compression / encryption (subsequent phases).

Files arrive as multipart uploads and results stream back as bytes — no
base64-in-JSON, so there is no payload-size ceiling or btoa() overflow.
"""
from __future__ import annotations

import json

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response

from app.engines.ocr import ocr_pdf
from app.engines.redact import redact_pdf

app = FastAPI(title="DocFlow PDF Service", version="0.1.0")

MAX_BYTES = 200 * 1024 * 1024  # 200 MB hard ceiling


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "pdf-svc"}


@app.post("/redact")
async def redact(
    file: UploadFile = File(...),
    redactions: str = Form(...),
) -> Response:
    """Permanently remove content under the given rectangles.

    `redactions` is a JSON string:
      [{ "page": 1, "rects": [{ "x0":0.1,"y0":0.2,"x1":0.4,"y1":0.25 }] }]
    with coordinates as fractions (0..1) of page size, top-left origin.
    """
    try:
        parsed = json.loads(redactions)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="`redactions` must be valid JSON")
    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="`redactions` must be a JSON array")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    try:
        out = redact_pdf(data, parsed)
    except Exception as err:  # noqa: BLE001 - surface engine errors to the gateway
        raise HTTPException(status_code=422, detail=f"redaction failed: {err}")

    return Response(
        content=out,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="redacted.pdf"'},
    )


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    language: str = Form("eng"),
    force: bool = Form(False),
) -> Response:
    """Make a PDF searchable by adding an OCR text layer (Tesseract)."""
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="file too large")

    try:
        out = ocr_pdf(data, language=language, force=force)
    except Exception as err:  # noqa: BLE001 - surface engine errors to the gateway
        raise HTTPException(status_code=422, detail=f"OCR failed: {err}")

    return Response(
        content=out,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="ocr.pdf"'},
    )
