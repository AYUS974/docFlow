import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { files } = await request.json()
    if (!Array.isArray(files) || files.length < 2) {
      return NextResponse.json({ error: 'At least 2 files required' }, { status: 400 })
    }

    const mergedPdf = await PDFDocument.create()

    for (const base64 of files) {
      try {
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const pdf = await PDFDocument.load(bytes)
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        pages.forEach(page => mergedPdf.addPage(page))
      } catch (err) {
        console.error('Failed to process one file:', err)
      }
    }

    const pdfBytes = await mergedPdf.save()
    const resultBase64 = btoa(String.fromCharCode(...pdfBytes))
    return NextResponse.json({
      data: `data:application/pdf;base64,${resultBase64}`,
      pageCount: mergedPdf.getPageCount(),
    })
  } catch (err) {
    console.error('Merge failed:', err)
    return NextResponse.json({ error: 'Failed to merge PDFs' }, { status: 500 })
  }
}