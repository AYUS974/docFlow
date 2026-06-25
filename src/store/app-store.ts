import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type View = 'landing' | 'editor' | 'dashboard' | 'pricing'

export interface PDFAnnotation {
  id: string
  type: 'highlight' | 'draw' | 'text' | 'rectangle' | 'ellipse' | 'line' | 'eraser' | 'redact' | 'signature' | 'whiteout' | 'image' | 'watermark'
  pageNumber: number
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  color: string
  strokeWidth?: number
  points?: { x: number; y: number }[]
  fontSize?: number
  fontFamily?: string
  // Signature specific
  signatureData?: string
  // Image annotation specific
  imageData?: string
  // Text edit specific (native text editing)
  originalText?: string
  editedText?: string
  originalX?: number
  originalY?: number
  originalWidth?: number
  originalHeight?: number
  originalFontSize?: number
  originalFontFamily?: string
  // Watermark specific
  watermarkText?: string
  watermarkOpacity?: number
  watermarkAngle?: number
  watermarkFontSize?: number
  // Redaction specific
  isApplied?: boolean
  bold?: boolean
  italic?: boolean
}


export interface PDFTextItem {
  id: string
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  fontFamily: string
  pageNumber: number
  transform: number[]
  hasEOL: boolean
  str: string
  dir: string
  widthInChars?: number
  // Line/paragraph grouping for text reflow
  lineIndex?: number
  paragraphIndex?: number
  lineHeight?: number
}

export interface PDFTextLine {
  items: PDFTextItem[]
  y: number
  height: number
  x: number
  width: number
  paragraphIndex: number
}

export interface PDFTextParagraph {
  lines: PDFTextLine[]
  x: number
  y: number
  width: number
  height: number
}

export interface PDFPageInfo {
  pageNumber: number
  rotation: number
  width: number
  height: number
}

export interface PDFDocumentInfo {
  id?: string
  title: string
  fileName: string
  fileSize: number
  pageCount: number
  fileData?: string
  uploadedAt?: string
  pages?: PDFPageInfo[]
}

export type EditorTool =
  | 'select' | 'pan' | 'highlight' | 'draw' | 'text' | 'rectangle'
  | 'ellipse' | 'line' | 'eraser' | 'editText' | 'redact' | 'signature'
  | 'whiteout' | 'image' | 'watermark' | 'formField'

export interface SignatureSave {
  id: string
  data: string
  type: 'draw' | 'type' | 'image'
  createdAt: string
}

export interface CropBox {
  x: number
  y: number
  width: number
  height: number
}

export type PdfBaseFont = 'Helvetica' | 'TimesRoman' | 'Courier'

export interface FontMapping {
  cssName: string
  displayName: string
  fileName: string
  fallback: string
}

export const METRIC_FONTS: Record<string, FontMapping> = {
  'arimo': { cssName: 'Arimo', displayName: 'Arial / Helvetica (Arimo)', fileName: 'Arimo', fallback: 'sans-serif' },
  'tinos': { cssName: 'Tinos', displayName: 'Times New Roman (Tinos)', fileName: 'Tinos', fallback: 'serif' },
  'cousine': { cssName: 'Cousine', displayName: 'Courier New (Cousine)', fileName: 'Cousine', fallback: 'monospace' },
  'carlito': { cssName: 'Carlito', displayName: 'Calibri (Carlito)', fileName: 'Carlito', fallback: 'sans-serif' },
  'caladea': { cssName: 'Caladea', displayName: 'Cambria (Caladea)', fileName: 'Caladea', fallback: 'serif' }
}

export interface TextEditEntry {
  original: PDFTextItem
  edited: string
  // Position of the edited text (PDF points, top-left origin). Defaults to the
  // original location; updated when the user drags the edit to a new spot.
  x: number
  y: number
  // Render/export font (defaults to the matched metric font clone).
  fontFamily: string
  fontSize: number
  bold: boolean
  italic: boolean
  color: string
  isDuplicate?: boolean
}

interface AppState {
  // Navigation
  currentView: View
  previousView: View | null
  setView: (view: View) => void
  goBack: () => void

