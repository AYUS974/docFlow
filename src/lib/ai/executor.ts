'use client'

import { useAppStore, type PDFAnnotation, type PDFTextItem } from '@/store/app-store'
import type { AiToolName } from './tools'

/**
 * Client-side executor for DocFlow AI tool calls.
 *
 * The AI route streams tool calls to the browser (tools have no server
 * `execute`); this module applies them to the live zustand store — the same
 * actions the manual toolbar uses, so undo/redo and PDF export work
 * unchanged.
 *
 * All coordinates are PDF points at scale 1, top-left origin.
 */

export interface AiToolResult {
  success: boolean
  message: string
  [key: string]: unknown
}

const ok = (message: string, extra: Record<string, unknown> = {}): AiToolResult => ({ success: true, message, ...extra })
const fail = (message: string, extra: Record<string, unknown> = {}): AiToolResult => ({ success: false, message, ...extra })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPageSize(page: number): { width: number; height: number } {
  const doc = useAppStore.getState().currentDocument
  const info = doc?.pages?.find((p) => p.pageNumber === page)
  return info ? { width: info.width, height: info.height } : { width: 612, height: 792 }
}

function assertPage(page: number): string | null {
  const { totalPages } = useAppStore.getState()
  if (!Number.isInteger(page) || page < 1 || page > totalPages) {
    return `Page ${page} does not exist — the document has ${totalPages} pages.`
  }
  return null
}

/**
 * Navigate to a page (if needed) and wait until the TextLayer has extracted
 * its text items. Native text edits key off the TextLayer's item ids, so
 * find/replace/style/highlight/redact must run against these exact items.
 */
async function ensurePageTextItems(page: number): Promise<PDFTextItem[]> {
  const store = useAppStore.getState()
  if (store.currentPage !== page) store.setCurrentPage(page)

  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const items = useAppStore.getState().textItems
    if (items.length > 0 && items[0].pageNumber === page) return items
    await new Promise((r) => setTimeout(r, 100))
  }
  // Page may legitimately have no extractable text (scanned image).
  return useAppStore.getState().textItems.filter((i) => i.pageNumber === page)
}

interface TextMatch {
  item: PDFTextItem
  /** Bounding box of the matched substring inside the item (points). */
  x: number
  y: number
  width: number
  height: number
  startIndex: number
}

/** Find all case-insensitive occurrences of `query` inside a page's text items. */
function findMatches(items: PDFTextItem[], query: string): TextMatch[] {
  const q = query.toLowerCase()
  const matches: TextMatch[] = []
  for (const item of items) {
    const text = item.text
    const lower = text.toLowerCase()
    let from = 0
    while (true) {
      const idx = lower.indexOf(q, from)
      if (idx === -1) break
      // Approximate the substring box proportionally — good enough for
      // highlight/redact boxes over a single merged run.
      const charW = text.length > 0 ? item.width / text.length : item.fontSize * 0.5
      matches.push({
        item,
        x: item.x + idx * charW,
        y: item.y,
        width: Math.max(query.length * charW, 4),
        height: item.height,
        startIndex: idx,
      })
      from = idx + q.length
    }
  }
  return matches
}

function makeAnnotation(partial: Omit<PDFAnnotation, 'id'>): PDFAnnotation {
  return { id: crypto.randomUUID(), ...partial }
}

type Anchor =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

const MARGIN = 40

/** Resolve an anchor + element size to a top-left position on a page. */
function anchorToXY(anchorName: Anchor, page: number, elW: number, elH: number): { x: number; y: number } {
  const { width, height } = getPageSize(page)
  const [v, h] = anchorName === 'center' ? ['center', 'center'] : anchorName.split('-')
  const x = h === 'left' ? MARGIN : h === 'right' ? width - MARGIN - elW : (width - elW) / 2
  const y = v === 'top' ? MARGIN : v === 'bottom' ? height - MARGIN - elH : (height - elH) / 2
  return { x, y }
}

/** Rough width of a text run in points (Helvetica-ish average char width). */
const estTextWidth = (text: string, fontSize: number) => text.length * fontSize * 0.52

const shortId = (id: string) => id.slice(0, 8)

