import { useState, useEffect } from "react"
import { useTheme } from "@/components/theme-provider"

export function useIsDark(): boolean {
  const { theme } = useTheme()
  const [isDark, setIsDark] = useState(() => {
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
    }
    return theme === "dark"
  })

  useEffect(() => {
    if (theme !== "system") {
      setIsDark(theme === "dark")
      return
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const handler = (e: MediaQueryListEvent) => {
      setIsDark(e.matches)
    }
    setIsDark(mq.matches)
    mq.addEventListener("change", handler)
    return () => { mq.removeEventListener("change", handler) }
  }, [theme])

  return isDark
}