  // Document
  documents: PDFDocumentInfo[]
  setDocuments: (docs: PDFDocumentInfo[]) => void
  addDocument: (doc: PDFDocumentInfo) => void
  removeDocument: (id: string) => void
  updateDocument: (id: string, updates: Partial<PDFDocumentInfo>) => void

  // Editor
  currentDocument: PDFDocumentInfo | null
  setCurrentDocument: (doc: PDFDocumentInfo | null) => void
  currentTool: EditorTool
  setCurrentTool: (tool: EditorTool) => void
  currentPage: number
  setCurrentPage: (page: number) => void
  totalPages: number
  setTotalPages: (pages: number) => void
  zoom: number
  setZoom: (zoom: number) => void
  annotations: PDFAnnotation[]
  setAnnotations: (annots: PDFAnnotation[]) => void
  addAnnotation: (annot: PDFAnnotation) => void
  addAnnotations: (annots: PDFAnnotation[]) => void
  removeAnnotation: (id: string) => void
  clearAnnotations: () => void
  updateAnnotation: (id: string, updates: Partial<PDFAnnotation>) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  drawColor: string
  setDrawColor: (color: string) => void
  strokeWidth: number
  setStrokeWidth: (width: number) => void
  fontSize: number
  setFontSize: (size: number) => void
  fontFamily: string
  setFontFamily: (family: string) => void
  showSidebar: boolean
  toggleSidebar: () => void
  showAnnotationPanel: boolean
  toggleAnnotationPanel: () => void
  isEditorLoading: boolean
  setEditorLoading: (loading: boolean) => void

  // Editor drawing state
  isDrawing: boolean
  setIsDrawing: (drawing: boolean) => void
  currentDrawingPoints: { x: number; y: number }[]
  setCurrentDrawingPoints: (points: { x: number; y: number }[]) => void

  // Native text editing
  textItems: PDFTextItem[]
  setTextItems: (items: PDFTextItem[]) => void
  textLines: PDFTextLine[]
  setTextLines: (lines: PDFTextLine[]) => void
  textParagraphs: PDFTextParagraph[]
  setTextParagraphs: (paragraphs: PDFTextParagraph[]) => void
  editingTextItem: PDFTextItem | null
  setEditingTextItem: (item: PDFTextItem | null) => void
  textEdits: Map<string, TextEditEntry>
  addTextEdit: (itemId: string, original: PDFTextItem, edited: string) => void
  updateTextEdit: (itemId: string, updates: Partial<Pick<TextEditEntry, 'edited' | 'x' | 'y' | 'fontFamily' | 'fontSize' | 'bold' | 'italic' | 'color'>>) => void
  duplicateTextEdit: (item: PDFTextItem, text: string) => void
  removeTextEdit: (itemId: string) => void
  clearTextEdits: () => void

  // Page management
  pageRotations: Map<number, number>
  rotatePage: (pageNumber: number, degrees: number) => void
  deletePage: (pageNumber: number) => void
  reorderPages: (fromIndex: number, toIndex: number) => void
  pageOrder: number[]
  setPageOrder: (order: number[]) => void
  insertBlankPage: (afterPage: number) => void
  duplicatePage: (pageNumber: number) => void

  // Crop
  cropBox: CropBox | null
  setCropBox: (box: CropBox | null) => void
  isCropping: boolean
  setCropping: (cropping: boolean) => void

  // Signature
  signatureData: string | null
  setSignatureData: (data: string | null) => void
  signatureType: 'draw' | 'type' | 'image' | null
  setSignatureType: (type: 'draw' | 'type' | 'image' | null) => void
  signatureText: string
  setSignatureText: (text: string) => void
  showSignaturePad: boolean
  setShowSignaturePad: (show: boolean) => void
  savedSignatures: SignatureSave[]
  addSavedSignature: (sig: SignatureSave) => void
  removeSavedSignature: (id: string) => void

  // Watermark
  watermarkText: string
  setWatermarkText: (text: string) => void
  watermarkOpacity: number
  setWatermarkOpacity: (opacity: number) => void
  watermarkAngle: number
  setWatermarkAngle: (angle: number) => void

  // Image annotation
  pendingImageData: string | null
  setPendingImageData: (data: string | null) => void

  // Auth simulation
  isLoggedIn: boolean
  userName: string
  login: (name: string, email: string) => void
  logout: () => void

