'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Search, ChevronUp, ChevronDown, X, CaseSensitive, WholeWord } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import * as pdfjsLib from 'pdfjs-dist'

export interface SearchMatch {
  id: string
  pageNumber: number
  x: number
  y: number
  width: number
  height: number
  text: string
}

interface PdfSearchBarProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null
  isOpen: boolean
  onClose: () => void
  onJumpToMatch: (match: SearchMatch) => void
  onMatchesChange: (matches: SearchMatch[], activeIndex: number) => void
}

export function PdfSearchBar({
  pdfDoc,
  isOpen,
  onClose,
  onJumpToMatch,
  onMatchesChange,
}: PdfSearchBarProps) {
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<SearchMatch[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isSearching, setIsSearching] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [matchWholeWord, setMatchWholeWord] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
        inputRef.current?.select()
      }, 50)
    } else {
      setQuery('')
      setMatches([])
      setActiveIndex(0)
      onMatchesChange([], 0)
    }
  }, [isOpen])

  // Search logic across all pages
  const performSearch = useCallback(async (searchStr: string, isCaseSensitive: boolean, isWholeWord: boolean) => {
    if (!pdfDoc || !searchStr.trim()) {
      setMatches([])
      setActiveIndex(0)
      onMatchesChange([], 0)
      return
    }

    setIsSearching(true)
    const foundMatches: SearchMatch[] = []
    const term = isCaseSensitive ? searchStr : searchStr.toLowerCase()

    try {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum)
        const viewport = page.getViewport({ scale: 1 })
        const textContent = await page.getTextContent()

        for (const item of textContent.items as any[]) {
          if (!item.str) continue
          const rawStr = item.str
          const itemText = isCaseSensitive ? rawStr : rawStr.toLowerCase()

          let matchStart = 0
          while (matchStart < itemText.length) {
            let index = -1
            if (isWholeWord) {
              const regex = new RegExp(`\\b${escapeRegExp(term)}\\b`, isCaseSensitive ? 'g' : 'gi')
              regex.lastIndex = matchStart
              const match = regex.exec(rawStr)
              if (match) {
                index = match.index
              }
            } else {
              index = itemText.indexOf(term, matchStart)
            }

            if (index === -1) break

            // Transform PDF item coordinates to Top-Left origin in PDF points
            const tx = item.transform
            const itemX = tx[4]
            const itemY = viewport.height - tx[5] - (item.height || Math.abs(tx[0]))
            const charWidth = item.width / Math.max(1, rawStr.length)
            const matchX = itemX + index * charWidth
            const matchWidth = term.length * charWidth
            const matchHeight = item.height || Math.abs(tx[0]) || 12

            foundMatches.push({
              id: `${pageNum}-${index}-${matchX}-${itemY}`,
              pageNumber: pageNum,
              x: matchX,
              y: itemY,
              width: matchWidth,
              height: matchHeight,
              text: rawStr.substring(index, index + term.length),
            })

            matchStart = index + Math.max(1, term.length)
          }
        }
      }

      setMatches(foundMatches)
      const nextIdx = foundMatches.length > 0 ? 0 : -1
      setActiveIndex(nextIdx)
      onMatchesChange(foundMatches, nextIdx)

      if (foundMatches.length > 0) {
        onJumpToMatch(foundMatches[0])
      }
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }, [pdfDoc, onMatchesChange, onJumpToMatch])

  // Debounced search trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, caseSensitive, matchWholeWord)
    }, 150)
    return () => clearTimeout(timer)
  }, [query, caseSensitive, matchWholeWord, performSearch])

  const goToNext = () => {
    if (matches.length === 0) return
    const nextIdx = (activeIndex + 1) % matches.length
    setActiveIndex(nextIdx)
    onMatchesChange(matches, nextIdx)
    onJumpToMatch(matches[nextIdx])
  }

  const goToPrev = () => {
    if (matches.length === 0) return
    const prevIdx = (activeIndex - 1 + matches.length) % matches.length
    setActiveIndex(prevIdx)
    onMatchesChange(matches, prevIdx)
    onJumpToMatch(matches[prevIdx])
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        goToPrev()
      } else {
        goToNext()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={{ duration: 0.15 }}
          className="fixed top-16 right-4 sm:right-8 z-40 flex items-center gap-1.5 p-1.5 bg-background/95 dark:bg-slate-900/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl text-xs select-none min-w-[280px] sm:min-w-[340px]"
        >
          <div className="flex items-center gap-1.5 flex-1 bg-muted/60 dark:bg-slate-800/60 px-2 py-1 rounded-xl">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Find in document..."
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none font-medium"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground p-0.5 rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Match Counter Badge */}
          {query.trim() && (
            <span className="text-[11px] font-mono text-muted-foreground px-1 shrink-0 whitespace-nowrap">
              {matches.length > 0 ? (
                <span>
                  <strong className="text-foreground">{activeIndex + 1}</strong> of {matches.length}
                </span>
              ) : isSearching ? (
                'Searching…'
              ) : (
                '0 found'
              )}
            </span>
          )}

          {/* Controls */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg"
              disabled={matches.length === 0}
              onClick={goToPrev}
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg"
              disabled={matches.length === 0}
              onClick={goToNext}
              title="Next match (Enter)"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 rounded-lg ${caseSensitive ? 'bg-emerald-500/15 text-emerald-600 font-bold' : 'text-muted-foreground'}`}
              onClick={() => setCaseSensitive(!caseSensitive)}
              title="Match case"
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 rounded-lg ${matchWholeWord ? 'bg-emerald-500/15 text-emerald-600 font-bold' : 'text-muted-foreground'}`}
              onClick={() => setMatchWholeWord(!matchWholeWord)}
              title="Match whole word"
            >
              <WholeWord className="w-3.5 h-3.5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
