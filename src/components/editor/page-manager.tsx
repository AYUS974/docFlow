'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  RotateCw, RotateCcw, Trash2, Copy, Scissors, FileDown,
  ChevronUp, ChevronDown, Plus, FileText, Crop,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { PDFDocument } from 'pdf-lib'

interface PageManagerProps {
  pdfDoc: any
  pdfBytesRef: React.MutableRefObject<Uint8Array | null>
  fileData: string | null
}

export function PageManager({ pdfDoc, pdfBytesRef, fileData }: PageManagerProps) {
  const {
    currentPage, setCurrentPage, totalPages,
    pageRotations, rotatePage, deletePage, reorderPages, pageOrder,
    currentDocument, annotations,
    insertBlankPage, duplicatePage,
  } = useAppStore()

  const [showExtract, setShowExtract] = useState(false)
  const [extractRange, setExtractRange] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleRotateCW = (pageNum: number) => rotatePage(pageNum, 90)
  const handleRotateCCW = (pageNum: number) => rotatePage(pageNum, -90)
  const handleDelete = (pageNum: number) => { if (totalPages <= 1) return; deletePage(pageNum) }
  const handleMoveUp = (index: number) => { if (index <= 0) return; reorderPages(index, index - 1) }
  const handleMoveDown = (index: number) => { if (index >= pageOrder.length - 1) return; reorderPages(index, index + 1) }

  const handleExtract = async () => {
    if (!fileData || !extractRange.trim()) return
    setIsProcessing(true)
    try {
      const base64 = fileData.split(',')[1] || fileData
      const res = await fetch('/api/pdf/split', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, ranges: [extractRange] }),
      })
      const { files } = await res.json()
      if (files.length > 0) {
        const blob = await (await fetch(files[0].data)).blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'extracted-pages.pdf'; a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) { console.error('Extract failed:', err) }
    finally { setIsProcessing(false); setShowExtract(false) }
  }

  const handleDownloadRotated = async () => {
    if (!pdfBytesRef.current) return
    setIsProcessing(true)
    try {
      const rotationsObj: Record<string, number> = {}
      for (const [k, v] of pageRotations) rotationsObj[String(k)] = v
      const base64 = btoa(String.fromCharCode(...pdfBytesRef.current))
      const res = await fetch('/api/pdf/rotate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: base64, rotations: rotationsObj }),
      })
      const { data } = await res.json()
      const a = document.createElement('a'); a.href = data; a.download = `${currentDocument?.fileName || 'document'}-modified.pdf`; a.click()
    } catch (err) { console.error('Download failed:', err) }
    finally { setIsProcessing(false) }
  }

  const displayPages = pageOrder.length > 0 ? pageOrder : Array.from({ length: totalPages }, (_, i) => i + 1)

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-border/40">
          <h3 className="text-sm font-semibold mb-2">Pages</h3>
          <div className="flex gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownloadRotated} disabled={isProcessing}>
                  <FileDown className="w-3.5 h-3.5" />
                </Button></TooltipTrigger><TooltipContent side="right" className="text-xs">Save with rotations</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowExtract(true)}>
                  <Scissors className="w-3.5 h-3.5" />
                </Button></TooltipTrigger><TooltipContent side="right" className="text-xs">Extract pages</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { insertBlankPage(currentPage) }} title="Insert blank page after current">
                  <Plus className="w-3.5 h-3.5" />
                </Button></TooltipTrigger><TooltipContent side="right" className="text-xs">Insert blank page</TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { duplicatePage(currentPage) }} title="Duplicate current page">
                  <Copy className="w-3.5 h-3.5" />
                </Button></TooltipTrigger><TooltipContent side="right" className="text-xs">Duplicate page</TooltipContent></Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <ScrollArea className="flex-1 py-2 px-2">
          <div className="space-y-1.5">
            {displayPages.map((pageNum, idx) => {
              const rotation = pageRotations.get(pageNum) || 0
              const isActive = currentPage === pageNum
              const pageAnnotCount = annotations.filter(a => a.pageNumber === pageNum).length
              return (
                <motion.div
                  key={pageNum} layout
                  className={`group flex items-center gap-1 p-1.5 rounded-lg border transition-all ${
                    isActive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:bg-muted/50'
                  }`}
                >
                  <button className="flex-1 flex items-center gap-2 min-w-0 text-left" onClick={() => setCurrentPage(pageNum)}>
                    <div
                      className={`w-10 h-12 rounded border flex items-center justify-center text-xs shrink-0 bg-white ${isActive ? 'border-emerald-400' : 'border-border'}`}
                      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
                    >
                      <span className="text-muted-foreground">{pageNum}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium">Page {pageNum}</div>
                      {pageAnnotCount > 0 && <div className="text-[10px] text-emerald-600">{pageAnnotCount} annot.</div>}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <TooltipProvider delayDuration={200}>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveUp(idx)} disabled={idx === 0}><ChevronUp className="w-3 h-3" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Move up</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveDown(idx)} disabled={idx === displayPages.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Move down</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRotateCCW(pageNum)}><RotateCcw className="w-3 h-3" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Rotate -90</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRotateCW(pageNum)}><RotateCw className="w-3 h-3" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Rotate +90</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => duplicatePage(pageNum)}><Copy className="w-3 h-3" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Duplicate</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDelete(pageNum)} disabled={totalPages <= 1}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                      </TooltipTrigger><TooltipContent side="right" className="text-xs">Delete</TooltipContent></Tooltip>
                    </TooltipProvider>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Extract Pages Dialog */}
      <Dialog open={showExtract} onOpenChange={setShowExtract}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Extract Pages</DialogTitle><DialogDescription>Enter page ranges to extract into a new PDF.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Page Ranges</label>
              <input type="text" value={extractRange} onChange={(e) => setExtractRange(e.target.value)} placeholder="e.g. 1-3, 5, 7-end" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated ranges. &quot;end&quot; means last page.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowExtract(false)}>Cancel</Button>
              <Button onClick={handleExtract} disabled={isProcessing || !extractRange.trim()} className="bg-emerald-600 hover:bg-emerald-700 text-white">{isProcessing ? 'Extracting...' : 'Extract'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
