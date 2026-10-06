import type { DocChatContext } from './tools'

export interface FallbackAction {
  type: 'tool' | 'text'
  toolName?: string
  toolInput?: Record<string, unknown>
  text?: string
}

/**
 * Intelligent local intent parser that acts as a fail-safe backup.
 * If external LLM providers (Gemini / OpenAI / Groq) return 503 or 429 quota errors,
 * this parser extracts the user's intent and executes the document action reliably.
 */
export function parseIntentFallback(prompt: string, context?: DocChatContext | null): FallbackAction {
  const p = prompt.trim().toLowerCase()
  const raw = prompt.trim()

  // 1. Watermark Intent
  if (p.includes('watermark')) {
    let text = 'CONFIDENTIAL'
    if (p.includes('draft')) text = 'DRAFT'
    else if (p.includes('sample')) text = 'SAMPLE'
    else if (p.includes('urgent')) text = 'URGENT'
    else if (p.includes('confidential')) text = 'CONFIDENTIAL'
    else {
      // Extract quoted or capitalized words
      const match = raw.match(/["']([^"']+)["']/) || raw.match(/watermark\s+([A-Za-z0-9_-]+)/i)
      if (match && match[1] && !['in', 'on', 'with', 'a', 'the', 'red', 'blue', 'green'].includes(match[1].toLowerCase())) {
        text = match[1].toUpperCase()
      }
    }

    let color = '#ef4444' // default red
    if (p.includes('blue')) color = '#3b82f6'
    else if (p.includes('green')) color = '#10b981'
    else if (p.includes('black') || p.includes('gray')) color = '#6b7280'
    else if (p.includes('purple')) color = '#8b5cf6'

    const opacity = p.includes('light') ? 0.15 : p.includes('dark') ? 0.4 : 0.25

    return {
      type: 'tool',
      toolName: 'add_watermark',
      toolInput: { text, color, opacity, allPages: true },
    }
  }

  // 2. Page Numbers Intent
  if (p.includes('page number') || p.includes('numbering') || p.includes('page numbers') || p.includes('pagination')) {
    let position: 'bottom-center' | 'bottom-right' | 'top-right' = 'bottom-center'
    if (p.includes('right')) position = 'bottom-right'
    if (p.includes('top')) position = 'top-right'

    return {
      type: 'tool',
      toolName: 'add_page_numbers',
      toolInput: { position, startPage: 1 },
    }
  }

  // 3. Highlight Text Intent
  if (p.includes('highlight')) {
    const match = raw.match(/highlight\s+["']?([^"'\n,]+)["']?/i)
    let query = match ? match[1].replace(/^(the|all|word|text)\s+/i, '').trim() : ''
    if (query.endsWith('on this page') || query.endsWith('on page 1')) {
      query = query.replace(/\s+(on this page|on page \d+)$/i, '').trim()
    }
    if (query) {
      return {
        type: 'tool',
        toolName: 'highlight_text',
        toolInput: { query, page: context?.currentPage || 1, color: '#fef08a' },
      }
    }
  }

  // 4. Redact Text Intent
  if (p.includes('redact') || p.includes('black out') || p.includes('hide text')) {
    const match = raw.match(/(?:redact|black\s+out|hide\s+text)\s+["']?([^"'\n,]+)["']?/i)
    let query = match ? match[1].replace(/^(the|all|word|text)\s+/i, '').trim() : ''
    if (query.endsWith('on this page') || query.endsWith('on page 1')) {
      query = query.replace(/\s+(on this page|on page \d+)$/i, '').trim()
    }
    if (query) {
      return {
        type: 'tool',
        toolName: 'redact_text',
        toolInput: { query, page: context?.currentPage || 1 },
      }
    }
  }

  // 5. Whiteout / Erase Text Intent (e.g. "whiteout machine", "erase invoice", "white out text")
  if (p.includes('whiteout') || p.includes('white out') || p.includes('white-out') || p.includes('erase') || p.includes('remove word') || p.includes('delete word') || p.includes('clean out')) {
    const match = raw.match(/(?:whiteout|white\s+out|white-out|erase|remove\s+word|delete\s+word|clean\s+out)\s+["']?([^"'\n,]+)["']?/i)
    let query = match ? match[1].replace(/^(the|all|word|text)\s+/i, '').trim() : ''
    if (query.endsWith('on this page') || query.endsWith('on page 1')) {
      query = query.replace(/\s+(on this page|on page \d+)$/i, '').trim()
    }
    if (query) {
      return {
        type: 'tool',
        toolName: 'whiteout_text',
        toolInput: { query, page: context?.currentPage || 1 },
      }
    }
  }

  // 6. Replace Text Intent (e.g. "replace '2024' with '2026'")
  if (p.includes('replace') || p.includes('change')) {
    const replaceMatch = raw.match(/replace\s+["']?([^"']+)["']?\s+with\s+["']?([^"']+)["']?/i) ||
      raw.match(/change\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i)
    if (replaceMatch) {
      return {
        type: 'tool',
        toolName: 'replace_text',
        toolInput: {
          find: replaceMatch[1].trim(),
          replace: replaceMatch[2].trim(),
          page: context?.currentPage || 1,
          replaceAll: true,
        },
      }
    }
  }

  // 7. Rotate Pages Intent
  if (p.includes('rotate')) {
    let degrees = 90
    if (p.includes('180')) degrees = 180
    else if (p.includes('270') || p.includes('counter') || p.includes('left') || p.includes('-90')) degrees = 270
    const allPages = p.includes('all') || p.includes('every')
    return {
      type: 'tool',
      toolName: 'rotate_pages',
      toolInput: {
        degrees,
        ...(allPages ? {} : { pages: [context?.currentPage || 1] }),
      },
    }
  }

  // 8. Undo / Redo Intent
  if (p === 'undo' || p.startsWith('undo ')) {
    return { type: 'tool', toolName: 'undo', toolInput: {} }
  }
  if (p === 'redo' || p.startsWith('redo ')) {
    return { type: 'tool', toolName: 'redo', toolInput: {} }
  }

  // 9. Summarization Intent
  if (p.includes('summarize') || p.includes('summary') || p.includes('overview') || p.includes('batao') || p.includes('points')) {
    const text = context?.currentPageText?.trim()
    const title = context?.title || 'Document'
    const page = context?.currentPage || 1
    const totalPages = context?.pageCount || 1

    if (text && text.length > 30) {
      const sentences = text
        .split(/(?<=[.?!])\s+/)
        .filter((s) => s.trim().length > 15)
        .slice(0, 5)

      const bulletPoints = sentences.map((s) => `- ${s.trim()}`).join('\n')
      return {
        type: 'text',
        text: `### 📄 Summary of ${title} (Page ${page} of ${totalPages})\n\n**Key Takeaways:**\n${bulletPoints}\n\n*Word count: ~${text.split(/\s+/).length} words across this page.*`,
      }
    }

    return {
      type: 'text',
      text: `### 📄 Document Overview: ${title}\n- **Total Pages:** ${totalPages}\n- **Current Viewing Page:** ${page}\n- **Status:** Document loaded and ready for annotations and editing.`,
    }
  }

  // 10. General Help / Default Fallback
  return {
    type: 'text',
    text: `I'm ready to help you edit **${context?.title || 'your document'}**! You can ask me to:\n- **Add Watermarks:** *"Add a red CONFIDENTIAL watermark on all pages"*\n- **Page Numbers:** *"Add page numbers at bottom center"*\n- **Highlight / Redact / Whiteout:** *"Highlight Invoice"*, *"Redact phone number"*, or *"Whiteout machine"*\n- **Text Editing:** *"Replace '2024' with '2026'"*\n- **Summarize:** *"Summarize page 1"*`,
  }
}