/** Resolve an element id (or unique prefix) to an annotation, or an error message. */
function resolveElement(idOrPrefix: string): PDFAnnotation | string {
  const anns = useAppStore.getState().annotations
  const exact = anns.find((a) => a.id === idOrPrefix)
  if (exact) return exact
  const prefixed = anns.filter((a) => a.id.startsWith(idOrPrefix))
  if (prefixed.length === 1) return prefixed[0]
  if (prefixed.length === 0) return `No element with id "${idOrPrefix}" — call list_elements to see the current ids.`
  return `Id "${idOrPrefix}" matches ${prefixed.length} elements — use more characters of the id.`
}

/** Best-effort visual size of an element (text has no stored width/height). */
function elementSize(a: PDFAnnotation): { w: number; h: number } {
  if (a.type === 'text') {
    const fs = a.fontSize ?? 16
    return { w: estTextWidth(a.content ?? '', fs), h: fs }
  }
  return { w: a.width ?? 100, h: a.height ?? 50 }
}

/** Compact, model-friendly description of an element. */
function describeElement(a: PDFAnnotation) {
  const text = a.content ?? a.watermarkText ?? a.editedText
  return {
    id: shortId(a.id),
    type: a.type,
    page: a.pageNumber,
    x: Math.round(a.x),
    y: Math.round(a.y),
    ...(a.width !== undefined ? { width: Math.round(a.width) } : {}),
    ...(a.height !== undefined ? { height: Math.round(a.height) } : {}),
    ...(text ? { text: text.slice(0, 60) } : {}),
    color: a.color,
    ...(a.fontSize !== undefined ? { fontSize: a.fontSize } : {}),
    ...(a.watermarkOpacity !== undefined ? { opacity: a.watermarkOpacity } : {}),
  }
}

/** Extract a page's plain text directly with pdf.js (no navigation needed). */
async function extractPageTextDirect(page: number): Promise<string | null> {
  const doc = useAppStore.getState().currentDocument
  if (!doc?.fileData) return null
  try {
    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
    const base64 = doc.fileData.split(',')[1]
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
    if (page < 1 || page > pdf.numPages) return null
    const p = await pdf.getPage(page)
    const content = await p.getTextContent()
    const text = content.items
      .map((it: any) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : ''))
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
    void pdf.destroy()
    return text
  } catch (err) {
    console.error('AI get_page_text failed:', err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function getDocumentOverview(): Promise<AiToolResult> {
  const s = useAppStore.getState()
  const doc = s.currentDocument
  if (!doc) return fail('No document is open.')
  const byType: Record<string, number> = {}
  for (const a of s.annotations) byType[a.type] = (byType[a.type] || 0) + 1
  return ok('Document overview', {
    title: doc.title,
    fileName: doc.fileName,
    pageCount: s.totalPages,
    currentPage: s.currentPage,
    pages: (doc.pages || []).map((p) => ({ page: p.pageNumber, width: Math.round(p.width), height: Math.round(p.height) })),
    annotationsByType: byType,
    textEditsCount: s.textEdits.size,
    hasSavedSignature: s.savedSignatures.length > 0 || !!s.signatureData,
  })
}

async function getPageText({ page }: { page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const text = await extractPageTextDirect(page)
  if (text === null) return fail('Could not extract text from this page.')
  if (!text) return ok(`Page ${page} has no extractable text (it may be a scanned image).`, { text: '' })
  return ok(`Extracted text of page ${page}`, { text: text.slice(0, 8000) })
}

async function findText({ query, page }: { query: string; page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const items = await ensurePageTextItems(page)
  const matches = findMatches(items, query)
  if (matches.length === 0) return fail(`No occurrence of "${query}" found on page ${page}.`)
  return ok(`Found ${matches.length} occurrence(s) of "${query}" on page ${page}`, {
    matches: matches.slice(0, 20).map((m, i) => ({
      index: i + 1,
      itemText: m.item.text,
      x: Math.round(m.x),
      y: Math.round(m.y),
      width: Math.round(m.width),
      height: Math.round(m.height),
      fontSize: Math.round(m.item.fontSize),
    })),
  })
}

async function replaceText({ find, replace, page, replaceAll = true }: {
  find: string; replace: string; page: number; replaceAll?: boolean
}): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const items = await ensurePageTextItems(page)
  const store = useAppStore.getState()
  const lowerFind = find.toLowerCase()

  let replaced = 0
  for (const item of items) {
    if (!item.text.toLowerCase().includes(lowerFind)) continue
    // Case-sensitive replace when possible, otherwise case-insensitive.
    const pattern = item.text.includes(find)
      ? find
      : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), replaceAll ? 'gi' : 'i')
    const existing = store.textEdits.get(item.id)
    const base = existing ? existing.edited : item.text
    const next = typeof pattern === 'string'
      ? (replaceAll ? base.split(pattern).join(replace) : base.replace(pattern, replace))
      : base.replace(pattern, replace)
    if (next === base) continue
    store.addTextEdit(item.id, item, next)
    replaced++
    if (!replaceAll) break
  }

  if (replaced === 0) return fail(`"${find}" not found on page ${page}. Use find_text or get_page_text to check the exact wording.`)
  return ok(`Replaced "${find}" → "${replace}" in ${replaced} place(s) on page ${page}.`)
}

async function styleText({ query, page, bold, italic, color, fontSize }: {
  query: string; page: number; bold?: boolean; italic?: boolean; color?: string; fontSize?: number
}): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  if (bold === undefined && italic === undefined && !color && !fontSize) {
    return fail('No style property given — provide at least one of bold/italic/color/fontSize.')
  }
  const items = await ensurePageTextItems(page)
  const store = useAppStore.getState()
  const lowerQ = query.toLowerCase()

  let styled = 0
  for (const item of items) {
    if (!item.text.toLowerCase().includes(lowerQ)) continue
    const existing = store.textEdits.get(item.id)
    if (!existing) store.addTextEdit(item.id, item, item.text) // keep content, create the edit entry
    store.updateTextEdit(item.id, {
      ...(bold !== undefined ? { bold } : {}),
      ...(italic !== undefined ? { italic } : {}),
      ...(color ? { color } : {}),
      ...(fontSize ? { fontSize } : {}),
    })
    styled++
  }
  if (styled === 0) return fail(`"${query}" not found on page ${page}.`)
  return ok(`Restyled ${styled} text run(s) matching "${query}" on page ${page}.`)
}

