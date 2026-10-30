import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/theme"

/** Header button: flips between light and dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, setPref } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setPref(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun size={19} /> : <Moon size={19} />}
    </Button>
  )
}
