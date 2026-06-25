FROM python:3.12-slim

# System toolchain. PyMuPDF (redaction, render, extract) ships as a wheel and
# needs nothing here, but the chosen roadmap — OCR + Office conversion — pulls
# in the same binaries Sejda/Stirling-PDF use:
#   tesseract-ocr  -> OCR (via ocrmypdf)
#   ghostscript    -> compression / PDF-A / OCR rasterization
#   qpdf           -> encryption / decryption / linearization
#   libreoffice    -> Office <-> PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
      ghostscript \
      qpdf \
      tesseract-ocr \
      tesseract-ocr-eng \
      unpaper \
      pngquant \
      libreoffice-core \
      libreoffice-writer \
      libreoffice-calc \
      libreoffice-impress \
      fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
