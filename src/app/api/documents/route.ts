import { NextResponse } from 'next/server';
import { listDocuments, createDocument, deleteDocument } from '@/lib/storage';
import { getWorkspaceId } from '@/lib/workspace';

export async function GET() {
  try {
    const wsid = await getWorkspaceId();
    const documents = await listDocuments(wsid);
    return NextResponse.json(documents);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const wsid = await getWorkspaceId();
    const body = await request.json();
    const { title, fileName, fileSize, pageCount, data } = body;

    if (!fileName || !data) {
      return NextResponse.json({ error: 'Missing fileName or data' }, { status: 400 });
    }

    const document = await createDocument(wsid, { title, fileName, fileSize, pageCount, data });
    return NextResponse.json(document);
  } catch {
    return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const wsid = await getWorkspaceId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    await deleteDocument(wsid, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
