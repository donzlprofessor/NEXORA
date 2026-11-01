import { nextTick, onUnmounted, watch, type Ref } from 'vue'

export function useDialog(open: Ref<boolean>, close: () => void) {
  let previous: HTMLElement | null = null
  function keydown(event: KeyboardEvent) {
    if (!open.value) return
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      return
    }
    if (event.key !== 'Tab') return
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const focusable = Array.from(
      dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
      ) ?? [],
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (!first) {
      event.preventDefault()
      dialog?.focus()
      return
    }
    if (
      event.shiftKey &&
      (document.activeElement === first || !dialog?.contains(document.activeElement))
    ) {
      event.preventDefault()
      last?.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !dialog?.contains(document.activeElement))
    ) {
      event.preventDefault()
      first.focus()
    }
  }
  watch(open, async (value) => {
    if (value) {
      previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
      document.addEventListener('keydown', keydown)
      await nextTick()
      if (open.value) {
        const initial =
          document.querySelector<HTMLElement>('[role="dialog"] input') ??
          document.querySelector<HTMLElement>('[role="dialog"] button')
        initial?.focus()
      }
    } else {
      document.removeEventListener('keydown', keydown)
      previous?.focus()
    }
  })
  onUnmounted(() => document.removeEventListener('keydown', keydown))
}