async function addText(input: {
  page: number; text: string; anchor?: Anchor; x?: number; y?: number
  fontSize?: number; color?: string; fontFamily?: 'Helvetica' | 'TimesRoman' | 'Courier'
  bold?: boolean; italic?: boolean
}): Promise<AiToolResult> {
  const bad = assertPage(input.page)
  if (bad) return fail(bad)
  const store = useAppStore.getState()
  const fontSize = input.fontSize ?? 16
  const textW = estTextWidth(input.text, fontSize)

  let x = input.x
  let y = input.y
  if ((x === undefined || y === undefined)) {
    const a = anchorToXY(input.anchor ?? 'center', input.page, textW, fontSize)
    x = x ?? a.x
    // anchorToXY returns the TOP edge; annotation y is the baseline.
    y = y ?? a.y + fontSize
  }

  // addAnnotation pushes to the undo stack itself — no extra saveToUndoStack.
  store.addAnnotation(makeAnnotation({
    type: 'text', pageNumber: input.page,
    x, y,
    color: input.color ?? '#000000',
    content: input.text,
    fontSize,
    fontFamily: input.fontFamily ?? 'Helvetica',
    bold: input.bold ?? false,
    italic: input.italic ?? false,
  }))
  return ok(`Added text "${input.text}" on page ${input.page} at (${Math.round(x)}, ${Math.round(y)}).`)
}

async function highlightText({ query, page, color }: { query: string; page: number; color?: string }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const items = await ensurePageTextItems(page)
  const matches = findMatches(items, query)
  if (matches.length === 0) return fail(`"${query}" not found on page ${page}.`)
  const store = useAppStore.getState()
  store.addAnnotations(matches.map((m) => makeAnnotation({
    type: 'highlight', pageNumber: page,
    x: m.x - 1, y: m.y - 1,
    width: m.width + 2, height: m.height + 2,
    color: color ?? '#f59e0b',
  })))
  return ok(`Highlighted ${matches.length} occurrence(s) of "${query}" on page ${page}.`)
}

