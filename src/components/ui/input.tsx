import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-xl",
          "bg-card/[0.72] backdrop-blur-xl",
          "border border-border/70",
          "px-4 py-3 text-sm text-foreground",
          "ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "placeholder:text-muted-foreground/60",
          "transition-all duration-300",
          "focus:outline-none focus:border-primary/40",
          "focus:ring-4 focus:ring-primary/10",
          "focus:bg-card/[0.88]",
          "hover:border-primary/[0.18]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

// Textarea with same styling
export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[120px] w-full rounded-xl",
          "bg-card/[0.72] backdrop-blur-xl",
          "border border-border/70",
          "px-4 py-3 text-sm text-foreground",
          "ring-offset-background",
          "placeholder:text-muted-foreground/60",
          "transition-all duration-300",
          "focus:outline-none focus:border-primary/40",
          "focus:ring-4 focus:ring-primary/10",
          "focus:bg-card/[0.88]",
          "hover:border-primary/[0.18]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Input, Textarea }
