'use client'

import { useAppStore } from '@/store/app-store'
import { Navbar } from '@/components/navbar'
import { LandingPage } from '@/components/landing/landing-page'
import { PdfEditor } from '@/components/editor/pdf-editor'
import { Dashboard } from '@/components/dashboard/dashboard'
import { PricingPage } from '@/components/pricing/pricing-page'
import { useEffect, useState } from 'react'

export default function Home() {
  const { currentView } = useAppStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      // Keep internal state in sync
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

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
        <footer className="py-6 border-t border-border/40 bg-background/50 flex justify-center items-center shrink-0">
          <a
            href="https://ayuslabs.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-border/60 bg-[#0c0f16] hover:bg-[#121622] text-[#f8fafc] hover:text-[#ffffff] transition-all text-xs font-semibold shadow-sm shrink-0"
          >
            <span>Powered By</span>
            <img
              src="/ayus-logo.jpeg"
              alt="AYUS Labs"
              className="w-5.5 h-5.5 rounded-full object-cover"
            />
          </a>
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