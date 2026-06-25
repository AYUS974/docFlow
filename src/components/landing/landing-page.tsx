'use client'

import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import {
  FileText,
  PenTool,
  Layers,
  Zap,
  Shield,
  Users,
  ArrowRight,
  Check,
  Star,
  Sparkles,
  Upload,
  Highlighter,
  Type,
  MousePointer2,
  Download,
  Globe,
  Pencil,
  Stamp,
  EyeOff,
  FileDown,
  FilePlus,
  Scissors,
} from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

const features = [
  {
    icon: Pencil,
    title: 'Edit Existing Text',
    description:
      'Click directly on any text in your PDF to edit it in place. Unlike basic editors that only overlay text, DocFlow extracts the original text positions and lets you modify content right where it lives, then re-embeds your changes into the exported PDF.',
  },
  {
    icon: Stamp,
    title: 'Signatures',
    description:
      'Add your signature three ways: draw it freehand on a pad, type your name in a cursive font, or upload a signature image. Place it anywhere on the document with a single click, then export it permanently embedded in the PDF.',
  },
  {
    icon: EyeOff,
    title: 'Redaction & Whiteout',
    description:
      'Permanently remove sensitive information with the redaction tool that draws opaque black bars. Use whiteout to cleanly erase areas. Both are embedded into the final PDF, ensuring the data cannot be recovered.',
  },
  {
    icon: Highlighter,
    title: 'Smart Highlighting',
    description:
      'Highlight key passages with customizable colors. Instantly draw attention to important sections across multi-page documents with semi-transparent color overlays that preserve readability.',
  },
  {
    icon: PenTool,
    title: 'Freehand Drawing & Shapes',
    description:
      'Sketch ideas, draw arrows, circles, and rectangles with full control over color and stroke width. Every annotation is vector-embedded in the exported PDF for crisp output at any zoom level.',
  },
  {
    icon: FilePlus,
    title: 'Merge & Split',
    description:
      'Combine multiple PDFs into a single document, or split a large file by page ranges like "1-3, 5, 7-end". All processing happens server-side with instant download of the result.',
  },
  {
    icon: FileDown,
    title: 'Compress PDFs',
    description:
      'Reduce file sizes by stripping unused objects and optimizing the PDF structure. See the exact compression percentage before downloading. Perfect for email attachments and web uploads.',
  },
  {
    icon: Scissors,
    title: 'Page Management',
    description:
      'Rotate, reorder, delete, and extract pages from the sidebar. Drag pages into the right order, rotate individual pages by 90-degree increments, or extract specific ranges into a new file.',
  },
  {
    icon: Download,
    title: 'Export with All Edits',
    description:
      'Download your fully edited PDF with text changes, annotations, signatures, redactions, and page rotations all embedded. Every edit is preserved in the exported file using professional PDF libraries.',
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

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for getting started with basic PDF editing',
    features: [
      'Up to 3 documents',
      'Basic annotation tools',
      'Highlight & draw',
      'Standard export',
      'Community support',
    ],
    cta: 'Get Started Free',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$12',
    period: '/month',
    description: 'For professionals who need powerful PDF editing daily',
    features: [
      'Unlimited documents',
      'All annotation tools',
      'Shape & text tools',
      'High-quality export',
      'Priority support',
      'Custom colors & fonts',
      'Document templates',
    ],
    cta: 'Start Pro Trial',
    popular: true,
  },
  {
    name: 'Team',
    price: '$29',
    period: '/user/month',
    description: 'Collaborative editing for teams and organizations',
    features: [
      'Everything in Pro',
      'Real-time collaboration',
      'Team workspaces',
      'Admin controls',
      'API access',
      'SSO integration',
      'Dedicated support',
      'Custom branding',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

export function LandingPage() {
  const { setView, login } = useAppStore()

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="hero-bg relative overflow-hidden">
        <div className="grid-pattern absolute inset-0 opacity-40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-20 sm:pb-32">
          <motion.div
            className="text-center max-w-4xl mx-auto"
            initial="initial"
            animate="animate"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="mb-6">
              <Badge
                variant="secondary"
                className="px-4 py-1.5 text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Now with AI-powered smart annotations
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6"
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
              Annotate, highlight, draw, and collaborate — no downloads, no hassle,
              no limits on creativity.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-8 h-12 text-base rounded-xl shadow-lg shadow-emerald-600/20"
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
                className="w-full sm:w-auto gap-2 px-8 h-12 text-base rounded-xl"
                onClick={() => {
                  const section = document.getElementById('features')
                  section?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                See How It Works
                <ArrowRight className="w-4 h-4" />
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              variants={fadeUp}
              className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto"
            >
              {[
                { value: '50K+', label: 'Documents edited' },
                { value: '12K+', label: 'Active users' },
                { value: '99.9%', label: 'Uptime' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-600">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to edit PDFs
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
              Powerful annotation tools designed for speed and simplicity.
              No bloat, no learning curve — just open and edit.
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
                <Card className="h-full hover:shadow-lg hover:shadow-emerald-600/5 transition-all duration-300 hover:-translate-y-1 border-border/60 bg-card/80">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                      <feature.icon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 sm:py-28 bg-muted/30">
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
                  'Drag and drop or click to upload any PDF document. Files are processed instantly in your browser — nothing is sent to external servers.',
              },
              {
                step: '02',
                icon: Zap,
                title: 'Edit & Annotate',
                description:
                  'Use the intuitive toolbar to highlight text, add freehand drawings, type comments, or draw shapes. Switch tools instantly with keyboard shortcuts.',
              },
              {
                step: '03',
                icon: Download,
                title: 'Export & Share',
                description:
                  'Download your edited PDF with all annotations preserved. Share the final document with anyone — no special software needed to view your changes.',
              },
            ].map((item) => (
              <motion.div key={item.step} variants={fadeUp} className="text-center">
                <div className="relative inline-flex mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <item.icon className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
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
                <Card className="h-full border-border/60">
                  <CardContent className="p-6">
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
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {t.name.split(' ').map((n) => n[0]).join('')}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="text-center max-w-2xl mx-auto mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-muted-foreground">
              Start for free. Upgrade when you need more power.
            </motion.p>
          </motion.div>

          <motion.div
            className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, margin: '-100px' }}
            variants={stagger}
          >
            {plans.map((plan) => (
              <motion.div key={plan.name} variants={fadeUp}>
                <Card
                  className={`h-full relative ${
                    plan.popular
                      ? 'border-emerald-500 shadow-lg shadow-emerald-600/10'
                      : 'border-border/60'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-emerald-600 text-white px-3 py-1">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardContent className="p-6 pt-8">
                    <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {plan.description}
                    </p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm ml-1">
                        {plan.period}
                      </span>
                    </div>
                    <Button
                      className={`w-full mb-6 rounded-xl h-11 ${
                        plan.popular
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : ''
                      }`}
                      variant={plan.popular ? 'default' : 'outline'}
                      onClick={() => {
                        login('Demo User', 'demo@docflow.io')
                        setView('dashboard')
                      }}
                    >
                      {plan.cta}
                    </Button>
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          <Check className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-16 border-y border-border/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Trusted by teams at
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 opacity-50">
            {['Acme Corp', 'Globex', 'Initech', 'Umbrella', 'Stark Industries', 'Wayne Ent.'].map(
              (company) => (
                <div
                  key={company}
                  className="text-lg sm:text-xl font-bold text-muted-foreground"
                >
                  {company}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="relative rounded-3xl bg-emerald-600 overflow-hidden p-10 sm:p-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
            <div className="relative">
              <Globe className="w-12 h-12 text-white/80 mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to transform your workflow?
              </h2>
              <p className="text-emerald-100 text-lg max-w-xl mx-auto mb-8">
                Join thousands of professionals who already use DocFlow to edit,
                annotate, and share PDF documents faster than ever.
              </p>
              <Button
                size="lg"
                className="bg-white text-emerald-700 hover:bg-emerald-50 gap-2 px-8 h-12 text-base rounded-xl shadow-lg"
                onClick={() => {
                  login('Demo User', 'demo@docflow.io')
                  setView('dashboard')
                }}
              >
                <Zap className="w-5 h-5" />
                Get Started — It&apos;s Free
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12">
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
                {['Features', 'Pricing', 'Changelog', 'Roadmap'].map((item) => (
                  <li key={item}>
                    <button
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => {
                        if (item === 'Pricing') {
                          const section = document.getElementById('pricing')
                          section?.scrollIntoView({ behavior: 'smooth' })
                        }
                      }}
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Company</h4>
              <ul className="space-y-2">
                {['About', 'Blog', 'Careers', 'Contact'].map((item) => (
                  <li key={item}>
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm">Legal</h4>
              <ul className="space-y-2">
                {['Privacy Policy', 'Terms of Service', 'Security', 'GDPR'].map(
                  (item) => (
                    <li key={item}>
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </li>
                  )
                )}
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

            <div className="flex flex-col items-center gap-1.5 text-center">
              <p className="text-sm text-muted-foreground">
                &copy; 2026 DocFlow. All rights reserved.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                <Shield className="w-3.5 h-3.5" />
                <span>SOC 2 Certified &middot; GDPR Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}