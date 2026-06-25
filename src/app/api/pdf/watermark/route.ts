import { NextResponse } from 'next/server'
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { data, text, opacity, angle } = await request.json()
    if (!data || !text) {
      return NextResponse.json({ error: 'Missing data or watermark text' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const pdf = await PDFDocument.load(bytes)
    const font = await pdf.embedFont(StandardFonts.HelveticaBold)
    const pages = pdf.getPages()
    const wmText = text.toUpperCase()
    const wmOpacity = opacity ?? 0.15
    const wmAngle = (angle ?? -45) * (Math.PI / 180)
    const wmSize = 48

    for (const page of pages) {
      const { width, height } = page.getSize()
      const textWidth = font.widthOfTextAtSize(wmText, wmSize)

      // Draw diagonal watermark across the page
      for (let row = -2; row < Math.ceil(height / (wmSize * 4)) + 2; row++) {
        for (let col = -1; col < Math.ceil(width / (textWidth + 100)) + 1; col++) {
          const x = col * (textWidth + 100) + (row % 2 === 0 ? 50 : 0)
          const y = height - (row * (wmSize * 4) + wmSize * 2)

          page.drawText(wmText, {
            x, y,
            size: wmSize,
            font,
            color: rgb(0.5, 0.5, 0.5),
            opacity: wmOpacity,
            rotate: degrees(angle ?? -45),
          })
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
    console.error('Watermark failed:', err)
    return NextResponse.json({ error: 'Failed to add watermark' }, { status: 500 })
  }
}