async function redactText({ query, page }: { query: string; page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const items = await ensurePageTextItems(page)
  const matches = findMatches(items, query)
  if (matches.length === 0) return fail(`"${query}" not found on page ${page}.`)
  const store = useAppStore.getState()
  store.addAnnotations(matches.map((m) => makeAnnotation({
    type: 'redact', pageNumber: page,
    x: m.x - 1, y: m.y - 1,
    width: m.width + 2, height: m.height + 2,
    color: '#000000',
  })))
  return ok(`Redacted ${matches.length} occurrence(s) of "${query}" on page ${page}.`)
}

async function whiteoutArea({ page, x, y, width, height }: {
  page: number; x: number; y: number; width: number; height: number
}): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  useAppStore.getState().addAnnotation(makeAnnotation({
    type: 'whiteout', pageNumber: page, x, y, width, height, color: '#ffffff',
  }))
  return ok(`Whiteout applied on page ${page} (${Math.round(width)}×${Math.round(height)} pt).`)
}

async function addShape({ shape, page, x, y, width, height, color, strokeWidth }: {
  shape: 'rectangle' | 'ellipse' | 'line'; page: number
  x: number; y: number; width: number; height: number; color?: string; strokeWidth?: number
}): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  useAppStore.getState().addAnnotation(makeAnnotation({
    type: shape, pageNumber: page, x, y, width, height,
    color: color ?? '#ef4444',
    strokeWidth: strokeWidth ?? 2,
  }))
  return ok(`Drew ${shape} on page ${page}.`)
}

async function addWatermark({ text, pages, opacity, angle, color, fontSize }: {
  text: string; pages?: number[]; opacity?: number; angle?: number; color?: string; fontSize?: number
}): Promise<AiToolResult> {
  const store = useAppStore.getState()
  const targets = (pages && pages.length > 0)
    ? pages
    : Array.from({ length: store.totalPages }, (_, i) => i + 1)
  const invalid = targets.filter((p) => assertPage(p))
  if (invalid.length > 0) return fail(`Invalid page(s): ${invalid.join(', ')} — document has ${store.totalPages} pages.`)

  store.addAnnotations(targets.map((p) => {
    const { width, height } = getPageSize(p)
    return makeAnnotation({
      type: 'watermark', pageNumber: p,
      x: 0, y: 0, width, height,
      color: color ?? '#64748b',
      watermarkText: text,
      watermarkOpacity: opacity ?? 0.15,
      watermarkAngle: angle ?? -45,
      watermarkFontSize: fontSize ?? 48,
    })
  }))
  return ok(`Watermark "${text}" added on ${targets.length} page(s).`)
}

async function addPageNumbers({ position = 'bottom-center', format = 'numeric', pages, startAt = 1 }: {
  position?: 'bottom-center' | 'bottom-left' | 'bottom-right' | 'top-center' | 'top-left' | 'top-right'
  format?: 'numeric' | 'page-x' | 'x-of-y'
  pages?: number[]
  startAt?: number
}): Promise<AiToolResult> {
  const store = useAppStore.getState()
  const targets = (pages && pages.length > 0)
    ? pages
    : Array.from({ length: store.totalPages }, (_, i) => i + 1)
  const fontSize = 11

  store.addAnnotations(targets.map((p, idx) => {
    const n = startAt + idx
    const label = format === 'page-x' ? `Page ${n}` : format === 'x-of-y' ? `${n} of ${store.totalPages}` : `${n}`
    const { width, height } = getPageSize(p)
    const textW = estTextWidth(label, fontSize)
    const [v, h] = position.split('-')
    const x = h === 'left' ? MARGIN : h === 'right' ? width - MARGIN - textW : (width - textW) / 2
    const y = v === 'top' ? 28 : height - 20 // baseline
    return makeAnnotation({
      type: 'text', pageNumber: p, x, y,
      color: '#475569', content: label, fontSize, fontFamily: 'Helvetica',
    })
  }))
  return ok(`Page numbers (${format}, ${position}) added on ${targets.length} page(s).`)
}

