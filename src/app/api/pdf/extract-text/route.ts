import { NextResponse } from 'next/server'
import { getPdfjsServer } from '@/lib/pdfjs-server'

export async function POST(request: Request) {
  try {
    const { data } = await request.json()
    if (!data) {
      return NextResponse.json({ error: 'Missing PDF data' }, { status: 400 })
    }

    const pdfjsLib = await getPdfjsServer()
    const rawBase64 = data.replace(/^data:application\/pdf;base64,/, '')
    const bytes = Buffer.from(rawBase64, 'base64')
    const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const pdf = await pdfjsLib.getDocument({ data: uint8 }).promise

    const pages: { pageNumber: number; text: string }[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const text = textContent.items
        .filter((item: any) => 'str' in item)
        .map((item: any) => item.str + (item.hasEOL ? '\n' : ' '))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
      pages.push({ pageNumber: i, text: text.trim() })
    }

    return NextResponse.json({ pages, totalChars: pages.reduce((a, p) => a + p.text.length, 0) })
  } catch (err) {
    console.error('Extract text failed:', err)
    return NextResponse.json({ error: 'Failed to extract text' }, { status: 500 })
  }
}