'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/agents', label: 'Agents' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/simulation', label: 'Simulation' },
]

export function Navigation() {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        'sticky top-0 z-[100] w-full transition-all duration-300',
        scrolled 
          ? 'border-b border-white/5 bg-background/5 backdrop-blur-xl py-1.5' 
          : 'border-b border-transparent bg-transparent py-3'
      )}
    >
      <div className="flex w-full items-center px-4 sm:px-8 lg:px-12">
        {/* Logo Section - Left half flex */}
        <div className="flex flex-1 items-center">
          <Link href="/" className="group flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-sm border transition-all duration-300 shadow-sm",
              scrolled 
                ? "bg-primary text-primary-foreground border-primary/20" 
                : "bg-muted/60 border-white/10 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary/20"
            )}>
              <PlaygroundLogo className="h-6 w-6" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-[15px] font-bold tracking-tight text-foreground -mb-1">
                Agent Playground
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50">
                Nexus Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation - Centered */}
        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => {
            const isActive = item.href === '/' 
              ? pathname === item.href 
              : pathname === item.href || pathname.startsWith(`${item.href}/`)
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-sm px-4 py-2 text-sm font-medium transition-all duration-200',
                  isActive 
                    ? 'text-foreground font-semibold' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label}
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-x-4 -bottom-[1.1rem] h-0.5 bg-primary rounded-full shadow-[0_4px_12px_rgba(203,166,247,0.5)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Right Side Actions - Right half flex */}
        <div className="flex flex-1 items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
          
          {/* Mobile Menu Toggle */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-sm border border-border/40 bg-muted/20 text-muted-foreground transition-all hover:bg-muted/40 hover:text-foreground lg:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 top-[4.5rem] z-[-1] bg-background/80 backdrop-blur-md"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute inset-x-0 top-full border-b border-border/40 bg-card p-6 shadow-2xl lg:hidden"
            >
              <div className="flex flex-col gap-2">
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
                        'flex items-center justify-between rounded-sm px-4 py-3 font-medium transition-colors',
                        isActive 
                          ? 'bg-primary/10 text-primary' 
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      )}
                    >
                      {item.label}
                      {isActive && <div className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    </Link>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
