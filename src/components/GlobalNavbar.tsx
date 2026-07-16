'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from 'next-themes'
import { Cloud, Github, Menu, Moon, Sun, X } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Agents', href: '/agents' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Arena', href: '/simulation' },
  { label: 'Docs', href: '/#workflow' },
]

export function GlobalNavbar({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const isDark = !mounted || resolvedTheme === 'dark'

  useEffect(() => setMounted(true), [])
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className={cn(floating ? 'absolute inset-x-0 top-2 z-50 flex justify-center' : 'relative z-50 flex justify-center bg-[#040b13]/88 py-2 backdrop-blur-xl')}>
      <header className="flex h-[68px] w-[calc(100vw-24px)] max-w-[1820px] items-center justify-between rounded-[24px] border border-white/[0.08] bg-[#050d18]/92 px-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] sm:w-[calc(100vw-48px)] xl:w-[calc(100vw-64px)]">
        <Link href="/" className="group flex min-w-0 items-center gap-3 rounded-[16px] p-1 pr-3 transition hover:bg-white/[0.04]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[#b8a1ff]/30 bg-[#1c1730] text-[#d8ccff] shadow-[0_0_15px_rgba(155,124,246,0.15)] transition-transform group-hover:scale-105">
            <PlaygroundLogo className="h-5 w-5" />
          </span>
          <span className="hidden min-w-0 leading-tight sm:block"><span className="block truncate text-[15px] font-bold tracking-tight text-white/95">Agent Playground</span><span className="block truncate text-[12px] font-medium text-[#b8a1ff]/70">Inspectable Agent OS</span></span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-white/[0.05] bg-white/[0.02] p-1 lg:flex" aria-label="Global navigation">
          {navItems.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`)
            return <Link key={item.label} href={item.href} aria-current={active ? 'page' : undefined} className={cn('relative rounded-full px-5 py-2 text-[15px] font-medium transition-colors', active ? 'bg-white/10 text-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white')}>{item.label}</Link>
          })}
        </nav>

        <div className="flex items-center justify-end gap-3">
          <span className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-black/40 px-4 py-2 text-[13px] font-medium text-white/80 md:inline-flex"><Cloud className="h-4 w-4 text-[#b8a1ff]" aria-hidden="true" />Local + Cloud Runtime<span className="h-2 w-2 rounded-full bg-[#49d581]" aria-label="Runtime healthy" /></span>
          <span className="hidden h-6 w-px bg-white/10 md:block" />
          <button type="button" aria-label="Toggle color theme" onClick={() => setTheme(isDark ? 'light' : 'dark')} className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">{isDark ? <Moon className="h-5 w-5" aria-hidden="true" /> : <Sun className="h-5 w-5" aria-hidden="true" />}</button>
          <Link href="https://github.com" aria-label="Open GitHub" className="hidden h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white sm:grid"><Github className="h-5 w-5" aria-hidden="true" /></Link>
          <button type="button" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen} aria-controls="global-mobile-navigation" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.035] text-slate-300 lg:hidden">{mobileOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}</button>
        </div>
      </header>
      {mobileOpen && <div id="global-mobile-navigation" className="absolute left-3 right-3 top-[76px] rounded-2xl border border-white/10 bg-[#091321] p-3 shadow-2xl lg:hidden"><nav className="grid gap-1" aria-label="Global navigation">{navItems.map((item) => { const active = item.href === '/' ? pathname === '/' : pathname === item.href || pathname.startsWith(`${item.href}/`); return <Link key={item.label} href={item.href} onClick={() => setMobileOpen(false)} aria-current={active ? 'page' : undefined} className={cn('rounded-lg px-3 py-2.5 text-sm font-medium', active ? 'bg-white/10 text-white' : 'text-slate-300 hover:bg-white/[0.05]')}>{item.label}</Link> })}</nav></div>}
    </div>
  )
}
