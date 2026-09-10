export const PAGE_EASE = [0.22, 1, 0.36, 1] as const

export const PAGE_ENTER = { opacity: 1, y: 0, scale: 1 }
export const PAGE_INITIAL = { opacity: 0, y: 8, scale: 0.99 }
export const PAGE_EXIT = { opacity: 0, y: -4, scale: 0.995 }

export const pageTransition = (isCover: boolean) => ({
  duration: isCover ? 0.45 : 0.28,
  ease: PAGE_EASE
})

export const exitTransition = () => ({
  duration: 0.16,
  ease: PAGE_EASE
})
