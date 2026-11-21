// Steering input: relative drag from touch, mouse and pen, and the A/D and arrow keys.

export interface PlayerInput {
  readonly left: boolean
  readonly right: boolean
  // Returns the pointer's change in x, in CSS pixels, since the last call.
  takeDragPixels(): number
  dispose(): void
}

const leftKeys = new Set(['KeyA', 'ArrowLeft'])
const rightKeys = new Set(['KeyD', 'ArrowRight'])
const pauseKeys = new Set(['Escape', 'KeyP'])

export function createInput(gameElement: HTMLElement, onPauseKey: () => void): PlayerInput {
  let dragPixels = 0
  let dragPointer: number | null = null
  let lastPointerX = 0
  let left = false
  let right = false

  const onPointerDown = (event: PointerEvent) => {
    if (dragPointer !== null) return
    dragPointer = event.pointerId
    lastPointerX = event.clientX
  }
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerId !== dragPointer) return
    dragPixels += event.clientX - lastPointerX
    lastPointerX = event.clientX
  }
  const onPointerEnd = (event: PointerEvent) => {
    if (event.pointerId === dragPointer) dragPointer = null
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (leftKeys.has(event.code)) left = true
    else if (rightKeys.has(event.code)) right = true
    else if (pauseKeys.has(event.code) && !event.repeat) onPauseKey()
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (leftKeys.has(event.code)) left = false
    else if (rightKeys.has(event.code)) right = false
  }
  // A key released while the page had no focus never sends keyup.
  const onBlur = () => {
    left = false
    right = false
    dragPointer = null
  }
  // Blocks page scroll, pinch-zoom and trackpad zoom over the game; touch-action in the CSS covers most browsers, these the rest.
  const preventDefault = (event: Event) => event.preventDefault()
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) event.preventDefault()
  }

  gameElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerEnd)
  window.addEventListener('pointercancel', onPointerEnd)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  gameElement.addEventListener('touchmove', preventDefault, { passive: false })
  gameElement.addEventListener('gesturestart', preventDefault)
  gameElement.addEventListener('wheel', onWheel, { passive: false })

  return {
    get left() {
      return left
    },
    get right() {
      return right
    },
    takeDragPixels() {
      const pixels = dragPixels
      dragPixels = 0
      return pixels
    },
    dispose() {
      gameElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      gameElement.removeEventListener('touchmove', preventDefault)
      gameElement.removeEventListener('gesturestart', preventDefault)
      gameElement.removeEventListener('wheel', onWheel)
    },
  }
}
