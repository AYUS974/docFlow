'use client'

import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { Check, Zap, ArrowLeft } from 'lucide-react'

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 },
}

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
}

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

const faqs = [
  {
    q: 'Can I try Pro features before paying?',
    a: 'Yes! Every new account gets a 14-day free trial of Pro features. No credit card required to start — you will only be asked for payment when the trial ends.',
  },
  {
    q: 'What file formats does DocFlow support?',
    a: 'DocFlow currently supports PDF files for viewing and editing. We support all standard PDF versions including PDF 1.4 through PDF 2.0. Support for additional formats is on our roadmap.',
  },
  {
    q: 'Are my documents stored securely?',
    a: 'Absolutely. All documents are encrypted at rest and in transit. We are SOC 2 Type II certified and GDPR compliant. Your data is never shared with third parties.',
  },
  {
    q: 'Can I cancel my subscription anytime?',
    a: 'Yes, you can cancel your subscription at any time from your account settings. Your access continues until the end of the billing period, and you can export all your documents.',
  },
  {
    q: 'Is there a limit on file size?',
    a: 'Free accounts support files up to 10MB. Pro accounts support files up to 100MB, and Team accounts support files up to 500MB. Larger files can be processed on Enterprise plans.',
  },
  {
    q: 'Do you offer discounts for nonprofits or education?',
    a: 'Yes! We offer 50% off for verified nonprofits and educational institutions. Contact our sales team with proof of status to activate the discount.',
  },
]

export function PricingPage() {
  const { setView, login } = useAppStore()

  return (
    <div className="min-h-[80vh]">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <Button variant="ghost" className="gap-2 mb-8" onClick={() => setView('landing')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>
      </div>

      {/* Hero */}
      <motion.div
        className="text-center max-w-3xl mx-auto px-4 mb-16"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        <motion.h1 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
          Simple, transparent pricing
        </motion.h1>
        <motion.p variants={fadeUp} className="text-lg text-muted-foreground max-w-xl mx-auto">
          Start for free. Upgrade when you need more power. No hidden fees, no surprises.
        </motion.p>
      </motion.div>

      {/* Plans */}
      <motion.div
        className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-20"
        initial="initial"
        animate="animate"
        variants={stagger}
      >
        <div className="grid md:grid-cols-3 gap-6">
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
        </div>
      </motion.div>

      {/* Feature Comparison */}
      <div className="bg-muted/30 py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2
            className="text-2xl sm:text-3xl font-bold text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            Feature Comparison
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="overflow-x-auto"
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 pr-4 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-3 px-4 font-medium">Free</th>
                  <th className="text-center py-3 px-4 font-medium text-emerald-600">Pro</th>
                  <th className="text-center py-3 pl-4 font-medium">Team</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Documents', '3', 'Unlimited', 'Unlimited'],
                  ['Highlight tool', true, true, true],
                  ['Freehand draw', true, true, true],
                  ['Text annotations', false, true, true],
                  ['Shape tools', false, true, true],
                  ['Export quality', 'Standard', 'High', 'High'],
                  ['Real-time collab', false, false, true],
                  ['API access', false, false, true],
                  ['Support', 'Community', 'Priority', 'Dedicated'],
                ].map(([feature, ...vals], i) => (
                  <tr key={String(feature)} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                    <td className="py-2.5 pr-4 text-muted-foreground">{feature}</td>
                    {vals.map((val, j) => (
                      <td key={j} className="text-center py-2.5 px-4">
                        {val === true ? (
                          <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                        ) : val === false ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <span className={j === 1 ? 'font-medium text-emerald-600' : ''}>
                            {val}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        <motion.h2
          className="text-2xl sm:text-3xl font-bold text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          Frequently Asked Questions
        </motion.h2>
        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="border-border/60">
                <CardContent className="p-5">
                  <h3 className="font-semibold mb-2 text-sm">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <motion.div
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <div className="rounded-2xl bg-emerald-600 p-8 sm:p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.15),transparent)]" />
          <div className="relative">
            <Zap className="w-10 h-10 text-white/80 mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              Start editing for free today
            </h2>
            <p className="text-emerald-100 mb-6 max-w-md mx-auto">
              No credit card required. Upload your first PDF and start annotating in seconds.
            </p>
            <Button
              size="lg"
              className="bg-white text-emerald-700 hover:bg-emerald-50 gap-2 px-8 rounded-xl"
              onClick={() => {
                login('Demo User', 'demo@docflow.io')
                setView('dashboard')
              }}
            >
              Get Started Free
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}