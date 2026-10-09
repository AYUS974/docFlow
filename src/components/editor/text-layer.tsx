'use client'

import { useEffect, useRef, useCallback, useState, Fragment } from 'react'
import {
  useAppStore,
  type PDFTextItem,
  groupTextItemsIntoLines,
  groupLinesIntoParagraphs,
  matchMetricFont,
  METRIC_FONTS,
} from '@/store/app-store'
import * as pdfjsLib from 'pdfjs-dist'
import { Copy, Highlighter, Sparkles, Check } from 'lucide-react'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'

// Stitch fragmented text runs on the same line into unified spans
function mergeCloseItems(items: PDFTextItem[]): PDFTextItem[] {
  if (items.length <= 1) return items

  const merged: PDFTextItem[] = []
  let current = { ...items[0] }

  for (let i = 1; i < items.length; i++) {
    const next = items[i]
    const sameLine = Math.abs(current.y - next.y) < current.height * 0.4
    const gap = next.x - (current.x + current.width)
    const spaceWidth = current.fontSize * 0.35

    if (sameLine && gap < spaceWidth && !current.text.endsWith(' ') && !next.text.startsWith(' ')) {
      current.text += next.text
      current.str = current.text
      current.width = next.x + next.width - current.x
      if (next.fontSize > current.fontSize) {
        current.fontSize = next.fontSize
      }
      current.widthInChars = current.fontSize > 0 ? Math.round(current.width / (current.fontSize * 0.52)) : current.text.length
    } else {
      merged.push(current)
      current = { ...next }
    }
  }
  merged.push(current)
  return merged
}

