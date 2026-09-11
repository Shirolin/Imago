import { animate, stagger } from 'animejs'

export const PAGE_EASE_ENTER = 'outExpo'
export const PAGE_EASE_LEAVE = 'outCubic'
const ENTER_DELAY = 70
const ENTER_DURATION = 380

/** 后台标签页 rAF 饿死时保底放行，Vue 的 done 自带重复调用保护 */
function guardedDone(done: () => void, ms: number): () => void {
  const timer = setTimeout(done, ms)
  return () => {
    clearTimeout(timer)
    done()
  }
}
/** 主体区逐块跟上：单根护套则钻一层；最多 6 块；结束清内联样式 */
function staggerKids(page: HTMLElement): void {
  const root = page.firstElementChild
  if (!root) return
  let sections: Element[] = []
  let level: Element | null = root
  for (let depth = 0; depth < 3 && level; depth++) {
    const at = [...level.children].filter((k) => k instanceof HTMLElement)
    if (at.length >= 2) {
      sections = at
      break
    }
    level = level.firstElementChild
  }
  const kids = sections.slice(0, 6)
  if (kids.length < 2) return
  animate(kids, {
    opacity: [0, 1],
    y: [12, 0],
    duration: 420,
    delay: stagger(55, { start: 150 }),
    ease: 'outExpo',
    onComplete: () => {
      kids.forEach((k) => {
        ;(k as HTMLElement).style.opacity = ''
        ;(k as HTMLElement).style.transform = ''
      })
    }
  })
}

export function enterPage(el: Element, cover: boolean, reduced: boolean, done: () => void): void {
  if (reduced || !(el instanceof HTMLElement)) {
    done()
    return
  }
  const target = el
  target.style.opacity = '0'
  target.style.transform = 'translateY(10px) scale(0.995)'
  setTimeout(() => {
    if (!target.isConnected) {
      done()
      return
    }
    const finish = guardedDone(done, ENTER_DURATION + 500)
    animate(target, {
      opacity: [0, 1],
      y: [10, 0],
      scale: [0.995, 1],
      duration: cover ? 480 : ENTER_DURATION,
      ease: PAGE_EASE_ENTER,
      onComplete: () => {
        target.style.opacity = ''
        target.style.transform = ''
        finish()
      }
    })
    staggerKids(target)
  }, ENTER_DELAY)
}

export function leavePage(el: Element, reduced: boolean, done: () => void): void {
  if (reduced || !(el instanceof HTMLElement)) {
    done()
    return
  }
  const target = el
  target.style.position = 'absolute'
  target.style.inset = '0'
  target.style.zIndex = '1'
  target.style.pointerEvents = 'none'
  requestAnimationFrame(() => {
    if (!target.isConnected) {
      done()
      return
    }
    const finish = guardedDone(done, 700)
    animate(target, {
      opacity: [1, 0],
      duration: 200,
      ease: PAGE_EASE_LEAVE,
      onComplete: finish
    })
  })
}
