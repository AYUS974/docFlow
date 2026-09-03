'use client'

import { useAppStore } from '@/store/app-store'
import { Navbar } from '@/components/navbar'
import { LandingPage } from '@/components/landing/landing-page'
import { PdfEditor } from '@/components/editor/pdf-editor'
import { Dashboard } from '@/components/dashboard/dashboard'
import { PricingPage } from '@/components/pricing/pricing-page'
import { useEffect, useState, useRef } from 'react'

export default function Home() {
  const { currentView, setView } = useAppStore()
  const [mounted, setMounted] = useState(false)
  const isPopStateRef = useRef(false)

  // Initialize from URL search params on first mount
  useEffect(() => {
    setMounted(true)
    const params = new URLSearchParams(window.location.search)
    const viewParam = params.get('view')
    if (viewParam === 'dashboard' || viewParam === 'pricing' || viewParam === 'editor') {
      setView(viewParam)
    }
  }, [setView])

  // Sync state to URL and browser history
  useEffect(() => {
    if (!mounted) return

    if (isPopStateRef.current) {
      isPopStateRef.current = false
      return
    }

    const currentParams = new URLSearchParams(window.location.search)
    const currentParamView = currentParams.get('view') || 'landing'

    if (currentParamView !== currentView) {
      const url = currentView === 'landing' ? window.location.pathname : `?view=${currentView}`
      window.history.pushState({ view: currentView }, '', url)
    }
  }, [currentView, mounted])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      isPopStateRef.current = true
      const stateView = e.state?.view
      if (stateView) {
        setView(stateView)
      } else {
        const params = new URLSearchParams(window.location.search)
        const v = params.get('view')
        if (v === 'dashboard' || v === 'pricing' || v === 'editor') {
          setView(v)
        } else {
          setView('landing')
        }
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [setView])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      {currentView !== 'editor' && <Navbar />}

      <main className="flex-1">
        {currentView === 'landing' && <LandingPage />}
        {currentView === 'editor' && <PdfEditor />}
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'pricing' && <PricingPage />}
      </main>

      {/* Minimal Footer for Dashboard/Pricing views */}
      {currentView !== 'editor' && currentView !== 'landing' && (
        <footer className="py-8 border-t border-border/40 bg-background/50 flex flex-col justify-center items-center gap-3 shrink-0">
          <a
            href="https://www.ayuslabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-sm hover:border-white/20 hover:bg-white/[0.06] transition-all text-xs font-medium text-foreground/90 shadow-[0_0_22px_rgba(120,120,255,0.07)] hover:shadow-[0_0_28px_rgba(120,120,255,0.14)]"
          >
            <span>Powered By</span>
            <img
              src="/ayus-logo.jpeg"
              alt="AYUS Labs"
              className="w-6 h-6 rounded-full object-cover ring-1 ring-white/10"
            />
          </a>
          <p className="text-xs text-muted-foreground/70">
            &copy; 2026 DocFlow &middot; The Modern PDF Editor
          </p>
        </footer>
      )}

      {/* Global drag & drop for PDF files when on dashboard */}
      {currentView === 'dashboard' && <GlobalDropZone />}
    </div>
  )
}

function GlobalDropZone() {
  const { processPdfFile } = useAppStore()

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }
    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (file && file.type === 'application/pdf') {
        processPdfFile(file)
      }
    }
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)
    return () => {
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [processPdfFile])

  return null
}