import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { LucideMoon, LucideSun } from "lucide-react"

export function ThemeToggle() {
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"))
  }, [])

  function toggle() {
    const next = !isDark
    document.documentElement.classList.toggle("dark", next)
    setIsDark(next)
  }

  if (isDark === null) {
    return <Button variant="ghost" size="icon" disabled aria-label="Loading theme" className="pointer-events-none opacity-0" />
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
      {isDark ? <LucideMoon className="h-5 w-5" /> : <LucideSun className="h-5 w-5" />}
    </Button>
  )
}
