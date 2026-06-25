import { NextResponse } from 'next/server'
import { PDFDocument, degrees } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { data, rotations } = await request.json()
    if (!data) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const pdf = await PDFDocument.load(bytes)

    if (rotations && typeof rotations === 'object') {
      for (const [pageStr, deg] of Object.entries(rotations)) {
        const pageIndex = parseInt(pageStr) - 1
        if (pageIndex >= 0 && pageIndex < pdf.getPageCount()) {
          const page = pdf.getPage(pageIndex)
          const currentRotation = page.getRotation().angle
          page.setRotation(degrees(currentRotation + (deg as number)))
        }
      }
    }

    const pdfBytes = await pdf.save()
    const base64 = btoa(String.fromCharCode(...pdfBytes))
    return NextResponse.json({
      data: `data:application/pdf;base64,${base64}`,
      pageCount: pdf.getPageCount(),
    })
  } catch (err) {
    console.error('Rotate failed:', err)
    return NextResponse.json({ error: 'Failed to rotate PDF' }, { status: 500 })
  }
}