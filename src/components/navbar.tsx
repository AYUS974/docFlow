'use client'

import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import {
  FileText,
  LayoutDashboard,
  CreditCard,
  LogIn,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
} from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

export function Navbar() {
  const { currentView, setView, isLoggedIn, userName, login, logout } = useAppStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const navItems = [
    { label: 'Features', view: 'landing' as const, icon: FileText },
    { label: 'Dashboard', view: 'dashboard' as const, icon: LayoutDashboard },
    { label: 'Pricing', view: 'pricing' as const, icon: CreditCard },
  ]

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-50 glass border-b border-border/50"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
            onClick={() => setView('landing')}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Doc<span className="text-emerald-600">Flow</span>
            </span>
          </button>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Button
                key={item.view}
                variant={currentView === item.view ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView(item.view)}
                className="gap-2 rounded-lg"
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Button>
            ))}
          </div>

          {/* Right section */}
          <div className="hidden md:flex items-center gap-2">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-lg"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
                }
              </Button>
            )}
            {isLoggedIn ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{userName}</span>
                <Button variant="outline" size="sm" onClick={logout} className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => { login('Demo User', 'demo@docflow.io'); setView('dashboard') }}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <LogIn className="w-4 h-4" />
                Sign In
              </Button>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center gap-1 md:hidden">
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="rounded-lg"
                aria-label="Toggle theme"
              >
                {resolvedTheme === 'dark'
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />
                }
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden border-t border-border/50 overflow-hidden"
          >
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => (
                <Button
                  key={item.view}
                  variant={currentView === item.view ? 'secondary' : 'ghost'}
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    setView(item.view)
                    setMobileOpen(false)
                  }}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Button>
              ))}
              <div className="pt-2 border-t border-border/50">
                {isLoggedIn ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => {
                      logout()
                      setMobileOpen(false)
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out ({userName})
                  </Button>
                ) : (
                  <Button
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      login('Demo User', 'demo@docflow.io')
                      setView('dashboard')
                      setMobileOpen(false)
                    }}
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}