'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore, type PDFDocumentInfo } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileText,
  Plus,
  Trash2,
  Clock,
  HardDrive,
  Search,
  FileUp,
  X,
  FolderOpen,
  Sparkles,
  FilePlus,
  Scissors,
  FileDown,
  FileText as FileTextIcon,
  Loader2,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'

export function Dashboard() {
  const {
    documents, setDocuments, addDocument, removeDocument,
    setCurrentDocument, setView, setAnnotations,
    isLoggedIn, login,
  } = useAppStore()
  const [search, setSearch] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isLoadingDocs, setIsLoadingDocs] = useState(true)
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showSplitDialog, setShowSplitDialog] = useState(false)
  const [showCompressDialog, setShowCompressDialog] = useState(false)
  const [showExtractDialog, setShowExtractDialog] = useState(false)
  const [showWatermarkDialog, setShowWatermarkDialog] = useState(false)
  const [showPageNumDialog, setShowPageNumDialog] = useState(false)
  const [showConvertDialog, setShowConvertDialog] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set())
  const [splitRange, setSplitRange] = useState('')
  const [processingResult, setProcessingResult] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [wmText, setWmText] = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(0.15)
  const [wmAngle, setWmAngle] = useState(-45)
  const [convertFormat, setConvertFormat] = useState('txt')

  // Fetch saved documents from server on mount
  const fetchSavedDocuments = useCallback(async () => {
    try {
      setIsLoadingDocs(true)
      const res = await fetch('/api/documents')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          const loadedDocs: PDFDocumentInfo[] = data.map((d: any) => ({
            id: d.id,
            title: d.title || d.fileName?.replace(/\.pdf$/i, '') || 'Untitled Document',
            fileName: d.fileName || 'document.pdf',
            fileSize: d.fileSize || 0,
            pageCount: d.pageCount || 1,
            fileData: d.data ? (d.data.startsWith('data:') ? d.data : `data:application/pdf;base64,${d.data}`) : '',
            uploadedAt: d.createdAt || new Date().toISOString(),
          }))
          setDocuments(loadedDocs)
        }
      }
    } catch (err) {
      console.error('Failed to load documents from server:', err)
    } finally {
      setIsLoadingDocs(false)
    }
  }, [setDocuments])

  useEffect(() => {
    fetchSavedDocuments()
  }, [fetchSavedDocuments])

  const handleOpenDocument = useCallback(async (doc: PDFDocumentInfo) => {
    // If fileData is already in memory
    if (doc.fileData && doc.fileData.length > 50) {
      setCurrentDocument(doc)
      setAnnotations([])
      setView('editor')
      return
    }

    // Otherwise fetch the full payload
    setLoadingDocId(doc.id || '')
    try {
      const res = await fetch(`/api/documents/${doc.id}`)
      if (res.ok) {
        const fullDoc = await res.json()
        const dataUrl = fullDoc.data?.startsWith('data:')
          ? fullDoc.data
          : `data:application/pdf;base64,${fullDoc.data}`

        const fullDocInfo: PDFDocumentInfo = {
          ...doc,
          fileData: dataUrl,
          pageCount: fullDoc.pageCount || doc.pageCount,
        }

        // Cache file data in store
        setDocuments(documents.map((d) => (d.id === doc.id ? fullDocInfo : d)))

        if (Array.isArray(fullDoc.annotations)) {
          setAnnotations(fullDoc.annotations)
        } else {
          setAnnotations([])
        }

        setCurrentDocument(fullDocInfo)
        setView('editor')
      } else {
        console.error('Failed to fetch full document payload')
      }
    } catch (err) {
      console.error('Error opening document:', err)
    } finally {
      setLoadingDocId(null)
    }
  }, [documents, setDocuments, setCurrentDocument, setAnnotations, setView])

  const getDocBase64 = useCallback(async (doc?: PDFDocumentInfo): Promise<string> => {
    if (!doc) return ''
    if (doc.fileData && doc.fileData.length > 50) {
      return doc.fileData.split(',')[1] || ''
    }
    if (!doc.id) return ''
    try {
      const res = await fetch(`/api/documents/${doc.id}`)
      if (res.ok) {
        const fullDoc = await res.json()
        return fullDoc.data?.replace(/^data:application\/pdf;base64,/, '') || ''
      }
    } catch (e) {
      console.error('Failed to get doc payload:', e)
    }
    return ''
  }, [])

  const filteredDocs = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.fileName.toLowerCase().includes(search.toLowerCase())
  )

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') return
    setUploading(true)
    try {
      const arrayBuffer = await file.arrayBuffer()
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )
      const dataUrl = `data:application/pdf;base64,${base64}`

      // Get page count using pdf.js
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
      const uint8 = new Uint8Array(arrayBuffer)
      const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise

      const doc: PDFDocumentInfo = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.pdf$/i, ''),
        fileName: file.name,
        fileSize: file.size,
        pageCount: pdf.numPages,
        fileData: dataUrl,
        uploadedAt: new Date().toISOString(),
      }

      addDocument(doc)

      // Save to DB
      try {
        const saveRes = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: doc.title,
            fileName: doc.fileName,
            fileSize: doc.fileSize,
            pageCount: doc.pageCount,
            data: base64,
          }),
        })
        if (saveRes.ok) {
          const saved = await saveRes.json()
          if (saved?.id) {
            doc.id = saved.id
          }
        }
      } catch (e) {
        console.warn('Could not save to DB:', e)
      }

      setAnnotations([])
      setCurrentDocument(doc)
      setView('editor')
    } catch (err) {
      console.error('Failed to process file:', err)
    } finally {
      setUploading(false)
    }
  }, [addDocument, setCurrentDocument, setView, setAnnotations])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }, [processFile])

  const handleDelete = async (id: string) => {
    removeDocument(id)
    try {
      await fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
    } catch { /* ignore */ }
  }

  const loadSamplePdf = async () => {
    setUploading(true)
    try {
      const res = await fetch('/api/sample-pdf')
      const { data, pageCount } = await res.json()
      const doc: PDFDocumentInfo = {
        id: crypto.randomUUID(),
        title: 'DocFlow Sample Document',
        fileName: 'sample-document.pdf',
        fileSize: 0,
        pageCount: pageCount || 3,
        fileData: data,
        uploadedAt: new Date().toISOString(),
      }
      addDocument(doc)
      setAnnotations([])
      setCurrentDocument(doc)
      setView('editor')
    } catch (err) {
      console.error('Failed to load sample PDF:', err)
    } finally {
      setUploading(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return d.toLocaleDateString()
  }

  // If not logged in, show login prompt
  if (!isLoggedIn) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
            <FileText className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Welcome to DocFlow</h2>
          <p className="text-muted-foreground mb-8">
            Sign in to access your dashboard, upload documents, and start editing PDFs with powerful annotation tools.
          </p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8"
            onClick={() => login('Demo User', 'demo@docflow.io')}
          >
            Sign In to Get Started
          </Button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My Documents</h1>
          <p className="text-muted-foreground mt-1">
            Upload and manage your PDF files
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl border border-border/60 hover:bg-muted"
            onClick={fetchSavedDocuments}
            disabled={isLoadingDocs}
            title="Refresh documents"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingDocs ? 'animate-spin text-emerald-600' : ''}`} />
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={loadSamplePdf}
          >
            <Sparkles className="w-4 h-4" />
            Try Sample
          </Button>
          <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 rounded-xl">
              <Upload className="w-4 h-4" />
              Upload PDF
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload PDF Document</DialogTitle>
            </DialogHeader>
            <div
              className={`border-2 border-dashed rounded-2xl p-10 text-center transition-colors ${
                isDragOver
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-border hover:border-emerald-300'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
            >
              <FileUp className={`w-12 h-12 mx-auto mb-4 ${isDragOver ? 'text-emerald-600' : 'text-muted-foreground/50'}`} />
              <p className="text-sm font-medium mb-1">
                {isDragOver ? 'Drop your file here' : 'Drag & drop your PDF here'}
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                or click to browse files
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm rounded-lg transition-colors">
                  <Plus className="w-4 h-4" />
                  Choose File
                </span>
              </label>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </motion.div>

      {/* Search + Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-4 mb-6"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-10 rounded-xl"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2"
              onClick={() => setSearch('')}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground shrink-0">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>{documents.length} docs</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="w-4 h-4" />
            <span>{formatSize(documents.reduce((acc, d) => acc + d.fileSize, 0))}</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Tools */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: FilePlus, label: 'Merge PDFs', desc: 'Combine multiple files', action: () => { setSelectedForMerge(new Set()); setShowMergeDialog(true) }, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' },
          { icon: Scissors, label: 'Split PDF', desc: 'Extract page ranges', action: () => setShowSplitDialog(true), color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' },
          { icon: FileDown, label: 'Compress', desc: 'Reduce file size', action: () => setShowCompressDialog(true), color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600' },
          { icon: FileTextIcon, label: 'Extract Text', desc: 'Copy text from PDF', action: () => setShowExtractDialog(true), color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600' },
        ].map((tool) => (
          <button key={tool.label} onClick={tool.action} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:shadow-md hover:-translate-y-0.5 transition-all text-left bg-background">
            <div className={`w-10 h-10 rounded-lg ${tool.color} flex items-center justify-center shrink-0`}>
              <tool.icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{tool.label}</div>
              <div className="text-xs text-muted-foreground">{tool.desc}</div>
            </div>
          </button>
        ))}
      </motion.div>

      {/* Loading overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Processing PDF...</p>
          </div>
        </div>
      )}

      {/* Documents Grid */}
      {isLoadingDocs ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 py-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl border border-border/60 overflow-hidden animate-pulse">
              <div className="h-40 bg-muted/60" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted/80 rounded w-3/4" />
                <div className="h-3 bg-muted/50 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredDocs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <div
            className={`border-2 border-dashed rounded-3xl p-16 transition-colors mx-auto max-w-lg ${
              isDragOver
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-border hover:border-emerald-300'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <FolderOpen className={`w-16 h-16 mx-auto mb-4 ${isDragOver ? 'text-emerald-600' : 'text-muted-foreground/30'}`} />
            <h3 className="text-lg font-semibold mb-2">
              {search ? 'No documents found' : 'No documents yet'}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search
                ? 'Try a different search term'
                : 'Upload your first PDF to get started with editing and annotations'}
            </p>
            {!search && (
              <label className="cursor-pointer">
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileInput} />
                <span className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors">
                  <Plus className="w-5 h-5" />
                  Upload Your First PDF
                </span>
              </label>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filteredDocs.map((doc) => (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Card className="group hover:shadow-lg hover:shadow-emerald-600/5 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer border-border/60 overflow-hidden">
                  {/* PDF Preview */}
                  <div
                    className="h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center relative"
                    onClick={() => handleOpenDocument(doc)}
                  >
                    {loadingDocId === doc.id ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                        <span className="text-xs text-muted-foreground font-medium">Opening...</span>
                      </div>
                    ) : (
                      <>
                        <FileText className="w-16 h-16 text-muted-foreground/20 group-hover:text-emerald-600/30 transition-colors" />
                        <Badge className="absolute top-3 right-3 bg-background/80 text-foreground border-border/50 text-xs">
                          {doc.pageCount} {doc.pageCount === 1 ? 'page' : 'pages'}
                        </Badge>
                      </>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => handleOpenDocument(doc)}
                      >
                        <h3 className="font-semibold text-sm truncate group-hover:text-emerald-600 transition-colors">{doc.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id!) }}
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{formatSize(doc.fileSize)}</span>
                      {doc.uploadedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(doc.uploadedAt)}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Merge PDFs</DialogTitle><DialogDescription>Select 2 or more documents to merge into one.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No documents available. Upload some PDFs first.</p>
              ) : documents.map((doc) => (
                <label key={doc.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${selectedForMerge.has(doc.id!) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-border hover:bg-muted/50'}`}>
                  <input type="checkbox" checked={selectedForMerge.has(doc.id!)} onChange={(e) => {
                    const next = new Set(selectedForMerge)
                    if (e.target.checked) { next.add(doc.id!) } else { next.delete(doc.id!) }
                    setSelectedForMerge(next)
                  }} className="rounded" />
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{doc.title}</div>
                    <div className="text-xs text-muted-foreground">{doc.pageCount} pages</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{selectedForMerge.size} selected</span>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowMergeDialog(false)}>Cancel</Button>
                <Button disabled={selectedForMerge.size < 2 || isProcessing} onClick={async () => {
                  setIsProcessing(true)
                  try {
                    const selectedDocs = documents.filter(d => selectedForMerge.has(d.id!))
                    const files = (await Promise.all(selectedDocs.map(d => getDocBase64(d)))).filter(Boolean)
                    const res = await fetch('/api/pdf/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })
                    const data = await res.json()
                    const a = document.createElement('a')
                    a.href = data.data; a.download = 'merged.pdf'; a.click()
                    setShowMergeDialog(false)
                  } catch (err) { console.error(err) }
                  finally { setIsProcessing(false) }
                }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus className="w-4 h-4" />}
                  Merge
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Split Dialog */}
      <Dialog open={showSplitDialog} onOpenChange={setShowSplitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Split PDF</DialogTitle><DialogDescription>Enter page ranges to extract.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Select a document first from the grid, then enter ranges</label>
              <input type="text" value={splitRange} onChange={(e) => setSplitRange(e.target.value)} placeholder="e.g. 1-3, 5, 7-end" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated ranges. Use &quot;end&quot; for the last page.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSplitDialog(false)}>Cancel</Button>
              <Button disabled={!splitRange.trim() || isProcessing} onClick={async () => {
                setIsProcessing(true)
                try {
                  const base64 = await getDocBase64(documents[0])
                  if (!base64) return
                  const res = await fetch('/api/pdf/split', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64, ranges: splitRange.split(';').map(s => s.trim()) }) })
                  const { files } = await res.json()
                  files.forEach((f: any, i: number) => { const a = document.createElement('a'); a.href = f.data; a.download = `split-${i + 1}.pdf`; a.click() })
                  setShowSplitDialog(false)
                } catch (err) { console.error(err) }
                finally { setIsProcessing(false) }
              }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                Split
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compress Dialog */}
      <Dialog open={showCompressDialog} onOpenChange={setShowCompressDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Compress PDF</DialogTitle><DialogDescription>Reduce file size while preserving quality.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {processingResult ? (
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <div className="text-3xl font-bold text-emerald-600">-{processingResult.reduction}%</div>
                <div className="text-sm text-muted-foreground mt-1">Size reduced</div>
                <div className="flex justify-center gap-6 mt-3 text-xs">
                  <div><span className="text-muted-foreground">Original: </span><span className="font-medium">{(processingResult.originalSize / 1024).toFixed(1)} KB</span></div>
                  <div><span className="text-muted-foreground">Compressed: </span><span className="font-medium text-emerald-600">{(processingResult.compressedSize / 1024).toFixed(1)} KB</span></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Select the most recent document to compress.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowCompressDialog(false); setProcessingResult(null) }}>Cancel</Button>
              <Button disabled={isProcessing} onClick={async () => {
                setIsProcessing(true); setProcessingResult(null)
                try {
                  const base64 = await getDocBase64(documents[0])
                  if (!base64) return
                  const res = await fetch('/api/pdf/compress', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64 }) })
                  setProcessingResult(await res.json())
                  // Auto download
                  const a = document.createElement('a')
                  a.href = processingResult?.data; a.download = 'compressed.pdf'; a.click()
                } catch (err) { console.error(err) }
                finally { setIsProcessing(false) }
              }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                Compress
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extract Text Dialog */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh]">
          <DialogHeader><DialogTitle>Extract Text</DialogTitle><DialogDescription>Copy text content from your PDF.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            {isProcessing ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
            ) : processingResult ? (
              <div>
                <div className="text-xs text-muted-foreground mb-2">{processingResult.totalChars} characters extracted across {processingResult.pages.length} pages</div>
                <ScrollArea className="h-64 rounded-lg border">
                  <div className="p-3 space-y-3">
                    {processingResult.pages.map((p: any) => (
                      <div key={p.pageNumber}>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Page {p.pageNumber}</div>
                        <p className="text-sm whitespace-pre-wrap">{p.text || '(no text content)'}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button variant="outline" className="mt-2 w-full gap-2" onClick={() => {
                  const text = processingResult.pages.map((p: any) => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n')
                  navigator.clipboard.writeText(text)
                }}>
                  <Copy className="w-4 h-4" /> Copy All Text
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">Click Extract to pull text from the most recent document.</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setShowExtractDialog(false); setProcessingResult(null) }}>Close</Button>
              <Button disabled={isProcessing} onClick={async () => {
                setIsProcessing(true); setProcessingResult(null)
                try {
                  const base64 = await getDocBase64(documents[0])
                  if (!base64) return
                  const res = await fetch('/api/pdf/extract-text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: base64 }) })
                  setProcessingResult(await res.json())
                } catch (err) { console.error(err) }
                finally { setIsProcessing(false) }
              }} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileTextIcon className="w-4 h-4" />}
                Extract
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Global drag overlay */}
      <AnimatePresence>
        {isDragOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-emerald-600/10 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="bg-background rounded-3xl p-12 shadow-2xl text-center">
              <FileUp className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <p className="text-xl font-semibold">Drop your PDF here</p>
              <p className="text-sm text-muted-foreground mt-1">Release to upload</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}