import { NextResponse } from 'next/server';
import { forwardToPdfSvc } from '@/lib/pdfsvc';

/**
 * Real redaction. Accepts multipart/form-data:
 *   file        - the PDF
 *   redactions  - JSON array: [{ page, rects:[{x0,y0,x1,y1}] }] (fractions 0..1)
 * Forwards to pdf-svc /redact (PyMuPDF apply_redactions) and streams the
 * sanitized PDF back. The underlying text/content is removed, not just hidden.
 */
export async function POST(request: Request) {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = incoming.get('file');
  const redactions = incoming.get('redactions');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (typeof redactions !== 'string') {
    return NextResponse.json({ error: 'Missing redactions' }, { status: 400 });
  }

  const form = new FormData();
  form.append('file', file, 'input.pdf');
  form.append('redactions', redactions);

  return forwardToPdfSvc('/redact', form, 'redacted.pdf');
}
