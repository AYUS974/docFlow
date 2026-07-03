'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  isToolUIPart,
  getToolName,
} from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Sparkles, Send, Square, Trash2, X, Loader2, CheckCircle2, AlertTriangle, Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store/app-store'
import { executeAiTool, type AiToolResult } from '@/lib/ai/executor'
import { AI_TOOL_LABELS, type AiToolName, type DocChatContext } from '@/lib/ai/tools'

/** Snapshot of the open document sent with every request so the model knows
 *  page sizes, what the user is looking at, and the current page's text. */
function buildContext(): DocChatContext | undefined {
  const s = useAppStore.getState()
  const doc = s.currentDocument
  if (!doc) return undefined
  const byType: Record<string, number> = {}
  for (const a of s.annotations) byType[a.type] = (byType[a.type] || 0) + 1
  return {
    title: doc.title,
    fileName: doc.fileName,
    pageCount: s.totalPages || doc.pageCount,
    currentPage: s.currentPage,
    zoomPercent: Math.round(s.zoom * 100),
    pages: (doc.pages || []).map((p) => ({ page: p.pageNumber, width: p.width, height: p.height })),
    annotationsCount: s.annotations.length,
    annotationsByType: byType,
    textEditsCount: s.textEdits.size,
    hasSavedSignature: s.savedSignatures.length > 0 || !!s.signatureData,
    currentPageText: s.textItems
      .filter((i) => i.pageNumber === s.currentPage)
      .map((i) => i.text)
      .join(' ')
      .slice(0, 6000),
  }
}

const SUGGESTIONS = [
  'Add a DRAFT watermark on all pages',
  'Page numbers at the bottom center',
  'Summarize this page',
  'Highlight all totals on this page',
]

const MD_COMPONENTS = {
  p: (props: any) => <p className="mb-1.5 last:mb-0" {...props} />,
  ul: (props: any) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5" {...props} />,
  ol: (props: any) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5" {...props} />,
  code: (props: any) => <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]" {...props} />,
  a: (props: any) => <a className="text-emerald-600 underline" target="_blank" rel="noreferrer" {...props} />,
}

function ToolChip({ label, state, output }: {
  label: string
  state: string
  output?: AiToolResult
}) {
  const running = state === 'input-streaming' || state === 'input-available'
  const failed = state === 'output-error' || (output && output.success === false)
  return (
    <div className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
      failed
        ? 'border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
        : 'border-border/60 bg-muted/50 text-muted-foreground'
    }`}>
      {running
        ? <Loader2 className="w-3.5 h-3.5 mt-px shrink-0 animate-spin text-emerald-600" />
        : failed
          ? <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          : <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0 text-emerald-600" />}
      <div className="min-w-0">
        <span className="font-medium">{label}</span>
        {output?.message && !running && (
          <p className="mt-0.5 truncate opacity-80">{output.message}</p>
        )}
      </div>
    </div>
  )
}

export function AiChatPanel() {
  const showAiPanel = useAppStore((s) => s.showAiPanel)
  const toggleAiPanel = useAppStore((s) => s.toggleAiPanel)
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status, error, stop, setMessages, clearError, addToolOutput } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      // Every tool executes in the browser against the live editor store.
      const output = await executeAiTool(toolCall.toolName, toolCall.input)
      addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output,
        // Keep the doc snapshot fresh for the automatic follow-up request.
        options: { body: { context: buildContext() } },
      })
    },
  })

  const busy = status === 'submitted' || status === 'streaming'

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, status])

  useEffect(() => {
    if (showAiPanel) setTimeout(() => inputRef.current?.focus(), 250)
  }, [showAiPanel])

  const submit = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    if (error) clearError()
    sendMessage({ text: trimmed }, { body: { context: buildContext() } })
    setInput('')
  }

  return (
    <AnimatePresence>
      {showAiPanel && (
        <motion.div
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="border-l border-border/60 bg-background shrink-0 overflow-hidden max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:z-50 max-md:shadow-2xl max-md:w-[85vw]"
        >
          <div className="flex flex-col h-full w-[340px] max-md:w-full">
            {/* Header */}
            <div className="p-3 border-b border-border/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold leading-none">AI Assistant</h3>
                  <span className="text-[10px] text-muted-foreground">Gemini · edits apply live, undo anytime</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                {messages.length > 0 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Clear chat"
                    onClick={() => { stop(); setMessages([]); clearError() }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Close" onClick={toggleAiPanel}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.length === 0 && (
                <div className="pt-6 text-center">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
                  <p className="text-sm font-medium">Command your document</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4 px-4">
                    Watermark, sign, replace text, redact, rotate — just type it. Hindi/Hinglish bhi chalega.
                  </p>
                  <div className="flex flex-col gap-1.5 px-2">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} onClick={() => submit(s)}
                        className="text-xs text-left px-3 py-2 rounded-lg border border-border/60 hover:border-emerald-400/60 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors text-muted-foreground hover:text-foreground">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={message.role === 'user' ? 'flex justify-end' : ''}>
                  {message.role === 'user' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-emerald-600 text-white px-3 py-2 text-sm whitespace-pre-wrap">
                      {message.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {message.parts.map((part, i) => {
                        if (part.type === 'text') {
                          return (
                            <div key={i} className="text-sm leading-relaxed text-foreground/90">
                              <ReactMarkdown components={MD_COMPONENTS}>{part.text}</ReactMarkdown>
                            </div>
                          )
                        }
                        if (isToolUIPart(part)) {
                          const name = getToolName(part) as AiToolName
                          return (
                            <ToolChip
                              key={part.toolCallId}
                              label={AI_TOOL_LABELS[name] ?? name}
                              state={part.state}
                              output={part.state === 'output-available' ? (part.output as AiToolResult) : undefined}
                            />
                          )
                        }
                        return null
                      })}
                    </div>
                  )}
                </div>
              ))}

              {status === 'submitted' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" /> Thinking…
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-300/60 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-700 dark:text-red-300">
                  <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> AI error</p>
                  <p className="mt-1 break-words">{error.message || 'Request failed. Check GOOGLE_GENERATIVE_AI_API_KEY in .env.'}</p>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border/40 shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      submit(input)
                    }
                  }}
                  rows={Math.min(4, Math.max(1, input.split('\n').length))}
                  placeholder='e.g. "watermark CONFIDENTIAL laga do" or "replace John with Jane on page 2"'
                  className="flex-1 resize-none rounded-lg border border-border/60 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                {busy ? (
                  <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={() => stop()} title="Stop">
                    <Square className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700" onClick={() => submit(input)} disabled={!input.trim()} title="Send">
                    <Send className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70 flex items-center gap-1">
                <Wrench className="w-2.5 h-2.5" /> Edits apply to the live editor — Ctrl+Z / Undo works on everything.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
