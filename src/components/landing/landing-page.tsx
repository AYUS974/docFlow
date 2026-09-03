'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import {
  FileText,
  PenTool,
  Zap,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  Upload,
  Highlighter,
  Download,
  Globe,
  Pencil,
  Stamp,
  EyeOff,
  FileDown,
  FilePlus,
  Scissors,
  ShieldCheck,
  Shield,
  Lock,
  Mail,
  Layers,
  Calendar,
  ExternalLink,
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

function HeroMockupPreview() {
  const [activeTool, setActiveTool] = useState<'highlight' | 'edit' | 'sign' | 'redact' | 'ai'>('highlight')

  return (
    <div className="relative w-full rounded-2xl md:rounded-3xl p-1.5 sm:p-3 bg-gradient-to-b from-border/80 via-border/40 to-border/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] backdrop-blur-xl border border-white/20 dark:border-white/10">
      {/* Background radial glow */}
      <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/20 blur-3xl pointer-events-none" />

      {/* Floating Badges */}
      <motion.div
        animate={{ y: [-4, 6, -4] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="hidden md:flex absolute -top-5 -left-4 z-20 items-center gap-2.5 px-4 py-2 rounded-xl bg-background/90 dark:bg-card/90 backdrop-blur-md border border-emerald-500/30 shadow-lg shadow-emerald-500/10 text-xs font-semibold text-foreground"
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <Zap className="w-3.5 h-3.5" />
        </div>
        <span>In-Place Text Editing Active</span>
      </motion.div>

      <motion.div
        animate={{ y: [6, -5, 6] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="hidden md:flex absolute -bottom-5 -right-4 z-20 items-center gap-2.5 px-4 py-2 rounded-xl bg-background/90 dark:bg-card/90 backdrop-blur-md border border-emerald-500/30 shadow-lg shadow-emerald-500/10 text-xs font-semibold text-foreground"
      >
        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="w-3.5 h-3.5" />
        </div>
        <span>100% Client-Side Privacy</span>
      </motion.div>

      {/* Main Mockup Window */}
      <div className="w-full rounded-xl md:rounded-2xl bg-card border border-border/60 overflow-hidden flex flex-col text-left shadow-2xl">
        {/* Top Window Title Bar */}
        <div className="px-4 py-3 bg-muted/40 border-b border-border/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80 hover:opacity-100 transition-opacity" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:opacity-100 transition-opacity" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:opacity-100 transition-opacity" />
            <span className="hidden sm:inline-block ml-3 text-xs font-medium text-muted-foreground truncate max-w-[200px]">
              Master_Agreement_2026.pdf
            </span>
          </div>

          {/* Interactive Tool Selector Tabs */}
          <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border/60 text-xs">
            <button
              onClick={() => setActiveTool('highlight')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                activeTool === 'highlight'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Highlight</span>
            </button>
            <button
              onClick={() => setActiveTool('edit')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                activeTool === 'edit'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Pencil className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Text</span>
            </button>
            <button
              onClick={() => setActiveTool('sign')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                activeTool === 'sign'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Stamp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign</span>
            </button>
            <button
              onClick={() => setActiveTool('redact')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                activeTool === 'redact'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Redact</span>
            </button>
            <button
              onClick={() => setActiveTool('ai')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                activeTool === 'ai'
                  ? 'bg-emerald-600 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Analysis</span>
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted">Page 1 / 3</span>
            <span className="px-2 py-0.5 rounded bg-muted">100%</span>
          </div>
        </div>

        {/* Mock Canvas Area */}
        <div className="p-4 sm:p-8 bg-muted/20 flex items-center justify-center min-h-[360px] sm:min-h-[420px] relative">
          {/* Simulated PDF Paper Page */}
          <div className="w-full max-w-2xl bg-card rounded-lg border border-border/80 p-6 sm:p-10 shadow-lg relative text-foreground">
            {/* Document Header */}
            <div className="border-b border-border/60 pb-4 mb-6 flex items-start justify-between">
              <div>
                <h4 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  ENTERPRISE SERVICES & PARTNERSHIP AGREEMENT
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  DocFlow Technology Group &bull; Reference: #DF-2026-904
                </p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
            </div>

            {/* Document Content with Active Interactive Annotations */}
            <div className="space-y-4 text-xs sm:text-sm text-foreground/90 leading-relaxed font-sans">
              <div>
                <span className="font-semibold text-foreground">1. Scope of Engagement. </span>
                <span>
                  The service provider agrees to deliver end-to-end PDF processing systems, real-time collaboration engines, and encrypted document storage.
                </span>
              </div>

              {/* Clause 2 with Interactive Highlights / Edits */}
              <div className="p-2.5 rounded-lg border border-transparent transition-colors duration-300">
                <span className="font-semibold text-foreground">2. Confidentiality & Security. </span>
                <span>
                  All proprietary document contents shall be encrypted at rest and in transit.
                </span>{' '}
                <span
                  className={`transition-all duration-300 rounded px-1.5 py-0.5 ${
                    activeTool === 'highlight'
                      ? 'bg-amber-300/40 dark:bg-amber-400/30 text-amber-950 dark:text-amber-200 border-b-2 border-amber-500 font-medium'
                      : 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  &ldquo;Neither party will retain or transmit unencrypted document tokens outside the browser context.&rdquo;
                </span>
              </div>

              {/* Clause 3 with In-place Edit Showcase */}
              <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">3. Service Retainer Fee</span>
                  {activeTool === 'edit' && (
                    <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full animate-pulse">
                      Live Text Editing
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span>Authorized monthly retainer is:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-500/10 font-mono font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    $18,500.00 / mo
                    {activeTool === 'edit' && <span className="inline-block w-1.5 h-4 bg-emerald-500 ml-1 animate-ping" />}
                  </span>
                </div>
              </div>

              {/* Clause 4 with Redaction Showcase */}
              <div>
                <span className="font-semibold text-foreground">4. Tax & Bank Identifiers: </span>
                <span
                  className={`inline-block transition-all duration-300 px-2 py-0.5 rounded ${
                    activeTool === 'redact'
                      ? 'bg-foreground text-background font-mono text-xs select-none'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {activeTool === 'redact' ? '████-████-9941 (REDACTED)' : 'US-TAX-ID-9941'}
                </span>
              </div>

              {/* Signature Section */}
              <div className="pt-4 mt-4 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Authorized Signature</div>
                  <div className="font-serif italic text-lg sm:text-xl text-emerald-700 dark:text-emerald-400 tracking-wide mt-0.5">
                    Jonathan Vance
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-xs font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Verified PKI Signature</span>
                </div>
              </div>
            </div>

            {/* Floating AI Popup if AI tool is selected */}
            {activeTool === 'ai' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute right-4 bottom-14 z-30 max-w-xs p-3.5 rounded-xl bg-background/95 border border-emerald-500/40 shadow-2xl backdrop-blur-lg"
              >
                <div className="flex items-center gap-2 mb-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>DocFlow AI Summary</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Clause 2 & 3 comply with standard enterprise SLA guidelines. No liabilities or abnormal obligations detected.
                </p>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const features = [
  {
    icon: Pencil,
    badge: 'Core Feature',
    title: 'Edit Existing Text',
    description:
      'Click directly on any text in your PDF to edit it in place. Unlike basic editors that only overlay text, DocFlow extracts original text positions and lets you modify content right where it lives.',
  },
  {
    icon: Stamp,
    badge: 'E-Sign',
    title: 'Signatures',
    description:
      'Add your signature three ways: draw it freehand on a pad, type your name in cursive, or upload an image. Place it anywhere on the document with a single click and export permanently embedded.',
  },
  {
    icon: EyeOff,
    badge: 'Security',
    title: 'Redaction & Whiteout',
    description:
      'Permanently remove sensitive information with opaque black bars or clean whiteout erase. Both are vector-embedded into the exported PDF ensuring the data cannot be recovered.',
  },
  {
    icon: Highlighter,
    badge: 'Annotation',
    title: 'Smart Highlighting',
    description:
      'Highlight key passages with customizable colors. Instantly draw attention to important sections across multi-page documents with clean semi-transparent color overlays.',
  },
  {
    icon: PenTool,
    badge: 'Drawing',
    title: 'Freehand Drawing & Shapes',
    description:
      'Sketch ideas, draw arrows, circles, and rectangles with full control over stroke and color. Every annotation is vector-embedded for crisp output at any zoom level.',
  },
  {
    icon: FilePlus,
    badge: 'Workflow',
    title: 'Merge & Split',
    description:
      'Combine multiple PDFs into a single document, or split a large file by custom page ranges. Instant processing with seamless downloads.',
  },
  {
    icon: FileDown,
    badge: 'Optimization',
    title: 'Compress PDFs',
    description:
      'Reduce file sizes by stripping unused objects and optimizing PDF structures. See the exact compression savings before downloading.',
  },
  {
    icon: Scissors,
    badge: 'Organize',
    title: 'Page Management',
    description:
      'Rotate, reorder, delete, and extract pages from the sidebar. Drag pages into the right order or extract specific page ranges into new files.',
  },
  {
    icon: Download,
    badge: 'Export',
    title: 'Export with All Edits',
    description:
      'Download your fully edited PDF with text changes, annotations, signatures, redactions, and page rotations completely preserved and compliant with all PDF standards.',
  },
]

const testimonials = [
  {
    name: 'Sarah Chen',
    role: 'Product Manager at TechCorp',
    content:
      'DocFlow has completely transformed our document review process. What used to take days of back-and-forth emails now happens in minutes with real-time annotations.',
    rating: 5,
  },
  {
    name: 'Marcus Rivera',
    role: 'Freelance Designer',
    content:
      'The drawing and shape tools are incredibly intuitive. I use DocFlow for every client review now — it makes collecting feedback so much more efficient than screenshots.',
    rating: 5,
  },
  {
    name: 'Emily Watson',
    role: 'Legal Consultant',
    content:
      'As someone who reviews contracts daily, DocFlow\'s highlighting and text annotation tools have become indispensable. Fast, reliable, and beautifully designed.',
    rating: 5,
  },
]

export function LandingPage() {
  const { setView, login } = useAppStore()
  const [activeModal, setActiveModal] = useState<'roadmap' | 'privacy' | 'contact' | null>(null)

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Ambient background glows */}
      <div className="glow-orb-emerald top-[-100px] left-1/2 -translate-x-1/2 opacity-70 dark:opacity-50" />
      <div className="glow-orb-cyan top-[600px] -left-40 opacity-50 dark:opacity-30" />
      <div className="glow-orb-emerald top-[1200px] -right-40 opacity-40 dark:opacity-20" />

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="grid-pattern absolute inset-0 opacity-30 dark:opacity-20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="mb-6 flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 backdrop-blur-md shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                <span>Next-Gen PDF Editor with Smart AI Annotations</span>
              </div>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-foreground"
            >
              Edit PDFs with
              <br />
              <span className="gradient-text">effortless precision</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              DocFlow brings professional-grade PDF editing right to your browser.
              Annotate, edit text in-place, e-sign, and collaborate with zero software installation.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 h-12 text-base rounded-xl shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/40 hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => {
                  login('Demo User', 'demo@docflow.io')
                  setView('dashboard')
                }}
              >
                <Upload className="w-5 h-5" />
                Start Editing Free
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto gap-2 px-8 h-12 text-base rounded-xl border-border/80 bg-background/60 backdrop-blur-sm hover:bg-muted/60 transition-all duration-200"
                onClick={() => {
                  const section = document.getElementById('how-it-works')
                  section?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                See How It Works
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            {/* Live Interactive Hero Mockup */}
            <motion.div variants={fadeUp} className="w-full max-w-5xl mx-auto">
              <HeroMockupPreview />
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeUp}
              className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto pt-8 border-t border-border/40"
            >
              {[
                { value: '50K+', label: 'Documents edited' },
                { value: '12K+', label: 'Active users' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {stat.value}
                  </div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="mb-3">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5">
                Feature Rich
              </Badge>
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4 tracking-tight">
              Everything you need to edit PDFs
            </motion.h2>
            <motion.p variants={fadeUp} className="text-base sm:text-lg text-muted-foreground">
              Powerful annotation and editing tools designed for speed and simplicity.
              Zero bloat, zero learning curve.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            {features.map((feature) => (
              <motion.div key={feature.title} variants={fadeUp}>
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between group hover:border-emerald-500/40 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all duration-300 pointer-events-none" />
                  
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/40 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                        <feature.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/40">
                        {feature.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 sm:py-28 bg-muted/20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">
              Three steps to perfect documents
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
              From upload to finished edit in under a minute.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            {[
              {
                step: '01',
                icon: Upload,
                title: 'Upload Your PDF',
                description:
                  'Drag and drop or click to upload any PDF document. Files are processed instantly in your browser — zero external uploads.',
              },
              {
                step: '02',
                icon: Zap,
                title: 'Edit & Annotate',
                description:
                  'Use the intuitive toolbar to highlight text, edit copy in place, type comments, or draw shapes with keyboard shortcuts.',
              },
              {
                step: '03',
                icon: Download,
                title: 'Export & Share',
                description:
                  'Download your edited PDF with all annotations permanently preserved. Share the final document with anyone.',
              },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/30 flex items-center justify-center">
                    <item.icon className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">
              Loved by thousands of users
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
              See why professionals choose DocFlow for their document editing needs.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp}>
                <div className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex gap-1 mb-4">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <Star
                          key={i}
                          className="w-4 h-4 fill-amber-400 text-amber-400"
                        />
                      ))}
                    </div>
                    <p className="text-sm leading-relaxed mb-6 text-foreground/90">
                      &ldquo;{t.content}&rdquo;
                    </p>
                  </div>
                  <div className="flex items-center gap-3 pt-4 border-t border-border/40">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {t.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-600 overflow-hidden p-10 sm:p-16 text-center shadow-2xl shadow-emerald-600/20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.2),transparent)]" />
            <div className="relative">
              <Globe className="w-12 h-12 text-white/90 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to transform your workflow?
              </h2>
              <p className="text-emerald-100 text-base sm:text-lg max-w-xl mx-auto mb-8">
                Join thousands of professionals who already use DocFlow to edit,
                annotate, and share PDF documents faster than ever.
              </p>
              <Button
                size="lg"
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold gap-2 px-8 h-12 text-base rounded-xl shadow-xl hover:scale-105 transition-all duration-200"
                onClick={() => {
                  login('Demo User', 'demo@docflow.io')
                  setView('dashboard')
                }}
              >
                <Zap className="w-5 h-5 text-emerald-600" />
                Get Started — It&apos;s Free
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 bg-muted/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold">
                  Doc<span className="text-emerald-600">Flow</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                The modern PDF editor built for professionals who value speed,
                simplicity, and beautiful design.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Product</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => {
                      const el = document.getElementById('features')
                      el?.scrollIntoView({ behavior: 'smooth' })
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Features
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setView('pricing')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Pricing
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal('roadmap')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Changelog & Roadmap
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setActiveModal('contact')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal('contact')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Contact & Support
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal('contact')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Careers
                  </button>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Legal & Trust</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setActiveModal('privacy')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Privacy Policy
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal('privacy')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Terms of Service
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveModal('privacy')}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                  >
                    Security & GDPR
                  </button>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/40 pt-8 flex flex-col items-center gap-4">
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

            <p className="text-sm text-muted-foreground">
              &copy; 2026 DocFlow &middot; An AYUS Labs Creation. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Roadmap & Changelog Modal */}
      <Dialog open={activeModal === 'roadmap'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle>Product Changelog & Roadmap</DialogTitle>
            <DialogDescription>
              Explore what is new in DocFlow and what we are building next.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-600 text-white">v2.4 (Current Release)</Badge>
                <span className="text-xs text-muted-foreground">September 2026</span>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> In-Place Native PDF Text Editing & Font Matching</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> AI Document Assistant with contextual document search</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Workspace-scoped persistent file storage</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600 shrink-0" /> Multi-file PDF Merge, Split, Compress & Extract tools</li>
              </ul>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5">Q4 2026 (Upcoming)</Badge>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Layers className="w-4 h-4 text-blue-500 shrink-0" /> Real-time multi-user live collaborative annotations</li>
                <li className="flex items-center gap-2"><Zap className="w-4 h-4 text-blue-500 shrink-0" /> OCR Multi-language text extraction & scanned PDF search</li>
                <li className="flex items-center gap-2"><Globe className="w-4 h-4 text-blue-500 shrink-0" /> Direct cloud integration (Google Drive, OneDrive, Dropbox)</li>
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy & Security Modal */}
      <Dialog open={activeModal === 'privacy'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle>Privacy, Security & GDPR Compliance</DialogTitle>
            <DialogDescription>
              Your document privacy is our highest priority.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm text-muted-foreground leading-relaxed">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-emerald-600" /> Client-Side Processing
              </h4>
              <p className="text-xs">
                DocFlow renders and processes document annotations directly in your web browser via WebAssembly and Canvas. Your raw documents are not shared with third parties.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-emerald-600" /> Workspace Isolation & Encryption
              </h4>
              <p className="text-xs">
                Each workspace session is strictly isolated using secure HTTP cookies and encrypted at rest using AES-256 and in transit via TLS 1.3.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60">
              <h4 className="font-semibold text-foreground text-sm flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-emerald-600" /> GDPR & SOC 2 Standards
              </h4>
              <p className="text-xs">
                You maintain 100% ownership of all uploaded and edited files. You can delete your documents and workspace data permanently at any time.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact & Support Modal */}
      <Dialog open={activeModal === 'contact'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
              <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <DialogTitle>Contact & AYUS Labs</DialogTitle>
            <DialogDescription>
              We are here to help with questions, enterprise plans, or feature requests.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/60 space-y-2">
              <div className="font-medium text-foreground">DocFlow Support Team</div>
              <p className="text-xs text-muted-foreground">
                Email: <span className="font-mono text-emerald-600 select-all">support@docflow.io</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Organization: <span className="font-medium text-foreground">AYUS Labs</span>
              </p>
            </div>
            <a
              href="https://www.ayuslabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            >
              <span>Visit AYUS Labs Official Site</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}