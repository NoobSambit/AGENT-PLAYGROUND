export function PlaygroundLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      {/* Bot chassis background filled */}
      <rect x="5" y="6" width="14" height="12" rx="3" fill="currentColor" className="opacity-10" />
      
      {/* Visor Area Background */}
      <rect x="7" y="9" width="10" height="6" rx="2" fill="currentColor" className="opacity-20" />
      
      {/* Main Bot Head Outline */}
      <rect x="5" y="6" width="14" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" className="opacity-90" />
      
      {/* Robot Eyes (Glowing) */}
      <circle cx="9" cy="12" r="1.2" fill="currentColor" className="opacity-90" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" className="opacity-90" />
      
      {/* Side connector bolts (ears) */}
      <path d="M5 10H3M5 14H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-40" />
      <path d="M19 10H21M19 14H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-40" />
      
      {/* Antenna Outline and Node */}
      <path d="M12 6V3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-60" />
      <circle cx="12" cy="2.5" r="1" fill="currentColor" className="opacity-80" />
      
      {/* Visor Bottom Screen Line */}
      <path d="M7 16H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-50" />
    </svg>
  )
}
