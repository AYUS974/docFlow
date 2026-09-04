import path from 'path'
import { pathToFileURL } from 'url'

export async function getPdfjsServer() {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerPath = path.join(process.cwd(), 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.mjs')
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
  return pdfjsLib
}
