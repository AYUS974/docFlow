'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pen, Type, Upload, Trash2, Check, X, Save, Star } from 'lucide-react'

export function SignaturePad() {
  const {
    showSignaturePad, setShowSignaturePad,
    signatureData, setSignatureData,
    signatureType, setSignatureType,
    signatureText, setSignatureText,
    addSavedSignature, savedSignatures, setSignatureData: setActiveSignature,
  } = useAppStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [lastPoint, setLastPoint] = useState<{ x: number; y: number } | null>(null)
  const [previewData, setPreviewData] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSaved, setShowSaved] = useState(false)

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) { clientX = e.touches[0]?.clientX || 0; clientY = e.touches[0]?.clientY || 0 }
    else { clientX = e.clientX; clientY = e.clientY }
    return { x: (clientX - rect.left) * (canvas.width / rect.width), y: (clientY - rect.top) * (canvas.height / rect.height) }
  }

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => { e.preventDefault(); setIsDrawing(true); setLastPoint(getCanvasPoint(e)) }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPoint) return; e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!; const pt = getCanvasPoint(e)
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(lastPoint.x, lastPoint.y); ctx.lineTo(pt.x, pt.y); ctx.stroke()
    setLastPoint(pt)
  }
  const stopDrawing = () => { setIsDrawing(false); setLastPoint(null); if (canvasRef.current) setPreviewData(canvasRef.current.toDataURL('image/png')) }
  const clearCanvas = () => { const canvas = canvasRef.current; if (!canvas) return; canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height); setPreviewData(null) }

  useEffect(() => {
    if (signatureType !== 'type') return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!; ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!signatureText.trim()) { setPreviewData(null); return }
    ctx.font = '36px "Georgia", "Times New Roman", cursive, serif'; ctx.fillStyle = '#1a1a1a'; ctx.textBaseline = 'middle'
    ctx.fillText(signatureText, 20, canvas.height / 2); setPreviewData(canvas.toDataURL('image/png'))
  }, [signatureText, signatureType])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setPreviewData(ev.target?.result as string); setSignatureType('image') }
    reader.readAsDataURL(file); e.target.value = ''
  }

  const applySignature = () => {
    if (!previewData) return
    setSignatureData(previewData)
 // Save to saved signatures
    addSavedSignature({ id: crypto.randomUUID(), data: previewData, type: signatureType || 'draw', createdAt: new Date().toISOString() })
    setShowSignaturePad(false)
  }

  const useSavedSignature = (data: string) => {
    setSignatureData(data); setShowSignaturePad(false)
  }

  useEffect(() => { if (showSignaturePad && !signatureType) setSignatureType('draw') }, [showSignaturePad, signatureType, setSignatureType])

  return (
    <Dialog open={showSignaturePad} onOpenChange={(open) => { if (!open) { setShowSignaturePad(false); clearCanvas() } }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Your Signature</DialogTitle>
          <DialogDescription>Draw, type, or upload your signature to place on the document.</DialogDescription>
        </DialogHeader>

        {/* Saved signatures */}
        {savedSignatures.length > 0 && (
          <div>
            <button onClick={() => setShowSaved(!showSaved)} className="text-xs text-emerald-600 hover:underline flex items-center gap-1 mb-2">
              <Star className="w-3 h-3" /> {showSaved ? 'Hide' : 'Show'} saved signatures ({savedSignatures.length})
            </button>
            {showSaved && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {savedSignatures.map((sig) => (
                  <button key={sig.id} onClick={() => useSavedSignature(sig.data)} className="shrink-0 border-2 border-transparent hover:border-emerald-500 rounded-lg p-1 transition-colors" title={sig.type}>
                    <img src={sig.data} alt="Saved signature" className="h-10" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Tabs value={signatureType || 'draw'} onValueChange={(v) => { setSignatureType(v as 'draw' | 'type' | 'image'); clearCanvas() }}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="draw" className="gap-2"><Pen className="w-4 h-4" /> Draw</TabsTrigger>
            <TabsTrigger value="type" className="gap-2"><Type className="w-4 h-4" /> Type</TabsTrigger>
            <TabsTrigger value="image" className="gap-2"><Upload className="w-4 h-4" /> Upload</TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white">
              <canvas ref={canvasRef} width={500} height={180} className="w-full cursor-crosshair touch-none"
                onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
            </div>
            <div className="flex justify-end mt-3">
              <Button variant="ghost" size="sm" onClick={clearCanvas} className="gap-1"><Trash2 className="w-4 h-4" /> Clear</Button>
            </div>
          </TabsContent>

          <TabsContent value="type">
            <div className="border-2 border-dashed border-border rounded-xl overflow-hidden bg-white p-4">
              <canvas ref={canvasRef} width={500} height={180} className="w-full hidden" />
              <div className="h-[140px] flex items-center justify-center">
                {signatureText ? (
                  <span className="text-4xl text-gray-900" style={{ fontFamily: '"Georgia", "Times New Roman", cursive, serif' }}>{signatureText}</span>
                ) : (
                  <span className="text-gray-300 text-lg">Type your name below</span>
                )}
              </div>
            </div>
            <input type="text" placeholder="Type your name..." value={signatureText} onChange={(e) => setSignatureText(e.target.value)}
              className="mt-3 w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" autoFocus />
          </TabsContent>

          <TabsContent value="image">
            <div className="border-2 border-dashed border-border rounded-xl p-12 text-center cursor-pointer hover:border-emerald-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              {previewData ? (
                <img src={previewData} alt="Signature" className="max-h-[140px] mx-auto" />
              ) : (
                <div><Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">Click to upload signature image</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG, or SVG</p></div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            {previewData && signatureType === 'image' && (
              <div className="flex justify-end mt-3"><Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} className="gap-1"><X className="w-4 h-4" /> Remove</Button></div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setShowSignaturePad(false)}>Cancel</Button>
          <Button onClick={applySignature} disabled={!previewData} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
            <Check className="w-4 h-4" /> Apply Signature
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