async function addSignature({ page, anchor: anchorName, x, y, width }: {
  page: number; anchor?: Anchor; x?: number; y?: number; width?: number
}): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const store = useAppStore.getState()
  const latest = store.savedSignatures[store.savedSignatures.length - 1]
  const data = latest?.data || store.signatureData
  if (!data) {
    return fail('No saved signature yet. Ask the user to create one first: Signature tool (S) → draw/type → save.')
  }

  // Preserve the signature image's aspect ratio.
  const dims = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 3, h: img.naturalHeight || 1 })
    img.onerror = () => resolve({ w: 3, h: 1 })
    img.src = data
  })
  const sigW = width ?? 150
  const sigH = sigW * (dims.h / dims.w)

  let px = x
  let py = y
  if (px === undefined || py === undefined) {
    const a = anchorToXY(anchorName ?? 'bottom-right', page, sigW, sigH)
    px = px ?? a.x
    py = py ?? a.y
  }

  store.addAnnotation(makeAnnotation({
    type: 'signature', pageNumber: page,
    x: px, y: py, width: sigW, height: sigH,
    color: '#000000', signatureData: data,
  }))
  return ok(`Signature placed on page ${page} at (${Math.round(px)}, ${Math.round(py)}).`)
}

async function rotatePages({ pages, degrees }: { pages?: number[]; degrees: number }): Promise<AiToolResult> {
  if (degrees % 90 !== 0) return fail('degrees must be a multiple of 90.')
  const store = useAppStore.getState()
  const targets = (pages && pages.length > 0)
    ? pages
    : Array.from({ length: store.totalPages }, (_, i) => i + 1)
  for (const p of targets) {
    const bad = assertPage(p)
    if (bad) return fail(bad)
  }
  for (const p of targets) store.rotatePage(p, ((degrees % 360) + 360) % 360)
  return ok(`Rotated ${targets.length} page(s) by ${degrees}°.`)
}

