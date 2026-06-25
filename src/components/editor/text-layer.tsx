'use client'
import { useEffect, useRef, useCallback, useState, Fragment } from 'react'
import { useAppStore, type PDFTextItem, groupTextItemsIntoLines, groupLinesIntoParagraphs, matchMetricFont, METRIC_FONTS } from '@/store/app-store'
import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'

const CSS_FONT_MAP: Record<string, string> = {
  'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif',
  'TimesRoman': '"Times New Roman", Times, Georgia, serif',
  'Courier': '"Courier New", Courier, "Lucida Console", monospace',
}
const FONT_LABELS: Record<string, string> = { Helvetica: 'Sans', TimesRoman: 'Serif', Courier: 'Mono' }

interface TextLayerProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null
  canvasEl: HTMLCanvasElement | null
  containerEl: HTMLDivElement | null
}

export function TextLayer({ pdfDoc, canvasEl, containerEl }: TextLayerProps) {
  const {
    currentPage, zoom, textItems, setTextItems,
    textLines, setTextLines,
    textParagraphs, setTextParagraphs,
    editingTextItem, setEditingTextItem,
    textEdits, addTextEdit, updateTextEdit, removeTextEdit, currentTool,
    duplicateTextEdit,
  } = useAppStore()

  const [editingValue, setEditingValue] = useState('')
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null)
  const [selectedEditId, setSelectedEditId] = useState<string | null>(null)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showSizeDropdown, setShowSizeDropdown] = useState(false)
  const [showColorDropdown, setShowColorDropdown] = useState(false)
  const editRef = useRef<HTMLDivElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  // Drag state for repositioning a committed edit ("pick & place").
  const dragRef = useRef<{ id: string; startCX: number; startCY: number; startX: number; startY: number; moved: boolean } | null>(null)

  // --- Inline toolbar handlers ---
  const activeItem = editingTextItem || (selectedEditId ? (textEdits.get(selectedEditId)?.original || textItems.find(i => i.id === selectedEditId)) : null)
  const activeEdit = activeItem ? textEdits.get(activeItem.id) : null
  const showToolbar = !!activeItem && currentTool === 'editText'

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

  // Extract text content when page changes
  const extractText = useCallback(async () => {
    if (!pdfDoc) return
    // Skip stale page numbers during a document swap (avoids "Invalid page request").
    if (currentPage < 1 || currentPage > pdfDoc.numPages) return
    try {
      const page = await pdfDoc.getPage(currentPage)
      const textContent = await page.getTextContent()
      // pdf.js exposes the real font family in `styles[fontName].fontFamily`
      // (item.fontName is just an internal id like "g_d0_f2").
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
          // Compute approximate char width for reflow
          const widthInChars = itemFontSize > 0 ? Math.round(width / (itemFontSize * 0.52)) : item.str.length

          return {
            id: `text-${currentPage}-${idx}`,
            text: item.str,
            str: item.str,
            x, y, width, height,
            fontSize: itemFontSize,
            fontFamily: fontName,
            pageNumber: currentPage,
            transform: tx,
            hasEOL: item.hasEOL || false,
            dir: item.dir || 'ltr',
            widthInChars,
            lineHeight: height * 1.2,
          }
        })

      // Sort by y then x for proper line grouping
      rawItems.sort((a, b) => Math.abs(a.y - b.y) < (a.height * 0.4) ? a.x - b.x : a.y - b.y)

      // Group into lines and paragraphs for reflow support
      const lines = groupTextItemsIntoLines(rawItems)
      const paragraphs = groupLinesIntoParagraphs(lines)

      // Assign line/paragraph indices back to items
      const indexedItems = rawItems.map(item => {
        const line = lines.find(l => l.items.some(li => li.id === item.id))
        const para = paragraphs.find(p => p.lines.some(pl => pl.items.some(li => li.id === item.id)))
        return {
          ...item,
          lineIndex: line ? lines.indexOf(line) : undefined,
          paragraphIndex: para ? paragraphs.indexOf(para) : undefined,
        }
      })

      setTextItems(indexedItems)
      setTextLines(lines)
      setTextParagraphs(paragraphs)
    } catch (err) {
      console.error('Text extraction failed:', err)
    }
  }, [pdfDoc, currentPage, setTextItems, setTextLines, setTextParagraphs])

  useEffect(() => { extractText() }, [extractText])

  // When user clicks a text item
  const handleTextClick = (item: PDFTextItem) => {
    if (currentTool !== 'editText') return
    setEditingTextItem(item)
    setEditingValue(item.text)
  }

  // Populate the editable box with the original text and focus it once editing
  // starts. The box is uncontrolled (browser-managed), so we read its value
  // from the DOM on commit — this is what was missing before.
  useEffect(() => {
    if (editingTextItem && editRef.current) {
      editRef.current.textContent = editingTextItem.text
      editRef.current.focus()
      // Place the caret at the end of the text.
      const sel = window.getSelection()
      const range = document.createRange()
      range.selectNodeContents(editRef.current)
      range.collapse(false)
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  }, [editingTextItem])

  // When user finishes editing — read the edited text straight from the DOM.
  const handleEditBlur = () => {
    const newText = (editRef.current?.textContent ?? editingValue).replace(/ /g, ' ')
    if (editingTextItem && newText !== editingTextItem.text) {
      addTextEdit(editingTextItem.id, editingTextItem, newText)
      // Select the new edit so the font popover (detected vs default) shows.
      setSelectedEditId(editingTextItem.id)
    }
    setEditingTextItem(null)
    setEditingValue('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleEditBlur()
    }
    if (e.key === 'Escape') {
      setEditingTextItem(null)
      setEditingValue('')
    }
  }

  const scale = zoom * 1.5
  const isEditMode = currentTool === 'editText'

  const getEditedText = (itemId: string) => {
    const edit = textEdits.get(itemId)
    return edit ? edit.edited : null
  }

  // --- Pick & place: drag a committed edit to any position ---
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
  const endEditDrag = () => { dragRef.current = null }

  if (!canvasEl || !pdfDoc) return null

  return (
    <div
      ref={layerRef}
      className="absolute top-0 left-0 w-full h-full"
      style={{
        pointerEvents: isEditMode ? 'auto' : 'none',
        zIndex: isEditMode ? 5 : 1,
      }}
      onMouseMove={handleLayerMouseMove}
      onMouseUp={endEditDrag}
      onMouseLeave={endEditDrag}
      onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedEditId(null) }}
    >
      {textItems.map((item) => {
        const editedText = getEditedText(item.id)
        const isEditing = editingTextItem?.id === item.id
        
        const edit = textEdits.get(item.id)
        const editFamilyKey = edit?.fontFamily ?? matchMetricFont(item.fontFamily)
        const fontName = METRIC_FONTS[editFamilyKey]?.cssName || 'Arimo'
        const itemFontSize = edit?.fontSize ?? item.fontSize
        const isBold = edit ? edit.bold : (item.fontFamily.toLowerCase().includes('bold'))
        const isItalic = edit ? edit.italic : (item.fontFamily.toLowerCase().includes('italic') || item.fontFamily.toLowerCase().includes('oblique'))
        const itemColor = edit?.color ?? '#000000'

        const fontStyle: React.CSSProperties = {
          position: 'absolute',
          left: (edit?.x ?? item.x) * scale,
          top: (edit?.y ?? item.y) * scale,
          fontSize: itemFontSize * scale,
          fontFamily: fontName,
          fontWeight: isBold ? 'bold' : 'normal',
          fontStyle: isItalic ? 'italic' : 'normal',
          color: 'transparent',
          cursor: isEditMode ? 'text' : 'default',
          whiteSpace: 'pre',
          lineHeight: `${item.height / item.fontSize}`,
          minWidth: '1px',
          minHeight: '1px',
        }

        if (isEditing) {
          return (
            <div
              key={item.id}
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditingValue(e.currentTarget.textContent || '')}
              onBlur={handleEditBlur}
              onKeyDown={handleEditKeyDown}
              style={{
                ...fontStyle,
                color: itemColor,
                background: 'rgba(255,255,255,0.92)',
                outline: '2px solid #10b981',
                outlineOffset: '1px',
                padding: '0 2px',
                borderRadius: '2px',
                minWidth: '30px',
                caretColor: itemColor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                zIndex: 10,
              }}
            />
          )
        }

        if (editedText !== null) {
          const edit = textEdits.get(item.id)!
          const ex = edit.x
          const ey = edit.y
          const isSelected = selectedEditId === item.id
          
          return (
            <Fragment key={item.id}>
              {/* Stationary white mask over the ORIGINAL glyphs */}
              <div style={{
                position: 'absolute',
                left: item.x * scale, top: (item.y - 1) * scale,
                width: Math.max(item.width, 4) * scale, height: (item.height + 2) * scale,
                background: 'white', zIndex: 1, pointerEvents: 'none',
              }} />
              {/* The edited text */}
              <span
                onMouseDown={(e) => startEditDrag(e, item)}
                onClick={(e) => { e.stopPropagation(); if (isEditMode) setSelectedEditId(item.id) }}
                style={{
                  position: 'absolute',
                  left: ex * scale, top: ey * scale,
                  fontSize: edit.fontSize * scale,
                  fontFamily: fontName,
                  fontWeight: edit.bold ? 'bold' : 'normal',
                  fontStyle: edit.italic ? 'italic' : 'normal',
                  lineHeight: `${item.height / item.fontSize}`,
                  whiteSpace: 'pre',
                  color: edit.color, background: 'white',
                  display: 'inline-block', zIndex: 2,
                  padding: '0 1px',
                  cursor: isEditMode ? 'move' : 'default',
                  outline: isSelected ? '1px dashed #10b981' : 'none',
                  userSelect: 'none',
                }}
              >{editedText}</span>
            </Fragment>
          )
        }

        // Non-editing: transparent but clickable hitbox
        const isHovered = hoveredItemId === item.id
        return (
          <span
            key={item.id}
            onClick={() => handleTextClick(item)}
            style={{
              ...fontStyle,
              display: 'inline-block',
              border: isEditMode 
                ? (isHovered ? '1px dashed rgba(16,185,129,0.6)' : '1px dashed rgba(16,185,129,0.25)') 
                : 'none',
              background: isEditMode && isHovered ? 'rgba(16,185,129,0.08)' : 'transparent',
              borderRadius: '2px',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={() => {
              if (isEditMode) {
                setHoveredItemId(item.id)
              }
            }}
            onMouseLeave={() => {
              if (isEditMode) {
                setHoveredItemId(null)
              }
            }}
          >
            {item.text}
          </span>
        )
      })}

      {/* Render duplicate text edits */}
      {Array.from(textEdits.entries()).map(([id, edit]) => {
        if (!edit.isDuplicate) return null
        const isEditing = editingTextItem?.id === id
        const fontName = METRIC_FONTS[edit.fontFamily]?.cssName || 'Arimo'
        const isSelected = selectedEditId === id

        const fontStyle: React.CSSProperties = {
          position: 'absolute',
          left: edit.x * scale,
          top: edit.y * scale,
          fontSize: edit.fontSize * scale,
          fontFamily: fontName,
          fontWeight: edit.bold ? 'bold' : 'normal',
          fontStyle: edit.italic ? 'italic' : 'normal',
          color: edit.color,
          whiteSpace: 'pre',
          lineHeight: '1.2',
          minWidth: '1px',
          minHeight: '1px',
        }

        if (isEditing) {
          return (
            <div
              key={id}
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditingValue(e.currentTarget.textContent || '')}
              onBlur={handleEditBlur}
              onKeyDown={handleEditKeyDown}
              style={{
                ...fontStyle,
                background: 'rgba(255,255,255,0.92)',
                outline: '2px solid #10b981',
                outlineOffset: '1px',
                padding: '0 2px',
                borderRadius: '2px',
                minWidth: '30px',
                caretColor: edit.color,
                boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                zIndex: 10,
              }}
            />
          )
        }

        return (
          <span
            key={id}
            onMouseDown={(e) => {
              if (!isEditMode) return
              e.preventDefault()
              e.stopPropagation()
              setSelectedEditId(id)
              dragRef.current = { id, startCX: e.clientX, startCY: e.clientY, startX: edit.x, startY: edit.y, moved: false }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (isEditMode) {
                if (selectedEditId === id) {
                  setEditingTextItem(edit.original)
                  setEditingValue(edit.edited)
                } else {
                  setSelectedEditId(id)
                }
              }
            }}
            style={{
              ...fontStyle,
              background: 'white',
              display: 'inline-block',
              zIndex: 2,
              padding: '0 1px',
              cursor: isEditMode ? 'move' : 'default',
              outline: isSelected ? '1px dashed #10b981' : 'none',
              userSelect: 'none',
            }}
          >
            {edit.edited}
          </span>
        )
      })}

      {/* Floating Sejda-style Inline Toolbar */}
      {showToolbar && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute flex items-center gap-1.5 p-1 bg-white border border-slate-200 shadow-xl rounded-lg z-50 transition-all select-none"
          style={{
            left: Math.max(10, activeX * scale),
            top: activeY * scale - 46,
          }}
        >
          {/* Bold Button */}
          <button
            onClick={handleToggleBold}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm font-bold border border-transparent transition-colors hover:bg-slate-100 ${isBold ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'text-slate-700'}`}
            title="Bold"
          >
            B
          </button>
          
          {/* Italic Button */}
          <button
            onClick={handleToggleItalic}
            className={`w-7 h-7 flex items-center justify-center rounded text-sm italic border border-transparent transition-colors hover:bg-slate-100 ${isItalic ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'text-slate-700'}`}
            title="Italic"
          >
            I
          </button>

          <span className="w-px h-5 bg-slate-200" />

          {/* Font Size Selector */}
          <div className="relative flex items-center">
            <button
              onClick={() => {
                setShowSizeDropdown(!showSizeDropdown)
                setShowFontDropdown(false)
                setShowColorDropdown(false)
              }}
              className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium"
              title="Font Size"
            >
              <span>{Math.round(editSize)}</span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>
            
            {showSizeDropdown && (
              <div className="absolute top-8 left-0 flex flex-col max-h-48 overflow-y-auto bg-white border border-slate-200 shadow-lg rounded-md z-50 p-1 min-w-[70px]">
                <input
                  type="number"
                  value={Math.round(editSize)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 12
                    handleChangeFontSize(val)
                  }}
                  className="w-full text-xs px-1.5 py-1 border border-slate-200 rounded focus:outline-none focus:border-emerald-500 mb-1"
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
                    className={`text-left text-xs px-2 py-1.5 rounded hover:bg-slate-100 transition-colors ${Math.round(editSize) === sz ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-700'}`}
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
              className="h-7 px-2 flex items-center gap-1 rounded text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium max-w-[150px] truncate"
              title="Font Family"
            >
              <span>{METRIC_FONTS[editFamilyKey]?.displayName.split(' ')[0] || 'Arial'}</span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>
            
            {showFontDropdown && (
              <div className="absolute top-8 left-0 flex flex-col bg-white border border-slate-200 shadow-lg rounded-md z-50 p-1 min-w-[180px]">
                {Object.entries(METRIC_FONTS).map(([key, f]) => (
                  <button
                    key={key}
                    onClick={() => {
                      handleChangeFontFamily(key)
                      setShowFontDropdown(false)
                    }}
                    className={`text-left text-xs px-2.5 py-2 rounded hover:bg-slate-100 transition-colors ${editFamilyKey === key ? 'bg-emerald-50 text-emerald-600 font-semibold' : 'text-slate-700'}`}
                    style={{ fontFamily: f.cssName }}
                  >
                    {f.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-slate-200" />

          {/* Color Picker */}
          <div className="relative">
            <button
              onClick={() => {
                setShowColorDropdown(!showColorDropdown)
                setShowFontDropdown(false)
                setShowSizeDropdown(false)
              }}
              className="w-7 h-7 flex items-center justify-center rounded border border-slate-200 bg-white hover:bg-slate-50"
              title="Text Color"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-300"
                style={{ backgroundColor: editColor }}
              />
            </button>
            
            {showColorDropdown && (
              <div className="absolute top-8 left-0 bg-white border border-slate-200 shadow-lg rounded-md z-50 p-2 min-w-[150px] flex flex-col gap-2">
                <div className="grid grid-cols-5 gap-1">
                  {['#000000', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#9ca3af', '#ffffff'].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        handleChangeColor(c)
                        setShowColorDropdown(false)
                      }}
                      className="w-5 h-5 rounded-full border border-slate-300 transition-transform hover:scale-110"
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-1 border-t border-slate-100 pt-1.5">
                  <span className="text-[10px] text-slate-400 font-bold">#</span>
                  <input
                    type="text"
                    value={editColor.replace('#', '')}
                    onChange={(e) => {
                      const hex = e.target.value.substring(0, 6)
                      handleChangeColor(`#${hex}`)
                    }}
                    placeholder="000000"
                    className="w-18 text-[11px] px-1 py-0.5 border border-slate-200 rounded focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          <span className="w-px h-5 bg-slate-200" />

          {/* Link Indicator (Placeholder Icon) */}
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-slate-600 transition-colors"
            title="Link (Visual indicator)"
          >
            🔗
          </button>

          {/* Move Indicator */}
          <button
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 cursor-move"
            title="Drag text to move"
          >
            ✥
          </button>

          <span className="w-px h-5 bg-slate-200" />

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
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
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
            className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete text"
          >
            🗑️
          </button>

          {/* Revert Button */}
          {!activeEdit?.isDuplicate && activeEdit && (
            <button
              onClick={() => {
                if (activeItem) {
                  removeTextEdit(activeItem.id)
                  setSelectedEditId(null)
                }
              }}
              className="w-7 h-7 flex items-center justify-center rounded text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors font-semibold"
              title="Revert to original PDF text"
            >
              ↺
            </button>
          )}
        </div>
      )}

      {/* Line boundaries visualization in edit mode (debug toggle) */}
      {isEditMode && textLines.length > 0 && (
        <div className="pointer-events-none absolute inset-0" style={{ zIndex: -1 }}>
          {textLines.map((line, i) => (
            <div
              key={`line-${i}`}
              className="border-l-2 border-emerald-300/30"
              style={{
                position: 'absolute',
                left: line.x * scale,
                top: line.y * scale,
                width: line.width * scale,
                height: line.height * scale,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
