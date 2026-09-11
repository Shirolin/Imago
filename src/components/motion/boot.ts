import { animate, stagger } from 'animejs'

const SESSION_KEY = 'imago-booted'
const FAILSAFE_MS = 5000
const TOTAL_MS = 1700

function markBooted(): void {
  window.__imago_booted = true
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* 隐私模式无痕写入失败不影响启动 */
  }
}

export function dismissVeil(): void {
  document.getElementById('boot-veil')?.remove()
  markBooted()
}

/** 揭幕：凝墨字条由 CSS 首帧即播，这里只做落纸与揭幕叠播 → 收尾清理 */
export function playBoot(): void {
  const v = document.getElementById('boot-veil')
  if (!v) {
    markBooted()
    return
  }
  const print = document.querySelector('.imago-cover-print')
  const rows = [...document.querySelectorAll('.imago-ticket-list li')].filter(
    (n) => n instanceof HTMLElement
  )
  const masthead = [...document.querySelectorAll('.imago-cover-ticket > p')].filter(
    (n) => n instanceof HTMLElement
  )
  const cta = document.querySelector('[data-boot-cta]')
  const covered = [print, ...masthead, cta].filter(
    (n): n is HTMLElement => n instanceof HTMLElement
  )
  covered.forEach((n) => {
    n.style.opacity = '0'
  })
  if (print instanceof HTMLElement) print.style.transform = 'translateY(12px) scale(1.02)'
  rows.forEach((r) => {
    ;(r as HTMLElement).style.opacity = '0'
  })

  const anims: Array<{ pause: () => void }> = []
  const cleanup = (): void => {
    anims.forEach((a) => {
      try {
        a.pause()
      } catch {
        /* 定点收尾时动画实例已结束可忽略 */
      }
    })
    anims.length = 0
    ;[...covered, ...rows].forEach((n) => {
      const el = n as HTMLElement
      el.style.opacity = ''
      el.style.transform = ''
    })
    dismissVeil()
  }

  anims.push(
    animate(v, {
      opacity: [1, 0],
      y: [0, -48],
      duration: 650,
      delay: 1000,
      ease: 'outExpo',
      onComplete: cleanup
    })
  )
  if (print instanceof HTMLElement) {
    anims.push(
      animate(print, {
        opacity: [0, 1],
        y: [12, 0],
        scale: [1.02, 1],
        duration: 700,
        delay: 1000,
        ease: 'outExpo'
      })
    )
  }
  if (rows.length > 0) {
    anims.push(
      animate(rows, {
        opacity: [0, 1],
        y: [10, 0],
        duration: 420,
        delay: stagger(55, { start: 1150 }),
        ease: 'outExpo'
      })
    )
  }
  if (masthead.length > 0) {
    anims.push(
      animate(masthead, {
        opacity: [0, 1],
        duration: 500,
        delay: 1050,
        ease: 'outExpo'
      })
    )
  }
  if (cta instanceof HTMLElement) {
    anims.push(
      animate(cta, {
        opacity: [0, 1],
        y: [8, 0],
        duration: 500,
        delay: 1350,
        ease: 'outExpo'
      })
    )
  }

  setTimeout(cleanup, TOTAL_MS + 800)
  v.addEventListener('click', cleanup, { once: true })
}

function fontsReady(): Promise<void> {
  return new Promise((resolve) => {
    const done = (): void => resolve()
    setTimeout(done, 800)
    try {
      const ready = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready
      if (ready && typeof (ready as Promise<unknown>).then === 'function') {
        void (ready as Promise<unknown>).then(done)
      }
    } catch {
      /* 取不到字体状态直接放行 */
    }
  })
}

function waitCover(): Promise<boolean> {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const tick = (): void => {
      if (document.querySelector('.imago-cover-print')) {
        resolve(true)
        return
      }
      if (Date.now() - t0 > 2000) {
        resolve(false)
        return
      }
      setTimeout(tick, 60)
    }
    tick()
  })
}
export interface BootOptions {
  isHome: boolean
  reduced: boolean
}
export function initBoot({ isHome, reduced }: BootOptions): void {
  setTimeout(dismissVeil, FAILSAFE_MS)
  let played = false
  try {
    played = sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    played = false
  }
  // 调试开关：首页加 ?motion=full 强制播完整三幕，无视减动效与会话标记
  const forceFull = new URLSearchParams(window.location.search).get('motion') === 'full'
  const full = forceFull || (isHome && !reduced && !played)
  if (!full) {
    // 轻路：减动效/复访/工作台直达，不等字体不等封面，路由就绪后两帧即撤
    const frames = new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
    const cap = new Promise((resolve) => setTimeout(resolve, 1500))
    void Promise.race([frames, cap])
      .then(() => dismissVeil())
      .catch(() => dismissVeil())
    return
  }
  fontsReady()
    .then(() => waitCover())
    .then((found) => {
      if (found) playBoot()
      else dismissVeil()
    })
    .catch(() => dismissVeil())
}

declare global {
  interface Window {
    __imago_booted?: boolean
  }
}