async function deletePage({ page }: { page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  const store = useAppStore.getState()
  if (store.totalPages <= 1) return fail('Cannot delete the only page of the document.')
  store.deletePage(page)
  return ok(`Deleted page ${page}. The document now has ${useAppStore.getState().totalPages} pages.`)
}

async function insertBlankPage({ afterPage }: { afterPage: number }): Promise<AiToolResult> {
  const store = useAppStore.getState()
  if (afterPage < 0 || afterPage > store.totalPages) return fail(`afterPage must be between 0 and ${store.totalPages}.`)
  store.insertBlankPage(afterPage)
  return ok(`Inserted a blank page after page ${afterPage}.`)
}

async function duplicatePage({ page }: { page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  useAppStore.getState().duplicatePage(page)
  return ok(`Duplicated page ${page}.`)
}

async function goToPage({ page }: { page: number }): Promise<AiToolResult> {
  const bad = assertPage(page)
  if (bad) return fail(bad)
  useAppStore.getState().setCurrentPage(page)
  return ok(`Now viewing page ${page}.`)
}

async function setZoom({ percent }: { percent: number }): Promise<AiToolResult> {
  useAppStore.getState().setZoom(percent / 100)
  return ok(`Zoom set to ${Math.round(percent)}%.`)
}

async function removeAnnotations({ page, type }: { page?: number; type?: PDFAnnotation['type'] }): Promise<AiToolResult> {
  const store = useAppStore.getState()
  if (page !== undefined) {
    const bad = assertPage(page)
    if (bad) return fail(bad)
  }
  const keep = store.annotations.filter((a) =>
    !((page === undefined || a.pageNumber === page) && (type === undefined || a.type === type))
  )
  const removed = store.annotations.length - keep.length
  if (removed === 0) return fail('No matching annotations to remove.')
  store.saveToUndoStack()
  useAppStore.setState({ annotations: keep })
  return ok(`Removed ${removed} annotation(s)${type ? ` of type ${type}` : ''}${page ? ` on page ${page}` : ''}.`)
}

async function undoLast(): Promise<AiToolResult> {
  const store = useAppStore.getState()
  if (!store.canUndo) return fail('Nothing to undo.')
  store.undo()
  return ok('Undid the last annotation change.')
}

async function redoLast(): Promise<AiToolResult> {
  const store = useAppStore.getState()
  if (!store.canRedo) return fail('Nothing to redo.')
  store.redo()
  return ok('Redid the last undone change.')
}

async function listElements({ page, type }: { page?: number; type?: PDFAnnotation['type'] }): Promise<AiToolResult> {
  if (page !== undefined) {
    const bad = assertPage(page)
    if (bad) return fail(bad)
  }
  const all = useAppStore.getState().annotations
  const filtered = all
    .filter((a) => (page === undefined || a.pageNumber === page) && (type === undefined || a.type === type))
    .sort((a, b) => a.pageNumber - b.pageNumber || a.y - b.y)
  if (filtered.length === 0) {
    return ok('No matching elements on the canvas — nothing has been added yet with these filters.', { elements: [] })
  }
  return ok(`${filtered.length} element(s) on the canvas`, {
    elements: filtered.slice(0, 100).map(describeElement),
    ...(filtered.length > 100 ? { note: 'Showing the first 100 — narrow down with page/type filters.' } : {}),
  })
}

async function updateElement(input: {
  id: string; x?: number; y?: number; anchor?: Anchor; page?: number
  width?: number; height?: number; text?: string; color?: string
  fontSize?: number; bold?: boolean; italic?: boolean
  opacity?: number; angle?: number; strokeWidth?: number
}): Promise<AiToolResult> {
  const el = resolveElement(input.id)
  if (typeof el === 'string') return fail(el)
  if (input.page !== undefined) {
    const bad = assertPage(input.page)
    if (bad) return fail(bad)
  }

  const updates: Partial<PDFAnnotation> = {}
  if (input.page !== undefined && input.page !== el.pageNumber) updates.pageNumber = input.page
  if (input.width !== undefined) updates.width = input.width
  if (input.height !== undefined) updates.height = input.height

  let nx = input.x
  let ny = input.y
  if (input.anchor) {
    const size = elementSize(el)
    const pos = anchorToXY(
      input.anchor,
      input.page ?? el.pageNumber,
      input.width ?? size.w,
      input.height ?? size.h,
    )
    nx = nx ?? pos.x
    // anchorToXY returns the TOP edge; text-element y is the baseline.
    ny = ny ?? (el.type === 'text' ? pos.y + (input.fontSize ?? el.fontSize ?? 16) : pos.y)
  }
  if (nx !== undefined) updates.x = nx
  if (ny !== undefined) updates.y = ny
  // Freehand strokes carry their geometry in `points` — translate them along.
  if (el.points && (nx !== undefined || ny !== undefined)) {
    const dx = (nx ?? el.x) - el.x
    const dy = (ny ?? el.y) - el.y
    updates.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
  }

  if (input.text !== undefined) {
    if (el.type === 'watermark') updates.watermarkText = input.text
    else if (el.type === 'text') updates.content = input.text
    else return fail(`A ${el.type} element has no text to change.`)
  }
  if (input.color) updates.color = input.color
  if (input.fontSize !== undefined) {
    if (el.type === 'watermark') updates.watermarkFontSize = input.fontSize
    else updates.fontSize = input.fontSize
  }
  if (input.bold !== undefined) updates.bold = input.bold
  if (input.italic !== undefined) updates.italic = input.italic
  if (input.opacity !== undefined) {
    if (el.type !== 'watermark') return fail('opacity only applies to watermark elements.')
    updates.watermarkOpacity = input.opacity
  }
  if (input.angle !== undefined) {
    if (el.type !== 'watermark') return fail('angle only applies to watermark elements.')
    updates.watermarkAngle = input.angle
  }
  if (input.strokeWidth !== undefined) updates.strokeWidth = input.strokeWidth

  if (Object.keys(updates).length === 0) return fail('No changes given — provide at least one property to update.')

  const store = useAppStore.getState()
  // updateAnnotation does not push to the undo stack itself.
  store.saveToUndoStack()
  store.updateAnnotation(el.id, updates)
  return ok(`Updated ${el.type} element ${shortId(el.id)} (${Object.keys(updates).join(', ')}).`, {
    element: describeElement({ ...el, ...updates }),
  })
}

async function duplicateElement({ id, page, x, y, anchor: anchorName }: {
  id: string; page?: number; x?: number; y?: number; anchor?: Anchor
}): Promise<AiToolResult> {
  const el = resolveElement(id)
  if (typeof el === 'string') return fail(el)
  const targetPage = page ?? el.pageNumber
  const bad = assertPage(targetPage)
  if (bad) return fail(bad)

  let nx = x
  let ny = y
  if ((nx === undefined || ny === undefined) && anchorName) {
    const size = elementSize(el)
    const pos = anchorToXY(anchorName, targetPage, size.w, size.h)
    nx = nx ?? pos.x
    ny = ny ?? (el.type === 'text' ? pos.y + (el.fontSize ?? 16) : pos.y)
  }
  // Default: offset the copy slightly so it doesn't sit invisibly on top.
  const offset = targetPage === el.pageNumber && nx === undefined && ny === undefined ? 20 : 0
  nx = nx ?? el.x + offset
  ny = ny ?? el.y + offset

  const copy: PDFAnnotation = { ...el, id: crypto.randomUUID(), pageNumber: targetPage, x: nx, y: ny }
  if (el.points) {
    const dx = nx - el.x
    const dy = ny - el.y
    copy.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
  }
  useAppStore.getState().addAnnotation(copy)
  return ok(`Duplicated ${el.type} element → new element ${shortId(copy.id)} on page ${targetPage}.`, {
    element: describeElement(copy),
  })
}

async function deleteElement({ id }: { id: string }): Promise<AiToolResult> {
  const el = resolveElement(id)
  if (typeof el === 'string') return fail(el)
  // removeAnnotation pushes to the undo stack itself.
  useAppStore.getState().removeAnnotation(el.id)
  return ok(`Deleted ${el.type} element ${shortId(el.id)} from page ${el.pageNumber}.`)
}

async function movePage({ from, to }: { from: number; to: number }): Promise<AiToolResult> {
  const store = useAppStore.getState()
  for (const p of [from, to]) {
    if (!Number.isInteger(p) || p < 1 || p > store.totalPages) {
      return fail(`Position ${p} is out of range — the document has ${store.totalPages} pages.`)
    }
  }
  if (from === to) return ok(`Page is already at position ${from}.`)
  if (store.pageOrder.length === 0) {
    store.setPageOrder(Array.from({ length: store.totalPages }, (_, i) => i + 1))
  }
  useAppStore.getState().reorderPages(from - 1, to - 1)
  return ok(`Moved the page at position ${from} to position ${to} — the new order is visible in the Pages panel.`)
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const HANDLERS: Record<AiToolName, (input: any) => Promise<AiToolResult>> = {
  get_document_overview: getDocumentOverview,
  get_page_text: getPageText,
  find_text: findText,
  replace_text: replaceText,
  style_text: styleText,
  add_text: addText,
  highlight_text: highlightText,
  redact_text: redactText,
  whiteout_area: whiteoutArea,
  add_shape: addShape,
  add_watermark: addWatermark,
  add_page_numbers: addPageNumbers,
  add_signature: addSignature,
  rotate_pages: rotatePages,
  delete_page: deletePage,
  insert_blank_page: insertBlankPage,
  duplicate_page: duplicatePage,
  go_to_page: goToPage,
  set_zoom: setZoom,
  list_elements: listElements,
  update_element: updateElement,
  duplicate_element: duplicateElement,
  delete_element: deleteElement,
  move_page: movePage,
  remove_annotations: removeAnnotations,
  undo: undoLast,
  redo: redoLast,
}

export async function executeAiTool(toolName: string, input: unknown): Promise<AiToolResult> {
  const handler = HANDLERS[toolName as AiToolName]
  if (!handler) return fail(`Unknown tool: ${toolName}`)
  if (!useAppStore.getState().currentDocument) return fail('No document is open in the editor.')
  try {
    return await handler(input ?? {})
  } catch (err) {
    console.error(`AI tool ${toolName} failed:`, err)
    return fail(err instanceof Error ? err.message : 'Tool execution failed.')
  }
}
