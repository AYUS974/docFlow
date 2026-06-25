/**
 * Thin gateway to the pdf-svc Python sidecar.
 *
 * Next.js API routes stay dumb: they forward a multipart request to pdf-svc
 * and stream the (binary PDF) response straight back to the browser. No
 * base64, no buffering the whole file in memory.
 */
import { NextResponse } from 'next/server';

const PDF_SVC_URL = process.env.PDF_SVC_URL || 'http://localhost:8000';

/** Forward an already-built FormData to a pdf-svc endpoint and stream back. */
export async function forwardToPdfSvc(
  path: string,
  form: FormData,
  downloadName?: string
): Promise<NextResponse> {
  let upstream: Response;
  try {
    upstream = await fetch(`${PDF_SVC_URL}${path}`, { method: 'POST', body: form });
  } catch {
    return NextResponse.json(
      { error: 'PDF service unavailable. Is pdf-svc running?' },
      { status: 502 }
    );
  }

  if (!upstream.ok) {
    let detail = `pdf-svc returned ${upstream.status}`;
    try {
      const body = await upstream.json();
      if (body?.detail) detail = String(body.detail);
    } catch {
      /* non-JSON error body */
    }
    return NextResponse.json({ error: detail }, { status: upstream.status });
  }

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/pdf');
  if (downloadName) {
    headers.set('Content-Disposition', `attachment; filename="${downloadName}"`);
  }
  return new NextResponse(upstream.body, { status: 200, headers });
}

export { PDF_SVC_URL };
