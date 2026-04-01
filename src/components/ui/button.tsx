import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: [
          "bg-primary text-white",
          "shadow-lg shadow-violet-500/25",
          "hover:shadow-violet-500/40 hover:brightness-110",
          "before:absolute before:inset-0 before:rounded-sm before:bg-primary before:opacity-0 before:blur-xl before:-z-10 before:transition-opacity",
          "hover:before:opacity-50",
        ],
        destructive: [
          "bg-primary text-white",
          "shadow-lg shadow-red-500/25",
          "hover:shadow-red-500/40 hover:brightness-110",
        ],
        outline: [
          "border border-border/70 bg-card/[0.62] backdrop-blur-xl",
          "hover:bg-card/[0.84] hover:border-primary/20",
          "text-foreground",
        ],
        secondary: [
          "bg-secondary/80 text-secondary-foreground backdrop-blur-sm",
          "hover:bg-secondary hover:shadow-md",
        ],
        ghost: [
          "text-muted-foreground",
          "hover:bg-card/[0.72] hover:text-foreground",
        ],
        link: "text-violet-400 underline-offset-4 hover:underline hover:text-violet-300",
        glow: [
          "bg-primary text-white",
          "shadow-2xl shadow-violet-500/30",
          "hover:shadow-violet-500/50 hover:brightness-110",
          "before:absolute before:inset-0 before:rounded-sm before:bg-primary before:opacity-0 before:blur-2xl before:-z-10 before:transition-opacity",
          "hover:before:opacity-60",
        ],
        glass: [
          "bg-card/[0.62] backdrop-blur-xl border border-border/70",
          "text-foreground",
          "hover:bg-card/[0.82] hover:border-primary/25",
          "hover:shadow-lg hover:shadow-violet-500/10",
        ],
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-sm px-3.5 text-xs",
        lg: "h-14 rounded-sm px-8 text-base",
        xl: "h-16 rounded-sm px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
