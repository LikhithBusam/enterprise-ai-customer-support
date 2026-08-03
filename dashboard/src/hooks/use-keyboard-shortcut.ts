import { useEffect } from "react"

interface ShortcutOptions {
  meta?: boolean
  ctrl?: boolean
  enabled?: boolean
}

/** Registers a single global keyboard shortcut for the given key, cleaned up on unmount. */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  options: ShortcutOptions = {},
): void {
  const { meta = false, ctrl = false, enabled = true } = options

  useEffect(() => {
    if (!enabled) return

    function handleKeyDown(event: KeyboardEvent): void {
      const matchesKey = event.key.toLowerCase() === key.toLowerCase()
      const matchesModifier = meta || ctrl ? event.metaKey || event.ctrlKey : true
      if (matchesKey && matchesModifier) {
        event.preventDefault()
        callback()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [key, meta, ctrl, enabled, callback])
}
