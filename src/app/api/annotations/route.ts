import { NextResponse } from 'next/server';
import { createAnnotation, deleteAnnotation } from '@/lib/storage';
import { getWorkspaceId } from '@/lib/workspace';

export async function POST(request: Request) {
  try {
    const wsid = await getWorkspaceId();
    const body = await request.json();
    const {
      type, pageNumber, x, y, width, height,
      content, color, strokeWidth, points, documentId
    } = body;

    if (!documentId || !type || !pageNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const annotation = await createAnnotation(wsid, {
      type, pageNumber, x, y, width, height,
      content, color, strokeWidth, points, documentId,
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json(annotation);
  } catch {
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const wsid = await getWorkspaceId();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Annotation ID is required' }, { status: 400 });
    }

    await deleteAnnotation(wsid, id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}
