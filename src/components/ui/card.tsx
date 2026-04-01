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
      "bg-card/[0.72] backdrop-blur-2xl",
      "border border-border/70",
      "shadow-[0_24px_70px_-36px_rgba(109,77,158,0.35)]",
      "hover:border-primary/20 hover:bg-card/[0.86]",
    ],
    glass: [
      "bg-card/[0.58] backdrop-blur-2xl",
      "border border-border/60",
      "shadow-[0_20px_60px_-34px_rgba(109,77,158,0.28)]",
      "hover:bg-card/[0.76] hover:border-primary/20",
    ],
    gradient: [
      "relative overflow-hidden",
      "bg-[linear-gradient(160deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.02)_100%),var(--surface)]",
      "border border-border/70",
      "before:absolute before:inset-0 before:bg-primary/5 before:opacity-0 before:transition-opacity",
      "hover:before:opacity-100",
    ],
    bordered: [
      "relative",
      "bg-card/[0.76] backdrop-blur-xl",
      "border-2 border-primary/[0.18]",
      "shadow-[0_18px_44px_-30px_rgba(109,77,158,0.32)]",
      "hover:border-primary/35 hover:shadow-[0_24px_54px_-34px_rgba(109,77,158,0.4)]",
    ],
  }

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-sm text-card-foreground transition-all duration-300",
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
