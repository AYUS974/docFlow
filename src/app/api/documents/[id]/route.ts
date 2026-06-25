import { NextResponse } from 'next/server';
import { getDocument, updateDocument } from '@/lib/storage';
import { getWorkspaceId } from '@/lib/workspace';

type Params = { params: Promise<{ id: string }> };

async function resolveId(request: Request, params: Params['params']): Promise<string | null> {
  const { id } = await params;
  if (id) return id;
  // Fallback: also accept ?id= for backward compatibility.
  return new URL(request.url).searchParams.get('id');
}

export async function GET(request: Request, { params }: Params) {
  try {
    const wsid = await getWorkspaceId();
    const id = await resolveId(request, params);
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const document = await getDocument(wsid, id);
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const wsid = await getWorkspaceId();
    const id = await resolveId(request, params);
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const { title } = await request.json();
    const document = await updateDocument(wsid, id, { title });
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(document);
  } catch {
    return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
  }
}
