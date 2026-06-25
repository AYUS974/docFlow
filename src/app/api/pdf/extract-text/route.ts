import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { data } = await request.json()
    if (!data) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 })
    }

    const pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf-worker/pdf.worker.min.mjs'

    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise

    const pages: { pageNumber: number; text: string }[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const text = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str)
        .join(' ')
      pages.push({ pageNumber: i, text: text.trim() })
    }

    return NextResponse.json({ pages, totalChars: pages.reduce((a, p) => a + p.text.length, 0) })
  } catch (err) {
    console.error('Extract text failed:', err)
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 })
  }
}