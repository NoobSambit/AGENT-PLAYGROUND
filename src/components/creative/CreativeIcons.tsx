import React from 'react'

export const StudioIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="3" width="18" height="18" rx="2" className="fill-pastel-purple/10 stroke-pastel-purple" strokeWidth="1.5" />
    <path d="M7 8H17" className="stroke-pastel-purple" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7 12H13" className="stroke-pastel-purple" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="17" cy="14" r="2" className="fill-pastel-blue/20 stroke-pastel-blue" strokeWidth="1.5" />
    <path d="M7 16H11" className="stroke-pastel-purple" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const LibraryIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 6V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6Z" className="fill-pastel-blue/10 stroke-pastel-blue" strokeWidth="1.5" />
    <path d="M9 4V20" className="stroke-pastel-blue" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 8H16" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 12H16" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M13 16H15" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const BriefIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="4" width="16" height="16" rx="3" className="fill-pastel-yellow/10 stroke-pastel-yellow" strokeWidth="1.5" />
    <path d="M8 8H16" className="stroke-pastel-yellow" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 12H14" className="stroke-pastel-yellow" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="8" y="15" width="4" height="2" rx="1" className="fill-pastel-yellow" />
  </svg>
)

export const PipelineIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="12" cy="12" r="9" className="fill-pastel-green/10 stroke-pastel-green" strokeWidth="1.5" />
    <path d="M12 7V17M7 12H17" className="stroke-pastel-green" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 9L17 7L15 5" className="stroke-pastel-green" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M9 15L7 17L9 19" className="stroke-pastel-green" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const ContextIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" className="fill-pastel-pink/10 stroke-pastel-pink" strokeWidth="1.5" />
    <path d="M8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12Z" className="fill-pastel-pink/20 stroke-pastel-pink" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1" className="fill-pastel-pink" />
  </svg>
)

export const ArtifactIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" className="fill-pastel-blue/10 stroke-pastel-blue" strokeWidth="1.5" />
    <path d="M14 2V8H20" className="stroke-pastel-blue" strokeWidth="1.5" />
    <path d="M8 13H16" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 17H12" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const MetricIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="3" y="11" width="4" height="10" rx="1" className="fill-pastel-purple/40 stroke-pastel-purple" strokeWidth="1.5" />
    <rect x="10" y="7" width="4" height="14" rx="1" className="fill-pastel-blue/40 stroke-pastel-blue" strokeWidth="1.5" />
    <rect x="17" y="3" width="4" height="18" rx="1" className="fill-pastel-pink/40 stroke-pastel-pink" strokeWidth="1.5" />
  </svg>
)

export const QualityIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" className="fill-pastel-yellow/20 stroke-pastel-yellow" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

export const SaveIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M19 21H5C4.44772 21 4 20.5523 4 20V4C4 3.44772 4.44772 3 5 3H16L20 7V20C20 20.5523 19.5523 21 19 21Z" className="fill-pastel-blue/10 stroke-pastel-blue" strokeWidth="1.5" />
    <rect x="7" y="3" width="7" height="5" rx="1" className="fill-background stroke-pastel-blue" strokeWidth="1.5" />
    <rect x="7" y="13" width="10" height="8" rx="1" className="fill-background stroke-pastel-blue" strokeWidth="1.5" />
  </svg>
)

export const GenerateIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 3L14.5 9L21 12L14.5 15L12 21L9.5 15L3 12L9.5 9L12 3Z" className="fill-pastel-purple/20 stroke-pastel-purple" strokeWidth="1.5" />
    <path d="M5 5L6 7" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M19 19L18 17" className="stroke-pastel-pink" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

export const PublishIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 12V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V12" className="stroke-pastel-green" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 15V3M12 3L8 7M12 3L16 7" className="stroke-pastel-green" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
