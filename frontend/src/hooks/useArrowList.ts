import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent } from "react"

interface UseArrowListOptions<T> {
  items: T[]
  enabled: boolean
  onSelect: (item: T) => void
}

export function useArrowList<T>({ items, enabled, onSelect }: UseArrowListOptions<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const enabledRef = useRef(enabled)
  const itemsRef = useRef(items)
  const onSelectRef = useRef(onSelect)

  itemsRef.current = items
  onSelectRef.current = onSelect

  useEffect(() => {
    if (enabled && !enabledRef.current) {
      setSelectedIndex(0)
    }
    enabledRef.current = enabled
    if (!enabled) {
      setSelectedIndex(-1)
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    setSelectedIndex((prev) => (prev >= items.length ? 0 : prev))
  }, [items.length, enabled])

  useEffect(() => {
    if (selectedIndex < 0 || !enabled || !containerRef.current) return
    const nodes = containerRef.current.querySelectorAll<HTMLElement>("[data-list-item]")
    if (selectedIndex < nodes.length) {
      nodes[selectedIndex].scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex, enabled])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      const list = itemsRef.current
      if (!enabled || list.length === 0) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev < 0 || prev >= list.length - 1 ? 0 : prev + 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((prev) => (prev <= 0 ? list.length - 1 : prev - 1))
      } else if (e.key === "Enter") {
        const item = list[selectedIndex >= 0 ? selectedIndex : 0]
        if (item !== undefined) {
          e.preventDefault()
          onSelectRef.current(item)
        }
      }
    },
    [enabled, selectedIndex],
  )

  return { containerRef, selectedIndex, setSelectedIndex, handleKeyDown }
}
