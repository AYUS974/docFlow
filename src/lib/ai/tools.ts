import { tool } from 'ai'
import { z } from 'zod'

/**
 * DocFlow AI tool definitions — the single source of truth for what the
 * assistant can do to a document.
 *
 * IMPORTANT: none of these tools have an `execute` function. The document
 * lives entirely in the browser (zustand store + pdf.js), so every tool call
 * is streamed to the client and executed there by `src/lib/ai/executor.ts`.
 *
 * Coordinate system (matches the editor everywhere):
 *  - Units are PDF points at scale 1 (NOT pixels).
 *  - Origin is the TOP-LEFT corner of the page; y grows downward.
 *  - For `add_text`, `y` is the text BASELINE (bottom of the glyphs).
 */

const page = z.number().int().min(1).describe('1-based page number')

const anchor = z
  .enum([
    'top-left', 'top-center', 'top-right',
    'center-left', 'center', 'center-right',
    'bottom-left', 'bottom-center', 'bottom-right',
  ])
  .describe('Named position on the page; use instead of x/y when the user speaks in terms like "top right" or "bottom of the page"')

const annotationType = z.enum([
  'highlight', 'draw', 'text', 'rectangle', 'ellipse', 'line', 'redact', 'signature', 'whiteout', 'image', 'watermark',
])

const elementId = z
  .string()
  .min(4)
  .describe('Element id from list_elements (the short 8-character form is fine)')