  // PDF processing
  processPdfFile: (file: File) => void

  // Undo/Redo history
  saveToUndoStack: () => void
  _undoStack: PDFAnnotation[][]
  _redoStack: PDFAnnotation[][]
}

export const FONT_FALLBACK_MAP: Record<string, string> = {
  'Helvetica': 'Helvetica',
  'Helvetica-Bold': 'Helvetica',
  'Helvetica-Oblique': 'Helvetica',
  'Helvetica-BoldOblique': 'Helvetica',
  'TimesNewRoman': 'TimesRoman',
  'Times New Roman': 'TimesRoman',
  'Times-Roman': 'TimesRoman',
  'Times-Bold': 'TimesRoman',
  'Times-Italic': 'TimesRoman',
  'Times-BoldItalic': 'TimesRoman',
  'Courier': 'Courier',
  'Courier-New': 'Courier',
  'Courier-Bold': 'Courier',
  'Courier-Oblique': 'Courier',
  'Arial': 'Helvetica',
  'Arial Black': 'Helvetica',
  'Calibri': 'Helvetica',
  'Cambria': 'TimesRoman',
  'Georgia': 'TimesRoman',
  'Verdana': 'Helvetica',
  'Tahoma': 'Helvetica',
  'Trebuchet MS': 'Helvetica',
  'Lucida Console': 'Courier',
  'Monaco': 'Courier',
}

export function matchPdfFont(fontName: string): 'Helvetica' | 'TimesRoman' | 'Courier' {
  const name = (fontName || '').replace(/[^a-zA-Z]/g, '').toLowerCase()
  if (name.includes('courier') || name.includes('mono') || name.includes('console')) return 'Courier'
  // Sans must be tested before serif: "sansserif".includes("serif") is true.
  if (name.includes('sans') || name.includes('arial') || name.includes('helvetica') ||
      name.includes('verdana') || name.includes('calibri') || name.includes('tahoma') ||
      name.includes('segoe') || name.includes('roboto')) return 'Helvetica'
  if (name.includes('times') || name.includes('serif') || name.includes('georgia') ||
      name.includes('cambria') || name.includes('garamond')) return 'TimesRoman'
  return 'Helvetica'
}

export function matchMetricFont(fontName: string): string {
  const name = (fontName || '').toLowerCase()
  if (name.includes('calibri') || name.includes('carlito')) return 'carlito'
  if (name.includes('cambria') || name.includes('caladea')) return 'caladea'
  if (name.includes('courier') || name.includes('mono') || name.includes('console') || name.includes('cousine')) return 'cousine'
  if (name.includes('times') || name.includes('serif') || name.includes('georgia') || name.includes('tinos')) return 'tinos'
  // Default is Arial/Helvetica clone: arimo
  return 'arimo'
}

export function groupTextItemsIntoLines(items: PDFTextItem[]): PDFTextLine[] {
  if (items.length === 0) return []
  const lines: PDFTextLine[] = []
  let currentLine: PDFTextItem[] = [items[0]]
  let currentY = items[0].y
  const tolerance = items[0].height * 0.4

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentLine.push(item)
    } else {
      if (currentLine.length > 0) {
        lines.push(createTextLine(currentLine, lines.length))
      }
      currentLine = [item]
      currentY = item.y
    }
  }
  if (currentLine.length > 0) {
    lines.push(createTextLine(currentLine, lines.length))
  }
  return lines
}

function createTextLine(items: PDFTextItem[], lineIdx: number): PDFTextLine {
  const sorted = [...items].sort((a, b) => a.x - b.x)
  const y = Math.min(...sorted.map(i => i.y))
  const height = Math.max(...sorted.map(i => i.height))
  const x = Math.min(...sorted.map(i => i.x))
  const maxX = Math.max(...sorted.map(i => i.x + i.width))
  return {
    items: sorted.map((item, i) => ({ ...item, lineIndex: lineIdx })),
    y, height, x,
    width: maxX - x,
    paragraphIndex: 0,
  }
}

