import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { data, position, format, startFrom } = await request.json()
    if (!data) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const pdf = await PDFDocument.load(bytes)
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const pages = pdf.getPages()
    const startPos = startFrom ?? 1
    const pos = position || 'bottom-center'
    const fmt = format || 'numeric'

    pages.forEach((page, idx) => {
      const { width, height } = page.getSize()
      const num = idx + startPos
      let label = String(num)
      if (fmt === 'dash') label = `- ${num} -`
      if (fmt === 'page-of') label = `Page ${num} of ${pages.length}`
      if (fmt === 'roman') label = toRoman(num)

      const textWidth = font.widthOfTextAtSize(label, 10)
      const margin = 40
      let x = width / 2 - textWidth / 2
      let y = margin

      if (pos === 'bottom-center') { x = width / 2 - textWidth / 2; y = margin }
      else if (pos === 'bottom-right') { x = width - textWidth - margin; y = margin }
      else if (pos === 'bottom-left') { x = margin; y = margin }
      else if (pos === 'top-center') { x = width / 2 - textWidth / 2; y = height - margin - 10 }
      else if (pos === 'top-right') { x = width - textWidth - margin; y = height - margin - 10 }
      else if (pos === 'top-left') { x = margin; y = height - margin - 10 }

      page.drawText(label, { x, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) })
    })

    const pdfBytes = await pdf.save()
    const base64 = btoa(String.fromCharCode(...pdfBytes))
    return NextResponse.json({
      data: `data:application/pdf;base64,${base64}`,
      pageCount: pdf.getPageCount(),
    })
  } catch (err) {
    console.error('Page numbers failed:', err)
    return NextResponse.json({ error: 'Failed to add page numbers' }, { status: 500 })
  }
}

function toRoman(num: number): string {
  const vals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ]
  let result = ''
  for (const [val, sym] of vals) {
    while (num >= val) { result += sym; num -= val }
  }
  return result
}