// Individual text span with automatic horizontal scaling to match canvas glyphs 1:1
function TextSpanItem({
  item,
  scale,
  isEditMode,
  isHovered,
  isSelected,
  onSelect,
  onDoubleClick,
  onMouseEnter,
  onMouseLeave,
}: {
  item: PDFTextItem
  scale: number
  isEditMode: boolean
  isHovered: boolean
  isSelected: boolean
  onSelect: () => void
  onDoubleClick: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}) {
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = spanRef.current
    if (!el) return
    el.style.transform = 'none'
    const naturalWidth = el.getBoundingClientRect().width || el.offsetWidth
    const targetWidth = item.width * scale

    if (naturalWidth > 0 && targetWidth > 0) {
      const scaleX = targetWidth / naturalWidth
      el.style.transform = `scaleX(${scaleX})`
      el.style.transformOrigin = '0 0'
    }
  }, [item.text, item.width, scale])

  const itemFamilyKey = matchMetricFont(item.fontFamily)
  const fontName = METRIC_FONTS[itemFamilyKey]?.cssName || 'Arimo, sans-serif'
  const isItemBold = item.fontFamily.toLowerCase().includes('bold')
  const isItemItalic = item.fontFamily.toLowerCase().includes('italic') || item.fontFamily.toLowerCase().includes('oblique')

  const fontStyle: React.CSSProperties = {
    position: 'absolute',
    left: item.x * scale,
    top: item.y * scale,
    fontSize: (item.fontSize || item.height || 12) * scale,
    fontFamily: fontName,
    fontWeight: isItemBold ? 'bold' : 'normal',
    fontStyle: isItemItalic ? 'italic' : 'normal',
    color: 'transparent',
    whiteSpace: 'pre',
    lineHeight: 1,
    display: 'inline-block',
    userSelect: isEditMode ? 'none' : 'text',
    cursor: isEditMode ? 'text' : 'text',
  }

  return (
    <span
      ref={spanRef}
      style={{
        ...fontStyle,
        border: isEditMode
          ? isHovered
            ? '1px dashed rgba(16,185,129,0.7)'
            : '1px dashed rgba(16,185,129,0.25)'
          : 'none',
        background: isEditMode && isHovered ? 'rgba(16,185,129,0.08)' : 'transparent',
        borderRadius: '2px',
        transition: 'border-color 0.15s, background 0.15s',
        outline: isEditMode && isSelected ? '1.5px dashed #10b981' : 'none',
      }}
      onClick={(e) => {
        if (isEditMode) {
          e.stopPropagation()
          onSelect()
        }
      }}
      onDoubleClick={(e) => {
        if (isEditMode) {
          e.stopPropagation()
          onDoubleClick()
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {item.text}
    </span>
  )
}

interface TextLayerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null
  canvasEl: HTMLCanvasElement | null
  containerEl: HTMLDivElement | null
  pageNumber: number
  onHighlightSelection?: (text: string, bounds: { x: number; y: number; width: number; height: number }, pageNumber: number) => void
}

export function TextLayer({
  pdfDoc,
  canvasEl,
  containerEl,
  pageNumber,
  onHighlightSelection,
}: TextLayerProps) {
  const {
    zoom,
    editingTextItem,
    setEditingTextItem,
    textEdits,
    addTextEdit,
    updateTextEdit,
    removeTextEdit,
    currentTool,
    duplicateTextEdit,
    addAnnotation,
    drawColor,
    toggleAiPanel,
    showAiPanel,
    setCopiedText,
  } = useAppStore()

  const [pageTextItems, setPageTextItems] = useState<PDFTextItem[]>([])
  const [pageTextLines, setPageTextLines] = useState<any[]>([])
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showSizeDropdown, setShowSizeDropdown] = useState(false)
  const [showColorDropdown, setShowColorDropdown] = useState(false)
  const [copied, setCopied] = useState(false)

  // Floating selection tooltip state
  const [selectionBox, setSelectionBox] = useState<{
    text: string
    x: number
    y: number
    width: number
    height: number
    pdfBounds: { x: number; y: number; width: number; height: number }
  } | null>(null)

  const editRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; startCX: number; startCY: number; startX: number; startY: number; moved: boolean } | null>(null)

  const scale = zoom * 1.5
  const isEditMode = currentTool === 'editText'
  const isSelectOrHighlight = currentTool === 'select' || currentTool === 'highlight' || currentTool === 'pan'

  // Extract text content for this specific page
  const extractText = useCallback(async () => {
    if (!pdfDoc || pageNumber < 1 || pageNumber > pdfDoc.numPages) return
    try {
      const page = await pdfDoc.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const styles: Record<string, any> = (textContent as any).styles || {}
      const viewport = page.getViewport({ scale: 1 })

      const rawItems: PDFTextItem[] = textContent.items
        .filter((item: any) => 'str' in item && item.str.trim().length > 0)
        .map((item: any, idx: number) => {
          const tx = item.transform
          const x = tx[4]
          const y = viewport.height - tx[5] - (item.height || 12)
          const itemFontSize = Math.abs(tx[0]) || Math.abs(tx[3]) || 12
          const width = item.width || 0
          const height = item.height || itemFontSize * 1.2
          const fontName = styles[item.fontName]?.fontFamily || item.fontName || 'sans-serif'
          const widthInChars = itemFontSize > 0 ? Math.round(width / (itemFontSize * 0.52)) : item.str.length

          return {
            id: `text-${pageNumber}-${idx}`,
            text: item.str,
            str: item.str,
            x,
            y,
            width,
            height,
            fontSize: itemFontSize,
            fontFamily: fontName,
            pageNumber,
            transform: tx,
            hasEOL: item.hasEOL || false,
            dir: item.dir || 'ltr',
            widthInChars,
            lineHeight: height * 1.2,
          }
        })

      rawItems.sort((a, b) => (Math.abs(a.y - b.y) < a.height * 0.4 ? a.x - b.x : a.y - b.y))
      const lines = groupTextItemsIntoLines(rawItems)
      const paragraphs = groupLinesIntoParagraphs(lines)

      const indexedItems = rawItems.map((item) => {
        const line = lines.find((l) => l.items.some((li) => li.id === item.id))
        const para = paragraphs.find((p) => p.lines.some((pl) => pl.items.some((li) => li.id === item.id)))
        return {
          ...item,
          lineIndex: line ? lines.indexOf(line) : undefined,
          paragraphIndex: para ? paragraphs.indexOf(para) : undefined,
        }
      })

      setPageTextItems(mergeCloseItems(indexedItems))
      setPageTextLines(lines)
    } catch (err) {
      console.error(`Text extraction failed for page ${pageNumber}:`, err)
    }
  }, [pdfDoc, pageNumber])

  useEffect(() => {
    extractText()
  }, [extractText])

  // Handle native text selection change
  const handleMouseUp = () => {
    if (isEditMode) return
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setSelectionBox(null)
      return
    }

    const selectedText = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    const layerRect = layerRef.current?.getBoundingClientRect()

    if (layerRect && rect.width > 0 && rect.height > 0) {
      const localX = (rect.left - layerRect.left) / scale
      const localY = (rect.top - layerRect.top) / scale
      const localW = rect.width / scale
      const localH = rect.height / scale

      setSelectionBox({
        text: selectedText,
        x: rect.left - layerRect.left,
        y: rect.top - layerRect.top - 42,
        width: rect.width,
        height: rect.height,
        pdfBounds: {
          x: Math.max(0, localX),
          y: Math.max(0, localY),
          width: localW,
          height: localH,
        },
      })
    }
  }

  const handleCopySelection = () => {
    if (!selectionBox) return
    const textToCopy = selectionBox.text
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(textToCopy).catch(() => {})
      }
    } catch {}
    setCopiedText(textToCopy)
    setCopied(true)
    setTimeout(() => {
      setCopied(false)
      setSelectionBox(null)
    }, 1200)
  }

  const handleHighlightSelection = (highlightColor?: string) => {
    if (!selectionBox) return
    const b = selectionBox.pdfBounds
    addAnnotation({
      id: crypto.randomUUID(),
      type: 'highlight',
      pageNumber,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      color: highlightColor || drawColor || '#f59e0b',
    })
    setSelectionBox(null)
    window.getSelection()?.removeAllRanges()
  }

  const handleAskAiAboutSelection = () => {
    if (!selectionBox) return
    if (!showAiPanel) toggleAiPanel()
    setSelectionBox(null)
  }

  // --- Inline edit toolbar handlers ---
  const activeItem = editingTextItem || (selectedEditId ? (textEdits.get(selectedEditId)?.original || pageTextItems.find((i) => i.id === selectedEditId)) : null)
  const activeEdit = activeItem ? textEdits.get(activeItem.id) : null
  const showToolbar = !!activeItem && isEditMode

  const editFamilyKey = activeEdit?.fontFamily || (activeItem ? matchMetricFont(activeItem.fontFamily) : 'arimo')
  const editSize = activeEdit?.fontSize || (activeItem ? activeItem.fontSize : 12)
  const isBold = activeEdit ? activeEdit.bold : (activeItem ? activeItem.fontFamily.toLowerCase().includes('bold') : false)
  const isItalic = activeEdit ? activeEdit.italic : (activeItem ? (activeItem.fontFamily.toLowerCase().includes('italic') || activeItem.fontFamily.toLowerCase().includes('oblique')) : false)
  const editColor = activeEdit?.color || '#000000'

  const handleToggleBold = () => {
    if (!activeItem) return
    const nextBold = !isBold
    if (activeEdit) {
      updateTextEdit(activeItem.id, { bold: nextBold })
    } else {
      addTextEdit(activeItem.id, activeItem, activeItem.text)
      updateTextEdit(activeItem.id, { bold: nextBold })
    }
  }

  const handleToggleItalic = () => {
    if (!activeItem) return
    const nextItalic = !isItalic
    if (activeEdit) {
      updateTextEdit(activeItem.id, { italic: nextItalic })
    } else {
      addTextEdit(activeItem.id, activeItem, activeItem.text)
      updateTextEdit(activeItem.id, { italic: nextItalic })
    }
  }

  const handleChangeFontSize = (size: number) => {
    if (!activeItem) return
    if (activeEdit) {
      updateTextEdit(activeItem.id, { fontSize: size })
    } else {
      addTextEdit(activeItem.id, activeItem, activeItem.text)
      updateTextEdit(activeItem.id, { fontSize: size })
    }
  }

  const handleChangeFontFamily = (family: string) => {
    if (!activeItem) return
    if (activeEdit) {
      updateTextEdit(activeItem.id, { fontFamily: family })
    } else {
      addTextEdit(activeItem.id, activeItem, activeItem.text)
      updateTextEdit(activeItem.id, { fontFamily: family })
    }
  }

  const handleChangeColor = (color: string) => {
    if (!activeItem) return
    if (activeEdit) {
      updateTextEdit(activeItem.id, { color: color })
    } else {
      addTextEdit(activeItem.id, activeItem, activeItem.text)
      updateTextEdit(activeItem.id, { color: color })
    }
  }

  const activeX = activeEdit ? activeEdit.x : (activeItem ? activeItem.x : 0)
  const activeY = activeEdit ? activeEdit.y : (activeItem ? activeItem.y : 0)

  // When user finishes editing
  const handleEditBlur = () => {
    const newText = (editRef.current?.textContent ?? '').replace(/ /g, ' ')
    if (editingTextItem) {
      const existing = textEdits.get(editingTextItem.id)
      const currentText = existing ? existing.edited : editingTextItem.text
      if (newText !== currentText) {
        if (existing?.isDuplicate) {
          addTextEdit(editingTextItem.id, editingTextItem, newText)
        } else if (newText === editingTextItem.text) {
          removeTextEdit(editingTextItem.id)
        } else {
          addTextEdit(editingTextItem.id, editingTextItem, newText)
        }
        setSelectedEditId(editingTextItem.id)
      }
    }
    setEditingTextItem(null)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).blur()
    }
    if (e.key === 'Escape') {
      setEditingTextItem(null)
    }
  }

  const getEditedText = (itemId: string) => {
    const edit = textEdits.get(itemId)
    return edit ? edit.edited : null
  }

  // --- Pick & place drag handlers ---
  const startEditDrag = (e: React.MouseEvent, item: PDFTextItem) => {
    if (!isEditMode) return
    e.preventDefault()
    e.stopPropagation()
    const edit = textEdits.get(item.id)
    if (!edit) return
    setSelectedEditId(item.id)
    dragRef.current = { id: item.id, startCX: e.clientX, startCY: e.clientY, startX: edit.x, startY: edit.y, moved: false }
  }
  const handleLayerMouseMove = (e: React.MouseEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.startCX) / scale
    const dy = (e.clientY - d.startCY) / scale
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) d.moved = true
    updateTextEdit(d.id, { x: d.startX + dx, y: d.startY + dy })
  }
  const endEditDrag = () => {
    dragRef.current = null
  }

  if (!canvasEl || !pdfDoc) return null

  return (
    <div
      ref={layerRef}
      className="absolute top-0 left-0 w-full h-full"
      style={{
        pointerEvents: isEditMode ? 'auto' : isSelectOrHighlight ? 'auto' : 'none',
        zIndex: isEditMode ? 10 : 5,
        userSelect: isEditMode ? 'none' : 'text',
      }}
      onMouseUp={handleMouseUp}
      onMouseMove={handleLayerMouseMove}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && isEditMode) setSelectedEditId(null)
      }}
    >
      {/* Native PDF Text Spans with Auto-Fit Horizontal Sizing */}
      {pageTextItems.map((item) => {
        const editedText = getEditedText(item.id)
        const isEditing = editingTextItem?.id === item.id

        const edit = textEdits.get(item.id)
        const itemFamilyKey = edit?.fontFamily ?? matchMetricFont(item.fontFamily)
        const fontName = METRIC_FONTS[itemFamilyKey]?.cssName || 'Arimo'
        const itemFontSize = edit?.fontSize ?? item.fontSize
        const isItemBold = edit ? edit.bold : item.fontFamily.toLowerCase().includes('bold')
        const isItemItalic = edit ? edit.italic : item.fontFamily.toLowerCase().includes('italic') || item.fontFamily.toLowerCase().includes('oblique')
        const itemColor = edit?.color ?? '#000000'

        if (isEditing) {
          return (
            <Fragment key={item.id}>
              <div
                style={{
                  position: 'absolute',
                  left: item.x * scale,
                  top: (item.y - 1) * scale,
                  width: Math.max(item.width, 4) * scale,
                  height: (item.height + 2) * scale,
                  background: 'white',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
              <div
                key={item.id}
                ref={(el) => {
                  editRef.current = el
                  if (el && document.activeElement !== el) {
                    const existing = textEdits.get(item.id)
                    el.textContent = existing ? existing.edited : item.text
                    el.focus()
                    const sel = window.getSelection()
                    const range = document.createRange()
                    range.selectNodeContents(el)
                    range.collapse(false)
                    sel?.removeAllRanges()
                    sel?.addRange(range)
                  }
                }}
                contentEditable
                suppressContentEditableWarning
                onBlur={handleEditBlur}
                onKeyDown={handleEditKeyDown}
                style={{
                  position: 'absolute',
                  left: item.x * scale,
                  top: item.y * scale,
                  fontSize: itemFontSize * scale,
                  fontFamily: fontName,
                  fontWeight: isItemBold ? 'bold' : 'normal',
                  fontStyle: isItemItalic ? 'italic' : 'normal',
                  color: itemColor,
                  background: 'white',
                  outline: '2px solid #10b981',
                  outlineOffset: '1px',
                  padding: '0 2px',
                  borderRadius: '2px',
                  minWidth: '30px',
                  caretColor: itemColor,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  zIndex: 20,
                  userSelect: 'text',
                  whiteSpace: 'pre',
                  lineHeight: 1,
                }}
              />
            </Fragment>
          )
        }

        if (editedText !== null) {
          const editEntry = textEdits.get(item.id)!
          const isSelected = selectedEditId === item.id

          return (
            <Fragment key={item.id}>
              <div
                style={{
                  position: 'absolute',
                  left: item.x * scale,
                  top: (item.y - 1) * scale,
                  width: Math.max(item.width, 4) * scale,
                  height: (item.height + 2) * scale,
                  background: 'white',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
              <span
                onMouseDown={(e) => startEditDrag(e, item)}
                onClick={(e) => {
                  e.stopPropagation()
                  if (isEditMode) setSelectedEditId(item.id)
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  if (isEditMode) {
                    setEditingTextItem(item)
                  }
                }}
                style={{
                  position: 'absolute',
                  left: editEntry.x * scale,
                  top: editEntry.y * scale,
                  fontSize: editEntry.fontSize * scale,
                  fontFamily: fontName,
                  fontWeight: editEntry.bold ? 'bold' : 'normal',
                  fontStyle: editEntry.italic ? 'italic' : 'normal',
                  lineHeight: 1,
                  whiteSpace: 'pre',
                  color: editEntry.color,
                  background: 'white',
                  display: 'inline-block',
                  zIndex: 2,
                  padding: '0 1px',
                  cursor: isEditMode ? 'move' : 'text',
                  outline: isSelected ? '1.5px dashed #10b981' : 'none',
                  userSelect: isEditMode ? 'none' : 'text',
                }}
              >
                {editedText}
              </span>
            </Fragment>
          )
        }

        // Standard selectable PDF text run with precise auto-scaled width
        return (
          <TextSpanItem
            key={item.id}
            item={item}
            scale={scale}
            isEditMode={isEditMode}
            isHovered={hoveredItemId === item.id}
            isSelected={selectedEditId === item.id}
            onSelect={() => setSelectedEditId(item.id)}
            onDoubleClick={() => {
              setSelectedEditId(item.id)
              setEditingTextItem(item)
            }}
            onMouseEnter={() => setHoveredItemId(item.id)}
            onMouseLeave={() => setHoveredItemId(null)}
          />
        )
      })}

      {/* Floating Text Selection Quick Actions Bar */}
      {selectionBox && !isEditMode && (
        <div
          className="absolute z-40 flex items-center gap-1.5 p-1.5 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl text-xs select-none animate-in fade-in zoom-in-95 pointer-events-auto"
          style={{
            left: Math.max(10, selectionBox.x),
            top: Math.max(10, selectionBox.y),
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleCopySelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-muted font-medium transition-colors text-foreground"
            title="Copy Text (Ctrl+C)"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-blue-500" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <span className="w-px h-4 bg-border/60" />

          {/* Quick Highlight Colors (Yellow, Green, Blue, Pink, Purple, Red) */}
          <div className="flex items-center gap-1 px-1">
            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-0.5 mr-0.5">
              <Highlighter className="w-3.5 h-3.5 text-amber-500" />
            </span>
            {[
              { label: 'Yellow', color: '#f59e0b' },
              { label: 'Green', color: '#10b981' },
              { label: 'Blue', color: '#3b82f6' },
              { label: 'Pink', color: '#ec4899' },
              { label: 'Purple', color: '#8b5cf6' },
              { label: 'Red', color: '#ef4444' },
            ].map((c) => (
              <button
                key={c.color}
                onClick={() => handleHighlightSelection(c.color)}
                className="w-4 h-4 rounded-full border border-border/40 transition-transform hover:scale-130 shadow-xs"
                style={{ backgroundColor: c.color }}
                title={`Highlight in ${c.label}`}
              />
            ))}
          </div>

          <span className="w-px h-4 bg-border/60" />

          <button
            onClick={handleAskAiAboutSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl hover:bg-muted font-medium transition-colors text-foreground"
            title="Ask AI about this text"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span>Ask AI</span>
          </button>
        </div>
      )}

      {/* Floating Sejda-style Inline Toolbar in Edit Mode */}
      {showToolbar && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute flex items-center gap-1.5 p-1 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-xl z-50 transition-all select-none text-foreground font-sans pointer-events-auto"
          style={{
            left: Math.max(10, activeX * scale),
            top: Math.max(10, activeY * scale - 46),
          }}
        >
          {/* Bold Button */}
          <button
            onClick={handleToggleBold}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm font-bold border border-transparent transition-colors hover:bg-muted ${
              isBold ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-600' : 'text-foreground'
            }`}
            title="Bold"
          >
            B
          </button>

          {/* Italic Button */}
          <button
            onClick={handleToggleItalic}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm italic border border-transparent transition-colors hover:bg-muted ${
              isItalic ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 text-emerald-600' : 'text-foreground'
            }`}
            title="Italic"
          >
            I
          </button>

          <span className="w-px h-5 bg-border/60" />

          {/* Font Size Selector */}
          <div className="relative flex items-center">
            <button
              onClick={() => {
                setShowSizeDropdown(!showSizeDropdown)
                setShowFontDropdown(false)
                setShowColorDropdown(false)
              }}
              className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-border/60 bg-background hover:bg-muted text-foreground font-medium"
              title="Font Size"
            >
              <span>{Math.round(editSize)}</span>
              <span className="text-[10px] text-muted-foreground">▼</span>
            </button>

            {showSizeDropdown && (
              <div className="absolute top-8 left-0 flex flex-col max-h-48 overflow-y-auto bg-background border border-border/80 shadow-lg rounded-md z-50 p-1 min-w-[70px]">
                <input
                  type="number"
                  value={Math.round(editSize)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 12
                    handleChangeFontSize(val)
                  }}
                  className="w-full text-xs px-1.5 py-1 border border-border rounded focus:outline-none focus:border-emerald-500 mb-1 bg-background text-foreground"
                  min="4"
                  max="120"
                />
                {[8, 9, 10, 11, 12, 14, 18, 24, 30, 36, 48, 60, 72].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      handleChangeFontSize(sz)
                      setShowSizeDropdown(false)
                    }}
                    className={`text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors ${
                      Math.round(editSize) === sz ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 font-semibold' : 'text-foreground'
                    }`}
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
                setShowFontDropdown(!showFontDropdown)
                setShowSizeDropdown(false)
                setShowColorDropdown(false)
              }}
              className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-border/60 bg-background hover:bg-muted text-foreground font-medium max-w-[150px] truncate"
              title="Font Family"
            >
              <span>{METRIC_FONTS[editFamilyKey]?.displayName.split(' ')[0] || 'Arial'}</span>
              <span className="text-[10px] text-muted-foreground">▼</span>
            </button>

            {showFontDropdown && (
              <div className="absolute top-8 left-0 flex flex-col bg-background border border-border/80 shadow-lg rounded-md z-50 p-1 min-w-[180px]">
                {Object.entries(METRIC_FONTS).map(([key, f]) => (
                  <button
                    key={key}
                    onClick={() => {
                      handleChangeFontFamily(key)
                      setShowFontDropdown(false)
                    }}
                    className={`text-left text-xs px-2.5 py-2 rounded hover:bg-muted transition-colors ${
                      editFamilyKey === key ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 font-semibold' : 'text-foreground'
                    }`}
                    style={{ fontFamily: f.cssName }}
                  >
                    {f.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-border/60" />

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColorDropdown(!showColorDropdown)
                setShowFontDropdown(false)
                setShowSizeDropdown(false)
              }}
              className="w-7 h-7 flex items-center justify-center rounded border border-border/60 bg-background hover:bg-muted"
              title="Text Color"
            >
              <span className="w-4 h-4 rounded-full border border-border" style={{ backgroundColor: editColor }} />
            </button>

            {showColorDropdown && (
              <div className="absolute top-8 left-0 bg-background border border-border/80 shadow-lg rounded-md z-50 p-2 min-w-[150px] flex flex-col gap-2">
                <div className="grid grid-cols-5 gap-1">
                  {['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#9ca3af', '#ffffff'].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        handleChangeColor(c)
                        setShowColorDropdown(false)
                      }}
                      className="w-5 h-5 rounded-full border border-border transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-border/60" />

          {/* Duplicate Button */}
          <button
            onClick={() => {
              if (activeItem) {
                if (activeEdit?.isDuplicate) {
                  duplicateTextEdit(activeEdit.original, activeEdit.edited)
                } else {
                  duplicateTextEdit(activeItem, activeEdit?.edited ?? activeItem.text)
                }
              }
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-emerald-600 hover:bg-muted transition-colors"
            title="Duplicate"
          >
            📋
          </button>

          {/* Delete Button */}
          <button
            onClick={() => {
              if (activeItem) {
                if (activeEdit?.isDuplicate) {
                  removeTextEdit(activeItem.id)
                  setSelectedEditId(null)
                } else {
                  if (activeEdit) {
                    updateTextEdit(activeItem.id, { edited: '' })
                  } else {
                    addTextEdit(activeItem.id, activeItem, '')
                  }
                }
              }
            }}
            className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete text"
          >
            🗑️
          </button>
        </div>
      )}
    </div>
  )
}
