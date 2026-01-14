import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'glass' | 'gradient' | 'bordered'
  }
>(({ className, variant = 'default', ...props }, ref) => {
  const variants = {
    default: [
      "bg-[#12121a]/90 backdrop-blur-xl",
      "border border-white/[0.06]",
      "shadow-xl shadow-black/20",
      "hover:border-white/[0.1] hover:shadow-2xl hover:shadow-violet-500/5",
    ],
    glass: [
      "bg-white/[0.02] backdrop-blur-2xl",
      "border border-white/[0.08]",
      "shadow-2xl shadow-black/30",
      "hover:bg-white/[0.04] hover:border-violet-500/20",
    ],
    gradient: [
      "relative overflow-hidden",
      "bg-gradient-to-br from-[#12121a] to-[#0a0a0f]",
      "border border-white/[0.06]",
      "before:absolute before:inset-0 before:bg-gradient-to-br before:from-violet-500/10 before:to-pink-500/5 before:opacity-0 before:transition-opacity",
      "hover:before:opacity-100",
    ],
    bordered: [
      "relative",
      "bg-[#0a0a0f]/80 backdrop-blur-xl",
      "border-2 border-violet-500/20",
      "shadow-lg shadow-violet-500/5",
      "hover:border-violet-500/40 hover:shadow-violet-500/10",
    ],
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-2xl text-card-foreground transition-all duration-300",
        variants[variant],
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-none tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