export const aiTools = {
  get_document_overview: tool({
    description:
      'Get the current document overview: title, page count, per-page dimensions, current page, annotation counts and whether a saved signature exists. Call this when you need page sizes to compute coordinates.',
    inputSchema: z.object({}),
  }),

  get_page_text: tool({
    description:
      'Read the full plain text of a page. Use it to answer questions about the document, summarize it, or locate content before editing.',
    inputSchema: z.object({ page }),
  }),

  find_text: tool({
    description:
      'Find occurrences of a text snippet on a page. Returns each match with its exact position and size (PDF points, top-left origin). Call this before replace/highlight/redact if you are unsure the text exists.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Text to search for (case-insensitive)'),
      page,
    }),
  }),

  replace_text: tool({
    description:
      "Replace text that already exists in the PDF on a given page (native text edit — the original glyphs are masked and the new text is drawn in a matching font). Use for requests like \"change 'John' to 'Jane'\".",
    inputSchema: z.object({
      find: z.string().min(1).describe('Existing text to find (case-insensitive fallback)'),
      replace: z.string().describe('Replacement text; empty string deletes the matched text'),
      page,
      replaceAll: z.boolean().optional().describe('Replace every occurrence on the page (default true)'),
    }),
  }),

  style_text: tool({
    description:
      'Restyle existing PDF text (bold, italic, color, font size) without changing its content. Only provide the properties that should change.',
    inputSchema: z.object({
      query: z.string().min(1).describe('Existing text to restyle (case-insensitive)'),
      page,
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      color: z.string().optional().describe('Hex color like #ef4444'),
      fontSize: z.number().min(4).max(120).optional(),
    }),
  }),

  add_text: tool({
    description:
      'Add a NEW text box to a page (not editing existing text). Position with either `anchor` (preferred for phrases like "top right") or explicit x/y. `y` is the text baseline.',
    inputSchema: z.object({
      page,
      text: z.string().min(1),
      anchor: anchor.optional(),
      x: z.number().optional().describe('Left edge of the text in PDF points'),
      y: z.number().optional().describe('Text baseline in PDF points (top-left origin)'),
      fontSize: z.number().min(6).max(120).optional().describe('Default 16'),
      color: z.string().optional().describe('Hex color, default #000000'),
      fontFamily: z.enum(['Helvetica', 'TimesRoman', 'Courier']).optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
    }),
  }),

  highlight_text: tool({
    description: 'Highlight every occurrence of a text snippet on a page with a translucent color.',
    inputSchema: z.object({
      query: z.string().min(1),
      page,
      color: z.string().optional().describe('Hex highlight color, default #f59e0b (amber)'),
    }),
  }),

  redact_text: tool({
    description:
      'Cover every occurrence of a text snippet on a page with a solid black redaction box (e.g. hide names, emails, amounts).',
    inputSchema: z.object({ query: z.string().min(1), page }),
  }),

  whiteout_area: tool({
    description: 'Cover a rectangular area of a page with white (hide content without a black box).',
    inputSchema: z.object({
      page,
      x: z.number(),
      y: z.number(),
      width: z.number().min(1),
      height: z.number().min(1),
    }),
  }),

  add_shape: tool({
    description:
      'Draw a shape on a page: rectangle outline, ellipse outline, or an arrow (line). For an arrow, x/y is the start point and width/height are the x/y offsets to the tip.',
    inputSchema: z.object({
      shape: z.enum(['rectangle', 'ellipse', 'line']),
      page,
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      color: z.string().optional().describe('Hex color, default #ef4444'),
      strokeWidth: z.number().min(1).max(10).optional(),
    }),
  }),

  add_watermark: tool({
    description:
      'Add a diagonal text watermark (e.g. CONFIDENTIAL, DRAFT) across pages. Omit `pages` to watermark every page.',
    inputSchema: z.object({
      text: z.string().min(1),
      pages: z.array(page).optional().describe('Specific pages; omit for all pages'),
      opacity: z.number().min(0.05).max(1).optional().describe('Default 0.15'),
      angle: z.number().min(-90).max(90).optional().describe('Degrees, default -45'),
      color: z.string().optional().describe('Hex color, default #64748b'),
      fontSize: z.number().min(12).max(160).optional().describe('Default 48'),
    }),
  }),

  add_page_numbers: tool({
    description: 'Stamp page numbers on pages. Omit `pages` to number every page.',
    inputSchema: z.object({
      position: z
        .enum(['bottom-center', 'bottom-left', 'bottom-right', 'top-center', 'top-left', 'top-right'])
        .optional()
        .describe('Default bottom-center'),
      format: z
        .enum(['numeric', 'page-x', 'x-of-y'])
        .optional()
        .describe('"numeric" → 1 · "page-x" → Page 1 · "x-of-y" → 1 of 12. Default numeric'),
      pages: z.array(page).optional(),
      startAt: z.number().int().min(0).optional().describe('Number shown on the first stamped page, default 1'),
    }),
  }),

  add_signature: tool({
    description:
      "Place the user's saved signature on a page. Fails with a helpful message if no signature has been created yet. Position via `anchor` (default bottom-right) or x/y.",
    inputSchema: z.object({
      page,
      anchor: anchor.optional(),
      x: z.number().optional(),
      y: z.number().optional().describe('Top edge of the signature box'),
      width: z.number().min(40).max(400).optional().describe('Signature width in points, default 150'),
    }),
  }),

  rotate_pages: tool({
    description: 'Rotate pages clockwise. Omit `pages` to rotate every page.',
    inputSchema: z.object({
      pages: z.array(page).optional(),
      // Kept as a plain int because Gemini rejects numeric-literal unions in tool schemas.
      degrees: z.number().int().describe('Clockwise degrees: 90, 180 or 270 (negative rotates counter-clockwise)'),
    }),
  }),

  delete_page: tool({
    description: 'Delete a page from the document. Destructive — only call when the user clearly asked for it.',
    inputSchema: z.object({ page }),
  }),

  insert_blank_page: tool({
    description: 'Insert a blank page after the given page number (0 inserts at the beginning).',
    inputSchema: z.object({ afterPage: z.number().int().min(0) }),
  }),

  duplicate_page: tool({
    description: 'Duplicate a page (copy is appended right after the original in the page order).',
    inputSchema: z.object({ page }),
  }),

  go_to_page: tool({
    description: 'Navigate the editor viewport to a page.',
    inputSchema: z.object({ page }),
  }),

  set_zoom: tool({
    description: 'Set the editor zoom level as a percentage (25–500).',
    inputSchema: z.object({ percent: z.number().min(25).max(500) }),
  }),

  list_elements: tool({
    description:
      'List the elements currently on the canvas (everything added in this session: text boxes, highlights, shapes, watermarks, signatures, images, redactions…) with their id, type, page, position and size. ALWAYS call this before update_element / delete_element / duplicate_element so you target the right id.',
    inputSchema: z.object({
      page: page.optional().describe('Only list elements on this page'),
      type: annotationType.optional().describe('Only list elements of this type'),
    }),
  }),

  update_element: tool({
    description:
      'Restructure an existing canvas element by id: move it (x/y or anchor), resize it (width/height), rewrite its text, change color / font size / bold / italic / stroke width / watermark opacity or angle, or move it to another page. Only pass the properties that should change. Get ids from list_elements first.',
    inputSchema: z.object({
      id: elementId,
      x: z.number().optional().describe('New left position in PDF points (for text elements: left edge; y stays the baseline)'),
      y: z.number().optional(),
      anchor: anchor.optional().describe('Reposition by named page position instead of x/y'),
      page: page.optional().describe('Move the element to this page'),
      width: z.number().min(1).optional(),
      height: z.number().min(1).optional(),
      text: z.string().optional().describe('New text content (text elements and watermarks only)'),
      color: z.string().optional().describe('Hex color like #ef4444'),
      fontSize: z.number().min(4).max(160).optional(),
      bold: z.boolean().optional(),
      italic: z.boolean().optional(),
      opacity: z.number().min(0.05).max(1).optional().describe('Watermark elements only'),
      angle: z.number().min(-90).max(90).optional().describe('Watermark elements only, degrees'),
      strokeWidth: z.number().min(1).max(10).optional().describe('Shape/draw elements only'),
    }),
  }),

  duplicate_element: tool({
    description:
      'Duplicate an existing canvas element. Without a position the copy is offset slightly from the original; optionally place it at x/y or an anchor, or on a different page.',
    inputSchema: z.object({
      id: elementId,
      page: page.optional().describe('Put the copy on this page (default: same page)'),
      x: z.number().optional(),
      y: z.number().optional(),
      anchor: anchor.optional(),
    }),
  }),

  delete_element: tool({
    description:
      'Delete ONE specific canvas element by id (from list_elements). For bulk removal by page/type use remove_annotations instead.',
    inputSchema: z.object({ id: elementId }),
  }),

  move_page: tool({
    description:
      'Move a page to a different position in the document\'s page order (like drag-reordering in the Pages panel). Positions are 1-based.',
    inputSchema: z.object({
      from: page.describe('Current position of the page to move'),
      to: page.describe('Target position'),
    }),
  }),

  remove_annotations: tool({
    description:
      'Bulk-remove annotations added in this session (highlights, shapes, text boxes, watermarks, signatures…). Filter by page and/or type; no filters removes ALL annotations. To remove a single element, use delete_element.',
    inputSchema: z.object({
      page: page.optional(),
      type: annotationType.optional(),
    }),
  }),

  undo: tool({
    description: 'Undo the most recent annotation change (one step).',
    inputSchema: z.object({}),
  }),

  redo: tool({
    description: 'Redo the most recently undone annotation change (one step).',
    inputSchema: z.object({}),
  }),
} as const

