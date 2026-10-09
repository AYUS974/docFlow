'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface ThumbnailStripProps {
  isOpen: boolean
  thumbnails: { page: number; dataUrl: string }[]
  currentPage: number
  onSelectPage: (page: number) => void
  onClose?: () => void
}

export function PdfThumbnailStrip({
  isOpen,
  thumbnails,
  currentPage,
  onSelectPage,
}: ThumbnailStripProps) {
  if (!isOpen || thumbnails.length <= 1) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.95 }}
        transition={{ duration: 0.15 }}
        className="fixed md:absolute bottom-16 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 p-2 bg-background/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-border/80 shadow-2xl rounded-2xl max-w-[90vw] overflow-x-auto scrollbar-thin select-none"
      >
        {thumbnails.map((thumb) => {
          const isCurrent = thumb.page === currentPage
          return (
            <button
              key={thumb.page}
              onClick={() => onSelectPage(thumb.page)}
              className={`group flex flex-col items-center gap-1 shrink-0 p-1 rounded-xl transition-all ${
                isCurrent
                  ? 'bg-emerald-500/10 ring-2 ring-emerald-500 shadow-md scale-105'
                  : 'hover:bg-muted/80 opacity-70 hover:opacity-100 hover:scale-102'
              }`}
            >
              <div className="w-14 sm:w-16 h-18 sm:h-20 bg-white rounded-lg overflow-hidden border border-border/60 shadow-xs flex items-center justify-center relative">
                <img
                  src={thumb.dataUrl}
                  alt={`Page ${thumb.page}`}
                  className="w-full h-full object-contain"
                />
                {isCurrent && (
                  <div className="absolute inset-0 border-2 border-emerald-500 rounded-lg pointer-events-none" />
                )}
              </div>
              <span
                className={`text-[10px] font-semibold ${
                  isCurrent ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                }`}
              >
                Page {thumb.page}
              </span>
            </button>
          )
        })}
      </motion.div>
    </AnimatePresence>
  )
}
