'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Menu, Sparkles, X } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { LLMProviderToggle } from '@/components/llm/LLMProviderToggle'

const navItems = [
  { href: '/', label: 'Home', description: 'Product overview and entry point' },
  { href: '/agents', label: 'Agents', description: 'Directory of all active personalities' },
  { href: '/dashboard', label: 'Dashboard', description: 'System health, roster, and quick actions' },
  { href: '/simulation', label: 'Simulation', description: 'Run and review multi-agent conversations' },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isHome = pathname === '/'

  const currentItem = navItems.find((item) =>
    item.href === '/' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`)
  )

  if (isHome) return null

  return (
    <header className="sticky top-0 z-[100] px-4 pt-4 sm:px-6">
      <div className="page-shell px-0">
        <div className="page-section flex min-h-16 items-center gap-4 px-4 py-3 sm:px-5">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(109,77,158,0.6)] transition-transform duration-300 group-hover:scale-[1.03]">
              <PlaygroundLogo className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold uppercase tracking-[0.24em] text-primary/80">
                Agent Playground
              </p>
              <p className="truncate text-sm text-muted-foreground">
                Personality-driven AI workspace
              </p>
            </div>
          </Link>

          <nav className="hidden flex-1 items-center justify-center lg:flex">
            <div className="tab-nav">
              {navItems.map((item) => {
                const isActive = item.href === '/'
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn('tab-item relative', isActive && 'tab-item-active')}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>

          <div className="ml-auto hidden items-center gap-3 lg:flex">
            {currentItem && pathname !== '/' && (
              <div className="soft-pill max-w-xs">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">{currentItem.description}</span>
              </div>
            )}

            <LLMProviderToggle compact className="min-w-[18rem]" />

            <ThemeToggle />

            <Link
              href="/agents/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_20px_50px_-26px_rgba(109,77,158,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_60px_-28px_rgba(109,77,158,0.78)]"
            >
              Create Agent
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <ThemeToggle />
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card/[0.65] text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/25 hover:text-foreground"
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="page-shell mt-3 px-0 lg:hidden"
          >
            <div className="page-section overflow-hidden px-4 py-4">
              <div className="space-y-2">
                {navItems.map((item) => {
                  const isActive = item.href === '/'
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        'flex items-start justify-between rounded-sm px-4 py-3 transition-all',
                        isActive
                          ? 'bg-primary/10 text-foreground'
                          : 'bg-transparent text-muted-foreground hover:bg-card/70 hover:text-foreground'
                      )}
                    >
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div>
                      </div>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" />
                    </Link>
                  )
                })}
              </div>

              <div className="page-divider my-4" />

              <LLMProviderToggle />

              <div className="page-divider my-4" />

              <Link
                href="/agents/new"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-[0_18px_48px_-28px_rgba(109,77,158,0.72)]"
              >
                Create Agent
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
