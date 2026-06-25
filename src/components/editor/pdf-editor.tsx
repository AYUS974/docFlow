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
  MoveHorizontal, CheckCircle2, Loader2, Settings2, ScanText,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { TextLayer } from './text-layer'
import { SignaturePad } from './signature-pad'
import { PageManager } from './page-manager'

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
    saveToUndoStack,
  } = useAppStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
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
  const [textBold, setTextBold] = useState(false)
  const [textItalic, setTextItalic] = useState(false)
  const textSubmitRef = useRef<() => void>(() => {})
  const [annotFontDropdownId, setAnnotFontDropdownId] = useState<string | null>(null)
  const [annotSizeDropdownId, setAnnotSizeDropdownId] = useState<string | null>(null)
  const [annotColorDropdownId, setAnnotColorDropdownId] = useState<string | null>(null)

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

  // Cleanup active states and selections on tool change
  useEffect(() => {
    if (textInput.visible) {
      textSubmitRef.current()
    }
    setSelectedAnnotId(null)
    setEditingAnnotId(null)
    if (currentTool !== 'crop' && isCropping) {
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

  // Render current page
  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current
    if (!pdf || !canvasRef.current) return
    // Guard stale/out-of-range page numbers during a document swap (redaction/
    // OCR reload, page delete) — getPage() throws "Invalid page request" otherwise.
    if (currentPage < 1 || currentPage > pdf.numPages) return
    // Cancel any in-flight render on this canvas before starting a new one,
    // otherwise pdf.js throws "same canvas during multiple render() operations".
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel() } catch { /* already settled */ }
      renderTaskRef.current = null
    }
    setIsRendering(true)
    try {
      const page = await pdf.getPage(currentPage)
      const rotation = pageRotations.get(currentPage) || 0
      const viewport = page.getViewport({ scale: zoom * 1.5, rotation })
      const canvas = canvasRef.current
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      const task = page.render({ canvasContext: ctx, viewport })
      renderTaskRef.current = task
      await task.promise
      renderTaskRef.current = null
      renderAnnotations()
    } catch (err: any) {
      // A cancelled render is expected when pages/zoom change quickly.
      if (err?.name !== 'RenderingCancelledException') console.error('Failed to render page:', err)
    } finally {
      setIsRendering(false)
    }
  }, [currentPage, zoom, pdfReady, pageRotations])

  useEffect(() => { renderPage() }, [renderPage])
  useEffect(() => { renderAnnotations() }, [annotations, currentPage])
  // Render annotations overlay
  const renderAnnotations = useCallback(() => {
    const overlay = overlayCanvasRef.current
    const canvas = canvasRef.current
    if (!overlay || !canvas) return
    overlay.width = canvas.width
    overlay.height = canvas.height
    const ctx = overlay.getContext('2d')!
    const scale = zoom * 1.5

    // Render text edit whiteouts first
    for (const [, edit] of textEdits) {
      if (edit.original.pageNumber !== currentPage) continue
      const orig = edit.original
      ctx.save()
      ctx.fillStyle = 'white'
      ctx.fillRect(orig.x * scale, orig.y * scale, Math.max(orig.width, 20) * scale, orig.height * scale)
      ctx.restore()
    }

    // Render crop box
    if (isCropping && cropBox) {
      ctx.save()
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(cropBox.x * scale, cropBox.y * scale, cropBox.width * scale, cropBox.height * scale)
      ctx.setLineDash([])
      // Dim outside area
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, 0, overlay.width, cropBox.y * scale) // top
      ctx.fillRect(0, (cropBox.y + cropBox.height) * scale, overlay.width, overlay.height - (cropBox.y + cropBox.height) * scale) // bottom
      ctx.fillRect(0, cropBox.y * scale, cropBox.x * scale, cropBox.height * scale) // left
      ctx.fillRect((cropBox.x + cropBox.width) * scale, cropBox.y * scale, overlay.width - (cropBox.x + cropBox.width) * scale, cropBox.height * scale) // right
      ctx.restore()
    }

    const pageAnnots = annotations.filter((a) => a.pageNumber === currentPage)
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
        case 'text': {
          // Rendered as interactive HTML elements in the overlay layer
          break
        }
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

    // Draw selection border for selected annotation
    if (selectedAnnotId) {
      const selectedAnnot = annotations.find(a => a.id === selectedAnnotId)
      if (selectedAnnot && selectedAnnot.pageNumber === currentPage) {
        ctx.save()
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 3])
        let x = selectedAnnot.x, y = selectedAnnot.y, w = selectedAnnot.width || 100, h = selectedAnnot.height || 50
        if (selectedAnnot.type === 'text') {
          h = selectedAnnot.fontSize || 16
          w = (selectedAnnot.content?.length || 5) * h * 0.6
          y = selectedAnnot.y - h
        } else if (selectedAnnot.type === 'draw' && selectedAnnot.points && selectedAnnot.points.length > 0) {
          const xs = selectedAnnot.points.map(p => p.x)
          const ys = selectedAnnot.points.map(p => p.y)
          const minX = Math.min(...xs), maxX = Math.max(...xs)
          const minY = Math.min(...ys), maxY = Math.max(...ys)
          x = minX; y = minY; w = maxX - minX; h = maxY - minY
        }
        ctx.strokeRect(x * scale - 4, y * scale - 4, w * scale + 8, h * scale + 8)
        ctx.restore()
      }
    }
  }, [annotations, currentPage, zoom, textEdits, isCropping, cropBox, selectedAnnotId])
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const overlay = overlayCanvasRef.current
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

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (currentTool === 'eraser' || currentTool === 'editText' || currentTool === 'pan') return
    if ('button' in e && e.button !== 0) return

    const coords = getCanvasCoords(e)

    if (currentTool === 'select') {
      const pageAnnots = annotations.filter((a) => a.pageNumber === currentPage)
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
      addAnnotation({
        id: crypto.randomUUID(), type: 'signature', pageNumber: currentPage,
        x: coords.x, y: coords.y, width: 150, height: 50, color: '#000000',
        signatureData,
      })
      return
    }

    // Image: place pending image at click
    if (currentTool === 'image') {
      if (!pendingImageData) { fileInputRef.current?.click(); return }
      addAnnotation({
        id: crypto.randomUUID(), type: 'image', pageNumber: currentPage,
        x: coords.x, y: coords.y, width: 200, height: 150, color: '#000000',
        imageData: pendingImageData,
      })
      setPendingImageData(null)
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

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDraggingAnnot && dragAnnotStart && selectedAnnotId) {
      const coords = getCanvasCoords(e)
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

    if (!isDrawing || !drawStartRef.current) return
    if (currentTool === 'pan') return
    const coords = getCanvasCoords(e)
    const scale = zoom * 1.5

    if (currentTool === 'draw') {
      setCurrentDrawingPoints([...currentDrawingPoints, coords])
    }

    // Live preview for shape/rect/ellipse/line/highlight/redact/whiteout/crop
    const shapeTools = ['rectangle', 'ellipse', 'highlight', 'redact', 'whiteout', 'line', 'crop']
    if (shapeTools.includes(currentTool) || isCropping) {
      const overlay = overlayCanvasRef.current
      const canvas = canvasRef.current
      if (!overlay || !canvas) return
      overlay.width = canvas.width; overlay.height = canvas.height
      const ctx = overlay.getContext('2d')!
      // Re-render existing annotations first
      renderAnnotations()
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

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (isDraggingAnnot) {
      setIsDraggingAnnot(false)
      setDragAnnotStart(null)
      return
    }
    if (currentTool === 'pan') return
    if (!isDrawing) return

    // Handle crop box
    if (isCropping && drawStartRef.current) {
      const coords = getCanvasCoords(e)
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
        id: crypto.randomUUID(), type: 'draw', pageNumber: currentPage,
        x: currentDrawingPoints[0].x, y: currentDrawingPoints[0].y,
        color: drawColor, strokeWidth, points: [...currentDrawingPoints],
      })
      setCurrentDrawingPoints([])
    } else if (['rectangle', 'ellipse', 'highlight', 'redact', 'whiteout', 'line'].includes(currentTool)) {
      const coords = getCanvasCoords(e)
      const w = coords.x - drawStartRef.current.x
      const h = coords.y - drawStartRef.current.y
      if (Math.abs(w) > 2 || Math.abs(h) > 2) {
        const base = { id: crypto.randomUUID(), pageNumber: currentPage, color: drawColor, strokeWidth }
        if (['highlight', 'rectangle', 'ellipse', 'redact', 'whiteout'].includes(currentTool)) {
          addAnnotation({ ...base, type: currentTool as PDFAnnotation['type'], x: Math.min(drawStartRef.current.x, coords.x), y: Math.min(drawStartRef.current.y, coords.y), width: Math.abs(w), height: Math.abs(h) })
        } else if (currentTool === 'line') {
          addAnnotation({ ...base, type: 'line', x: drawStartRef.current.x, y: drawStartRef.current.y, width: w, height: h })
        }
      }
    }
    drawStartRef.current = null; setIsDrawing(false)
  }

  const handleEraserClick = (e: React.MouseEvent) => {
    if (currentTool !== 'eraser') return
    const coords = getCanvasCoords(e)
    const scale = zoom * 1.5
    const pageAnnots = annotations.filter((a) => a.pageNumber === currentPage)
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
          saveToUndoStack()
          setTextInput({ x: annot.x, y: annot.y, visible: true })
          setTextInputValue(annot.content || '')
          setEditingAnnotId(annot.id)
          return
        }
        if (coords.x >= ax && coords.x <= ax + aw && coords.y >= ay && coords.y <= ay + ah) hit = true
      }
      if (hit) { removeAnnotation(annot.id); showStatus(`Removed ${annot.type}`); return }
    }
  }

  // handleTextSubmit replaced by textSubmitRef

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (currentTool === 'text') {
      // If a text box is already open for editing, this click is the user
      // committing it (the blur handler does the commit) — don't also spawn a
      // brand-new box, or every "click away" would duplicate the text.
      if (editingAnnotId) return
      const coords = getCanvasCoords(e)
      const newAnnotId = crypto.randomUUID()
      addAnnotation({
        id: newAnnotId,
        type: 'text',
        pageNumber: currentPage,
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
      // Drop back to the Select tool so subsequent clicks edit/move this box
      // instead of dropping more text boxes onto the page.
      setCurrentTool('select')
    }
    if (currentTool === 'eraser') handleEraserClick(e)
  }

  // NOTE: the previous effect that synced the selected text annotation with the
  // global toolbar state was removed — it called updateAnnotation() with
  // `annotations` in its deps, causing an infinite render loop, and it duplicated
  // the per-annotation floating toolbar (which edits the annotation directly).

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

  // Scroll wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom(zoom + delta)
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
      if (e.key === '?') setShowShortcuts(true)
      if (e.key === 'Delete' && currentTool === 'select') {
        // Future: delete selected annotation
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCurrentTool, goBack, setZoom, zoom, undo, redo, textInput.visible, editingTextItem, setEditingTextItem, isCropping, setCropping, currentTool])

  const selectedAnnot = selectedAnnotId ? annotations.find(a => a.id === selectedAnnotId) : null
  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage)
  const totalAnnotations = annotations.length
  const isEditTextMode = currentTool === 'editText'
  const isSignatureMode = currentTool === 'signature'
  const isRedactMode = currentTool === 'redact'
  const isWhiteoutMode = currentTool === 'whiteout'
  const isPanMode = currentTool === 'pan'
  const isImageMode = currentTool === 'image'

  return (
    <div className="h-screen flex flex-col bg-muted/30">
      {/* ===== TOP TOOLBAR ===== */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/60 bg-background shrink-0">
        {/* Back */}
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setView('dashboard')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Separator orientation="vertical" className="h-6" />

        {/* Undo / Redo */}
        <TooltipProvider delayDuration={300}>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={!canUndo} onClick={undo}><Undo2 className="w-4 h-4" /></Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Undo (Ctrl+Z)</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" disabled={!canRedo} onClick={redo}><Redo2 className="w-4 h-4" /></Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Redo (Ctrl+Shift+Z)</TooltipContent></Tooltip>
        </TooltipProvider>
        <Separator orientation="vertical" className="h-6" />

        {/* Sidebar toggle */}
        <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={toggleSidebar}>
          {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </Button>
        <Separator orientation="vertical" className="h-6" />

        {/* Tool groups */}
        <div className="flex items-center gap-0.5 overflow-x-auto">
          {TOOL_GROUPS.map((group, gi) => (
            <TooltipProvider key={group.label} delayDuration={300}>
              {gi > 0 && <Separator key={`sep-${gi}`} orientation="vertical" className="h-6 mx-0.5" />}
              {group.tools.map((tool) => (
                <Tooltip key={tool.id}>
                  <TooltipTrigger asChild>
                    <Button
                      variant={currentTool === tool.id ? 'secondary' : 'ghost'}
                      size="icon" className="shrink-0 h-8 w-8"
                      onClick={() => {
                        if (tool.id === 'signature' && !signatureData) { setShowSignaturePad(true); return }
                        if (tool.id === 'image' && !pendingImageData) { fileInputRef.current?.click(); return }
                        setCurrentTool(tool.id)
                      }}
                    >
                      <tool.icon className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{tool.label} ({tool.shortcut})</TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          ))}
        </div>
        <Separator orientation="vertical" className="h-6" />

        {/* Colors */}
        <div className="flex items-center gap-1 shrink-0">
          {COLORS.map((c) => (
            <button key={c} className={`w-4 h-4 rounded-full border-2 transition-all ${(selectedAnnot ? selectedAnnot.color : drawColor) === c ? 'border-foreground scale-125' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} onClick={() => {
              setDrawColor(c)
              if (selectedAnnotId) {
                updateAnnotation(selectedAnnotId, { color: c })
              }
            }} />
          ))}
        </div>
        <Separator orientation="vertical" className="h-6" />

        {/* Context-sensitive controls */}
        {['draw', 'rectangle', 'ellipse', 'line'].includes(currentTool) && (
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}><Minus className="w-3 h-3" /></Button>
            <span className="text-xs text-muted-foreground w-7 text-center">{strokeWidth}px</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}><Plus className="w-3 h-3" /></Button>
          </div>
        )}
        {(currentTool === 'text' || currentTool === 'editText' || (currentTool === 'select' && selectedAnnot?.type === 'text')) && (
          <div className="flex items-center gap-1.5 shrink-0">
            <select
              value={selectedAnnot?.type === 'text' ? (selectedAnnot.fontFamily || 'Helvetica') : fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value)
                if (selectedAnnotId) {
                  updateAnnotation(selectedAnnotId, { fontFamily: e.target.value })
                }
              }}
              className="text-xs border border-border rounded px-1.5 py-1 bg-background"
            >
              {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              const currentSize = selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize
              const nextSize = Math.max(6, currentSize - 2)
              setFontSize(nextSize)
              if (selectedAnnotId) {
                updateAnnotation(selectedAnnotId, { fontSize: nextSize })
              }
            }}><Minus className="w-3 h-3" /></Button>
            <span className="text-xs text-muted-foreground w-7 text-center">
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

            {/* Bold and Italic toggles */}
            {(currentTool === 'text' || (currentTool === 'select' && selectedAnnot?.type === 'text')) && (
              <>
                <Button
                  variant={(selectedAnnot?.type === 'text' ? !!selectedAnnot.bold : textBold) ? 'secondary' : 'ghost'}
                  size="icon" className="h-7 w-7 font-bold"
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
                  variant={(selectedAnnot?.type === 'text' ? !!selectedAnnot.italic : textItalic) ? 'secondary' : 'ghost'}
                  size="icon" className="h-7 w-7 italic font-serif"
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
              </>
            )}
          </div>
        )}

        {/* Mode indicators */}
        {isEditTextMode && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full shrink-0">Click text to edit</span>}
        {isSignatureMode && <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full shrink-0">Click to place signature</span>}
        {isRedactMode && <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full shrink-0">Drag to redact</span>}
        {annotations.some(a => a.type === 'redact') && (
          <Button
            variant="destructive" size="sm"
            className="shrink-0 h-8 gap-1.5 text-xs"
            disabled={processing === 'redact'}
            onClick={handleApplyRedaction}
          >
            {processing === 'redact'
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Redacting…</>
              : <><EyeOff className="w-3.5 h-3.5" /> Apply Redaction ({annotations.filter(a => a.type === 'redact').length})</>}
          </Button>
        )}
        {isWhiteoutMode && <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded-full shrink-0">Drag to whiteout</span>}
        {isPanMode && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full shrink-0">Drag to pan</span>}
        {isImageMode && <span className="text-xs bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 px-2 py-0.5 rounded-full shrink-0">Click to place image</span>}
        {isCropping && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full shrink-0">Drag to select crop area</span>}

        <div className="flex-1" />

        {/* Quick tools dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="shrink-0 h-8 gap-1.5 text-xs">
              <Settings2 className="w-3.5 h-3.5" /> Tools
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => setShowWatermarkDialog(true)} className="gap-2 cursor-pointer">
              <Droplets className="w-4 h-4" /><span>Add Watermark</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowPageNumDialog(true)} className="gap-2 cursor-pointer">
              <Hash className="w-4 h-4" /><span>Add Page Numbers</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOcr} disabled={processing === 'ocr'} className="gap-2 cursor-pointer">
              {processing === 'ocr' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanText className="w-4 h-4" />}
              <span>{processing === 'ocr' ? 'Running OCR…' : 'OCR — Make Searchable'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setCropping(!isCropping); if (isCropping) setCropBox(null) }} className="gap-2 cursor-pointer">
              <Crop className="w-4 h-4" /><span>{isCropping ? 'Cancel Crop' : 'Crop Page'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { insertBlankPage(currentPage); showStatus('Blank page inserted') }} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4" /><span>Insert Blank Page</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { duplicatePage(currentPage); showStatus('Page duplicated') }} className="gap-2 cursor-pointer">
              <Copy className="w-4 h-4" /><span>Duplicate This Page</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Zoom */}
        <div className="flex items-center gap-1 shrink-0">
          <TooltipProvider delayDuration={300}>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFitToWidth}><Maximize2 className="w-4 h-4" /></Button>
            </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Fit Width</TooltipContent></Tooltip>
          </TooltipProvider>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom - 0.1)}><ZoomOut className="w-4 h-4" /></Button>
          <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(zoom + 0.1)}><ZoomIn className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(1)}><RotateCcw className="w-4 h-4" /></Button>
        </div>
        <Separator orientation="vertical" className="h-6" />

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 relative" disabled={isExporting}>
              {isExporting ? <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={handleExportPdf} className="gap-2 cursor-pointer">
              <FileDown className="w-4 h-4" /><div><div className="text-sm font-medium">Export as PDF</div><div className="text-xs text-muted-foreground">With all edits embedded</div></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDownloadPng} className="gap-2 cursor-pointer">
              <ImageIcon className="w-4 h-4" /><div><div className="text-sm font-medium">Export as PNG</div><div className="text-xs text-muted-foreground">Current page only</div></div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleConvert('txt')} className="gap-2 cursor-pointer">
              <FileText className="w-4 h-4" /><div><div className="text-sm font-medium">Convert to TXT</div><div className="text-xs text-muted-foreground">Extract all text</div></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleConvert('html')} className="gap-2 cursor-pointer">
              <FileOutput className="w-4 h-4" /><div><div className="text-sm font-medium">Convert to HTML</div><div className="text-xs text-muted-foreground">Styled web page</div></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleConvertToJpg} className="gap-2 cursor-pointer">
              <ImageIcon className="w-4 h-4" /><div><div className="text-sm font-medium">Convert to JPG</div><div className="text-xs text-muted-foreground">Current page as JPEG image</div></div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleCompress} disabled={!!processing} className="gap-2 cursor-pointer">
              <Minus className="w-4 h-4" /><div><div className="text-sm font-medium">Compress PDF</div><div className="text-xs text-muted-foreground">Reduce file size</div></div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleProtect} disabled={!!processing} className="gap-2 cursor-pointer">
              <Shield className="w-4 h-4" /><div><div className="text-sm font-medium">Password Protect</div><div className="text-xs text-muted-foreground">Encrypt with password</div></div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
              <Printer className="w-4 h-4" /><div className="text-sm font-medium">Print Page</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Annotation panel toggle */}
        <TooltipProvider delayDuration={300}>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 relative" onClick={toggleAnnotationPanel}>
              <FileText className="w-4 h-4" />
              {totalAnnotations > 0 && <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{totalAnnotations}</span>}
            </Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Annotations ({totalAnnotations})</TooltipContent></Tooltip>
        </TooltipProvider>

        {/* Shortcuts */}
        <TooltipProvider delayDuration={300}>
          <Tooltip><TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => setShowShortcuts(true)}><Keyboard className="w-4 h-4" /></Button>
          </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Shortcuts (?)</TooltipContent></Tooltip>
        </TooltipProvider>

        {/* Hidden file input for image uploads */}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
      </div>
      {/* ===== PAGE NAV BAR ===== */}
      <div className="flex items-center justify-center gap-3 px-4 py-1.5 border-b border-border/40 bg-background shrink-0">
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage <= 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft className="w-4 h-4" /></Button>
        <span className="text-sm text-muted-foreground">Page <span className="font-medium text-foreground">{currentPage}</span> of {totalPages}</span>
        <Button variant="outline" size="icon" className="h-7 w-7" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight className="w-4 h-4" /></Button>
        <span className="text-xs text-muted-foreground ml-3 truncate max-w-[200px]">{currentDocument?.fileName}</span>
        {totalAnnotations > 0 && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full ml-1">{totalAnnotations} annot.</span>}
        {textEdits.size > 0 && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full ml-1">{textEdits.size} text edit{textEdits.size !== 1 ? 's' : ''}</span>}
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }} className="border-r border-border/60 bg-background shrink-0 overflow-hidden flex flex-col"
            >
              <div className="flex border-b border-border/40 shrink-0">
                <button className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarMode === 'thumbnails' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setSidebarMode('thumbnails')}>Thumbnails</button>
                <button className={`flex-1 py-2 text-xs font-medium transition-colors ${sidebarMode === 'pages' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setSidebarMode('pages')}>Pages</button>
              </div>
              {sidebarMode === 'thumbnails' ? (
                <ScrollArea className="flex-1 py-2 px-2">
                  <div className="space-y-2">
                    {pageThumbnails.map((thumb) => {
                      const thumbAnnotCount = annotations.filter(a => a.pageNumber === thumb.page).length
                      const rotation = pageRotations.get(thumb.page) || 0
                      return (
                        <button key={thumb.page} className={`w-full rounded-lg border-2 transition-all p-1 relative ${currentPage === thumb.page ? 'border-emerald-500 shadow-sm' : 'border-transparent hover:border-border'}`} onClick={() => setCurrentPage(thumb.page)}>
                          <div className="relative w-full">
                            <img src={thumb.dataUrl} alt={`Page ${thumb.page}`} className="w-full rounded" style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined} />
                            <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{thumb.page}</div>
                            {thumbAnnotCount > 0 && <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{thumbAnnotCount}</div>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </ScrollArea>
              ) : (
                <PageManager pdfDoc={pdfDocRef.current} pdfBytesRef={pdfBytesRef} fileData={currentDocument?.fileData || null} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas Area */}
        <div
          ref={containerRef} className="flex-1 overflow-auto flex items-start justify-center p-6"
          onWheel={handleWheel}
          style={{ cursor: isPanMode ? 'grab' : isCropping ? 'crosshair' : undefined }}
        >
          <div className="pdf-canvas-container shadow-xl rounded-lg overflow-hidden relative">
            {/* Text input overlay for add-text tool */}
            {textInput.visible && (
              <div className="absolute" style={{
                left: textInput.x * zoom * 1.5,
                top: textInput.y * zoom * 1.5 - (selectedAnnot?.type === 'text' ? (selectedAnnot.fontSize || 16) : fontSize) * zoom * 1.5
              }}>
                <input type="text" autoFocus value={textInputValue} onChange={(e) => setTextInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') textSubmitRef.current(); if (e.key === 'Escape') setTextInput({ x: 0, y: 0, visible: false }) }}
                  onBlur={() => textSubmitRef.current()}
                  className="border-2 border-emerald-500 rounded px-2 py-1 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm outline-none"
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
            {isRendering && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
                <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef} />
            <canvas ref={overlayCanvasRef} className="absolute top-0 left-0"
              style={{ pointerEvents: currentTool === 'editText' ? 'none' : 'auto' }}
              onMouseDown={(e) => { if (isPanMode) handlePanStart(e); else handlePointerDown(e) }}
              onMouseMove={(e) => { if (isPanning) handlePanMove(e); else handlePointerMove(e) }}
              onMouseUp={(e) => { if (isPanning) handlePanEnd(); else handlePointerUp(e) }}
              onMouseLeave={() => { if (isPanning) handlePanEnd(); else handlePointerUp({} as any) }}
              onClick={handleCanvasClick}
              onDoubleClick={handleCanvasDoubleClick}
              onTouchStart={handlePointerDown} onTouchMove={handlePointerMove} onTouchEnd={handlePointerUp}
            />
            {/* Native text editing layer */}
            <TextLayer pdfDoc={pdfDocRef.current} canvasEl={canvasRef.current} containerEl={containerRef.current} />
            {/* Added text annotations HTML overlay */}
            <div 
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ zIndex: 6 }}
            >
              {annotations
                .filter((annot) => annot.type === 'text' && annot.pageNumber === currentPage)
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
                        key={annot.id}
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
                              // Place the caret at the end so the user keeps
                              // typing where they left off instead of having the
                              // whole word selected (and replaced on next keypress).
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
                      key={annot.id}
                      style={style}
                      onMouseDown={(e) => handleStartDrag(e, annot)}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isSelectOrTextTool) {
                          if (selectedAnnotId === annot.id) {
                            setEditingAnnotId(annot.id)
                          } else {
                            setSelectedAnnotId(annot.id)
                          }
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
                              addAnnotation({
                                ...annot,
                                id: crypto.randomUUID(),
                                x: annot.x + 20,
                                y: annot.y + 20
                              })
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
          </div>
        </div>

        {/* Right Panel - Annotations */}
        <AnimatePresence>
          {showAnnotationPanel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="border-l border-border/60 bg-background shrink-0 overflow-hidden">
              <div className="p-3 border-b border-border/40 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Annotations <span className="ml-1 text-xs text-muted-foreground font-normal">({pageAnnotations.length})</span></h3>
                {pageAnnotations.length > 0 && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAnnotations} title="Clear all"><XCircle className="w-3.5 h-3.5 text-destructive" /></Button>}
              </div>
              <ScrollArea className="h-[calc(100%-48px)]">
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
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className="flex items-center justify-between px-4 py-1 border-t border-border/40 bg-background shrink-0 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {currentDocument?.fileName}</span>
          <span>{totalPages} pages</span>
          <span>{totalAnnotations} annotations</span>
          <span>{textEdits.size} text edits</span>
        </div>
        {statusMessage && (
          <AnimatePresence><motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
          >{statusMessage}</motion.div></AnimatePresence>
        )}
        <div className="flex items-center gap-2">
          <span>{Math.round(zoom * 100)}%</span>
          <span>Page {currentPage}/{totalPages}</span>
        </div>
      </div>
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
