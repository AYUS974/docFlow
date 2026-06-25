import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

/**
 * File-based, per-workspace document storage.
 *
 * Each browser (anonymous session) gets its own workspace id (`wsid`, set as an
 * httpOnly cookie by middleware). Documents live at
 *   <STORAGE_DIR>/workspaces/<wsid>/<docId>.json
 * holding metadata, the base64 PDF payload, and annotations inline.
 *
 * Every function is scoped to a wsid, so one workspace can never read, mutate,
 * or delete another's documents (prevents cross-workspace access / IDOR).
 *
 * Set STORAGE_DIR in .env to relocate; defaults to ".data" in the project root.
 */
const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), '.data')
const WORKSPACES_DIR = path.join(STORAGE_DIR, 'workspaces')

export interface StoredAnnotation {
  id: string
  type: string
  pageNumber: number
  x: number
  y: number
  width: number | null
  height: number | null
  content: string | null
  color: string
  strokeWidth: number
  points: { x: number; y: number }[] | null
  documentId: string
  createdAt: string
}

export interface StoredDocument {
  id: string
  title: string
  fileName: string
  fileSize: number
  pageCount: number
  data: string
  createdAt: string
  annotations: StoredAnnotation[]
}

export type DocumentMeta = Omit<StoredDocument, 'data' | 'annotations'>

// Guard against path traversal via crafted wsid/id values.
function safe(segment: string): string {
  return path.basename(segment)
}

function wsDir(wsid: string): string {
  return path.join(WORKSPACES_DIR, safe(wsid))
}

async function ensureDir(wsid: string): Promise<void> {
  await fs.mkdir(wsDir(wsid), { recursive: true })
}

function docPath(wsid: string, id: string): string {
  return path.join(wsDir(wsid), `${safe(id)}.json`)
}

async function readDoc(wsid: string, id: string): Promise<StoredDocument | null> {
  try {
    const raw = await fs.readFile(docPath(wsid, id), 'utf-8')
    return JSON.parse(raw) as StoredDocument
  } catch {
    return null
  }
}

async function writeDoc(wsid: string, doc: StoredDocument): Promise<void> {
  await ensureDir(wsid)
  await fs.writeFile(docPath(wsid, doc.id), JSON.stringify(doc), 'utf-8')
}

export async function listDocuments(wsid: string): Promise<DocumentMeta[]> {
  await ensureDir(wsid)
  const dir = wsDir(wsid)
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))
  const docs: DocumentMeta[] = []
  for (const file of files) {
    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8')
      const doc = JSON.parse(raw) as StoredDocument
      docs.push({
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        createdAt: doc.createdAt,
      })
    } catch {
      /* skip unreadable/corrupt files */
    }
  }
  return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function getDocument(
  wsid: string,
  id: string
): Promise<StoredDocument | null> {
  const doc = await readDoc(wsid, id)
  if (!doc) return null
  // Mirror Prisma's `include: { annotations: { orderBy: createdAt asc } }`
  doc.annotations = [...(doc.annotations ?? [])].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  return doc
}

export async function createDocument(
  wsid: string,
  input: {
    title?: string
    fileName: string
    fileSize: number
    pageCount: number
    data: string
  }
): Promise<DocumentMeta> {
  const doc: StoredDocument = {
    id: randomUUID(),
    title: input.title || input.fileName.replace(/\.pdf$/i, ''),
    fileName: input.fileName,
    fileSize: input.fileSize,
    pageCount: input.pageCount,
    data: input.data,
    createdAt: new Date().toISOString(),
    annotations: [],
  }
  await writeDoc(wsid, doc)
  const { data: _data, annotations: _annotations, ...meta } = doc
  return meta
}

export async function updateDocument(
  wsid: string,
  id: string,
  updates: { title?: string }
): Promise<DocumentMeta | null> {
  const doc = await readDoc(wsid, id)
  if (!doc) return null
  if (typeof updates.title === 'string') doc.title = updates.title
  await writeDoc(wsid, doc)
  const { data: _data, annotations: _annotations, ...meta } = doc
  return meta
}

export async function deleteDocument(wsid: string, id: string): Promise<boolean> {
  try {
    await fs.unlink(docPath(wsid, id))
    return true
  } catch {
    return false
  }
}

export async function createAnnotation(
  wsid: string,
  input: {
    type: string
    pageNumber: number
    x: number
    y: number
    width?: number | null
    height?: number | null
    content?: string | null
    color?: string | null
    strokeWidth?: number | null
    points?: { x: number; y: number }[] | null
    documentId: string
  }
): Promise<StoredAnnotation | null> {
  const doc = await readDoc(wsid, input.documentId)
  if (!doc) return null
  const annotation: StoredAnnotation = {
    id: randomUUID(),
    type: input.type,
    pageNumber: input.pageNumber,
    x: input.x,
    y: input.y,
    width: input.width ?? null,
    height: input.height ?? null,
    content: input.content ?? null,
    color: input.color ?? '#f59e0b',
    strokeWidth: input.strokeWidth ?? 2,
    points: input.points ?? null,
    documentId: input.documentId,
    createdAt: new Date().toISOString(),
  }
  doc.annotations = [...(doc.annotations ?? []), annotation]
  await writeDoc(wsid, doc)
  return annotation
}

export async function deleteAnnotation(wsid: string, id: string): Promise<boolean> {
  await ensureDir(wsid)
  const dir = wsDir(wsid)
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))
  for (const file of files) {
    const docId = file.replace(/\.json$/, '')
    const doc = await readDoc(wsid, docId)
    if (!doc) continue
    const next = (doc.annotations ?? []).filter((a) => a.id !== id)
    if (next.length !== (doc.annotations ?? []).length) {
      doc.annotations = next
      await writeDoc(wsid, doc)
      return true
    }
  }
  return false
}
