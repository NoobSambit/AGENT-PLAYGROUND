'use client'

import { usePathname } from 'next/navigation'
import { GlobalNavbar } from '@/components/GlobalNavbar'

export function Navigation() {
  const pathname = usePathname()

  if (pathname === '/' || pathname === '/agents' || pathname === '/simulation') {
    return null
  }

  return <GlobalNavbar />
}
