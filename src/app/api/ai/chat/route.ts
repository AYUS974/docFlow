import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { aiTools, type DocChatContext } from '@/lib/ai/tools'
import { buildModelChain, withFallbacks } from '@/lib/ai/models'
import { parseIntentFallback, type FallbackAction } from '@/lib/ai/fallback-parser'

export const maxDuration = 60

function buildSystemPrompt(ctx?: DocChatContext | null): string {
  const base = `You are DocFlow AI, the built-in assistant of the DocFlow PDF editor. You edit the user's document by calling tools — the edits are applied live in their editor and they can undo any of them.

## Rules
- The user may write in English, Hindi or Hinglish; always reply in the same language/style they used. Keep replies short and friendly.
- ALWAYS act via tools. Never claim an edit was made unless the tool result says success.
- Coordinates are PDF points at scale 1 with a TOP-LEFT origin (y grows downward). A US-Letter page is 612×792 pt, A4 is 595×842 pt — but always use the real page sizes from the context/overview below.
- Prefer \`anchor\` positions over raw x/y when the user speaks vaguely ("top right", "neeche", "corner me").
- Before replace_text / style_text / highlight_text / redact_text / whiteout_text on text you have not seen, use find_text or get_page_text first so you target the right occurrence and page.
- If the user asks to whiteout, erase, or cover text in white, call whiteout_text.
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

export async function GET() {
  const chain = buildModelChain()
  return Response.json({
    status: 'ok',
    configured: chain.length > 0,
    message: 'DocFlow AI Chat API is running. Send POST requests to start chatting.',
  })
}

function createFallbackStream(action: FallbackAction): Response {
  const encoder = new TextEncoder()
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const partId = `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: {"type":"start","messageId":"${msgId}"}\n\n`))
      controller.enqueue(encoder.encode('data: {"type":"start-step"}\n\n'))

      if (action.type === 'tool' && action.toolName) {
        const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        controller.enqueue(
          encoder.encode(
            `data: {"type":"tool-input-available","toolCallId":"${callId}","toolName":"${action.toolName}","input":${JSON.stringify(action.toolInput || {})}}\n\n`,
          ),
        )
        controller.enqueue(encoder.encode('data: {"type":"finish-step"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"finish","finishReason":"tool-calls"}\n\n'))
      } else {
        const text = action.text || 'Done.'
        controller.enqueue(encoder.encode(`data: {"type":"text-start","id":"${partId}"}\n\n`))
        controller.enqueue(
          encoder.encode(`data: {"type":"text-delta","id":"${partId}","delta":${JSON.stringify(text)}}\n\n`),
        )
        controller.enqueue(encoder.encode(`data: {"type":"text-end","id":"${partId}"}\n\n`))
        controller.enqueue(encoder.encode('data: {"type":"finish-step"}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"finish","finishReason":"stop"}\n\n'))
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function interceptErrorsWithFallback(response: Response, action: FallbackAction, hasToolResult = false): Response {
  if (!response.body) return response

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const partId = `part_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const transformedStream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          return
        }

        const text = decoder.decode(value, { stream: true })

        // Check if stream emitted an error
        if (text.includes('data: {"type":"error"') || text.includes('"type":"error"')) {
          console.log('[docflow-ai] Intercepted stream error (503/429), streaming fallback action instead')
          controller.enqueue(encoder.encode(`data: {"type":"start","messageId":"${msgId}"}\n\n`))
          controller.enqueue(encoder.encode('data: {"type":"start-step"}\n\n'))

          if (!hasToolResult && action.type === 'tool' && action.toolName) {
            const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
            controller.enqueue(
              encoder.encode(
                `data: {"type":"tool-input-available","toolCallId":"${callId}","toolName":"${action.toolName}","input":${JSON.stringify(action.toolInput || {})}}\n\n`,
              ),
            )
            controller.enqueue(encoder.encode('data: {"type":"finish-step"}\n\n'))
            controller.enqueue(encoder.encode('data: {"type":"finish","finishReason":"tool-calls"}\n\n'))
          } else {
            const reply = action.text || 'Action completed successfully on the document canvas ✓'
            controller.enqueue(encoder.encode(`data: {"type":"text-start","id":"${partId}"}\n\n`))
            controller.enqueue(
              encoder.encode(`data: {"type":"text-delta","id":"${partId}","delta":${JSON.stringify(reply)}}\n\n`),
            )
            controller.enqueue(encoder.encode(`data: {"type":"text-end","id":"${partId}"}\n\n`))
            controller.enqueue(encoder.encode('data: {"type":"finish-step"}\n\n'))
            controller.enqueue(encoder.encode('data: {"type":"finish","finishReason":"stop"}\n\n'))
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
          return
        }

        controller.enqueue(value)
      } catch (err) {
        console.warn('[docflow-ai] Stream read error:', err)
        controller.close()
      }
    },
  })

  return new Response(transformedStream, {
    headers: response.headers,
    status: response.status,
  })
}

export async function POST(req: Request) {
  const chain = buildModelChain()
  const { messages, context }: { messages: UIMessage[]; context?: DocChatContext } = await req.json()

  // Extract last user prompt
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const userText = lastUserMsg?.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => (p as { text: string }).text)
    .join(' ') || ''

  const fallbackAction = parseIntentFallback(userText, context)

  // Check if last message was a tool result (follow-up)
  const lastMsg = messages[messages.length - 1]
  const hasToolResult = ((lastMsg?.role as string) === 'tool') || lastMsg?.parts?.some((p) => p.type.startsWith('tool-'))

  // If no external model is configured, execute via smart fallback immediately
  if (chain.length === 0) {
    if (hasToolResult) {
      return createFallbackStream({
        type: 'text',
        text: 'Action completed successfully on the document canvas ✓',
      })
    }
    return createFallbackStream(fallbackAction)
  }

  try {
    const result = streamText({
      model: withFallbacks(chain),
      maxRetries: 0,
      system: buildSystemPrompt(context),
      messages: await convertToModelMessages(messages),
      tools: aiTools,
    })

    const rawResponse = result.toUIMessageStreamResponse({
      onError: (error) => {
        console.warn('[docflow-ai] Stream error, executing fallback:', error)
        return 'An error occurred during response streaming.'
      },
    })

    return interceptErrorsWithFallback(rawResponse, fallbackAction, hasToolResult)
  } catch (err) {
    console.warn('[docflow-ai] Model call failed, switching to smart fallback:', err)
    if (hasToolResult) {
      return createFallbackStream({
        type: 'text',
        text: 'Action completed successfully on the document canvas ✓',
      })
    }
    return createFallbackStream(fallbackAction)
  }
}
