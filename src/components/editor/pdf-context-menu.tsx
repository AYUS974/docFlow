'use client'

import { useEffect, useRef } from 'react'
import {
  Copy, ClipboardPaste, Trash2, ArrowUp, ArrowDown, Type, Calendar, Search,
  EyeOff
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { type PDFAnnotation } from '@/store/app-store'

export interface ContextMenuState {
  visible: boolean
  x: number
  y: number
  annot?: PDFAnnotation | null
  pageNumber: number
  canvasCoords: { x: number; y: number }
}

interface PdfContextMenuProps {
  state: ContextMenuState
  onClose: () => void
  onDuplicate: (annot: PDFAnnotation) => void
  onCopyAnnot?: (annot: PDFAnnotation) => void
  onPasteAt?: (coords: { x: number; y: number }, pageNumber: number) => void
  onDelete: (annotId: string) => void
  onBringToFront: (annotId: string) => void
  onSendToBack: (annotId: string) => void
  onChangeColor: (annotId: string, color: string) => void
  onAddTextAt: (coords: { x: number; y: number }, pageNumber: number) => void
  onAddDateAt: (coords: { x: number; y: number }, pageNumber: number) => void
  onApplyRedaction?: () => void
  onOpenSearch?: () => void
}

const QUICK_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000']

export function PdfContextMenu({
  state,
  onClose,
  onDuplicate,
  onCopyAnnot,
  onPasteAt,
  onDelete,
  onBringToFront,
  onSendToBack,
  onChangeColor,
  onAddTextAt,
  onAddDateAt,
  onApplyRedaction,
  onOpenSearch,
}: PdfContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleScrollOrResize = () => onClose()

    if (state.visible) {
      document.addEventListener('mousedown', handleClickOutside)
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [state.visible, onClose])

  if (!state.visible) return null

  // Ensure menu stays within viewport
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1200
  const screenH = typeof window !== 'undefined' ? window.innerHeight : 800
  const menuX = Math.min(state.x, screenW - 220)
  const menuY = Math.min(state.y, screenH - 320)

  const annot = state.annot

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.95, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.12 }}
        className="fixed z-50 min-w-[210px] bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl p-1.5 text-xs select-none font-sans text-foreground"
        style={{ left: menuX, top: menuY }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {annot ? (
          <>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1 flex items-center justify-between">
              <span>{annot.type} on Page {annot.pageNumber}</span>
            </div>

            {/* Color Palette for Annotations */}
            {['draw', 'rectangle', 'ellipse', 'line', 'highlight', 'text'].includes(annot.type) && (
              <div className="px-2 py-1.5 flex items-center justify-between gap-1 border-b border-border/40 mb-1">
                {QUICK_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      onChangeColor(annot.id, c)
                      onClose()
                    }}
                    className={`w-4 h-4 rounded-full border transition-transform hover:scale-125 ${
                      annot.color === c ? 'scale-110 ring-2 ring-emerald-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            )}

            {onCopyAnnot && (
              <button
                onClick={() => {
                  onCopyAnnot(annot)
                  onClose()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-blue-500" />
                  <span>Copy</span>
                </div>
                <kbd className="text-[10px] text-muted-foreground font-mono">Ctrl+C</kbd>
              </button>
            )}

            <button
              onClick={() => {
                onDuplicate(annot)
                onClose()
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Copy className="w-3.5 h-3.5 text-indigo-500" />
                <span>Duplicate</span>
              </div>
              <kbd className="text-[10px] text-muted-foreground font-mono">Ctrl+D</kbd>
            </button>

            {onPasteAt && (
              <button
                onClick={() => {
                  onPasteAt(state.canvasCoords, state.pageNumber)
                  onClose()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Paste Here</span>
                </div>
                <kbd className="text-[10px] text-muted-foreground font-mono">Ctrl+V</kbd>
              </button>
            )}

            <div className="my-1 border-t border-border/40" />

            <button
              onClick={() => {
                onBringToFront(annot.id)
                onClose()
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
            >
              <ArrowUp className="w-3.5 h-3.5 text-purple-500" />
              <span>Bring to Front</span>
            </button>

            <button
              onClick={() => {
                onSendToBack(annot.id)
                onClose()
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
            >
              <ArrowDown className="w-3.5 h-3.5 text-purple-500" />
              <span>Send to Back</span>
            </button>

            {annot.type === 'redact' && onApplyRedaction && (
              <button
                onClick={() => {
                  onApplyRedaction()
                  onClose()
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 font-medium transition-colors"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Apply Redaction</span>
              </button>
            )}

            <div className="my-1 border-t border-border/40" />

            <button
              onClick={() => {
                onDelete(annot.id)
                onClose()
              }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-destructive/10 text-destructive font-medium transition-colors"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </div>
              <kbd className="text-[10px] font-mono opacity-80">Del</kbd>
            </button>
          </>
        ) : (
          <>
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/40 mb-1">
              Page {state.pageNumber}
            </div>

            {onPasteAt && (
              <button
                onClick={() => {
                  onPasteAt(state.canvasCoords, state.pageNumber)
                  onClose()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ClipboardPaste className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Paste Here</span>
                </div>
                <kbd className="text-[10px] text-muted-foreground font-mono">Ctrl+V</kbd>
              </button>
            )}

            <button
              onClick={() => {
                onAddTextAt(state.canvasCoords, state.pageNumber)
                onClose()
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
            >
              <Type className="w-3.5 h-3.5 text-emerald-500" />
              <span>Add Text Here</span>
            </button>

            <button
              onClick={() => {
                onAddDateAt(state.canvasCoords, state.pageNumber)
                onClose()
              }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Insert Today&apos;s Date</span>
            </button>

            {onOpenSearch && (
              <button
                onClick={() => {
                  onOpenSearch()
                  onClose()
                }}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left hover:bg-muted font-medium transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-amber-500" />
                  <span>Find in Document</span>
                </div>
                <kbd className="text-[10px] text-muted-foreground font-mono">Ctrl+F</kbd>
              </button>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
