import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: [
          "bg-gradient-to-r from-violet-500 to-purple-600 text-white",
          "shadow-lg shadow-violet-500/25",
          "hover:shadow-violet-500/40 hover:brightness-110",
          "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-violet-400 before:to-purple-500 before:opacity-0 before:blur-xl before:-z-10 before:transition-opacity",
          "hover:before:opacity-50",
        ],
        destructive: [
          "bg-gradient-to-r from-red-500 to-rose-600 text-white",
          "shadow-lg shadow-red-500/25",
          "hover:shadow-red-500/40 hover:brightness-110",
        ],
        outline: [
          "border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm",
          "hover:bg-white/[0.05] hover:border-white/[0.12]",
          "text-foreground",
        ],
        secondary: [
          "bg-secondary/80 text-secondary-foreground backdrop-blur-sm",
          "hover:bg-secondary hover:shadow-md",
        ],
        ghost: [
          "text-muted-foreground",
          "hover:bg-white/[0.05] hover:text-foreground",
        ],
        link: "text-violet-400 underline-offset-4 hover:underline hover:text-violet-300",
        glow: [
          "bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 text-white",
          "shadow-2xl shadow-violet-500/30",
          "hover:shadow-violet-500/50 hover:brightness-110",
          "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-r before:from-violet-400 before:via-purple-400 before:to-pink-400 before:opacity-0 before:blur-2xl before:-z-10 before:transition-opacity",
          "hover:before:opacity-60",
        ],
        glass: [
          "bg-white/[0.03] backdrop-blur-xl border border-white/[0.08]",
          "text-foreground",
          "hover:bg-white/[0.06] hover:border-violet-500/30",
          "hover:shadow-lg hover:shadow-violet-500/10",
        ],
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-14 rounded-2xl px-8 text-base",
        xl: "h-16 rounded-2xl px-10 text-lg",
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
