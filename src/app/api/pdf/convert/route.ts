import { NextResponse } from 'next/server'
import { PDFDocument } from 'pdf-lib'

export async function POST(request: Request) {
  try {
    const { data, format } = await request.json()
    if (!data || !format) {
      return NextResponse.json({ error: 'Missing data or format' }, { status: 400 })
    }

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))

    // PDF to TXT — text extraction
    if (format === 'txt') {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      let fullText = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ')
        fullText += `--- Page ${i} ---\n${pageText.trim()}\n\n`
      }
      return NextResponse.json({ text: fullText, format: 'txt', pageCount: pdf.numPages })
    }

    // PDF to HTML — styled text extraction
    if (format === 'html') {
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise
      let html = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>PDF Content</title><style>body{font-family:Georgia,"Times New Roman",serif;max-width:800px;margin:0 auto;padding:20px;color:#333;line-height:1.6}.page{margin-bottom:40px;padding:24px;border:1px solid #e5e7eb;border-radius:12px;page-break-after:always;background:white;box-shadow:0 1px 3px rgba(0,0,0,0.08)}.page h2{color:#111;font-size:14px;text-transform:uppercase;letter-spacing:0.05em;border-bottom:2px solid #10b981;padding-bottom:8px;margin-bottom:16px;font-family:Helvetica,Arial,sans-serif}.page p{margin:8px 0;font-size:15px}</style></head><body>\n'
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .filter((item: any) => 'str' in item)
          .map((item: any) => item.str)
          .join(' ')
        html += `<div class="page"><h2>Page ${i}</h2><p>${pageText.trim().replace(/\n/g, '<br>')}</p></div>\n`
      }
      html += '</body></html>'
      return NextResponse.json({ html, format: 'html', pageCount: pdf.numPages })
    }

    // PDF to PNG/JPG — client-side rendering via pdfjs, return instructions
    // (actual rendering happens in the browser for image export)
    if (format === 'jpg' || format === 'png') {
      return NextResponse.json({
        error: 'Image conversion is performed client-side. Use the editor\'s Export as PNG feature for current page, or the browser print dialog for all pages.',
        clientSide: true,
        format,
        pageCount: (await (await import('pdfjs-dist')).getDocument({ data: bytes }).promise).numPages,
      })
    }

    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 })
  } catch (err) {
    console.error('Convert failed:', err)
    return NextResponse.json({ error: 'Failed to convert PDF' }, { status: 500 })
  }
}
