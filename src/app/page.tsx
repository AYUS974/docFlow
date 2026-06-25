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