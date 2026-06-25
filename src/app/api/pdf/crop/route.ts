import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { data, cropBox, pageNumber } = await request.json()
    if (!data || !cropBox || !pageNumber) {
      return NextResponse.json({ error: 'Missing data, cropBox, or pageNumber' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const pdf = await PDFDocument.load(bytes)
    const page = pdf.getPage(pageNumber - 1)
    const { width, height } = page.getSize()

    // cropBox is in PDF coordinate space (top-left origin from pdfjs)
    // Convert to pdf-lib coordinate space (bottom-left origin)
    const cropX = Math.max(0, cropBox.x)
    const cropY = Math.max(0, height - cropBox.y - cropBox.height)
    const cropW = Math.min(cropBox.width, width - cropBox.x)
    const cropH = Math.min(cropBox.height, height - cropBox.y)

    page.setCropBox(cropX, cropY, cropW, cropH)
    page.setMediaBox(cropX, cropY, cropW, cropH)

    const pdfBytes = await pdf.save()
    const base64 = btoa(String.fromCharCode(...pdfBytes))
    return NextResponse.json({
      data: `data:application/pdf;base64,${base64}`,
      cropBox: { x: cropX, y: cropY, width: cropW, height: cropH },
      pageCount: pdf.getPageCount(),
    })
  } catch (err) {
    console.error('Crop failed:', err)
    return NextResponse.json({ error: 'Failed to crop PDF' }, { status: 500 })
  }
}