export type AiToolName = keyof typeof aiTools

/** Human-friendly labels for the chat UI's tool-activity chips. */
export const AI_TOOL_LABELS: Record<AiToolName, string> = {
  get_document_overview: 'Reading document info',
  get_page_text: 'Reading page text',
  find_text: 'Finding text',
  replace_text: 'Replacing text',
  style_text: 'Restyling text',
  add_text: 'Adding text',
  highlight_text: 'Highlighting',
  redact_text: 'Redacting',
  whiteout_area: 'Applying whiteout',
  add_shape: 'Drawing shape',
  add_watermark: 'Adding watermark',
  add_page_numbers: 'Adding page numbers',
  add_signature: 'Placing signature',
  rotate_pages: 'Rotating pages',
  delete_page: 'Deleting page',
  insert_blank_page: 'Inserting blank page',
  duplicate_page: 'Duplicating page',
  go_to_page: 'Navigating',
  set_zoom: 'Adjusting zoom',
  list_elements: 'Inspecting canvas',
  update_element: 'Updating element',
  duplicate_element: 'Duplicating element',
  delete_element: 'Deleting element',
  move_page: 'Reordering pages',
  remove_annotations: 'Removing annotations',
  undo: 'Undoing',
  redo: 'Redoing',
}

/** Context snapshot the client sends with every chat request. */
export interface DocChatContext {
  title: string
  fileName: string
  pageCount: number
  currentPage: number
  zoomPercent: number
  pages: { page: number; width: number; height: number }[]
  annotationsCount: number
  annotationsByType: Record<string, number>
  textEditsCount: number
  hasSavedSignature: boolean
  currentPageText: string
}
