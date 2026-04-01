"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { motion } from "framer-motion"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const isLight = mounted ? theme === "light" : false

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => setTheme(isLight ? "dark" : "light")}
      className="relative inline-flex h-11 items-center gap-2 rounded-full border border-border/60 bg-card/[0.65] px-3 text-foreground shadow-[0_14px_40px_-28px_rgba(109,77,158,0.45)] backdrop-blur-xl transition-all hover:border-primary/25 hover:bg-card/[0.85]"
    >
      <span className="relative flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-primary ">
        <Sun className="h-4 w-4 rotate-0 scale-100 text-amber-500 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 text-primary transition-all dark:rotate-0 dark:scale-100" />
      </span>
      <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
        {isLight ? "Light" : "Dark"} mode
      </span>
      <span className="sr-only">Toggle theme</span>
    </motion.button>
  )
}