export function groupLinesIntoParagraphs(lines: PDFTextLine[]): PDFTextParagraph[] {
  if (lines.length === 0) return []
  const paragraphs: PDFTextParagraph[] = []
  let currentParaLines: PDFTextLine[] = [lines[0]]
  let prevLine = lines[0]

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const gap = line.y - (prevLine.y + prevLine.height)
    const indentDiff = Math.abs(line.x - prevLine.x)
    const isParagraphBreak = gap > prevLine.height * 1.5 || indentDiff > 20

    if (isParagraphBreak) {
      paragraphs.push(createParagraph(currentParaLines, paragraphs.length))
      currentParaLines = [line]
    } else {
      currentParaLines.push(line)
    }
    prevLine = line
  }
  if (currentParaLines.length > 0) {
    paragraphs.push(createParagraph(currentParaLines, paragraphs.length))
  }
  return paragraphs
}

function createParagraph(lines: PDFTextLine[], paraIdx: number): PDFTextParagraph {
  const y = Math.min(...lines.map(l => l.y))
  const height = Math.max(...lines.map(l => l.y + l.height)) - y
  const x = Math.min(...lines.map(l => l.x))
  const maxX = Math.max(...lines.map(l => l.x + l.width))
  return {
    lines: lines.map(l => ({ ...l, paragraphIndex: paraIdx })),
    x, y, width: maxX - x, height,
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  // Navigation
  currentView: 'landing',
  previousView: null,
  setView: (view) => set((state) => ({ currentView: view, previousView: state.currentView })),
  goBack: () => set((state) => ({
    currentView: state.previousView || 'landing',
    previousView: null
  })),

  // Document
  documents: [],
  setDocuments: (docs) => set({ documents: docs }),
  addDocument: (doc) => set((state) => ({ documents: [doc, ...state.documents] })),
  removeDocument: (id) => set((state) => ({
    documents: state.documents.filter((d) => d.id !== id)
  })),
  updateDocument: (id, updates) => set((state) => ({
    documents: state.documents.map((d) =>
      d.id === id ? { ...d, ...updates } : d
    ),
    currentDocument: state.currentDocument?.id === id
      ? { ...state.currentDocument, ...updates }
      : state.currentDocument,
  })),

  // Editor
  currentDocument: null,
  setCurrentDocument: (doc) => set({ currentDocument: doc }),
  currentTool: 'select',
  setCurrentTool: (tool) => set({ currentTool: tool }),
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),
  totalPages: 0,
  setTotalPages: (pages) => set({ totalPages: pages }),
  zoom: 1.0,
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(5, zoom)) }),
  annotations: [],
  _undoStack: [],
  _redoStack: [],
  canUndo: false,
  canRedo: false,
  setAnnotations: (annots) => set({ annotations: annots, _undoStack: [], _redoStack: [], canUndo: false, canRedo: false }),
  addAnnotation: (annot) => set((state) => ({
    annotations: [...state.annotations, annot],
    _undoStack: [...state._undoStack, state.annotations],
    _redoStack: [],
    canUndo: true,
    canRedo: false,
  })),
  addAnnotations: (annots) => set((state) => ({
    annotations: [...state.annotations, ...annots],
    _undoStack: [...state._undoStack, state.annotations],
    _redoStack: [],
    canUndo: true,
    canRedo: false,
  })),
  removeAnnotation: (id) => set((state) => {
    const removed = state.annotations.find((a) => a.id === id)
    if (!removed) return state
    return {
      annotations: state.annotations.filter((a) => a.id !== id),
      _undoStack: [...state._undoStack, state.annotations],
      _redoStack: [],
      canUndo: true,
      canRedo: false,
    }
  }),
  clearAnnotations: () => set((state) => {
    if (state.annotations.length === 0) return state
    return {
      annotations: [],
      _undoStack: [...state._undoStack, state.annotations],
      _redoStack: [],
      canUndo: true,
      canRedo: false,
    }
  }),
  updateAnnotation: (id, updates) => set((state) => ({
    annotations: state.annotations.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    ),
  })),
  undo: () => set((state) => {
    if (state._undoStack.length === 0) return state
    const prev = state._undoStack[state._undoStack.length - 1]
    return {
      annotations: prev,
      _undoStack: state._undoStack.slice(0, -1),
      _redoStack: [...state._redoStack, state.annotations],
      canUndo: state._undoStack.length > 1,
      canRedo: true,
    }
  }),
  redo: () => set((state) => {
    if (state._redoStack.length === 0) return state
    const next = state._redoStack[state._redoStack.length - 1]
    return {
      annotations: next,
      _redoStack: state._redoStack.slice(0, -1),
      _undoStack: [...state._undoStack, state.annotations],
      canUndo: true,
      canRedo: state._redoStack.length > 1,
    }
  }),
  saveToUndoStack: () => set((state) => ({
    _undoStack: [...state._undoStack, state.annotations],
    _redoStack: [],
    canUndo: true,
    canRedo: false,
  })),
  drawColor: '#f59e0b',
  setDrawColor: (color) => set({ drawColor: color }),
  strokeWidth: 2,
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  fontSize: 16,
  setFontSize: (size) => set({ fontSize: size }),
  fontFamily: 'Helvetica',
  setFontFamily: (family) => set({ fontFamily: family }),
  showSidebar: true,
  toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
  showAnnotationPanel: false,
  toggleAnnotationPanel: () => set((state) => ({ showAnnotationPanel: !state.showAnnotationPanel })),
  isEditorLoading: false,
  setEditorLoading: (loading) => set({ isEditorLoading: loading }),

  // Drawing state
  isDrawing: false,
  setIsDrawing: (drawing) => set({ isDrawing: drawing }),
  currentDrawingPoints: [],
  setCurrentDrawingPoints: (points) => set({ currentDrawingPoints: points }),

  // Native text editing
  textItems: [],
  setTextItems: (items) => set({ textItems: items }),
  textLines: [],
  setTextLines: (lines) => set({ textLines: lines }),
  textParagraphs: [],
  setTextParagraphs: (paragraphs) => set({ textParagraphs: paragraphs }),
  editingTextItem: null,
  setEditingTextItem: (item) => set({ editingTextItem: item }),
  textEdits: new Map<string, TextEditEntry>(),
  addTextEdit: (itemId, original, edited) => set((state) => {
    const newEdits = new Map(state.textEdits)
    const existing = newEdits.get(itemId)
    
    const isBold = original.fontFamily.toLowerCase().includes('bold')
    const isItalic = original.fontFamily.toLowerCase().includes('italic') || original.fontFamily.toLowerCase().includes('oblique')
    
    newEdits.set(itemId, {
      original,
      edited,
      x: existing?.x ?? original.x,
      y: existing?.y ?? original.y,
      fontFamily: existing?.fontFamily ?? matchMetricFont(original.fontFamily),
      fontSize: existing?.fontSize ?? original.fontSize,
      bold: existing?.bold ?? isBold,
      italic: existing?.italic ?? isItalic,
      color: existing?.color ?? '#000000',
      isDuplicate: existing?.isDuplicate ?? false,
    })
    return { textEdits: newEdits }
  }),
  updateTextEdit: (itemId, updates) => set((state) => {
    const newEdits = new Map(state.textEdits)
    const existing = newEdits.get(itemId)
    if (!existing) return state
    newEdits.set(itemId, { ...existing, ...updates })
    return { textEdits: newEdits }
  }),
  duplicateTextEdit: (item, text) => set((state) => {
    const newEdits = new Map(state.textEdits)
    const existing = newEdits.get(item.id)
    
    const baseText = existing ? existing.edited : text
    const baseX = existing ? existing.x : item.x
    const baseY = existing ? existing.y : item.y
    const baseFont = existing ? existing.fontFamily : matchMetricFont(item.fontFamily)
    const baseSize = existing ? existing.fontSize : item.fontSize
    const isBold = existing ? existing.bold : (item.fontFamily.toLowerCase().includes('bold'))
    const isItalic = existing ? existing.italic : (item.fontFamily.toLowerCase().includes('italic') || item.fontFamily.toLowerCase().includes('oblique'))
    const baseColor = existing ? existing.color : '#000000'

    const newId = `duplicate-${crypto.randomUUID()}`
    const duplicated: TextEditEntry = {
      original: {
        ...item,
        id: newId,
        x: baseX + 15,
        y: baseY + 15,
      },
      edited: baseText,
      x: baseX + 15,
      y: baseY + 15,
      fontFamily: baseFont,
      fontSize: baseSize,
      bold: isBold,
      italic: isItalic,
      color: baseColor,
      isDuplicate: true,
    }
    newEdits.set(newId, duplicated)
    return { textEdits: newEdits }
  }),
  removeTextEdit: (itemId) => set((state) => {
    const newEdits = new Map(state.textEdits)
    newEdits.delete(itemId)
    return { textEdits: newEdits }
  }),
  clearTextEdits: () => set({ textEdits: new Map() }),

  // Page management
  pageRotations: new Map<number, number>(),
  rotatePage: (pageNumber, degrees) => set((state) => {
    const newRotations = new Map(state.pageRotations)
    const current = newRotations.get(pageNumber) || 0
    newRotations.set(pageNumber, (current + degrees) % 360)
    return { pageRotations: newRotations }
  }),
  deletePage: (pageNumber) => {
    const state = get()
    const newPageOrder = state.pageOrder.filter(p => p !== pageNumber)
      .map(p => p > pageNumber ? p - 1 : p)
    const newRotations = new Map<number, number>()
    for (const [k, v] of state.pageRotations) {
      if (k === pageNumber) continue
      const newK = k > pageNumber ? k - 1 : k
      newRotations.set(newK, v)
    }
    const newAnnotations = state.annotations
      .filter(a => a.pageNumber !== pageNumber)
      .map(a => ({
        ...a,
        pageNumber: a.pageNumber > pageNumber ? a.pageNumber - 1 : a.pageNumber,
      }))
    set({
      pageOrder: newPageOrder,
      pageRotations: newRotations,
      annotations: newAnnotations,
      totalPages: state.totalPages - 1,
      currentPage: Math.min(state.currentPage, state.totalPages - 1),
    })
  },
  reorderPages: (fromIndex, toIndex) => set((state) => {
    const newOrder = [...state.pageOrder]
    const [moved] = newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, moved)
    return { pageOrder: newOrder }
  }),
  pageOrder: [],
  setPageOrder: (order) => set({ pageOrder: order }),
  insertBlankPage: (afterPage) => {
    const state = get()
    const newPageNum = afterPage + 1
    const newOrder = state.pageOrder.map(p => p >= newPageNum ? p + 1 : p)
    const insertIdx = newOrder.indexOf(afterPage) + 1
    if (insertIdx < 0 || insertIdx > newOrder.length) return
    // Shift all page numbers after the insert point
    const shiftedAnnotations = state.annotations.map(a => ({
      ...a,
      pageNumber: a.pageNumber >= newPageNum ? a.pageNumber + 1 : a.pageNumber,
    }))
    const shiftedRotations = new Map<number, number>()
    for (const [k, v] of state.pageRotations) {
      shiftedRotations.set(k >= newPageNum ? k + 1 : k, v)
    }
    newOrder.splice(insertIdx, 0, newPageNum)
    set({
      pageOrder: newOrder,
      annotations: shiftedAnnotations,
      pageRotations: shiftedRotations,
      totalPages: state.totalPages + 1,
    })
  },
  duplicatePage: (pageNumber) => {
    const state = get()
    const newPageNum = state.totalPages + 1
    const newOrder = [...state.pageOrder]
    const insertIdx = newOrder.indexOf(pageNumber) + 1
    if (insertIdx < 0) return
    // Copy annotations from the source page
    const sourceAnnots = state.annotations.filter(a => a.pageNumber === pageNumber)
    const newAnnots = sourceAnnots.map(a => ({
      ...a,
      id: crypto.randomUUID(),
      pageNumber: newPageNum,
    }))
    newOrder.splice(insertIdx, 0, newPageNum)
    set({
      pageOrder: newOrder,
      annotations: [...state.annotations, ...newAnnots],
      totalPages: state.totalPages + 1,
    })
  },

  // Crop
  cropBox: null,
  setCropBox: (box) => set({ cropBox: box }),
  isCropping: false,
  setCropping: (cropping) => set({ isCropping: cropping }),

  // Signature
  signatureData: null,
  setSignatureData: (data) => set({ signatureData: data }),
  signatureType: null,
  setSignatureType: (type) => set({ signatureType: type }),
  signatureText: '',
  setSignatureText: (text) => set({ signatureText: text }),
  showSignaturePad: false,
  setShowSignaturePad: (show) => set({ showSignaturePad: show }),
  savedSignatures: [],
  addSavedSignature: (sig) => set((state) => ({
    savedSignatures: [...state.savedSignatures, sig]
  })),
  removeSavedSignature: (id) => set((state) => ({
    savedSignatures: state.savedSignatures.filter(s => s.id !== id)
  })),

  // Watermark
  watermarkText: 'CONFIDENTIAL',
  setWatermarkText: (text) => set({ watermarkText: text }),
  watermarkOpacity: 0.15,
  setWatermarkOpacity: (opacity) => set({ watermarkOpacity: opacity }),
  watermarkAngle: -45,
  setWatermarkAngle: (angle) => set({ watermarkAngle: angle }),

  // Image annotation
  pendingImageData: null,
  setPendingImageData: (data) => set({ pendingImageData: data }),

  // Auth
  isLoggedIn: true,
  userName: 'Demo User',
  login: (name, _email) => set({ isLoggedIn: true, userName: name }),
  logout: () => set({ isLoggedIn: false, userName: '' }),

  // PDF processing
  processPdfFile: (file) => {
    if (file.type !== 'application/pdf') return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
        const arrayBuffer = await file.arrayBuffer()
        const uint8 = new Uint8Array(arrayBuffer)
        const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise
        const pages: import('./app-store').PDFPageInfo[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const vp = page.getViewport({ scale: 1 })
          pages.push({ pageNumber: i, rotation: 0, width: vp.width, height: vp.height })
        }
        const doc: import('./app-store').PDFDocumentInfo = {
          id: crypto.randomUUID(),
          title: file.name.replace(/\.pdf$/i, ''),
          fileName: file.name,
          fileSize: file.size,
          pageCount: pdf.numPages,
          fileData: dataUrl,
          uploadedAt: new Date().toISOString(),
          pages,
        }
        set((state) => ({
          documents: [doc, ...state.documents],
          currentDocument: doc,
          annotations: [],
          textEdits: new Map(),
          pageRotations: new Map(),
          pageOrder: Array.from({ length: pdf.numPages }, (_, i) => i + 1),
          currentView: 'editor' as const,
        }))
        try {
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte), ''
            )
          )
          await fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: doc.title, fileName: doc.fileName, fileSize: doc.fileSize, pageCount: doc.pageCount, data: base64 }),
          })
        } catch { /* optional DB save */ }
      } catch (err) { console.error('Failed to process PDF:', err) }
    }
    reader.readAsDataURL(file)
  },
}), {
  name: 'app-store',
  storage: createJSONStorage(() => localStorage, {
    reviver: (key, value) => {
      if (value && typeof value === 'object' && (value as any).__type === 'Map') {
        return new Map((value as any).value)
      }
      return value
    },
    replacer: (key, value) => {
      if (value instanceof Map) {
        return { __type: 'Map', value: Array.from(value.entries()) }
      }
      return value
    }
  }),
  // Persist ONLY lightweight UI preferences. Documents/annotations/text-edits
  // contain base64 PDFs + images and must NOT go to localStorage (5 MB cap) —
  // doing so throws QuotaExceededError on every change. Documents persist via
  // the /api/documents folder store instead.
  version: 2,
  // Older versions persisted heavy/doc-specific data (documents, annotations,
  // textEdits, …). Strip those on load so stale text annotations don't render
  // against a document that isn't loaded — keep only the lightweight prefs.
  migrate: (persisted: any) => {
    if (!persisted || typeof persisted !== 'object') return persisted
    const {
      documents, currentDocument, annotations, textEdits, pageRotations,
      pageOrder, savedSignatures, currentView, currentPage,
      ...uiPrefs
    } = persisted
    return uiPrefs
  },
  partialize: (state) => ({
    drawColor: state.drawColor,
    strokeWidth: state.strokeWidth,
    fontSize: state.fontSize,
    fontFamily: state.fontFamily,
    showSidebar: state.showSidebar,
    showAnnotationPanel: state.showAnnotationPanel,
    zoom: state.zoom,
    watermarkText: state.watermarkText,
    watermarkOpacity: state.watermarkOpacity,
    watermarkAngle: state.watermarkAngle,
    isLoggedIn: state.isLoggedIn,
    userName: state.userName,
  }),
}))
