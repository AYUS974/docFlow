'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore, type EditorTool, type PDFAnnotation, matchPdfFont, matchMetricFont, METRIC_FONTS } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MousePointer2, Highlighter, PenTool, Type, Square, Circle, Eraser,
  ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight,
  PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  Download, Trash2, Plus, Minus, FileText, ArrowLeft, Undo2, Redo2,
  ArrowUpRight, Printer, Maximize2, Keyboard, FileDown, ImageIcon,
  XCircle, Pencil, EyeOff, PenLine, Stamp, Hand, Droplets, Crop,
  ImagePlus, Hash, Shield, FileOutput, Copy, Scissors, GripVertical,
  MoveHorizontal, CheckCircle2, Loader2, Settings2, ScanText, Sparkles, ChevronDown,
  Eye, Calendar, Check, ScrollText, BookOpen, Search,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { TextLayer } from './text-layer'
import { SignaturePad } from './signature-pad'
import { PageManager } from './page-manager'
import { AiChatPanel } from './ai-chat-panel'
import { PdfSearchBar, type SearchMatch } from './pdf-search-bar'
import { PdfContextMenu, type ContextMenuState } from './pdf-context-menu'
import { PdfThumbnailStrip } from './pdf-thumbnail-strip'
import { Slider } from '@/components/ui/slider'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'

