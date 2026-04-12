import React, { SVGProps } from 'react'
import { motion } from 'framer-motion'

export function MemoryCoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 3" />
      <path d="M12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" fill="currentColor" />
      <path d="M12 6V3M12 21V18M6 12H3M21 12H18M16.2426 7.75736L18.364 5.63604M5.63604 18.364L7.75736 16.2426M16.2426 16.2426L18.364 18.364M5.63604 5.63604L7.75736 7.75736" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

export function DataQueryIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M4 6L12 2L20 6L12 10L4 6Z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M4 11L12 15L20 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M4 16L12 20L20 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <path d="M12 20V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function SemanticNetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="5" cy="12" r="2" fill="currentColor" />
      <circle cx="19" cy="6" r="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="18" r="2" fill="currentColor" />
      <circle cx="12" cy="10" r="2" fill="currentColor" fillOpacity="0.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.5 11L10.5 10M13.5 10.5L18 7M11 11.5L14 17M6.5 13L13.5 17.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="square" />
    </svg>
  )
}

export function TraceArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="3" y="14" width="18" height="7" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6" y="8" width="12" height="6" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
      <rect x="9" y="3" width="6" height="5" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" />
      <line x1="7" y1="17.5" x2="11" y2="17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <line x1="15" y1="17.5" x2="17" y2="17.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

export function GeometricSyncIcon({ className, spinning = false, ...props }: SVGProps<SVGSVGElement> & { spinning?: boolean }) {
  return (
    <motion.svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      animate={spinning ? { rotate: 360 } : { rotate: 0 }}
      transition={spinning ? { duration: 1.5, repeat: Infinity, ease: "linear" } : {}}
      {...(props as any)}
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" />
      <path d="M12 4V1M12 20V23M20 12H23M4 12H1M17.6569 6.34315L19.7782 4.22183M6.34315 17.6569L4.22183 19.7782M17.6569 17.6569L19.7782 19.7782M6.34315 6.34315L4.22183 4.22183" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </motion.svg>
  )
}

export function VoidSearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="10" cy="10" r="5" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 14L20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M10 7V10H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}

export function PriorityStarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" fill="currentColor" fillOpacity="0.7" />
      <path d="M12 2L14.4 9.6H22L15.8 14.4L18.2 22L12 17.2L5.8 22L8.2 14.4L2 9.6H9.6L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="bevel" />
      <circle cx="12" cy="13" r="2" fill="white" fillOpacity="0.9" />
    </svg>
  )
}

export function ObliterateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3 6H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M8 6V4H16V6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M5 6L6 20H18L19 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" fill="currentColor" fillOpacity="0.1" />
      <path d="M10 11V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M14 11V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  )
}
