import { NextResponse } from 'next/server';
import { forwardToPdfSvc } from '@/lib/pdfsvc';

/**
 * OCR — make a scanned PDF searchable. Accepts multipart/form-data:
 *   file      - the PDF
 *   language  - Tesseract lang code(s), default "eng" (e.g. "eng+deu")
 *   force     - "true" to re-OCR pages that already have text
 * Forwards to pdf-svc /ocr (OCRmyPDF + Tesseract) and streams the result back.
 */
export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = incoming.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const form = new FormData();
  form.append('file', file, 'input.pdf');
  form.append('language', (incoming.get('language') as string) || 'eng');
  form.append('force', (incoming.get('force') as string) || 'false');

  return forwardToPdfSvc('/ocr', form, 'ocr.pdf');
}
