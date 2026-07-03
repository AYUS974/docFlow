import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { aiTools, type DocChatContext } from '@/lib/ai/tools'
import { buildModelChain, withFallbacks } from '@/lib/ai/models'

export const maxDuration = 60

function buildSystemPrompt(ctx?: DocChatContext | null): string {
  const base = `You are DocFlow AI, the built-in assistant of the DocFlow PDF editor. You edit the user's document by calling tools — the edits are applied live in their editor and they can undo any of them.

## Rules
- The user may write in English, Hindi or Hinglish; always reply in the same language/style they used. Keep replies short and friendly.
- ALWAYS act via tools. Never claim an edit was made unless the tool result says success.
- Coordinates are PDF points at scale 1 with a TOP-LEFT origin (y grows downward). A US-Letter page is 612×792 pt, A4 is 595×842 pt — but always use the real page sizes from the context/overview below.
- Prefer \`anchor\` positions over raw x/y when the user speaks vaguely ("top right", "neeche", "corner me").
- Before replace_text / style_text / highlight_text / redact_text on text you have not seen, use find_text or get_page_text first so you target the right occurrence and page.
- You have FULL control of the canvas: every element already on it (text boxes, shapes, highlights, watermarks, signatures, images…) can be restructured. Call list_elements to get element ids, then update_element (move/resize/recolor/rewrite), duplicate_element or delete_element with that id. Use this whenever the user wants to move, resize, restyle or clean up something that already exists instead of adding a new element.
- If the user does not say which page, assume the current page for local edits; for watermarks/page numbers assume all pages.
- Text inside the PDF can only be found/edited one page at a time; loop over pages when the user asks for a whole-document text operation.
- delete_page and remove_annotations are destructive: only call them when the request is unambiguous.
- After finishing, summarize in one short sentence what changed (e.g. "Watermark 'DRAFT' laga diya on all 5 pages ✓").
- If something is impossible (e.g. no saved signature yet, image insertion), say so and tell the user how to do it in the UI instead.`

  if (!ctx) return base + '\n\n## Document\nNo document context was provided; call get_document_overview before editing.'

  const pageDims = ctx.pages
    .slice(0, 30)
    .map((p) => `p${p.page}: ${Math.round(p.width)}×${Math.round(p.height)}`)
    .join(', ')
  const annotSummary = Object.entries(ctx.annotationsByType)
    .map(([t, n]) => `${t}:${n}`)
    .join(', ') || 'none'

  return `${base}

## Current document
- Title: "${ctx.title}" (${ctx.fileName}), ${ctx.pageCount} pages
- User is viewing page ${ctx.currentPage} at ${ctx.zoomPercent}% zoom
- Page sizes (points): ${pageDims}${ctx.pages.length > 30 ? ', …' : ''}
- Annotations so far: ${annotSummary}; native text edits: ${ctx.textEditsCount}
- Saved signature available: ${ctx.hasSavedSignature ? 'yes' : 'no'}

## Text of the page the user is viewing (page ${ctx.currentPage})
${ctx.currentPageText ? ctx.currentPageText.slice(0, 6000) : '(no extractable text on this page)'}`
}

export async function POST(req: Request) {
  const chain = buildModelChain()
  if (chain.length === 0) {
    return Response.json(
      { error: 'No AI provider key is set. Add GOOGLE_GENERATIVE_AI_API_KEY and/or ZAI_API_KEY to .env and restart the dev server.' },
      { status: 500 },
    )
  }

  const { messages, context }: { messages: UIMessage[]; context?: DocChatContext } = await req.json()

  const result = streamText({
    model: withFallbacks(chain),
    // The chain already fails over across models — don't also retry each
    // failing model with backoff (that's what made quota errors feel stuck).
    maxRetries: 1,
    system: buildSystemPrompt(context),
    messages: await convertToModelMessages(messages),
    tools: aiTools,
  })

  return result.toUIMessageStreamResponse({
    onError: (error) => (error instanceof Error ? error.message : 'AI request failed'),
  })
}
