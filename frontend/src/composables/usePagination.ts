import { computed, ref, watch, type Ref } from 'vue'

export function usePagination<T>(items: Ref<T[]>, size = 10) {
  const page = ref(1)
  const pages = computed(() => Math.max(1, Math.ceil(items.value.length / size)))
  watch(items, () => {
    page.value = 1
  })
  const rows = computed(() => items.value.slice((page.value - 1) * size, page.value * size))
  return { page, pages, rows }
}
