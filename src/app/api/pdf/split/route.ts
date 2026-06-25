import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

function parseRange(range: string, totalPages: number): number[] {
  const pages: number[] = []
  const parts = range.split(',').map(s => s.trim())
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-')
      let start = parseInt(startStr) || 1
      let end = endStr === 'end' ? totalPages : (parseInt(endStr) || totalPages)
      for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= totalPages) pages.push(i)
      }
    } else {
      const p = parseInt(part)
      if (p >= 1 && p <= totalPages) pages.push(p)
    }
  }
  return [...new Set(pages)].sort((a, b) => a - b)
}

export async function POST(request: Request) {
  try {
    const { data, ranges } = await request.json()
    if (!data || !ranges || !Array.isArray(ranges)) {
      return NextResponse.json({ error: 'Missing data or ranges' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const srcPdf = await PDFDocument.load(bytes)
    const totalPages = srcPdf.getPageCount()

    const results: { range: string; data: string; pageCount: number }[] = []

    for (const range of ranges) {
      const pageIndices = parseRange(range, totalPages)
      if (pageIndices.length === 0) continue

      const newPdf = await PDFDocument.create()
      const copiedPages = await newPdf.copyPages(srcPdf, pageIndices.map(p => p - 1))
      copiedPages.forEach(p => newPdf.addPage(p))

      const pdfBytes = await newPdf.save()
      const base64 = btoa(String.fromCharCode(...pdfBytes))
      results.push({
        range,
        data: `data:application/pdf;base64,${base64}`,
        pageCount: newPdf.getPageCount(),
      })
    }

    return NextResponse.json({ files: results })
  } catch (err) {
    console.error('Split failed:', err)
    return NextResponse.json({ error: 'Failed to split PDF' }, { status: 500 })
  }
}