const TOOL_GROUPS = [
  { label: 'File', tools: [
    { id: 'select' as EditorTool, icon: MousePointer2, label: 'Select', shortcut: 'V' },
    { id: 'pan' as EditorTool, icon: Hand, label: 'Pan', shortcut: 'H' },
  ]},
  { label: 'Edit', tools: [
    { id: 'editText' as EditorTool, icon: Pencil, label: 'Edit Text', shortcut: 'E' },
    { id: 'signature' as EditorTool, icon: Stamp, label: 'Signature', shortcut: 'S' },
    { id: 'image' as EditorTool, icon: ImagePlus, label: 'Image', shortcut: 'I' },
  ]},
  { label: 'Annotate', tools: [
    { id: 'highlight' as EditorTool, icon: Highlighter, label: 'Highlight', shortcut: 'A' },
    { id: 'draw' as EditorTool, icon: PenTool, label: 'Draw', shortcut: 'D' },
    { id: 'text' as EditorTool, icon: Type, label: 'Add Text', shortcut: 'T' },
  ]},
  { label: 'Shapes', tools: [
    { id: 'rectangle' as EditorTool, icon: Square, label: 'Rectangle', shortcut: 'R' },
    { id: 'ellipse' as EditorTool, icon: Circle, label: 'Ellipse', shortcut: 'O' },
    { id: 'line' as EditorTool, icon: ArrowUpRight, label: 'Arrow', shortcut: 'L' },
  ]},
  { label: 'Redact', tools: [
    { id: 'redact' as EditorTool, icon: EyeOff, label: 'Redact', shortcut: 'X' },
    { id: 'whiteout' as EditorTool, icon: PenLine, label: 'Whiteout', shortcut: 'W' },
  ]},
  { label: 'Clean', tools: [
    { id: 'eraser' as EditorTool, icon: Eraser, label: 'Eraser', shortcut: 'Z' },
  ]},
]
const ALL_TOOLS = TOOL_GROUPS.flatMap(g => g.tools)
const COLORS = ['#f59e0b','#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899','#06b6d4','#f97316','#000000','#6b7280']
const FONT_OPTIONS = [
  { value: 'Helvetica', label: 'Helvetica' },
  { value: 'TimesRoman', label: 'Times Roman' },
  { value: 'Courier', label: 'Courier' },
]
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.substring(0,2),16)/255, parseInt(h.substring(2,4),16)/255, parseInt(h.substring(4,6),16)/255]
}
export function PdfEditor() {
  const {
    currentDocument, currentTool, setCurrentTool,
    currentPage, setCurrentPage, totalPages, setTotalPages,
    zoom, setZoom,
    annotations, addAnnotation, removeAnnotation, clearAnnotations,
    drawColor, setDrawColor, strokeWidth, setStrokeWidth,
    fontSize, setFontSize, fontFamily, setFontFamily,
    showSidebar, toggleSidebar,
    showAnnotationPanel, toggleAnnotationPanel,
    showAiPanel, toggleAiPanel,
    isEditorLoading, setEditorLoading,
    isDrawing, setIsDrawing, currentDrawingPoints, setCurrentDrawingPoints,
    goBack, setView, undo, redo, canUndo, canRedo,
    signatureData, setSignatureData, setShowSignaturePad,
    textEdits, editingTextItem, setEditingTextItem,
    pageRotations, pageOrder, setPageOrder,
    cropBox, setCropBox, isCropping, setCropping,
    watermarkText, watermarkOpacity, watermarkAngle,
    pendingImageData, setPendingImageData,
    setWatermarkText, setWatermarkOpacity, setWatermarkAngle,
    savedSignatures, addSavedSignature,
    insertBlankPage, duplicatePage,
    updateDocument, updateAnnotation,
    bringToFront, sendToBack, removeAnnotationsByIds,
    saveToUndoStack,
  } = useAppStore()

  const [scrollMode, setScrollMode] = useState<'continuous' | 'single'>('continuous')
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const overlayCanvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({})
  const renderTasksRef = useRef<{ [key: number]: pdfjsLib.RenderTask | null }>({})
  const activeInteractionPageRef = useRef<number>(1)

  // Backward-compatible getters for existing single-page helpers
  const canvasRef = {
    get current(): HTMLCanvasElement | null {
      return canvasRefs.current[currentPage] || Object.values(canvasRefs.current)[0] || null
    }
  }
  const overlayCanvasRef = {
    get current(): HTMLCanvasElement | null {
      return overlayCanvasRefs.current[currentPage] || Object.values(overlayCanvasRefs.current)[0] || null
    }
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)
  const pdfBytesRef = useRef<Uint8Array | null>(null)
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null)
  const [pageThumbnails, setPageThumbnails] = useState<{page:number;dataUrl:string}[]>([])
  const [isRendering, setIsRendering] = useState(false)
  const [pdfReady, setPdfReady] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [sidebarMode, setSidebarMode] = useState<'thumbnails'|'pages'>('thumbnails')
  const drawStartRef = useRef<{x:number;y:number}|null>(null)
  const [textInput, setTextInput] = useState({x:0,y:0,visible:false})
  const [textInputValue, setTextInputValue] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{x:number;y:number;sl:number;st:number}|null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false)
  const [showPageNumDialog, setShowPageNumDialog] = useState(false)
  const [wmText, setWmText] = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(0.15)
  const [wmAngle, setWmAngle] = useState(-45)
  const [pnPos, setPnPos] = useState('bottom-center')
  const [pnFmt, setPnFmt] = useState('numeric')
  const [processing, setProcessing] = useState('')
  const [selectedAnnotId, setSelectedAnnotId] = useState<string | null>(null)
  const [isDraggingAnnot, setIsDraggingAnnot] = useState(false)
  const [dragAnnotStart, setDragAnnotStart] = useState<{ x: number; y: number; annotX: number; annotY: number; points?: { x: number; y: number }[] } | null>(null)
  const [editingAnnotId, setEditingAnnotId] = useState<string | null>(null)
  const [isResizingAnnot, setIsResizingAnnot] = useState(false)
  const [resizeAnnotStart, setResizeAnnotStart] = useState<{ x: number; y: number; annotW: number; annotH: number; ratio: number } | null>(null)
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const textSubmitRef = useRef<() => void>(() => {})
  const isSpawningRef = useRef(false)
  const wheelAccumulatorRef = useRef(0)
  const wheelCooldownRef = useRef(false)
  const [annotFontDropdownId, setAnnotFontDropdownId] = useState<string | null>(null)
  const [annotSizeDropdownId, setAnnotSizeDropdownId] = useState<string | null>(null)
  const [annotColorDropdownId, setAnnotColorDropdownId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([])
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0)
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    pageNumber: 1,
    canvasCoords: { x: 0, y: 0 },
  })
  const [showThumbnailStrip, setShowThumbnailStrip] = useState(false)
  
  // High-level editor modes: 'view' | 'annotate' | 'edit' | 'sign'
  type EditorMode = 'view' | 'annotate' | 'edit' | 'sign'
  const [editorMode, setEditorMode] = useState<EditorMode>('annotate')

  const handleModeChange = (mode: EditorMode) => {
    setEditorMode(mode)
    if (mode === 'view') {
      setCurrentTool('select')
    } else if (mode === 'annotate') {
      if (!['highlight', 'text', 'draw', 'rectangle', 'ellipse', 'line', 'eraser'].includes(currentTool)) {
        setCurrentTool('highlight')
      }
    } else if (mode === 'edit') {
      if (!['editText', 'whiteout', 'redact'].includes(currentTool)) {
        setCurrentTool('editText')
      }
    } else if (mode === 'sign') {
      if (!['signature', 'image'].includes(currentTool)) {
        if (!signatureData) {
          setShowSignaturePad(true)
        }
        setCurrentTool('signature')
      }
    }
  }

  // Keep editorMode in sync when tools are chosen via keyboard shortcuts / AI
  useEffect(() => {
    if (['editText', 'whiteout', 'redact'].includes(currentTool)) {
      setEditorMode('edit')
    } else if (['signature', 'image'].includes(currentTool)) {
      setEditorMode('sign')
    } else if (['highlight', 'text', 'draw', 'rectangle', 'ellipse', 'line', 'eraser'].includes(currentTool)) {
      setEditorMode('annotate')
    }
  }, [currentTool])

  const handleInsertDateStamp = () => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const newId = crypto.randomUUID()
    addAnnotation({
      id: newId,
      type: 'text',
      pageNumber: currentPage,
      x: 120,
      y: 120,
      content: today,
      color: '#000000',
      fontSize: 14,
      fontFamily: 'Helvetica',
    })
    setSelectedAnnotId(newId)
    showStatus('Date stamp added')
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const showStatus = (msg: string) => { setStatusMessage(msg); setTimeout(() => setStatusMessage(''), 3000) }

  // Load PDF
  useEffect(() => {
    const fileData = currentDocument?.fileData
    if (!fileData) return
    setEditorLoading(true)
    const loadPdf = async () => {
      try {
        const base64 = fileData.split(',')[1] || fileData
        const binaryString = atob(base64)
        const uint8 = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) uint8[i] = binaryString.charCodeAt(i)
        pdfBytesRef.current = uint8
        const pdf = await pdfjsLib.getDocument({ data: uint8.slice() }).promise
        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        setCurrentPage(1)
        setPageOrder(Array.from({ length: pdf.numPages }, (_, i) => i + 1))
        const thumbs: {page:number;dataUrl:string}[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const vp = page.getViewport({ scale: 0.2 })
          const tc = document.createElement('canvas')
          tc.width = vp.width; tc.height = vp.height
          await page.render({ canvasContext: tc.getContext('2d')!, viewport: vp }).promise
          thumbs.push({ page: i, dataUrl: tc.toDataURL() })
        }
        setPageThumbnails(thumbs)
        setPdfReady(!pdfReady)
        if (window.innerWidth < 768 && showSidebar) {
          toggleSidebar()
        }
        showStatus(`Loaded ${pdf.numPages} pages`)
      } catch (err) {
        console.error('Failed to load PDF:', err)
        showStatus('Failed to load PDF')
      } finally {
        setEditorLoading(false)
      }
    }
    loadPdf()
  }, [currentDocument?.fileData, setEditorLoading, setTotalPages, setCurrentPage, setPageOrder])

  // Auto fit to width on mobile when PDF is ready
  useEffect(() => {
    if (pdfReady && window.innerWidth < 768) {
      setTimeout(() => {
        handleFitToWidth()
      }, 400)
    }
  }, [pdfReady])

  // Cleanup active states and selections on tool change
  useEffect(() => {
    if (textInput.visible) {
      textSubmitRef.current()
    }
    if (currentTool !== 'select' && currentTool !== 'text' && currentTool !== 'editText') {
      setSelectedAnnotId(null)
      setEditingAnnotId(null)
    }
    if (isCropping) {
      setCropping(false)
      setCropBox(null)
    }
  }, [currentTool])

  // Assign ref to handleTextSubmit to bypass hook lifecycle limits
  textSubmitRef.current = () => {
    if (!textInputValue.trim()) {
      if (editingAnnotId) {
        saveToUndoStack()
        removeAnnotation(editingAnnotId)
        showStatus('Text removed')
      }
      setTextInput({ x: 0, y: 0, visible: false }); setTextInputValue(''); setEditingAnnotId(null); return
    }

    if (editingAnnotId) {
      saveToUndoStack()
      updateAnnotation(editingAnnotId, { content: textInputValue })
      showStatus('Text updated')
    } else {
      saveToUndoStack()
      addAnnotation({
        id: crypto.randomUUID(), type: 'text', pageNumber: currentPage,
        x: textInput.x, y: textInput.y, color: drawColor,
        content: textInputValue, fontSize, fontFamily,
        bold: textBold, italic: textItalic
      })
      showStatus('Text added')
    }
    setTextInput({ x: 0, y: 0, visible: false }); setTextInputValue(''); setEditingAnnotId(null)
  }

  // Keyboard shortcut to delete selected annotation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedAnnotId && (e.key === 'Delete' || e.key === 'Backspace')) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          saveToUndoStack()
          removeAnnotation(selectedAnnotId)
          setSelectedAnnotId(null)
          showStatus('Annotation deleted')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAnnotId, removeAnnotation])

  // Render a single PDF page into its designated canvas
  const renderSinglePage = useCallback(async (pageNumber: number) => {
    const pdf = pdfDocRef.current
    const canvas = canvasRefs.current[pageNumber]
    if (!pdf || !canvas || pageNumber < 1 || pageNumber > pdf.numPages) return

    if (renderTasksRef.current[pageNumber]) {
      try { renderTasksRef.current[pageNumber]?.cancel() } catch { /* settled */ }
      renderTasksRef.current[pageNumber] = null
    }

    try {
      const page = await pdf.getPage(pageNumber)
      const rotation = pageRotations.get(pageNumber) || 0
      const viewport = page.getViewport({ scale: zoom * 1.5, rotation })
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx, viewport })
      renderTasksRef.current[pageNumber] = task
      await task.promise
      renderTasksRef.current[pageNumber] = null
      renderPageAnnotations(pageNumber)
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Failed to render page ${pageNumber}:`, err)
      }
    }
  }, [zoom, pdfReady, pageRotations])

  // Render pages based on current scroll mode
  const renderPages = useCallback(async () => {
    const pdf = pdfDocRef.current
    if (!pdf || totalPages === 0) return
    setIsRendering(true)
    try {
      const pages = scrollMode === 'continuous'
        ? (pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1))
        : [currentPage]
      await Promise.all(pages.map(p => renderSinglePage(p)))
    } finally {
      setIsRendering(false)
    }
  }, [scrollMode, totalPages, pageOrder, currentPage, renderSinglePage])

  useEffect(() => { renderPages() }, [renderPages])

  // Render annotations overlay for a specific page
  const renderPageAnnotations = useCallback((pageNumber: number) => {
    const overlay = overlayCanvasRefs.current[pageNumber]
    const canvas = canvasRefs.current[pageNumber]
    if (!overlay || !canvas) return
    overlay.width = canvas.width
    overlay.height = canvas.height
    const ctx = overlay.getContext('2d')!
    const scale = zoom * 1.5

    // Render text edit whiteouts first
    for (const [, edit] of textEdits) {
      if (edit.original.pageNumber !== pageNumber) continue
      const orig = edit.original
      ctx.save()
      ctx.fillStyle = 'white'
      ctx.fillRect(orig.x * scale, orig.y * scale, Math.max(orig.width, 20) * scale, orig.height * scale)
      ctx.restore()
    }

    // Render crop box
    if (isCropping && cropBox && currentPage === pageNumber) {
      ctx.save()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(cropBox.x * scale, cropBox.y * scale, cropBox.width * scale, cropBox.height * scale)
      ctx.setLineDash([])
      // Dim outside area
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, 0, overlay.width, cropBox.y * scale)
      ctx.fillRect(0, (cropBox.y + cropBox.height) * scale, overlay.width, overlay.height - (cropBox.y + cropBox.height) * scale)
      ctx.fillRect(0, cropBox.y * scale, cropBox.x * scale, cropBox.height * scale)
      ctx.fillRect((cropBox.x + cropBox.width) * scale, cropBox.y * scale, overlay.width - (cropBox.x + cropBox.width) * scale, cropBox.height * scale)
      ctx.restore()
    }

    const pageAnnots = annotations.filter((a) => a.pageNumber === pageNumber)
    for (const annot of pageAnnots) {
      ctx.save()
      switch (annot.type) {
        case 'highlight':
          ctx.fillStyle = annot.color + '40'
          ctx.fillRect(annot.x * scale, annot.y * scale, (annot.width || 100) * scale, (annot.height || 30) * scale)
          break
        case 'draw':
          if (annot.points && annot.points.length > 1) {
            ctx.strokeStyle = annot.color
            ctx.lineWidth = (annot.strokeWidth || 2) * scale
            ctx.lineCap = 'round'; ctx.lineJoin = 'round'
            ctx.beginPath()
            ctx.moveTo(annot.points[0].x * scale, annot.points[0].y * scale)
            for (let i = 1; i < annot.points.length; i++) ctx.lineTo(annot.points[i].x * scale, annot.points[i].y * scale)
            ctx.stroke()
          }
          break
        case 'text':
          // Rendered as interactive HTML elements in the overlay layer
          break
        case 'rectangle':
          ctx.strokeStyle = annot.color
          ctx.lineWidth = (annot.strokeWidth || 2) * scale
          ctx.strokeRect(annot.x * scale, annot.y * scale, (annot.width || 100) * scale, (annot.height || 100) * scale)
          break
        case 'ellipse': {
          const cx = (annot.x + (annot.width || 100) / 2) * scale
          const cy = (annot.y + (annot.height || 100) / 2) * scale
          ctx.strokeStyle = annot.color
          ctx.lineWidth = (annot.strokeWidth || 2) * scale
          ctx.beginPath()
          ctx.ellipse(cx, cy, ((annot.width || 100) / 2) * scale, ((annot.height || 100) / 2) * scale, 0, 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'line': {
          const lw = (annot.strokeWidth || 2) * scale
          ctx.strokeStyle = annot.color; ctx.lineWidth = lw; ctx.lineCap = 'round'
          const ex = (annot.x + (annot.width || 50)) * scale
          const ey = (annot.y + (annot.height || 50)) * scale
          ctx.beginPath(); ctx.moveTo(annot.x * scale, annot.y * scale); ctx.lineTo(ex, ey); ctx.stroke()
          const angle = Math.atan2(ey - annot.y * scale, ex - annot.x * scale)
          const headLen = Math.max(10, lw * 5)
          ctx.fillStyle = annot.color; ctx.beginPath(); ctx.moveTo(ex, ey)
          ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6))
          ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6))
          ctx.closePath(); ctx.fill()
          break
        }
        case 'redact':
          ctx.fillStyle = '#000000'
          ctx.fillRect(annot.x * scale, annot.y * scale, (annot.width || 100) * scale, (annot.height || 30) * scale)
          break
        case 'whiteout':
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(annot.x * scale, annot.y * scale, (annot.width || 100) * scale, (annot.height || 30) * scale)
          break
        case 'signature':
          if (annot.signatureData) {
            const img = new Image()
            img.src = annot.signatureData
            try { ctx.drawImage(img, annot.x * scale, annot.y * scale, (annot.width || 150) * scale, (annot.height || 50) * scale) }
            catch { /* image not loaded yet */ }
          }
          break
        case 'image':
          if (annot.imageData) {
            const img = new Image()
            img.src = annot.imageData
            try { ctx.drawImage(img, annot.x * scale, annot.y * scale, (annot.width || 200) * scale, (annot.height || 150) * scale) }
            catch { /* image not loaded yet */ }
          }
          break
        case 'watermark':
          if (annot.watermarkText) {
            const angle = (annot.watermarkAngle || -45) * Math.PI / 180
            const wmSize = (annot.watermarkFontSize || 40) * scale
            ctx.save()
            ctx.translate((annot.x + (annot.width || 400) / 2) * scale, (annot.y + (annot.height || 300) / 2) * scale)
            ctx.rotate(angle)
            ctx.fillStyle = annot.color
            ctx.globalAlpha = annot.watermarkOpacity || 0.15
            ctx.font = `bold ${wmSize}px Helvetica, sans-serif`
            ctx.textAlign = 'center'
            ctx.fillText(annot.watermarkText, 0, 0)
            ctx.restore()
          }
          break
      }
      ctx.restore()
    }

    // Draw selection border for selected annotation on this page
    if (selectedAnnotId) {
      const selectedAnnot = annotations.find(a => a.id === selectedAnnotId)
      if (selectedAnnot && selectedAnnot.pageNumber === pageNumber && selectedAnnot.type !== 'text') {
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        let x = selectedAnnot.x, y = selectedAnnot.y, w = selectedAnnot.width || 100, h = selectedAnnot.height || 50
        if (selectedAnnot.type === 'draw' && selectedAnnot.points && selectedAnnot.points.length > 0) {
          const xs = selectedAnnot.points.map(p => p.x)
          const ys = selectedAnnot.points.map(p => p.y)
          const minX = Math.min(...xs), maxX = Math.max(...xs)
          const minY = Math.min(...ys), maxY = Math.max(...ys)
          x = minX; y = minY; w = maxX - minX; h = maxY - minY
        }
        ctx.strokeRect(x * scale - 4, y * scale - 4, w * scale + 8, h * scale + 8)

        // Draw resize handle at bottom-right corner for resizable annotations
        if (selectedAnnot.type !== 'draw' && selectedAnnot.type !== 'line') {
          ctx.setLineDash([])
          ctx.fillStyle = '#3b82f6'
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 1
          
          const handleX = (x + w) * scale + 4
          const handleY = (y + h) * scale + 4
          const handleSize = 8
          
          ctx.fillRect(handleX - handleSize / 2, handleY - handleSize / 2, handleSize, handleSize)
          ctx.strokeRect(handleX - handleSize / 2, handleY - handleSize / 2, handleSize, handleSize)
        }
        ctx.restore()
      }
    }
  }, [annotations, currentPage, zoom, textEdits, isCropping, cropBox, selectedAnnotId])

  const renderAllAnnotations = useCallback(() => {
    const pages = scrollMode === 'continuous'
      ? (pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1))
      : [currentPage]
    pages.forEach(p => renderPageAnnotations(p))
  }, [scrollMode, pageOrder, totalPages, currentPage, renderPageAnnotations])

  useEffect(() => { renderAllAnnotations() }, [renderAllAnnotations])

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, pageNum: number = currentPage) => {
    const overlay = overlayCanvasRefs.current[pageNum] || overlayCanvasRef.current
    if (!overlay) return { x: 0, y: 0 }
    const rect = overlay.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) { clientX = e.touches[0]?.clientX || 0; clientY = e.touches[0]?.clientY || 0 }
    else { clientX = e.clientX; clientY = e.clientY }
    return { x: (clientX - rect.left) / (zoom * 1.5), y: (clientY - rect.top) / (zoom * 1.5) }
  }

  const handleCanvasDoubleClick = (e: React.MouseEvent) => {
    // Handled by HTML overlay
  }

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent, pageNum: number = currentPage) => {
    activeInteractionPageRef.current = pageNum
    if (currentPage !== pageNum) {
      setCurrentPage(pageNum)
    }
    if (currentTool === 'eraser' || currentTool === 'editText' || currentTool === 'pan') return
    if ('button' in e && e.button !== 0) return

    const coords = getCanvasCoords(e, pageNum)

    if (currentTool === 'select') {
      // Check if user clicked the resize handle of the selected annotation
      if (selectedAnnotId) {
        const selectedAnnot = annotations.find(a => a.id === selectedAnnotId)
        if (selectedAnnot && selectedAnnot.pageNumber === pageNum) {
          const scale = zoom * 1.5
          let x = selectedAnnot.x, y = selectedAnnot.y, w = selectedAnnot.width || 100, h = selectedAnnot.height || 50
          if (selectedAnnot.type !== 'text' && selectedAnnot.type !== 'draw' && selectedAnnot.type !== 'line') {
            const handleX = x + w + 4 / scale
            const handleY = y + h + 4 / scale
            const dist = Math.sqrt((coords.x - handleX) ** 2 + (coords.y - handleY) ** 2)
            const clickThreshold = 12 / scale
            
            if (dist <= clickThreshold) {
              saveToUndoStack()
              setIsResizingAnnot(true)
              setResizeAnnotStart({
                x: coords.x,
                y: coords.y,
                annotW: w,
                annotH: h,
                ratio: w / h
              })
              return
            }
          }
        }
      }

      const pageAnnots = annotations.filter((a) => a.pageNumber === pageNum)
      for (let i = pageAnnots.length - 1; i >= 0; i--) {
        const annot = pageAnnots[i]
        if (annot.type === 'text') continue // Handled by HTML overlay
        let hit = false
        let x = annot.x, y = annot.y, w = annot.width || 100, h = annot.height || 50
        if (annot.type === 'draw' && annot.points && annot.points.length > 0) {
          const xs = annot.points.map(p => p.x)
          const ys = annot.points.map(p => p.y)
          const minX = Math.min(...xs), maxX = Math.max(...xs)
          const minY = Math.min(...ys), maxY = Math.max(...ys)
          x = minX; y = minY; w = maxX - minX; h = maxY - minY
        }
        if (coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h) hit = true

        if (hit) {
          saveToUndoStack()
          setSelectedAnnotId(annot.id)
          setIsDraggingAnnot(true)
          setDragAnnotStart({
            x: coords.x,
            y: coords.y,
            annotX: annot.x,
            annotY: annot.y,
            points: annot.points ? [...annot.points] : undefined
          })
          return
        }
      }
      setSelectedAnnotId(null)
      return
    }

    // Signature: place at click
    if (currentTool === 'signature') {
      if (!signatureData) { setShowSignaturePad(true); return }
      const newId = crypto.randomUUID()
      addAnnotation({
        id: newId, type: 'signature', pageNumber: pageNum,
        x: coords.x, y: coords.y, width: 150, height: 50, color: '#000000',
        signatureData,
      })
      setSelectedAnnotId(newId)
      setCurrentTool('select')
      return
    }

    // Image: place pending image at click
    if (currentTool === 'image') {
      if (!pendingImageData) { fileInputRef.current?.click(); return }
      const newId = crypto.randomUUID()
      addAnnotation({
        id: newId, type: 'image', pageNumber: pageNum,
        x: coords.x, y: coords.y, width: 200, height: 150, color: '#000000',
        imageData: pendingImageData,
      })
      setPendingImageData(null)
      setSelectedAnnotId(newId)
      setCurrentTool('select')
      return
    }

    // Crop mode
    if (isCropping) {
      drawStartRef.current = coords
      setIsDrawing(true)
      return
    }

    drawStartRef.current = coords
    setIsDrawing(true)

    if (currentTool === 'draw') {
      setCurrentDrawingPoints([coords])
    }
  }

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent, pageNum: number = currentPage) => {
    const activePage = pageNum || activeInteractionPageRef.current || currentPage

    // 1. Resizing logic
    if (isResizingAnnot && resizeAnnotStart && selectedAnnotId) {
      const coords = getCanvasCoords(e, activePage)
      const dx = coords.x - resizeAnnotStart.x
      const dy = coords.y - resizeAnnotStart.y
      
      const selectedAnnot = annotations.find(a => a.id === selectedAnnotId)
      if (!selectedAnnot) return
      
      let newW = resizeAnnotStart.annotW + dx
      let newH = resizeAnnotStart.annotH + dy
      
      newW = Math.max(10, newW)
      newH = Math.max(10, newH)
      
      if (selectedAnnot.type === 'image' || selectedAnnot.type === 'signature') {
        const ratio = resizeAnnotStart.ratio
        if (Math.abs(dx) > Math.abs(dy)) {
          newH = newW / ratio
        } else {
          newW = newH * ratio
        }
      }
      
      updateAnnotation(selectedAnnotId, {
        width: newW,
        height: newH
      })
      return
    }

    // 2. Dragging logic
    if (isDraggingAnnot && dragAnnotStart && selectedAnnotId) {
      const coords = getCanvasCoords(e, activePage)
      const dx = coords.x - dragAnnotStart.x
      const dy = coords.y - dragAnnotStart.y
      if (dragAnnotStart.points) {
        updateAnnotation(selectedAnnotId, {
          x: dragAnnotStart.annotX + dx,
          y: dragAnnotStart.annotY + dy,
          points: dragAnnotStart.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
        })
      } else {
        updateAnnotation(selectedAnnotId, {
          x: dragAnnotStart.annotX + dx,
          y: dragAnnotStart.annotY + dy
        })
      }
      return
    }

    // 3. Hover resize cursor logic
    if (!isDrawing && !isDraggingAnnot && !isResizingAnnot && selectedAnnotId) {
      const selectedAnnot = annotations.find(a => a.id === selectedAnnotId)
      if (selectedAnnot && selectedAnnot.pageNumber === activePage) {
        if (selectedAnnot.type !== 'text' && selectedAnnot.type !== 'draw' && selectedAnnot.type !== 'line') {
          const coords = getCanvasCoords(e, activePage)
          const scale = zoom * 1.5
          const handleX = selectedAnnot.x + (selectedAnnot.width || 100) + 4 / scale
          const handleY = selectedAnnot.y + (selectedAnnot.height || 50) + 4 / scale
          const dist = Math.sqrt((coords.x - handleX) ** 2 + (coords.y - handleY) ** 2)
          const overlay = overlayCanvasRefs.current[activePage] || overlayCanvasRef.current
          if (overlay) {
            if (dist <= 12 / scale) {
              overlay.style.cursor = 'se-resize'
              return
            } else {
              overlay.style.cursor = isPanMode ? 'grab' : isCropping ? 'crosshair' : 'default'
            }
          }
        }
      }
    }

    if (!isDrawing || !drawStartRef.current) return
    if (currentTool === 'pan') return
    const coords = getCanvasCoords(e, activePage)
    const scale = zoom * 1.5

    if (currentTool === 'draw') {
      setCurrentDrawingPoints([...currentDrawingPoints, coords])
    }

    // Live preview for shape/rect/ellipse/line/highlight/redact/whiteout/crop
    const shapeTools = ['rectangle', 'ellipse', 'highlight', 'redact', 'whiteout', 'line']
    if (shapeTools.includes(currentTool) || isCropping) {
      const overlay = overlayCanvasRefs.current[activePage] || overlayCanvasRef.current
      const canvas = canvasRefs.current[activePage] || canvasRef.current
      if (!overlay || !canvas) return
      overlay.width = canvas.width; overlay.height = canvas.height
      const ctx = overlay.getContext('2d')!
      // Re-render existing annotations for this page first
      renderPageAnnotations(activePage)
      // Draw preview shape
      const w = coords.x - drawStartRef.current.x
      const h = coords.y - drawStartRef.current.y
      ctx.save()
      ctx.setLineDash([4, 4])
      if (currentTool === 'rectangle' || isCropping) {
        ctx.strokeStyle = isCropping ? '#10b981' : drawColor
        ctx.lineWidth = (strokeWidth || 2) * scale
        ctx.strokeRect(drawStartRef.current.x * scale, drawStartRef.current.y * scale, w * scale, h * scale)
        if (isCropping) {
          ctx.fillStyle = 'rgba(16,185,129,0.08)'
          ctx.fillRect(drawStartRef.current.x * scale, drawStartRef.current.y * scale, w * scale, h * scale)
        }
      } else if (currentTool === 'ellipse') {
        const cx = (drawStartRef.current.x + w / 2) * scale
        const cy = (drawStartRef.current.y + h / 2) * scale
        ctx.strokeStyle = drawColor; ctx.lineWidth = (strokeWidth || 2) * scale
        ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(w / 2) * scale, Math.abs(h / 2) * scale, 0, 0, Math.PI * 2); ctx.stroke()
      } else if (currentTool === 'line') {
        ctx.strokeStyle = drawColor; ctx.lineWidth = (strokeWidth || 2) * scale; ctx.lineCap = 'round'
        ctx.beginPath(); ctx.moveTo(drawStartRef.current.x * scale, drawStartRef.current.y * scale); ctx.lineTo(coords.x * scale, coords.y * scale); ctx.stroke()
      } else {
        ctx.fillStyle = currentTool === 'redact' ? 'rgba(0,0,0,0.4)' : currentTool === 'highlight' ? drawColor + '30' : 'rgba(255,255,255,0.5)'
        ctx.fillRect(Math.min(drawStartRef.current.x, coords.x) * scale, Math.min(drawStartRef.current.y, coords.y) * scale, Math.abs(w) * scale, Math.abs(h) * scale)
      }
      ctx.restore()
    }
  }

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent, pageNum: number = currentPage) => {
    const activePage = pageNum || activeInteractionPageRef.current || currentPage

    if (isResizingAnnot) {
      setIsResizingAnnot(false)
      setResizeAnnotStart(null)
      return
    }
    if (isDraggingAnnot) {
      setIsDraggingAnnot(false)
      setDragAnnotStart(null)
      return
    }
    if (currentTool === 'pan') return
    if (!isDrawing) return

    // Handle crop box
    if (isCropping && drawStartRef.current) {
      const coords = getCanvasCoords(e, activePage)
      const w = Math.abs(coords.x - drawStartRef.current.x)
      const h = Math.abs(coords.y - drawStartRef.current.y)
      if (w > 5 && h > 5) {
        setCropBox({
          x: Math.min(drawStartRef.current.x, coords.x),
          y: Math.min(drawStartRef.current.y, coords.y),
          width: w, height: h,
        })
      }
      drawStartRef.current = null; setIsDrawing(false)
      return
    }

    if (!drawStartRef.current) { setIsDrawing(false); return }

    if (currentTool === 'draw' && currentDrawingPoints.length > 1) {
      addAnnotation({
        id: crypto.randomUUID(), type: 'draw', pageNumber: activePage,
        x: currentDrawingPoints[0].x, y: currentDrawingPoints[0].y,
        color: drawColor, strokeWidth, points: [...currentDrawingPoints],
      })
      setCurrentDrawingPoints([])
    } else if (['rectangle', 'ellipse', 'highlight', 'redact', 'whiteout', 'line'].includes(currentTool)) {
      const coords = getCanvasCoords(e, activePage)
      const w = coords.x - drawStartRef.current.x
      const h = coords.y - drawStartRef.current.y
      if (Math.abs(w) > 2 || Math.abs(h) > 2) {
        const base = { id: crypto.randomUUID(), pageNumber: activePage, color: drawColor, strokeWidth }
        if (['highlight', 'rectangle', 'ellipse', 'redact', 'whiteout'].includes(currentTool)) {
          addAnnotation({ ...base, type: currentTool as PDFAnnotation['type'], x: Math.min(drawStartRef.current.x, coords.x), y: Math.min(drawStartRef.current.y, coords.y), width: Math.abs(w), height: Math.abs(h) })
        } else if (currentTool === 'line') {
          addAnnotation({ ...base, type: 'line', x: drawStartRef.current.x, y: drawStartRef.current.y, width: w, height: h })
        }
      }
    }
    drawStartRef.current = null; setIsDrawing(false)
  }

  const handleEraserClick = (e: React.MouseEvent, pageNum: number = currentPage) => {
    if (currentTool !== 'eraser') return
    const coords = getCanvasCoords(e, pageNum)
    const scale = zoom * 1.5
    const pageAnnots = annotations.filter((a) => a.pageNumber === pageNum)
    for (const annot of pageAnnots) {
      let hit = false
      if (annot.type === 'draw' && annot.points) {
        for (const pt of annot.points) { if (Math.sqrt((pt.x - coords.x) ** 2 + (pt.y - coords.y) ** 2) < 15 / scale) { hit = true; break } }
      } else if (annot.type === 'line') {
        const lx2 = annot.x + (annot.width || 0), ly2 = annot.y + (annot.height || 0)
        const len = Math.sqrt((lx2 - annot.x) ** 2 + (ly2 - annot.y) ** 2)
        if (len > 0) {
          const t = Math.max(0, Math.min(1, ((coords.x - annot.x) * (lx2 - annot.x) + (coords.y - annot.y) * (ly2 - annot.y)) / (len * len)))
          if (Math.sqrt((coords.x - (annot.x + t * (lx2 - annot.x))) ** 2 + (coords.y - (annot.y + t * (ly2 - annot.y))) ** 2) < 15 / scale) hit = true
        }
      } else {
        const ax = annot.x, ay = annot.y, aw = annot.width || 50, ah = annot.height || 30
        if (coords.x >= ax && coords.x <= ax + aw && coords.y >= ay && coords.y <= ay + ah) {
          hit = true
        }
      }
      if (hit) { removeAnnotation(annot.id); showStatus(`Removed ${annot.type}`); return }
    }
  }

  const handleCanvasClick = (e: React.MouseEvent, pageNum: number = currentPage) => {
    if (currentPage !== pageNum) {
      setCurrentPage(pageNum)
    }
    if (currentTool === 'text') {
      if (editingAnnotId || isSpawningRef.current) return
      isSpawningRef.current = true

      const coords = getCanvasCoords(e, pageNum)
      const newAnnotId = crypto.randomUUID()
      addAnnotation({
        id: newAnnotId,
        type: 'text',
        pageNumber: pageNum,
        x: coords.x,
        y: coords.y,
        content: 'Type text...',
        fontSize,
        fontFamily,
        color: drawColor,
        bold: false,
        italic: false
      })
      setSelectedAnnotId(newAnnotId)
      setEditingAnnotId(newAnnotId)

      setTimeout(() => {
        isSpawningRef.current = false
      }, 300)

      setCurrentTool('select')
    }
    if (currentTool === 'eraser') handleEraserClick(e, pageNum)
  }

  const handleStartDrag = (e: React.MouseEvent, annot: PDFAnnotation) => {
    if (currentTool !== 'select' && currentTool !== 'text') return
    if (editingAnnotId === annot.id) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedAnnotId(annot.id)
    
    const startX = e.clientX
    const startY = e.clientY
    const origX = annot.x
    const origY = annot.y
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = (moveEvent.clientX - startX) / (zoom * 1.5)
      const dy = (moveEvent.clientY - startY) / (zoom * 1.5)
      updateAnnotation(annot.id, {
        x: origX + dx,
        y: origY + dy
      })
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Pan handlers
  const handlePanStart = (e: React.MouseEvent) => {
    if (currentTool !== 'pan') return
    setIsPanning(true)
    panStartRef.current = { x: e.clientX, y: e.clientY, sl: containerRef.current?.scrollLeft || 0, st: containerRef.current?.scrollTop || 0 }
  }
  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStartRef.current || !containerRef.current) return
    containerRef.current.scrollLeft = panStartRef.current.sl - (e.clientX - panStartRef.current.x)
    containerRef.current.scrollTop = panStartRef.current.st - (e.clientY - panStartRef.current.y)
  }
  const handlePanEnd = () => { setIsPanning(false); panStartRef.current = null }

  // Scroll wheel zoom + page navigation
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(Math.max(0.25, Math.min(5, zoom + delta)))
      return
    }

    if (scrollMode === 'continuous') {
      return
    }

    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 8
    const isAtTop = scrollTop <= 8
    const isScrollable = scrollHeight > clientHeight + 10

    // If scrolling down at the bottom of the page in single page mode
    if (e.deltaY > 0 && (isAtBottom || !isScrollable)) {
      if (currentPage < totalPages && !wheelCooldownRef.current) {
        wheelAccumulatorRef.current += e.deltaY
        if (wheelAccumulatorRef.current > 40) {
          wheelCooldownRef.current = true
          wheelAccumulatorRef.current = 0
          setCurrentPage(currentPage + 1)
          setTimeout(() => {
            if (containerRef.current) containerRef.current.scrollTop = 0
            wheelCooldownRef.current = false
          }, 250)
        }
      }
    }
    // If scrolling up at the top of the page in single page mode
    else if (e.deltaY < 0 && (isAtTop || !isScrollable)) {
      if (currentPage > 1 && !wheelCooldownRef.current) {
        wheelAccumulatorRef.current += e.deltaY
        if (wheelAccumulatorRef.current < -40) {
          wheelCooldownRef.current = true
          wheelAccumulatorRef.current = 0
          setCurrentPage(currentPage - 1)
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = Math.max(0, containerRef.current.scrollHeight - containerRef.current.clientHeight)
            }
            wheelCooldownRef.current = false
          }, 250)
        }
      }
    } else {
      wheelAccumulatorRef.current = 0
    }
  }

  // Scroll synchronization for Continuous Multi-Page mode
  const handleScroll = () => {
    if (scrollMode !== 'continuous' || !containerRef.current || totalPages <= 1) return
    const container = containerRef.current
    const containerRect = container.getBoundingClientRect()
    const centerY = containerRect.top + 160

    const pages = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1)
    for (const p of pages) {
      const el = document.getElementById(`pdf-page-${p}`)
      if (el) {
        const r = el.getBoundingClientRect()
        if (r.top <= centerY && r.bottom >= centerY) {
          if (currentPage !== p) {
            setCurrentPage(p)
          }
          break
        }
      }
    }
  }

  const handlePageSelect = (pageNumber: number) => {
    const validPage = Math.max(1, Math.min(totalPages, pageNumber))
    setCurrentPage(validPage)
    if (scrollMode === 'continuous') {
      const el = document.getElementById(`pdf-page-${validPage}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  }

  // Image file upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setPendingImageData(dataUrl)
      showStatus('Image loaded — click on the page to place it')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }
  // Download PNG of current page
  const handleDownloadPng = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const mergeCanvas = document.createElement('canvas')
    mergeCanvas.width = canvas.width; mergeCanvas.height = canvas.height
    const ctx = mergeCanvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, mergeCanvas.width, mergeCanvas.height)
    ctx.drawImage(canvas, 0, 0)
    if (overlayCanvasRef.current) ctx.drawImage(overlayCanvasRef.current, 0, 0)
    const link = document.createElement('a')
    link.download = `${currentDocument?.fileName || 'document'}-page${currentPage}.png`
    link.href = mergeCanvas.toDataURL('image/png'); link.click()
  }

  // Font embedding helper
  const getFontForExport = async (pdfDoc: PDFDocument, fontName: string) => {
    const matched = matchPdfFont(fontName)
    if (matched === 'Courier') return pdfDoc.embedFont(StandardFonts.Courier)
    if (matched === 'TimesRoman') return pdfDoc.embedFont(StandardFonts.TimesRoman)
    return pdfDoc.embedFont(StandardFonts.Helvetica)
  }

  // Export as PDF with ALL features embedded
  const handleExportPdf = async () => {
    if (!pdfBytesRef.current) return
    if (annotations.some(a => a.type === 'redact')) {
      showStatus('Tip: use "Apply Redaction" to permanently remove content — Export only covers it visually')
    }
    setIsExporting(true)
    try {
      const pdfDoc = await PDFDocument.load(pdfBytesRef.current)
      
      // Register fontkit
      pdfDoc.registerFontkit(fontkit)

      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
      const courierFont = await pdfDoc.embedFont(StandardFonts.Courier)
      const fontMap: Record<string, any> = { Helvetica: helveticaFont, TimesRoman: timesFont, Courier: courierFont }
      const pages = pdfDoc.getPages()
      // Annotation coordinates are stored in PDF points (getCanvasCoords divides
      // screen px by zoom*1.5), and pdf-lib pages are also in points — so the
      // export maps 1:1. (This was previously 1.5, which placed every shape/
      // image/signature/watermark ~1.5x off on export.)
      const scale = 1

      // Gather all unique font files needed for the edits and text annotations
      const neededFonts = new Set<string>()
      for (const [, edit] of textEdits) {
        const family = edit.fontFamily || matchMetricFont(edit.original.fontFamily)
        const fontInfo = METRIC_FONTS[family] || METRIC_FONTS['arimo']
        const prefix = fontInfo.fileName
        
        let styleStr = 'Regular'
        if (edit.bold && edit.italic) styleStr = 'BoldItalic'
        else if (edit.bold) styleStr = 'Bold'
        else if (edit.italic) styleStr = 'Italic'
        
        const fontFileName = `${prefix}-${styleStr}.ttf`
        neededFonts.add(fontFileName)
      }

      for (const annot of annotations) {
        if (annot.type === 'text') {
          const family = annot.fontFamily ? (METRIC_FONTS[annot.fontFamily.toLowerCase()] ? annot.fontFamily.toLowerCase() : matchMetricFont(annot.fontFamily)) : 'arimo'
          const fontInfo = METRIC_FONTS[family] || METRIC_FONTS['arimo']
          const prefix = fontInfo.fileName
          
          let styleStr = 'Regular'
          if (annot.bold && annot.italic) styleStr = 'BoldItalic'
          else if (annot.bold) styleStr = 'Bold'
          else if (annot.italic) styleStr = 'Italic'
          
          const fontFileName = `${prefix}-${styleStr}.ttf`
          neededFonts.add(fontFileName)
        }
      }

      // Load all needed fonts from local server
      const loadedFonts: Record<string, any> = {}
      for (const fontFile of neededFonts) {
        try {
          const res = await fetch(`/fonts/${fontFile}`)
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const buffer = await res.arrayBuffer()
          loadedFonts[fontFile] = await pdfDoc.embedFont(buffer)
        } catch (err) {
          console.error(`Failed to embed font ${fontFile}, falling back to Helvetica`, err)
        }
      }

      // Apply page rotations
      for (const [pageNum, deg] of pageRotations) {
        if (pageNum >= 1 && pageNum <= pages.length) pages[pageNum - 1].setRotation(degrees(deg))
      }

      // Apply text edits (whiteout original + new text at its chosen position/font)
      for (const [, edit] of textEdits) {
        const { original, edited } = edit
        if (original.pageNumber < 1 || original.pageNumber > pages.length) continue
        const page = pages[original.pageNumber - 1]
        const { height: ph } = page.getSize()
        
        // Find the font family used
        const family = edit.fontFamily || matchMetricFont(original.fontFamily)
        const fontInfo = METRIC_FONTS[family] || METRIC_FONTS['arimo']
        const prefix = fontInfo.fileName
        
        let styleStr = 'Regular'
        if (edit.bold && edit.italic) styleStr = 'BoldItalic'
        else if (edit.bold) styleStr = 'Bold'
        else if (edit.italic) styleStr = 'Italic'
        
        const fontFileName = `${prefix}-${styleStr}.ttf`
        
        // Use loaded custom font or fall back to standard Helvetica
        const font = loadedFonts[fontFileName] || helveticaFont
        
        const ex = edit.x ?? original.x
        const ey = edit.y ?? original.y
        const pad = original.fontSize * 0.2
        
        // Coords from pdf.js are PDF points -> map 1:1.
        const origBaseline = ph - original.y - original.height
        const drawBaseline = ph - ey - (edit.fontSize || original.fontSize)
        
        // Whiteout the ORIGINAL glyph box (if not a duplicate)
        if (!edit.isDuplicate) {
          page.drawRectangle({
            x: original.x - 1, y: origBaseline - pad,
            width: Math.max(original.width, original.fontSize * 0.6) + 2,
            height: original.height + pad,
            color: rgb(1, 1, 1), opacity: 1,
          })
        }
        
        // Draw the replacement text run (skip if text is empty/deleted)
        if (edited.trim().length > 0) {
          const [er, eg, eb] = hexToRgb(edit.color || '#000000')
          page.drawText(edited, {
            x: ex, y: drawBaseline,
            size: edit.fontSize || original.fontSize,
            font,
            color: rgb(er, eg, eb),
          })
        }
      }

      // Apply annotations
      for (const annot of annotations) {
        if (annot.pageNumber < 1 || annot.pageNumber > pages.length) continue
        const page = pages[annot.pageNumber - 1]
        const { width: pw, height: ph } = page.getSize()
        const [r, g, b] = hexToRgb(annot.color)

        switch (annot.type) {
          case 'highlight':
            page.drawRectangle({ x: annot.x * scale, y: ph - annot.y * scale - (annot.height || 30) * scale, width: (annot.width || 100) * scale, height: (annot.height || 30) * scale, color: rgb(r, g, b), opacity: 0.25 })
            break
          case 'draw':
            if (annot.points && annot.points.length > 1) {
              for (let i = 1; i < annot.points.length; i++) {
                page.drawLine({ start: { x: annot.points[i-1].x * scale, y: ph - annot.points[i-1].y * scale }, end: { x: annot.points[i].x * scale, y: ph - annot.points[i].y * scale }, thickness: (annot.strokeWidth || 2) * scale * 0.8, color: rgb(r, g, b) })
              }
            }
            break
          case 'text': {
            // Use the embedded metric-compatible font (+ bold/italic variant)
            // gathered above, at the chosen size/color. Coords are PDF points,
            // so map 1:1 (no 1.5x). Preview places the box top at (y - size),
            // so the baseline sits ~ y - 0.1*size in top-left space.
            const famKey = annot.fontFamily
              ? (METRIC_FONTS[annot.fontFamily.toLowerCase()] ? annot.fontFamily.toLowerCase() : matchMetricFont(annot.fontFamily))
              : 'arimo'
            const fInfo = METRIC_FONTS[famKey] || METRIC_FONTS['arimo']
            let styleStr = 'Regular'
            if (annot.bold && annot.italic) styleStr = 'BoldItalic'
            else if (annot.bold) styleStr = 'Bold'
            else if (annot.italic) styleStr = 'Italic'
            const font = loadedFonts[`${fInfo.fileName}-${styleStr}.ttf`] || helveticaFont
            const size = annot.fontSize || 16
            page.drawText(annot.content || '', {
              x: annot.x,
              y: ph - annot.y + size * 0.1,
              size,
              font,
              color: rgb(r, g, b),
            })
            break
          }
          case 'rectangle':
            page.drawRectangle({ x: annot.x * scale, y: ph - annot.y * scale - (annot.height || 100) * scale, width: (annot.width || 100) * scale, height: (annot.height || 100) * scale, borderColor: rgb(r, g, b), borderWidth: (annot.strokeWidth || 2) * scale * 0.8 })
            break
          case 'ellipse':
            page.drawEllipse({ x: (annot.x + (annot.width || 100) / 2) * scale, y: ph - (annot.y + (annot.height || 100) / 2) * scale, xScale: ((annot.width || 100) / 2) * scale, yScale: ((annot.height || 100) / 2) * scale, borderColor: rgb(r, g, b), borderWidth: (annot.strokeWidth || 2) * scale * 0.8 })
            break
          case 'line': {
            const sx = annot.x * scale, sy = ph - annot.y * scale
            const ex = (annot.x + (annot.width || 50)) * scale, ey = ph - (annot.y + (annot.height || 50)) * scale
            page.drawLine({ start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: (annot.strokeWidth || 2) * scale * 0.8, color: rgb(r, g, b) })
            const angle = Math.atan2(ey - sy, ex - sx); const headLen = 8 * scale
            page.drawLine({ start: { x: ex, y: ey }, end: { x: ex - headLen * Math.cos(angle - Math.PI / 6), y: ey - headLen * Math.sin(angle - Math.PI / 6) }, thickness: (annot.strokeWidth || 2) * scale * 0.8, color: rgb(r, g, b) })
            page.drawLine({ start: { x: ex, y: ey }, end: { x: ex - headLen * Math.cos(angle + Math.PI / 6), y: ey - headLen * Math.sin(angle + Math.PI / 6) }, thickness: (annot.strokeWidth || 2) * scale * 0.8, color: rgb(r, g, b) })
            break
          }
          case 'redact':
            page.drawRectangle({ x: annot.x * scale, y: ph - annot.y * scale - (annot.height || 30) * scale, width: (annot.width || 100) * scale, height: (annot.height || 30) * scale, color: rgb(0, 0, 0) })
            break
          case 'whiteout':
            page.drawRectangle({ x: annot.x * scale, y: ph - annot.y * scale - (annot.height || 30) * scale, width: (annot.width || 100) * scale, height: (annot.height || 30) * scale, color: rgb(1, 1, 1) })
            break
          case 'signature':
            if (annot.signatureData) {
              try {
                const sigBytes = Uint8Array.from(atob(annot.signatureData.split(',')[1] || ''), c => c.charCodeAt(0))
                const sigImage = await pdfDoc.embedPng(sigBytes)
                const sigDims = sigImage.scale(1)
                const sw = (annot.width || 150) * scale
                const sh = sw * (sigDims.height / sigDims.width)
                page.drawImage(sigImage, { x: annot.x * scale, y: ph - annot.y * scale - sh, width: sw, height: sh })
              } catch { /* skip bad signature images */ }
            }
            break
          case 'image':
            if (annot.imageData) {
              try {
                const imgBytes = Uint8Array.from(atob(annot.imageData.split(',')[1] || ''), c => c.charCodeAt(0))
                const img = await pdfDoc.embedPng(imgBytes)
                const imgDims = img.scale(1)
                const iw = (annot.width || 200) * scale
                const ih = iw * (imgDims.height / imgDims.width)
                page.drawImage(img, { x: annot.x * scale, y: ph - annot.y * scale - ih, width: iw, height: ih })
              } catch { /* skip */ }
            }
            break
          case 'watermark':
            if (annot.watermarkText) {
              const wmFont = helveticaFont
              const wmSize = (annot.watermarkFontSize || 40) * scale
              page.drawText(annot.watermarkText, {
                x: (annot.x + (annot.width || 400) / 2) * scale,
                y: (annot.y + (annot.height || 300) / 2) * scale,
                size: wmSize, font: wmFont, color: rgb(r, g, b),
                opacity: annot.watermarkOpacity || 0.15,
                rotate: degrees(annot.watermarkAngle || -45),
              })
            }
            break
        }
      }

      const pdfBytes = await pdfDoc.save()
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.download = `${currentDocument?.fileName || 'document'}-annotated.pdf`
      link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href)
      showStatus('PDF exported successfully')
    } catch (err) { console.error('Failed to export PDF:', err); showStatus('Export failed') }
    finally { setIsExporting(false) }
  }

  // Server-side watermark
  const handleApplyWatermark = async () => {
    if (!currentDocument?.fileData) return
    setProcessing('watermark')
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/watermark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, text: wmText, opacity: wmOpacity, angle: wmAngle }),
      })
      const { data } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = 'watermarked.pdf'; a.click()
      showStatus('Watermark applied')
    } catch { showStatus('Watermark failed') }
    finally { setProcessing('') }
  }

  // Server-side page numbers
  const handleAddPageNumbers = async () => {
    if (!currentDocument?.fileData) return
    setProcessing('pagenumbers')
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/page-numbers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, position: pnPos, format: pnFmt }),
      })
      const { data } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = 'numbered.pdf'; a.click()
      showStatus('Page numbers added')
    } catch { showStatus('Page numbers failed') }
    finally { setProcessing('') }
  }

  // Server-side crop
  const handleApplyCrop = async () => {
    if (!currentDocument?.fileData || !cropBox) return
    setProcessing('crop')
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/crop', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, cropBox, pageNumber: currentPage }),
      })
      const { data } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = 'cropped.pdf'; a.click()
      setCropping(false); setCropBox(null)
      showStatus('Page cropped')
    } catch { showStatus('Crop failed') }
    finally { setProcessing('') }
  }

  const handlePrint = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const mergeCanvas = document.createElement('canvas')
    mergeCanvas.width = canvas.width; mergeCanvas.height = canvas.height
    const ctx = mergeCanvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, mergeCanvas.width, mergeCanvas.height)
    ctx.drawImage(canvas, 0, 0)
    if (overlayCanvasRef.current) ctx.drawImage(overlayCanvasRef.current, 0, 0)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>Print</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5}img{max-width:100%;height:auto;box-shadow:0 2px 8px rgba(0,0,0,0.1)}</style></head><body><img src="${mergeCanvas.toDataURL()}" onload="window.print();window.close()"/></body></html>`)
      win.document.close()
    }
  }

  const handleFitToWidth = () => {
    const container = containerRef.current; if (!container || !pdfDocRef.current) return
    pdfDocRef.current.getPage(currentPage).then(page => {
      const vp = page.getViewport({ scale: 1 })
      setZoom((container.clientWidth - 48) / vp.width / 1.5)
    })
  }

  const handleConvert = async (format: string) => {
    if (!currentDocument?.fileData) return
    setIsExporting(true)
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/convert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, format }),
      })
      const result = await res.json()
      if (format === 'txt') {
        const blob = new Blob([result.text], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${currentDocument?.fileName || 'document'}.txt`; a.click()
        URL.revokeObjectURL(url)
      } else if (format === 'html') {
        const blob = new Blob([result.html], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${currentDocument?.fileName || 'document'}.html`; a.click()
        URL.revokeObjectURL(url)
      } else { showStatus(`Use browser print to save as ${format.toUpperCase()}`) }
      showStatus(`Converted to ${format.toUpperCase()}`)
    } catch { showStatus('Conversion failed') }
    finally { setIsExporting(false) }
  }

  const handleConvertToJpg = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const mergeCanvas = document.createElement('canvas')
    mergeCanvas.width = canvas.width; mergeCanvas.height = canvas.height
    const ctx = mergeCanvas.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, mergeCanvas.width, mergeCanvas.height)
    ctx.drawImage(canvas, 0, 0)
    if (overlayCanvasRef.current) ctx.drawImage(overlayCanvasRef.current, 0, 0)
    const dataUrl = mergeCanvas.toDataURL('image/jpeg', 0.92)
    const a = document.createElement('a'); a.href = dataUrl; a.download = `${currentDocument?.fileName?.replace('.pdf','') || 'page'}-page${currentPage}.jpg`; a.click()
    showStatus('Exported as JPG')
  }

  const handleCompress = async () => {
    if (!currentDocument?.fileData) return
    setProcessing('compress')
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/compress', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, quality: 'medium' }),
      })
      const { data, originalSize, compressedSize, reduction } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = `${currentDocument?.fileName?.replace('.pdf','')}-compressed.pdf`; a.click()
      showStatus(`Compressed: ${reduction}% smaller`)
    } catch { showStatus('Compression failed') }
    finally { setProcessing('') }
  }

  const handleProtect = async () => {
    if (!currentDocument?.fileData) return
    const password = window.prompt('Enter password to protect the PDF:')
    if (!password) return
    setProcessing('protect')
    try {
      const base64 = currentDocument.fileData.split(',')[1] || currentDocument.fileData
      const res = await fetch('/api/pdf/protect', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, password, permissions: ['all'] }),
      })
      const { data } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = `${currentDocument?.fileName?.replace('.pdf','')}-protected.pdf`; a.click()
      showStatus('PDF protected')
    } catch { showStatus('Protection failed') }
    finally { setProcessing('') }
  }

  // Real redaction — sends the document + redaction rectangles (as fractions of
  // page size) to pdf-svc, which removes the underlying content via PyMuPDF.
  const handleApplyRedaction = async () => {
    const redactAnnots = annotations.filter(a => a.type === 'redact')
    if (redactAnnots.length === 0) { showStatus('Draw redaction boxes with the Redact tool first'); return }
    if (!pdfBytesRef.current || !pdfDocRef.current) { showStatus('PDF not ready'); return }
    setProcessing('redact')
    try {
      // Normalize each box to fractions of its page's point size (top-left origin).
      const pageNums = [...new Set(redactAnnots.map(a => a.pageNumber))]
      const sizeByPage = new Map<number, { w: number; h: number }>()
      for (const p of pageNums) {
        const page = await pdfDocRef.current.getPage(p)
        const vp = page.getViewport({ scale: 1 })
        sizeByPage.set(p, { w: vp.width, h: vp.height })
      }
      const redactions = pageNums.map(p => {
        const { w, h } = sizeByPage.get(p)!
        const rects = redactAnnots.filter(a => a.pageNumber === p).map(a => ({
          x0: a.x / w, y0: a.y / h,
          x1: (a.x + (a.width || 0)) / w, y1: (a.y + (a.height || 0)) / h,
        }))
        return { page: p, rects }
      })

      const form = new FormData()
      form.append('file', new Blob([pdfBytesRef.current as any], { type: 'application/pdf' }), 'input.pdf')
      form.append('redactions', JSON.stringify(redactions))

      const res = await fetch('/api/pdf/redact', { method: 'POST', body: form })
      if (!res.ok) {
        let msg = 'Redaction failed'
        try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* binary/none */ }
        showStatus(msg); return
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDocument?.fileName?.replace(/\.pdf$/i, '') || 'document'}-redacted.pdf`
      a.click(); URL.revokeObjectURL(url)

      // Reload the sanitized PDF into the editor and drop the applied boxes.
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.onerror = reject
        fr.readAsDataURL(blob)
      })
      redactAnnots.forEach(an => removeAnnotation(an.id))
      if (currentDocument?.id) updateDocument(currentDocument.id, { fileData: dataUrl })
      showStatus('Redaction applied — content permanently removed')
    } catch (err) {
      console.error('Redaction failed:', err)
      showStatus('Redaction failed')
    } finally { setProcessing('') }
  }

  // OCR — make a scanned PDF searchable (pdf-svc → OCRmyPDF → Tesseract).
  const handleOcr = async () => {
    if (!pdfBytesRef.current) { showStatus('PDF not ready'); return }
    setProcessing('ocr')
    showStatus('Running OCR — this can take a moment…')
    try {
      const form = new FormData()
      form.append('file', new Blob([pdfBytesRef.current as any], { type: 'application/pdf' }), 'input.pdf')
      form.append('language', 'eng')
      const res = await fetch('/api/pdf/ocr', { method: 'POST', body: form })
      if (!res.ok) {
        let msg = 'OCR failed'
        try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* binary/none */ }
        showStatus(msg); return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentDocument?.fileName?.replace(/\.pdf$/i, '') || 'document'}-ocr.pdf`
      a.click(); URL.revokeObjectURL(url)

      // Reload the searchable PDF into the editor so text is now selectable.
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result as string)
        fr.onerror = reject
        fr.readAsDataURL(blob)
      })
      if (currentDocument?.id) updateDocument(currentDocument.id, { fileData: dataUrl })
      showStatus('OCR complete — text is now searchable')
    } catch (err) {
      console.error('OCR failed:', err)
      showStatus('OCR failed')
    } finally { setProcessing('') }
  }
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).contentEditable === 'true') return
      const keyMap: Record<string, EditorTool> = {
        v: 'select', h: 'pan', e: 'editText', s: 'signature', i: 'image',
        a: 'highlight', d: 'draw', t: 'text', r: 'rectangle', o: 'ellipse',
        l: 'line', x: 'redact', w: 'whiteout', z: 'eraser',
      }
      const k = e.key.toLowerCase()
      if (keyMap[k]) { setCurrentTool(keyMap[k]); return }
      if (e.key === 'Escape') {
        if (textInput.visible) { setTextInput({ x: 0, y: 0, visible: false }); setTextInputValue('') }
        else if (editingTextItem) setEditingTextItem(null)
        else if (isCropping) { setCropping(false); setCropBox(null) }
        else goBack()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
      if (e.key === '+' || e.key === '=') setZoom(zoom + 0.1)
      if (e.key === '-') setZoom(zoom - 0.1)
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoom(1) }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setShowSearch((prev) => !prev)
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && selectedAnnotId) {
        e.preventDefault()
        const annot = annotations.find(a => a.id === selectedAnnotId)
        if (annot) handleDuplicateAnnot(annot)
      }
      if (e.key === 'PageDown' || ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && (e.altKey || currentTool === 'select' || currentTool === 'pan'))) {
        if (currentPage < totalPages) {
          e.preventDefault()
          handlePageSelect(currentPage + 1)
        }
      }
      if (e.key === 'PageUp' || ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && (e.altKey || currentTool === 'select' || currentTool === 'pan'))) {
        if (currentPage > 1) {
          e.preventDefault()
          handlePageSelect(currentPage - 1)
        }
      }
      if (e.key === '?') setShowShortcuts(true)
      if (e.key === 'Delete' && selectedAnnotId) {
        saveToUndoStack()
        removeAnnotation(selectedAnnotId)
        setSelectedAnnotId(null)
        showStatus('Annotation deleted')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentTool, goBack, setZoom, zoom, undo, redo, textInput.visible, editingTextItem, setEditingTextItem, isCropping, setCropping, currentTool, currentPage, totalPages, setCurrentPage, selectedAnnotId, annotations, removeAnnotation])

  const handleContextMenu = (e: React.MouseEvent, pageNum: number) => {
    e.preventDefault()
    e.stopPropagation()
    const coords = getCanvasCoords(e, pageNum)
    const pageAnnots = annotations.filter((a) => a.pageNumber === pageNum)
    let clickedAnnot: PDFAnnotation | null = null

    for (let i = pageAnnots.length - 1; i >= 0; i--) {
      const annot = pageAnnots[i]
      let hit = false
      let x = annot.x, y = annot.y, w = annot.width || 100, h = annot.height || 50
      if (annot.type === 'draw' && annot.points && annot.points.length > 0) {
        const xs = annot.points.map(p => p.x)
        const ys = annot.points.map(p => p.y)
        const minX = Math.min(...xs), maxX = Math.max(...xs)
        const minY = Math.min(...ys), maxY = Math.max(...ys)
        x = minX; y = minY; w = maxX - minX; h = maxY - minY
      }
      if (coords.x >= x && coords.x <= x + w && coords.y >= y && coords.y <= y + h) {
        hit = true
        clickedAnnot = annot
        setSelectedAnnotId(annot.id)
        break
      }
    }

    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      annot: clickedAnnot,
      pageNumber: pageNum,
      canvasCoords: coords,
    })
  }

  const handleDuplicateAnnot = (annot: PDFAnnotation) => {
    const newId = crypto.randomUUID()
    addAnnotation({
      ...annot,
      id: newId,
      x: annot.x + 15,
      y: annot.y + 15,
    })
    setSelectedAnnotId(newId)
    showStatus('Annotation duplicated')
  }

  const handleAddTextAt = (coords: { x: number; y: number }, pageNumber: number) => {
    const newId = crypto.randomUUID()
    addAnnotation({
      id: newId,
      type: 'text',
      pageNumber,
      x: coords.x,
      y: coords.y,
      content: 'Type text...',
      fontSize,
      fontFamily,
      color: drawColor,
    })
    setSelectedAnnotId(newId)
    setEditingAnnotId(newId)
    setCurrentTool('select')
  }

  const handleAddDateAt = (coords: { x: number; y: number }, pageNumber: number) => {
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const newId = crypto.randomUUID()
    addAnnotation({
      id: newId,
      type: 'text',
      pageNumber,
      x: coords.x,
      y: coords.y,
      content: today,
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
    })
    setSelectedAnnotId(newId)
    showStatus('Date stamp added')
  }

  const handleJumpToMatch = (match: SearchMatch) => {
    handlePageSelect(match.pageNumber)
  }

  const selectedAnnot = selectedAnnotId ? annotations.find(a => a.id === selectedAnnotId) : null
  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage)
  const totalAnnotations = annotations.length
  const pagesToRender = scrollMode === 'continuous'
    ? (pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1))
    : [currentPage]
  const isEditTextMode = currentTool === 'editText'
  const isSignatureMode = currentTool === 'signature'
  const isRedactMode = currentTool === 'redact'
  const isWhiteoutMode = currentTool === 'whiteout'
  const isPanMode = currentTool === 'pan'
  const isImageMode = currentTool === 'image'

  return (
    <div className="h-screen flex flex-col bg-muted/30 relative">
      {/* Hidden file input for image uploads (accessible by all layout modes) */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* ===== MINIMAL TOP BAR (Desktop) ===== */}
      <div className="hidden md:flex items-center justify-between px-3.5 py-2 border-b border-border/60 bg-background/95 backdrop-blur-md shrink-0 select-none z-20">
        {/* Left: Back + Doc Title + Status */}
        <div className="flex items-center gap-2.5 min-w-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full" onClick={() => setView('dashboard')}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Back to Dashboard</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-5" />

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-[10px] shrink-0 border border-rose-500/20">
              PDF
            </div>
            <span className="text-xs font-semibold truncate max-w-[180px]" title={currentDocument?.fileName}>
              {currentDocument?.fileName || 'Document.pdf'}
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-1.5 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Saved
            </span>
          </div>
        </div>

        {/* Center: Segmented Mode Selector */}
        <div className="flex items-center bg-muted/80 dark:bg-slate-900 border border-border/60 p-0.5 rounded-full shadow-inner shrink-0">
          {(
            [
              { id: 'view', label: 'View', icon: Eye, color: 'text-emerald-500', activeCls: 'bg-emerald-600 text-white shadow-sm font-semibold' },
              { id: 'annotate', label: 'Annotate', icon: Highlighter, color: 'text-amber-500', activeCls: 'bg-amber-500 text-white shadow-sm font-semibold' },
              { id: 'edit', label: 'Edit PDF', icon: Pencil, color: 'text-blue-500', activeCls: 'bg-blue-600 text-white shadow-sm font-semibold' },
              { id: 'sign', label: 'Fill & Sign', icon: Stamp, color: 'text-purple-500', activeCls: 'bg-purple-600 text-white shadow-sm font-semibold' },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon
            const isActive = editorMode === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleModeChange(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1 text-xs rounded-full transition-all duration-200 ${
                  isActive
                    ? `${tab.activeCls} scale-100`
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50 font-medium'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : tab.color}`} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Right: Actions, AI Copilot, Export */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo / Redo */}
          <TooltipProvider delayDuration={300}>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full" disabled={!canUndo} onClick={undo}><Undo2 className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Undo (Ctrl+Z)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full" disabled={!canRedo} onClick={redo}><Redo2 className="w-3.5 h-3.5" /></Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Redo (Ctrl+Shift+Z)</TooltipContent></Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-5" />

          {/* Document Search Button */}
          <TooltipProvider delayDuration={300}>
            <Tooltip><TooltipTrigger asChild>
              <Button
                variant={showSearch ? 'secondary' : 'ghost'}
                size="icon"
                className={`shrink-0 h-8 w-8 rounded-full ${showSearch ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' : ''}`}
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Find in Document (Ctrl+F)</TooltipContent></Tooltip>
          </TooltipProvider>

          {/* Sidebar drawer toggle */}
          <TooltipProvider delayDuration={300}>
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showSidebar ? 'secondary' : 'ghost'} size="icon" className="shrink-0 h-8 w-8 rounded-full" onClick={toggleSidebar}>
                {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
              </Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Thumbnails (Ctrl+\)</TooltipContent></Tooltip>
          </TooltipProvider>

          {/* Annotations list */}
          <TooltipProvider delayDuration={300}>
            <Tooltip><TooltipTrigger asChild>
              <Button variant={showAnnotationPanel ? 'secondary' : 'ghost'} size="icon" className="shrink-0 h-8 w-8 rounded-full relative" onClick={toggleAnnotationPanel}>
                <FileText className="w-4 h-4" />
                {totalAnnotations > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 bg-emerald-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">{totalAnnotations}</span>}
              </Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Annotations List</TooltipContent></Tooltip>
          </TooltipProvider>

          {/* Quick Tools menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 rounded-full" title="Tools">
                <Settings2 className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setShowWatermarkDialog(true)} className="gap-2 cursor-pointer text-xs">
                <Droplets className="w-4 h-4 text-cyan-500" /><span>Add Watermark</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowPageNumDialog(true)} className="gap-2 cursor-pointer text-xs">
                <Hash className="w-4 h-4 text-indigo-500" /><span>Add Page Numbers</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleOcr} disabled={processing === 'ocr'} className="gap-2 cursor-pointer text-xs">
                {processing === 'ocr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4 text-emerald-500" />}
                <span>{processing === 'ocr' ? 'Running OCR…' : 'OCR — Make Searchable'}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { insertBlankPage(currentPage); showStatus('Blank page inserted') }} className="gap-2 cursor-pointer text-xs">
                <FileText className="w-4 h-4" /><span>Insert Blank Page</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { duplicatePage(currentPage); showStatus('Page duplicated') }} className="gap-2 cursor-pointer text-xs">
                <Copy className="w-4 h-4" /><span>Duplicate This Page</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowShortcuts(true)} className="gap-2 cursor-pointer text-xs">
                <Keyboard className="w-4 h-4" /><span>Keyboard Shortcuts (?)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* AI Assistant Button */}
          <Button
            variant="outline"
            size="sm"
            className={`shrink-0 h-8 rounded-full px-3 text-xs gap-1.5 font-semibold transition-all ${
              showAiPanel
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-xs'
            }`}
            onClick={toggleAiPanel}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Copilot</span>
          </Button>

          {/* Export Primary Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="shrink-0 h-8 rounded-full px-3.5 text-xs font-semibold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span>Export</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
                <FileDown className="w-4 h-4 text-emerald-600" /><div><div className="text-xs font-semibold">Export as PDF</div><div className="text-[10px] text-muted-foreground">With vector edits & annotations</div></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPng} className="gap-2 cursor-pointer">
                <ImageIcon className="w-4 h-4 text-blue-600" /><div><div className="text-xs font-semibold">Export Page as PNG</div><div className="text-[10px] text-muted-foreground">High-res raster snapshot</div></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertToJpg} className="gap-2 cursor-pointer">
                <ImageIcon className="w-4 h-4 text-amber-600" /><div><div className="text-xs font-semibold">Export Page as JPG</div><div className="text-[10px] text-muted-foreground">Compressed JPEG format</div></div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleConvert('txt')} className="gap-2 cursor-pointer">
                <FileText className="w-4 h-4" /><div><div className="text-xs font-semibold">Convert to TXT</div><div className="text-[10px] text-muted-foreground">Plain text document</div></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleConvert('html')} className="gap-2 cursor-pointer">
                <FileOutput className="w-4 h-4" /><div><div className="text-xs font-semibold">Convert to HTML</div><div className="text-[10px] text-muted-foreground">Formatted web page</div></div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCompress} disabled={!!processing} className="gap-2 cursor-pointer">
                <Minus className="w-4 h-4 text-purple-600" /><div><div className="text-xs font-semibold">Compress PDF</div><div className="text-[10px] text-muted-foreground">Reduce file size</div></div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleProtect} disabled={!!processing} className="gap-2 cursor-pointer">
                <Shield className="w-4 h-4 text-rose-600" /><div><div className="text-xs font-semibold">Password Protect</div><div className="text-[10px] text-muted-foreground">Encrypt with password</div></div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
                <Printer className="w-4 h-4" /><div className="text-xs font-semibold">Print Page</div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ===== TOP TOOLBAR (Mobile) ===== */}
      <div className="flex md:hidden items-center justify-between px-3 py-2 border-b border-border/60 bg-background shrink-0 select-none">
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setView('dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={toggleSidebar}>
            {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </Button>
        </div>

        {/* Mobile Mode Switcher */}
        <div className="flex items-center bg-muted/80 p-0.5 rounded-full text-[10px] gap-0.5">
          {(
            [
              { id: 'view', label: 'View', activeCls: 'bg-emerald-600 text-white font-bold shadow-xs' },
              { id: 'annotate', label: 'Annotate', activeCls: 'bg-amber-500 text-white font-bold shadow-xs' },
              { id: 'edit', label: 'Edit', activeCls: 'bg-blue-600 text-white font-bold shadow-xs' },
              { id: 'sign', label: 'Sign', activeCls: 'bg-purple-600 text-white font-bold shadow-xs' },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              onClick={() => handleModeChange(m.id)}
              className={`px-2 py-0.5 rounded-full capitalize font-medium transition-all ${
                editorMode === m.id
                  ? m.activeCls
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${showSearch ? 'bg-muted' : ''}`} onClick={() => setShowSearch(!showSearch)}>
            <Search className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className={`h-8 w-8 rounded-full ${showAiPanel ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600' : ''}`} onClick={toggleAiPanel}>
            <Sparkles className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={!canUndo} onClick={undo}>
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={!canRedo} onClick={redo}>
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {showSidebar && (
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden transition-opacity"
            onClick={toggleSidebar}
          />
        )}

        {/* Left Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? 240 : 200, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-r border-border/60 bg-background shrink-0 overflow-hidden flex flex-col md:relative fixed inset-y-0 left-0 z-50 md:z-0 shadow-2xl md:shadow-none h-full min-h-0"
            >
              <div className="flex border-b border-border/40 shrink-0">
                <button className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarMode === 'thumbnails' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setSidebarMode('thumbnails')}>Thumbnails</button>
                <button className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarMode === 'pages' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setSidebarMode('pages')}>Pages</button>
              </div>
              {sidebarMode === 'thumbnails' ? (
                <div className="flex-1 min-h-0 overflow-y-auto py-2 px-2 space-y-2">
                  {pageThumbnails.map((thumb) => {
                    const thumbAnnotCount = annotations.filter(a => a.pageNumber === thumb.page).length
                    const rotation = pageRotations.get(thumb.page) || 0
                    return (
                      <button key={thumb.page} className={`w-full rounded-lg border-2 transition-all p-1 relative ${currentPage === thumb.page ? 'border-emerald-500 shadow-sm' : 'border-transparent hover:border-border'}`} onClick={() => handlePageSelect(thumb.page)}>
                        <div className="relative w-full">
                          <img src={thumb.dataUrl} alt={`Page ${thumb.page}`} className="w-full rounded" style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined} />
                          <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{thumb.page}</div>
                          {thumbAnnotCount > 0 && <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{thumbAnnotCount}</div>}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <PageManager pdfDoc={pdfDocRef.current} pdfBytesRef={pdfBytesRef} fileData={currentDocument?.fileData || null} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area */}
        <div
          ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-2 sm:p-6 sm:pt-14 relative bg-slate-100/70 dark:bg-slate-950"
          onWheel={handleWheel}
          onScroll={handleScroll}
          style={{ cursor: isPanMode ? 'grab' : isCropping ? 'crosshair' : undefined }}
        >
          {/* ===== FLOATING CAPSULE TOOLBAR (Figma / Apple Style) ===== */}
          <div className="fixed md:absolute top-14 md:top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1 bg-background/90 dark:bg-slate-900/90 backdrop-blur-xl border border-border/70 shadow-2xl rounded-full text-xs select-none max-w-[95vw] overflow-x-auto">
            {/* Left: Select & Pan */}
            <div className="flex items-center gap-0.5 bg-muted/60 p-0.5 rounded-full shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-full transition-all ${
                  currentTool === 'select'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md font-bold scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
                onClick={() => setCurrentTool('select')}
                title="Select / Move (V)"
              >
                <MousePointer2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`h-7 w-7 rounded-full transition-all ${
                  currentTool === 'pan'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 shadow-md font-bold scale-105'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/60'
                }`}
                onClick={() => setCurrentTool('pan')}
                title="Pan Canvas (H)"
              >
                <Hand className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-5 shrink-0" />

            {/* Mode-Specific Tool Buttons */}
            {editorMode === 'view' && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 px-2.5 rounded-full text-xs gap-1.5 font-medium hover:bg-muted" onClick={handleFitToWidth}>
                  <Maximize2 className="w-3.5 h-3.5" /> <span>Fit Width</span>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}>
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[11px] font-mono text-muted-foreground w-9 text-center">{Math.round(zoom * 100)}%</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setZoom(1)} title="Reset zoom (100%)">
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            {editorMode === 'annotate' && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'highlight'
                      ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-md scale-105 ring-2 ring-amber-500/40'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 font-medium'
                  }`}
                  onClick={() => setCurrentTool('highlight')}
                >
                  <Highlighter className="w-3.5 h-3.5" /> <span>Highlight</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'text'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md scale-105 ring-2 ring-emerald-500/40'
                      : 'text-foreground hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium'
                  }`}
                  onClick={() => setCurrentTool('text')}
                >
                  <Type className="w-3.5 h-3.5" /> <span>Text</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'draw'
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md scale-105 ring-2 ring-indigo-500/40'
                      : 'text-foreground hover:bg-indigo-50 dark:hover:bg-indigo-950/30 font-medium'
                  }`}
                  onClick={() => setCurrentTool('draw')}
                >
                  <PenTool className="w-3.5 h-3.5" /> <span>Draw</span>
                </Button>

                {/* Shapes dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 px-2.5 rounded-full text-xs gap-1 font-semibold transition-all ${
                        ['rectangle', 'ellipse', 'line'].includes(currentTool)
                          ? 'bg-violet-600 hover:bg-violet-700 text-white shadow-md scale-105 ring-2 ring-violet-500/40'
                          : 'text-foreground hover:bg-violet-50 dark:hover:bg-violet-950/30 font-medium'
                      }`}
                    >
                      {currentTool === 'ellipse' ? <Circle className="w-3.5 h-3.5" /> : currentTool === 'line' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      <span>Shapes</span>
                      <ChevronDown className="w-3 h-3 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-44">
                    <DropdownMenuItem
                      onClick={() => setCurrentTool('rectangle')}
                      className={`gap-2 cursor-pointer text-xs ${currentTool === 'rectangle' ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-semibold' : ''}`}
                    >
                      <Square className="w-4 h-4 text-violet-500" /><span>Rectangle</span><kbd className="ml-auto text-[10px] text-muted-foreground font-mono">R</kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCurrentTool('ellipse')}
                      className={`gap-2 cursor-pointer text-xs ${currentTool === 'ellipse' ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-semibold' : ''}`}
                    >
                      <Circle className="w-4 h-4 text-violet-500" /><span>Circle / Oval</span><kbd className="ml-auto text-[10px] text-muted-foreground font-mono">O</kbd>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setCurrentTool('line')}
                      className={`gap-2 cursor-pointer text-xs ${currentTool === 'line' ? 'bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 font-semibold' : ''}`}
                    >
                      <ArrowUpRight className="w-4 h-4 text-violet-500" /><span>Arrow / Line</span><kbd className="ml-auto text-[10px] text-muted-foreground font-mono">L</kbd>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'eraser'
                      ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md scale-105 ring-2 ring-rose-500/40'
                      : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-medium'
                  }`}
                  onClick={() => setCurrentTool('eraser')}
                >
                  <Eraser className="w-3.5 h-3.5" /> <span>Eraser</span>
                </Button>

                {/* Quick Color Swatches */}
                <Separator orientation="vertical" className="h-5 shrink-0" />
                <div className="flex items-center gap-1.5 px-1">
                  {COLORS.slice(0, 5).map((c) => (
                    <button
                      key={c}
                      className={`w-4 h-4 rounded-full transition-all ${
                        drawColor === c
                          ? 'scale-125 ring-2 ring-offset-2 ring-emerald-500 dark:ring-offset-slate-900 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-110 border border-border/40'
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setDrawColor(c)}
                      title={`Color: ${c}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {editorMode === 'edit' && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'editText'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md scale-105 ring-2 ring-blue-500/40'
                      : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium'
                  }`}
                  onClick={() => setCurrentTool('editText')}
                >
                  <Pencil className="w-3.5 h-3.5" /> <span>Edit Text</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'whiteout'
                      ? 'bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-md scale-105 ring-2 ring-zinc-500/40'
                      : 'text-foreground hover:bg-muted font-medium'
                  }`}
                  onClick={() => setCurrentTool('whiteout')}
                >
                  <PenLine className="w-3.5 h-3.5" /> <span>Whiteout</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'redact'
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-md scale-105 ring-2 ring-red-500/40'
                      : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium'
                  }`}
                  onClick={() => setCurrentTool('redact')}
                >
                  <EyeOff className="w-3.5 h-3.5" /> <span>Redact</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    isCropping
                      ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-md scale-105 ring-2 ring-teal-500/40'
                      : 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/30 font-medium'
                  }`}
                  onClick={() => { setCropping(!isCropping); if (isCropping) setCropBox(null) }}
                >
                  <Crop className="w-3.5 h-3.5" /> <span>{isCropping ? 'Cancel Crop' : 'Crop'}</span>
                </Button>
              </div>
            )}

            {editorMode === 'sign' && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-3 rounded-full text-xs gap-1.5 font-semibold transition-all ${
                    currentTool === 'signature'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md scale-105 ring-2 ring-purple-500/40'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 font-medium'
                  }`}
                  onClick={() => {
                    if (!signatureData) { setShowSignaturePad(true); return }
                    setCurrentTool('signature')
                  }}
                >
                  <Stamp className="w-3.5 h-3.5" /> <span>Signature</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 px-2.5 rounded-full text-xs gap-1.5 font-medium transition-all ${
                    currentTool === 'image'
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white shadow-md scale-105 ring-2 ring-cyan-500/40'
                      : 'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-950/30'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-3.5 h-3.5" /> <span>Image / Stamp</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 rounded-full text-xs gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all hover:scale-105"
                  onClick={handleInsertDateStamp}
                >
                  <Calendar className="w-3.5 h-3.5" /> <span>Date Stamp</span>
                </Button>
              </div>
            )}
          </div>

          <div className={`flex flex-col items-center w-full ${scrollMode === 'continuous' ? 'gap-8 my-6 pb-24' : 'my-4 pb-20'}`}>
            {pagesToRender.map((pageNum) => {
              const isCurrent = currentPage === pageNum
              const pageAnnots = annotations.filter(a => a.pageNumber === pageNum)

              return (
                <div
                  id={`pdf-page-${pageNum}`}
                  key={pageNum}
                  className="pdf-page-wrapper flex flex-col items-center relative transition-all"
                  onClick={() => {
                    if (currentPage !== pageNum) {
                      setCurrentPage(pageNum)
                    }
                  }}
                >
                  {/* Subtle Page Separator / Number Badge in Continuous Mode */}
                  {scrollMode === 'continuous' && (
                    <div className="mb-2 flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-background/80 dark:bg-slate-900/80 backdrop-blur-md border border-border/50 text-[11px] font-medium text-muted-foreground shadow-xs select-none">
                      <span>Page {pageNum}</span>
                      {isCurrent && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                    </div>
                  )}

                  <div className="pdf-canvas-container shadow-2xl rounded-lg overflow-hidden relative border border-border/30 bg-white">
                    {/* Text input overlay for add-text tool */}
                    {textInput.visible && isCurrent && (
                      <div className="absolute z-20" style={{
                        left: textInput.x * zoom * 1.5,
                        top: textInput.y * zoom * 1.5 - (selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize) * zoom * 1.5
                      }}>
                        <input type="text" autoFocus value={textInputValue} onChange={(e) => setTextInputValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') textSubmitRef.current(); if (e.key === 'Escape') setTextInput({ x: 0, y: 0, visible: false }) }}
                          onBlur={() => textSubmitRef.current()}
                          className="border-2 border-emerald-500 rounded px-2 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm outline-none shadow-lg text-foreground"
                          style={{
                            fontSize: (selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize) * zoom * 1.5,
                            color: selectedAnnot ? selectedAnnot.color : drawColor,
                            fontFamily: (selectedAnnot?.type === 'text' ? (selectedAnnot.fontFamily || 'Helvetica') : fontFamily) === 'Courier' ? 'Courier New, monospace' : (selectedAnnot?.type === 'text' ? (selectedAnnot.fontFamily || 'Helvetica') : fontFamily) === 'TimesRoman' ? 'Times New Roman, serif' : 'Helvetica Neue, sans-serif',
                            fontWeight: (selectedAnnot?.type === 'text' ? !!selectedAnnot.bold : textBold) ? 'bold' : 'normal',
                            fontStyle: (selectedAnnot?.type === 'text' ? !!selectedAnnot.italic : textItalic) ? 'italic' : 'normal'
                          }}
                          placeholder="Type annotation..." />
                      </div>
                    )}
                    {isRendering && (!canvasRefs.current[pageNum] || !canvasRefs.current[pageNum]?.width) && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg min-h-[300px]">
                        <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                      </div>
                    )}
                    <canvas ref={(el) => { canvasRefs.current[pageNum] = el }} />
                    <canvas
                      ref={(el) => { overlayCanvasRefs.current[pageNum] = el }}
                      className="absolute top-0 left-0"
                      style={{
                        pointerEvents: currentTool === 'editText' ? 'none' : 'auto',
                        cursor: isPanMode
                          ? (isPanning ? 'grabbing' : 'grab')
                          : isCropping
                          ? 'crosshair'
                          : currentTool === 'text'
                          ? 'text'
                          : ['draw', 'rectangle', 'ellipse', 'line', 'whiteout', 'redact', 'highlight'].includes(currentTool)
                          ? 'crosshair'
                          : currentTool === 'eraser'
                          ? 'cell'
                          : currentTool === 'signature' || currentTool === 'image'
                          ? 'copy'
                          : 'default',
                      }}
                      onMouseDown={(e) => { if (isPanMode) handlePanStart(e); else handlePointerDown(e, pageNum) }}
                      onMouseMove={(e) => { if (isPanning) handlePanMove(e); else handlePointerMove(e, pageNum) }}
                      onMouseUp={(e) => { if (isPanning) handlePanEnd(); else handlePointerUp(e, pageNum) }}
                      onMouseLeave={() => { if (isPanning) handlePanEnd(); else handlePointerUp({} as any, pageNum) }}
                      onClick={(e) => handleCanvasClick(e, pageNum)}
                      onDoubleClick={handleCanvasDoubleClick}
                      onContextMenu={(e) => handleContextMenu(e, pageNum)}
                      onTouchStart={(e) => handlePointerDown(e, pageNum)}
                      onTouchMove={(e) => handlePointerMove(e, pageNum)}
                      onTouchEnd={(e) => handlePointerUp(e, pageNum)}
                    />
                    {/* Search match highlights for this page */}
                    {searchMatches
                      .filter((m) => m.pageNumber === pageNum)
                      .map((match) => {
                        const isActive = searchMatches[activeSearchMatchIndex]?.id === match.id
                        return (
                          <div
                            key={match.id}
                            className={`absolute rounded pointer-events-none transition-all ${
                              isActive
                                ? 'bg-emerald-500/50 border-2 border-emerald-500 shadow-md ring-4 ring-emerald-400/40 z-30 animate-pulse'
                                : 'bg-amber-400/40 border border-amber-500/70 z-20'
                            }`}
                            style={{
                              left: match.x * zoom * 1.5,
                              top: match.y * zoom * 1.5,
                              width: match.width * zoom * 1.5,
                              height: match.height * zoom * 1.5,
                            }}
                          />
                        )
                      })}
                    {/* Native text editing layer */}
                    {isCurrent && (
                      <TextLayer pdfDoc={pdfDocRef.current} canvasEl={canvasRefs.current[pageNum]} containerEl={containerRef.current} />
                    )}
                    {/* Added text annotations HTML overlay */}
                    <div 
                      className="absolute top-0 left-0 w-full h-full pointer-events-none"
                      style={{ zIndex: 6 }}
                    >
                      {pageAnnots
                        .filter((annot) => annot.type === 'text')
                        .map((annot) => {
                          const isEditing = editingAnnotId === annot.id
                          const isSelected = selectedAnnotId === annot.id
                          const isSelectOrTextTool = currentTool === 'select' || currentTool === 'text'
                          
                          // Coordinate scaling
                          const scale = zoom * 1.5
                          
                          // Style mapping
                          const getMetricFontKey = (family?: string) => {
                            if (!family) return 'arimo'
                            const key = family.toLowerCase()
                            if (METRIC_FONTS[key]) return key
                            return matchMetricFont(family)
                          }
                          
                          const fontStyleKey = getMetricFontKey(annot.fontFamily)
                          const cssFontFamily = METRIC_FONTS[fontStyleKey]?.cssName || 'Arimo'
                          
                          const style: React.CSSProperties = {
                            position: 'absolute',
                            left: annot.x * scale,
                            top: annot.y * scale - (annot.fontSize || 16) * scale, // Subtract font size to align with canvas baseline drawing
                            fontSize: (annot.fontSize || 16) * scale,
                            fontFamily: cssFontFamily,
                            fontWeight: annot.bold ? 'bold' : 'normal',
                            fontStyle: annot.italic ? 'italic' : 'normal',
                            color: annot.color,
                            whiteSpace: 'pre',
                            lineHeight: '1.2',
                            minWidth: '30px',
                            minHeight: '20px',
                            pointerEvents: isSelectOrTextTool ? 'auto' : 'none',
                            userSelect: isEditing ? 'text' : 'none',
                          }
                          
                          if (isEditing) {
                            return (
                              <div
                                key={`edit-${annot.id}`}
                                contentEditable
                                suppressContentEditableWarning
                                onBlur={(e) => {
                                  const newText = e.currentTarget.textContent || ''
                                  if (newText.trim() === '' || newText === 'Type text...') {
                                    removeAnnotation(annot.id)
                                    showStatus('Text annotation removed')
                                  } else {
                                    updateAnnotation(annot.id, { content: newText })
                                    showStatus('Text annotation updated')
                                  }
                                  setEditingAnnotId(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    e.currentTarget.blur()
                                  }
                                  if (e.key === 'Escape') {
                                    e.preventDefault()
                                    e.currentTarget.textContent = annot.content || ''
                                    e.currentTarget.blur()
                                  }
                                }}
                                ref={(el) => {
                                  if (el) {
                                    if (document.activeElement !== el) {
                                      el.textContent = annot.content === 'Type text...' ? '' : (annot.content || '')
                                      el.focus()
                                      const range = document.createRange()
                                      range.selectNodeContents(el)
                                      range.collapse(false)
                                      const sel = window.getSelection()
                                      sel?.removeAllRanges()
                                      sel?.addRange(range)
                                    }
                                  }
                                }}
                                style={{
                                  ...style,
                                  background: 'rgba(255,255,255,0.92)',
                                  outline: '2px solid #10b981',
                                  outlineOffset: '1px',
                                  padding: '0 2px',
                                  borderRadius: '2px',
                                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                  zIndex: 10,
                                }}
                              />
                            )
                          }
                          
                          return (
                            <div
                              key={`view-${annot.id}`}
                              style={style}
                              onMouseDown={(e) => handleStartDrag(e, annot)}
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isSelectOrTextTool) {
                                  setSelectedAnnotId(annot.id)
                                }
                              }}
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                if (isSelectOrTextTool) {
                                  setSelectedAnnotId(annot.id)
                                  setEditingAnnotId(annot.id)
                                }
                              }}
                              className="group"
                            >
                              <span
                                style={{
                                  outline: isSelected ? '1.5px dashed #10b981' : 'none',
                                  outlineOffset: '2px',
                                  display: 'inline-block',
                                  padding: '0 2px',
                                  borderRadius: '2px',
                                  cursor: isSelectOrTextTool ? 'move' : 'default',
                                }}
                                className="group-hover:outline group-hover:outline-1 group-hover:outline-emerald-300 group-hover:outline-dashed"
                              >
                                {annot.content || ' '}
                              </span>

                              {/* Floating Sejda-style Inline Toolbar */}
                              {isSelected && (
                                <div
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="absolute flex items-center gap-1.5 p-1 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg z-50 select-none text-foreground font-sans pointer-events-auto"
                                  style={{
                                    left: 0,
                                    top: -46,
                                  }}
                                >
                                  {/* Bold Button */}
                                  <button
                                    onClick={() => updateAnnotation(annot.id, { bold: !annot.bold })}
                                    className={`w-7 h-7 flex items-center justify-center rounded text-sm font-bold border border-transparent transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${annot.bold ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}
                                    title="Bold"
                                  >
                                    B
                                  </button>
                                  
                                  {/* Italic Button */}
                                  <button
                                    onClick={() => updateAnnotation(annot.id, { italic: !annot.italic })}
                                    className={`w-7 h-7 flex items-center justify-center rounded text-sm italic border border-transparent transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${annot.italic ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-600' : 'text-slate-700 dark:text-slate-300'}`}
                                    title="Italic"
                                  >
                                    I
                                  </button>

                                  <span className="w-px h-5 bg-slate-200 dark:bg-slate-800" />

                                  {/* Font Size Selector */}
                                  <div className="relative flex items-center">
                                    <button
                                      onClick={() => {
                                        setAnnotSizeDropdownId(annotSizeDropdownId === annot.id ? null : annot.id)
                                        setAnnotFontDropdownId(null)
                                        setAnnotColorDropdownId(null)
                                      }}
                                      className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                                      title="Font Size"
                                    >
                                      <span>{Math.round(annot.fontSize || 16)}</span>
                                      <span className="text-[10px] text-slate-400">▼</span>
                                    </button>
                                    
                                    {annotSizeDropdownId === annot.id && (
                                      <div className="absolute top-8 left-0 flex flex-col max-h-48 overflow-y-auto bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-md z-50 p-1 min-w-[70px]">
                                        <input
                                          type="number"
                                          value={Math.round(annot.fontSize || 16)}
                                          onChange={(e) => {
                                            const val = parseInt(e.target.value) || 16
                                            updateAnnotation(annot.id, { fontSize: val })
                                          }}
                                          className="w-full text-xs px-1.5 py-1 border border-slate-200 dark:border-slate-800 rounded bg-white dark:bg-gray-900 focus:outline-none focus:border-emerald-500 mb-1"
                                          min="4"
                                          max="120"
                                        />
                                        {[8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72].map((sz) => (
                                          <button
                                            key={sz}
                                            onClick={() => {
                                              updateAnnotation(annot.id, { fontSize: sz })
                                              setAnnotSizeDropdownId(null)
                                            }}
                                            className={`text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${Math.round(annot.fontSize || 16) === sz ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                                          >
                                            {sz}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Font Family Selector */}
                                  <div className="relative">
                                    <button
                                      onClick={() => {
                                        setAnnotFontDropdownId(annotFontDropdownId === annot.id ? null : annot.id)
                                        setAnnotSizeDropdownId(null)
                                        setAnnotColorDropdownId(null)
                                      }}
                                      className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium max-w-[150px] truncate"
                                      title="Font Family"
                                    >
                                      <span>{METRIC_FONTS[fontStyleKey]?.displayName.split(' ')[0] || 'Arial'}</span>
                                      <span className="text-[10px] text-slate-400">▼</span>
                                    </button>
                                    
                                    {annotFontDropdownId === annot.id && (
                                      <div className="absolute top-8 left-0 flex flex-col bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-md z-50 p-1 min-w-[180px]">
                                        {Object.entries(METRIC_FONTS).map(([key, f]) => (
                                          <button
                                            key={key}
                                            onClick={() => {
                                              updateAnnotation(annot.id, { fontFamily: key })
                                              setAnnotFontDropdownId(null)
                                            }}
                                            className={`text-left text-xs px-2.5 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${fontStyleKey === key ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}
                                            style={{ fontFamily: f.cssName }}
                                          >
                                            {f.displayName}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <span className="w-px h-5 bg-slate-200 dark:bg-slate-800" />

                                  {/* Color Picker */}
                                  <div className="relative">
                                    <button
                                      onClick={() => {
                                        setAnnotColorDropdownId(annotColorDropdownId === annot.id ? null : annot.id)
                                        setAnnotFontDropdownId(null)
                                        setAnnotSizeDropdownId(null)
                                      }}
                                      className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                                      title="Text Color"
                                    >
                                      <span
                                        className="w-4 h-4 rounded-full border border-slate-300"
                                        style={{ backgroundColor: annot.color }}
                                      />
                                    </button>
                                    
                                    {annotColorDropdownId === annot.id && (
                                      <div className="absolute top-8 left-0 bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-800 shadow-lg rounded-md z-50 p-2 min-w-[150px] flex flex-col gap-2">
                                        <div className="grid grid-cols-5 gap-1">
                                          {['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#9ca3af', '#ffffff'].map((c) => (
                                            <button
                                              key={c}
                                              onClick={() => {
                                                updateAnnotation(annot.id, { color: c })
                                                setAnnotColorDropdownId(null)
                                              }}
                                              className="w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110"
                                              style={{ backgroundColor: c }}
                                              title={c}
                                            />
                                          ))}
                                        </div>
                                        <div className="flex items-center gap-1 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                                          <span className="text-[10px] text-slate-400 font-bold">#</span>
                                          <input
                                            type="text"
                                            value={(annot.color || '#000000').replace('#', '')}
                                            onChange={(e) => {
                                              const hex = e.target.value.substring(0, 6)
                                              updateAnnotation(annot.id, { color: `#${hex}` })
                                            }}
                                            placeholder="000000"
                                            className="w-18 text-[11px] px-1 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-gray-900 rounded focus:outline-none focus:border-emerald-500 font-mono text-foreground"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <span className="w-px h-5 bg-slate-200 dark:bg-slate-800" />

                                  {/* Drag Indicator Button */}
                                  <button
                                    className="w-7 h-7 flex items-center justify-center rounded text-slate-400 cursor-move"
                                    title="Drag text to move"
                                  >
                                    ✥
                                  </button>

                                  <span className="w-px h-5 bg-slate-200 dark:bg-slate-800" />

                                  {/* Duplicate Button */}
                                  <button
                                    onClick={() => {
                                      const newId = crypto.randomUUID()
                                      addAnnotation({
                                        ...annot,
                                        id: newId,
                                        x: annot.x + 20,
                                        y: annot.y + 20
                                      })
                                      setSelectedAnnotId(newId)
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                    title="Duplicate"
                                  >
                                    📋
                                  </button>

                                  {/* Delete Button */}
                                  <button
                                    onClick={() => {
                                      removeAnnotation(annot.id)
                                      setSelectedAnnotId(null)
                                    }}
                                    className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                                    title="Delete text"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      }
                    </div>

                    {/* Floating Selection Island for Non-Text Annotations */}
                    {selectedAnnot && selectedAnnot.pageNumber === pageNum && selectedAnnot.type !== 'text' && (
                      <div
                        className="absolute z-30 flex items-center gap-1.5 p-1 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl select-none animate-in fade-in zoom-in-95 pointer-events-auto"
                        style={{
                          left: Math.max(10, selectedAnnot.x * zoom * 1.5),
                          top: Math.max(10, selectedAnnot.y * zoom * 1.5 - 46),
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* Color selection for shapes / drawings */}
                        {['draw', 'rectangle', 'ellipse', 'line'].includes(selectedAnnot.type) && (
                          <>
                            <div className="flex items-center gap-1 px-1">
                              {COLORS.slice(0, 5).map((c) => (
                                <button
                                  key={c}
                                  className={`w-4 h-4 rounded-full border transition-all ${selectedAnnot.color === c ? 'scale-125 border-foreground shadow-xs' : 'border-transparent opacity-70 hover:opacity-100 hover:scale-110'}`}
                                  style={{ backgroundColor: c }}
                                  onClick={() => updateAnnotation(selectedAnnot.id, { color: c })}
                                />
                              ))}
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                            {/* Stroke width */}
                            <div className="flex items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md"
                                onClick={() => {
                                  const nextW = Math.max(1, (selectedAnnot.strokeWidth || strokeWidth) - 1)
                                  setStrokeWidth(nextW)
                                  updateAnnotation(selectedAnnot.id, { strokeWidth: nextW })
                                }}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="text-[11px] font-mono w-5 text-center">{selectedAnnot.strokeWidth || strokeWidth}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 rounded-md"
                                onClick={() => {
                                  const nextW = Math.min(20, (selectedAnnot.strokeWidth || strokeWidth) + 1)
                                  setStrokeWidth(nextW)
                                  updateAnnotation(selectedAnnot.id, { strokeWidth: nextW })
                                }}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <Separator orientation="vertical" className="h-4" />
                          </>
                        )}

                        {/* Size scaler for signature / image / whiteout / shapes */}
                        {['signature', 'image', 'whiteout', 'rectangle', 'ellipse'].includes(selectedAnnot.type) && (
                          <>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold px-1">Size</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              onClick={() => {
                                const w = selectedAnnot.width || 100
                                const h = selectedAnnot.height || 50
                                const ratio = h > 0 ? w / h : 1
                                const newW = Math.max(20, w - 15)
                                const newH = selectedAnnot.type === 'signature' || selectedAnnot.type === 'image' ? newW / ratio : Math.max(10, h - 10)
                                saveToUndoStack()
                                updateAnnotation(selectedAnnot.id, { width: newW, height: newH })
                              }}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="text-[11px] font-mono text-muted-foreground px-1">{Math.round(selectedAnnot.width || 100)}px</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-md"
                              onClick={() => {
                                const w = selectedAnnot.width || 100
                                const h = selectedAnnot.height || 50
                                const ratio = h > 0 ? w / h : 1
                                const newW = Math.min(800, w + 15)
                                const newH = selectedAnnot.type === 'signature' || selectedAnnot.type === 'image' ? newW / ratio : Math.min(600, h + 10)
                                saveToUndoStack()
                                updateAnnotation(selectedAnnot.id, { width: newW, height: newH })
                              }}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Separator orientation="vertical" className="h-4" />
                          </>
                        )}

                        {/* Action button for Redact */}
                        {selectedAnnot.type === 'redact' && (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-6 px-2 text-[11px] gap-1 rounded-md"
                              disabled={processing === 'redact'}
                              onClick={handleApplyRedaction}
                            >
                              {processing === 'redact' ? <Loader2 className="w-3 h-3 animate-spin" /> : <EyeOff className="w-3 h-3" />}
                              <span>Apply Redact</span>
                            </Button>
                            <Separator orientation="vertical" className="h-4" />
                          </>
                        )}

                        {/* Duplicate */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground hover:text-foreground"
                          title="Duplicate"
                          onClick={() => {
                            const newId = crypto.randomUUID()
                            addAnnotation({
                              ...selectedAnnot,
                              id: newId,
                              x: selectedAnnot.x + 15,
                              y: selectedAnnot.y + 15,
                            })
                            setSelectedAnnotId(newId)
                            showStatus('Annotation duplicated')
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          onClick={() => {
                            removeAnnotation(selectedAnnot.id)
                            setSelectedAnnotId(null)
                            showStatus('Annotation deleted')
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ===== FLOATING BOTTOM PAGE CAPSULE ===== */}
          <div className="fixed md:absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 bg-background/90 dark:bg-slate-900/90 backdrop-blur-xl border border-border/70 shadow-2xl rounded-full text-xs select-none max-w-[95vw] overflow-x-auto">
            {/* View Mode Toggle: Continuous vs Single */}
            <div className="flex items-center bg-muted/70 p-0.5 rounded-full shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-[11px] rounded-full gap-1 transition-all ${
                  scrollMode === 'continuous'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setScrollMode('continuous')}
                title="Continuous multi-page scroll"
              >
                <ScrollText className="w-3 h-3" />
                <span className="hidden sm:inline">Continuous</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-[11px] rounded-full gap-1 transition-all ${
                  scrollMode === 'single'
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => {
                  setScrollMode('single')
                  if (containerRef.current) containerRef.current.scrollTop = 0
                }}
                title="Single page view"
              >
                <BookOpen className="w-3 h-3" />
                <span className="hidden sm:inline">Single</span>
              </Button>
            </div>

            <Separator orientation="vertical" className="h-4 shrink-0" />

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full shrink-0"
              disabled={currentPage <= 1}
              onClick={() => handlePageSelect(currentPage - 1)}
              title="Previous Page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <div
              className="relative shrink-0"
              onMouseEnter={() => setShowThumbnailStrip(true)}
              onMouseLeave={() => setShowThumbnailStrip(false)}
            >
              <button
                type="button"
                onClick={() => setShowThumbnailStrip(!showThumbnailStrip)}
                className="text-xs font-medium px-1.5 py-0.5 rounded-full hover:bg-muted/80 transition-colors cursor-pointer flex items-center gap-1"
                title="Click or hover to preview page thumbnails"
              >
                Page <span className="font-semibold text-foreground">{currentPage}</span> of {totalPages}
              </button>
              <PdfThumbnailStrip
                isOpen={showThumbnailStrip}
                thumbnails={pageThumbnails}
                currentPage={currentPage}
                onSelectPage={(p) => {
                  handlePageSelect(p)
                  setShowThumbnailStrip(false)
                }}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full shrink-0"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageSelect(currentPage + 1)}
              title="Next Page"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Separator orientation="vertical" className="h-4 shrink-0" />
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full shrink-0"
              onClick={() => setZoom(Math.max(0.2, zoom - 0.1))}
              title="Zoom Out"
            >
              <Minus className="w-3 h-3" />
            </Button>
            <span className="font-mono text-[11px] text-muted-foreground w-8 text-center shrink-0">{Math.round(zoom * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full shrink-0"
              onClick={() => setZoom(Math.min(3, zoom + 0.1))}
              title="Zoom In"
            >
              <Plus className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] rounded-full text-muted-foreground hover:text-foreground font-medium shrink-0"
              onClick={handleFitToWidth}
            >
              Fit
            </Button>
          </div>
        </div>

        {/* Right Panel - Annotations */}
        <AnimatePresence>
          {showAnnotationPanel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="border-l border-border/60 bg-background shrink-0 overflow-hidden flex flex-col h-full min-h-0">
              <div className="p-3 border-b border-border/40 flex items-center justify-between shrink-0">
                <h3 className="text-sm font-semibold">Annotations <span className="ml-1 text-xs text-muted-foreground font-normal">({pageAnnotations.length})</span></h3>
                {pageAnnotations.length > 0 && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAnnotations} title="Clear all"><XCircle className="w-3.5 h-3.5 text-destructive" /></Button>}
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {totalAnnotations === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
                    <p>No annotations yet.</p>
                    <p className="text-xs mt-1">Select a tool and start editing.</p>
                  </div>
                ) : pageAnnotations.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    <p>No annotations on this page.</p>
                    <p className="text-xs mt-1">{totalAnnotations} on other pages.</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {pageAnnotations.map((annot) => (
                      <div key={annot.id} className="flex items-start gap-2.5 p-2 rounded-lg border border-border/40 hover:bg-muted/50 transition-colors group">
                        <div className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ backgroundColor: annot.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium capitalize">{annot.type}</div>
                          {annot.content && <p className="text-xs text-muted-foreground mt-0.5 truncate">{annot.content}</p>}
                          {annot.points && <p className="text-xs text-muted-foreground mt-0.5">{annot.points.length} points</p>}
                          {annot.watermarkText && <p className="text-xs text-muted-foreground mt-0.5 truncate">{annot.watermarkText}</p>}
                          {(annot.imageData || annot.signatureData) && <p className="text-xs text-muted-foreground mt-0.5">Image ({annot.width}x{annot.height})</p>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0" onClick={() => removeAnnotation(annot.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Panel - AI Assistant */}
        <AiChatPanel />
      </div>

      {/* ===== MOBILE FORMATTING SUB-TOOLBAR ===== */}
      {isMobile && (['draw', 'rectangle', 'ellipse', 'line', 'text', 'editText'].includes(currentTool) || (currentTool === 'select' && selectedAnnot)) && (
        <div className="flex flex-col gap-2 p-2 border-t border-border/40 bg-background shrink-0 z-30 select-none">
          {/* Colors (horizontal scroll) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">Color:</span>
            {COLORS.map((c) => {
              const isSelected = (selectedAnnot ? selectedAnnot.color : drawColor) === c
              return (
                <button
                  key={c}
                  className={`w-6 h-6 rounded-full shrink-0 transition-all ${
                    isSelected
                      ? 'scale-125 ring-2 ring-offset-2 ring-emerald-500 shadow-md'
                      : 'border border-border/60 opacity-80 hover:opacity-100 hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => {
                    setDrawColor(c)
                    if (selectedAnnotId) {
                      updateAnnotation(selectedAnnotId, { color: c })
                    }
                  }}
                />
              )
            })}
          </div>
          
          {/* Stroke Width / Font controls */}
          <div className="flex items-center gap-3 px-1">
            {['draw', 'rectangle', 'ellipse', 'line'].includes(currentTool) && (
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase font-bold mr-1">Stroke:</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}><Minus className="w-3.5 h-3.5" /></Button>
                <span className="text-xs font-semibold w-7 text-center font-mono">{strokeWidth}px</span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
            )}
            
            {(currentTool === 'text' || currentTool === 'editText' || (currentTool === 'select' && selectedAnnot?.type === 'text')) && (
              <div className="flex items-center gap-2 w-full justify-between">
                {/* Font Family selector */}
                <select
                  value={selectedAnnot?.type === 'text' ? (selectedAnnot.fontFamily || 'Helvetica') : fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value)
                    if (selectedAnnotId) {
                      updateAnnotation(selectedAnnotId, { fontFamily: e.target.value })
                    }
                  }}
                  className="text-xs border border-border rounded px-1.5 py-1 bg-background shrink-0 max-w-[100px]"
                >
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                
                {/* Font Size controls */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    const currentSize = selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize
                    const nextSize = Math.max(6, currentSize - 2)
                    setFontSize(nextSize)
                    if (selectedAnnotId) {
                      updateAnnotation(selectedAnnotId, { fontSize: nextSize })
                    }
                  }}><Minus className="w-3 h-3" /></Button>
                  <span className="text-xs font-semibold w-8 text-center font-mono">
                    {selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize}px
                  </span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    const currentSize = selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize
                    const nextSize = Math.min(72, currentSize + 2)
                    setFontSize(nextSize)
                    if (selectedAnnotId) {
                      updateAnnotation(selectedAnnotId, { fontSize: nextSize })
                    }
                  }}><Plus className="w-3 h-3" /></Button>
                </div>
                
                {/* Bold / Italic controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 font-bold text-xs rounded transition-all ${
                      (selectedAnnot?.type === 'text' ? !!selectedAnnot.bold : textBold)
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    onClick={() => {
                      if (selectedAnnotId) {
                        const annot = annotations.find(a => a.id === selectedAnnotId)
                        if (annot) updateAnnotation(selectedAnnotId, { bold: !annot.bold })
                      } else {
                        setTextBold(!textBold)
                      }
                    }}
                  >
                    B
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 italic font-serif text-xs rounded transition-all ${
                      (selectedAnnot?.type === 'text' ? !!selectedAnnot.italic : textItalic)
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                    onClick={() => {
                      if (selectedAnnotId) {
                        const annot = annotations.find(a => a.id === selectedAnnotId)
                        if (annot) updateAnnotation(selectedAnnotId, { italic: !annot.italic })
                      } else {
                        setTextItalic(!textItalic)
                      }
                    }}
                  >
                    I
                  </Button>
                </div>
              </div>
            )}

            {selectedAnnotId && selectedAnnot && ['signature', 'image', 'rectangle', 'ellipse', 'redact', 'whiteout'].includes(selectedAnnot.type) && (
              <div className="flex items-center gap-2 w-full justify-between select-none py-0.5">
                <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">Size:</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    const w = selectedAnnot.width || (selectedAnnot.type === 'signature' ? 150 : selectedAnnot.type === 'image' ? 200 : 100)
                    const h = selectedAnnot.height || (selectedAnnot.type === 'signature' ? 50 : selectedAnnot.type === 'image' ? 150 : 50)
                    const ratio = h > 0 ? w / h : 1
                    const newW = Math.max(10, w - 10)
                    const newH = selectedAnnot.type === 'signature' || selectedAnnot.type === 'image'
                      ? newW / ratio
                      : Math.max(10, h - 10)
                    saveToUndoStack()
                    updateAnnotation(selectedAnnot.id, { width: newW, height: newH })
                  }}
                >
                  <Minus className="w-3.5 h-3.5" />
                </Button>
                <div className="flex-1 px-2 min-w-[100px] flex items-center">
                  <Slider
                    value={[selectedAnnot.width || 100]}
                    min={20}
                    max={600}
                    step={2}
                    onValueChange={(val) => {
                      const newW = val[0]
                      const w = selectedAnnot.width || (selectedAnnot.type === 'signature' ? 150 : selectedAnnot.type === 'image' ? 200 : 100)
                      const h = selectedAnnot.height || (selectedAnnot.type === 'signature' ? 50 : selectedAnnot.type === 'image' ? 150 : 50)
                      const ratio = h > 0 ? w / h : 1
                      const newH = selectedAnnot.type === 'signature' || selectedAnnot.type === 'image'
                        ? newW / ratio
                        : h
                      updateAnnotation(selectedAnnot.id, { width: newW, height: newH })
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => {
                    const w = selectedAnnot.width || (selectedAnnot.type === 'signature' ? 150 : selectedAnnot.type === 'image' ? 200 : 100)
                    const h = selectedAnnot.height || (selectedAnnot.type === 'signature' ? 50 : selectedAnnot.type === 'image' ? 150 : 50)
                    const ratio = h > 0 ? w / h : 1
                    const newW = Math.min(800, w + 10)
                    const newH = selectedAnnot.type === 'signature' || selectedAnnot.type === 'image'
                      ? newW / ratio
                      : Math.min(800, h + 10)
                    saveToUndoStack()
                    updateAnnotation(selectedAnnot.id, { width: newW, height: newH })
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-semibold font-mono w-12 text-right shrink-0">
                  {Math.round(selectedAnnot.width || 0)}px
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Status Notification */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="fixed bottom-16 left-1/2 -translate-x-1/2 z-40 px-3.5 py-1.5 bg-foreground/90 text-background backdrop-blur-md rounded-full shadow-2xl text-xs font-medium flex items-center gap-2 pointer-events-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {statusMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* In-Editor Document Search Bar */}
      <PdfSearchBar
        pdfDoc={pdfDocRef.current}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onJumpToMatch={handleJumpToMatch}
        onMatchesChange={(matches, activeIdx) => {
          setSearchMatches(matches)
          setActiveSearchMatchIndex(activeIdx)
        }}
      />

      {/* Right-Click Context Menu */}
      <PdfContextMenu
        state={contextMenu}
        onClose={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        onDuplicate={handleDuplicateAnnot}
        onDelete={(id) => {
          saveToUndoStack()
          removeAnnotation(id)
          setSelectedAnnotId(null)
          showStatus('Annotation deleted')
        }}
        onBringToFront={(id) => {
          bringToFront(id)
          showStatus('Brought to front')
        }}
        onSendToBack={(id) => {
          sendToBack(id)
          showStatus('Sent to back')
        }}
        onChangeColor={(id, color) => {
          updateAnnotation(id, { color })
          showStatus('Color updated')
        }}
        onAddTextAt={handleAddTextAt}
        onAddDateAt={handleAddDateAt}
        onApplyRedaction={handleApplyRedaction}
        onOpenSearch={() => setShowSearch(true)}
      />

      {/* Signature Pad Dialog */}
      <SignaturePad />

      {/* Watermark Dialog */}
      <Dialog open={showWatermarkDialog} onOpenChange={setShowWatermarkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Droplets className="w-5 h-5" />Add Watermark</DialogTitle><DialogDescription>Apply a text watermark to all pages.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium mb-1.5 block">Watermark Text</label>
              <input type="text" value={wmText} onChange={(e) => setWmText(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="CONFIDENTIAL" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm font-medium mb-1.5 block">Opacity</label>
                <input type="range" min={0.05} max={0.5} step={0.05} value={wmOpacity} onChange={(e) => setWmOpacity(Number(e.target.value))} className="w-full" />
                <span className="text-xs text-muted-foreground">{Math.round(wmOpacity * 100)}%</span>
              </div>
              <div><label className="text-sm font-medium mb-1.5 block">Angle</label>
                <input type="range" min={-90} max={90} step={5} value={wmAngle} onChange={(e) => setWmAngle(Number(e.target.value))} className="w-full" />
                <span className="text-xs text-muted-foreground">{wmAngle}°</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowWatermarkDialog(false)}>Cancel</Button>
              <Button onClick={handleApplyWatermark} disabled={processing === 'watermark' || !wmText.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {processing === 'watermark' ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Applying...</> : 'Apply Watermark'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Page Numbers Dialog */}
      <Dialog open={showPageNumDialog} onOpenChange={setShowPageNumDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Hash className="w-5 h-5" />Add Page Numbers</DialogTitle><DialogDescription>Add page numbers to all pages of the PDF.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium mb-1.5 block">Position</label>
              <select value={pnPos} onChange={(e) => setPnPos(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="bottom-center">Bottom Center</option>
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-center">Top Center</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
              </select>
            </div>
            <div><label className="text-sm font-medium mb-1.5 block">Format</label>
              <select value={pnFmt} onChange={(e) => setPnFmt(e.target.value)} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="numeric">1, 2, 3...</option>
                <option value="dash">- 1 -, - 2 -...</option>
                <option value="page-of">Page 1 of N</option>
                <option value="roman">i, ii, iii...</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPageNumDialog(false)}>Cancel</Button>
              <Button onClick={handleAddPageNumbers} disabled={processing === 'pagenumbers'} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {processing === 'pagenumbers' ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Adding...</> : 'Add Numbers'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Crop Apply Button (floating) */}
      {isCropping && cropBox && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex gap-2">
          <Button variant="outline" onClick={() => { setCropping(false); setCropBox(null) }}>Cancel Crop</Button>
          <Button onClick={handleApplyCrop} disabled={processing === 'crop'} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {processing === 'crop' ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Cropping...</> : 'Apply Crop'}
          </Button>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={showShortcuts} onOpenChange={setShowShortcuts}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Keyboard className="w-5 h-5" />Keyboard Shortcuts</DialogTitle><DialogDescription>Quick reference for all editor shortcuts.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tools</h4>
              {ALL_TOOLS.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{t.label}</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border border-border">{t.shortcut}</kbd></div>
              ))}
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>
              {[['Undo', 'Ctrl+Z'], ['Redo', 'Ctrl+Shift+Z'], ['Zoom In', '+'], ['Zoom Out', '-'], ['Reset Zoom', 'Ctrl+0'], ['Go Back', 'Esc'], ['Shortcuts', '?'], ['Scroll Zoom', 'Ctrl+Scroll']].map(([label, key]) => (
                <div key={key} className="flex items-center justify-between text-sm"><span className="text-muted-foreground">{label}</span><kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono border border-border">{key}</kbd></div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
