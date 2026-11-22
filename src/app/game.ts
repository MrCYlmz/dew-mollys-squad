import type { Level } from '../content/level'
import { tuning } from '../content/tuning'
import { watchFocus } from '../platform/focus'
import { createInput, type PlayerInput } from '../platform/input'
import { GameRenderer, type ScreenPoint } from '../render/gameRenderer'
import { firstLevel, levelAfter } from '../sim/levelOrder'
import { createRun, type Run, type SteerInput } from '../sim/run'
import { bossHpPercent, type BossHp } from '../ui/screens/Hud'

export type Screen = 'title' | 'playing' | 'paused' | 'victory' | 'defeat'

// What the screens show.
export interface GameView {
  screen: Screen
  squadCount: number
  progress: number
  distanceReached: number
  // Null outside the boss arena.
  boss: BossHp | null
}

const tickSeconds = 1 / tuning.tickRate
// Longer frames, such as after a stall, are cut short instead of being caught up tick by tick.
const maxFrameSeconds = 0.25

export class Game {
  private readonly renderer: GameRenderer
  private readonly input: PlayerInput
  private readonly stopWatchingFocus: () => void
  private readonly resizeObserver: ResizeObserver
  private readonly listeners = new Set<(view: GameView) => void>()
  private readonly steerInput: SteerInput = { drag: 0, left: false, right: false }
  private readonly labelPoint: ScreenPoint = { x: 0, y: 0 }
  private shownLabelX = Number.NaN
  private shownLabelY = Number.NaN
  private level: Level
  private run: Run
  private squadLabel: HTMLElement | null = null
  private accumulator = 0
  private lastTimestamp: number | null = null
  private frameRequest = 0
  view: GameView

  constructor(
    private readonly levels: readonly Level[],
    canvas: HTMLCanvasElement,
    gameElement: HTMLElement,
  ) {
    this.renderer = new GameRenderer(canvas)
    this.input = createInput(gameElement, () => this.pause())
    this.stopWatchingFocus = watchFocus(() => this.pause())
    this.resizeObserver = new ResizeObserver(() => this.resize(gameElement))
    this.resizeObserver.observe(gameElement)
    this.resize(gameElement)
    this.level = firstLevel(levels)
    this.run = this.newRun()
    this.view = { screen: 'title', squadCount: this.run.state.squad.count, progress: 0, distanceReached: 0, boss: null }
    this.frameRequest = requestAnimationFrame(this.frame)
  }

  subscribe(listener: (view: GameView) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly setSquadLabel = (element: HTMLElement | null): void => {
    this.squadLabel = element
    this.shownLabelX = this.shownLabelY = Number.NaN
  }

  play(): void {
    this.level = firstLevel(this.levels)
    this.restart()
  }

  // After the last level in level order, goes back to the title.
  nextLevel(): void {
    const next = levelAfter(this.levels, this.level)
    if (next === null) {
      this.quitToTitle()
      return
    }
    this.level = next
    this.restart()
  }

  pause(): void {
    if (this.view.screen === 'playing') this.publish({ screen: 'paused' })
  }

  resume(): void {
    if (this.view.screen !== 'paused') return
    this.lastTimestamp = null
    // A drag made on the pause screen is not a steer.
    this.input.takeDragPixels()
    this.publish({ screen: 'playing' })
  }

  restart(): void {
    this.run = this.newRun()
    this.lastTimestamp = null
    this.accumulator = 0
    this.input.takeDragPixels()
    this.publish({ screen: 'playing', squadCount: this.run.state.squad.count, progress: 0, distanceReached: 0, boss: null })
  }

  quitToTitle(): void {
    this.level = firstLevel(this.levels)
    this.run = this.newRun()
    this.publish({ screen: 'title', squadCount: this.run.state.squad.count, progress: 0, boss: null })
  }

  dispose(): void {
    cancelAnimationFrame(this.frameRequest)
    this.resizeObserver.disconnect()
    this.stopWatchingFocus()
    this.input.dispose()
    this.renderer.dispose()
  }

  private newRun(): Run {
    const run = createRun({ level: this.level, seed: Date.now() })
    this.renderer.startRun(run.state)
    return run
  }

  private resize(gameElement: HTMLElement): void {
    this.renderer.resize(gameElement.clientWidth, gameElement.clientHeight, window.devicePixelRatio)
  }

  private readonly frame = (timestamp: number): void => {
    this.frameRequest = requestAnimationFrame(this.frame)
    const frameSeconds = this.lastTimestamp === null ? 0 : Math.min((timestamp - this.lastTimestamp) / 1000, maxFrameSeconds)
    this.lastTimestamp = timestamp

    const playing = this.view.screen === 'playing'
    if (playing) this.advance(frameSeconds)
    const alpha = playing ? this.accumulator / tickSeconds : 1
    this.renderer.draw(this.run.state, alpha, playing ? frameSeconds : 0)
    this.placeSquadLabel(alpha)
  }

  private advance(frameSeconds: number): void {
    this.accumulator += frameSeconds
    const state = this.run.state
    while (this.accumulator >= tickSeconds) {
      this.accumulator -= tickSeconds
      this.steerInput.drag = this.input.takeDragPixels() * this.renderer.trackUnitsPerPixel()
      this.steerInput.left = this.input.left
      this.steerInput.right = this.input.right
      for (const event of this.run.step(this.steerInput)) {
        if (event.type === 'catsLost') this.renderer.scatterCats(event.count)
        else if (event.type === 'bossHit') this.renderer.flashBoss()
      }
      if (state.status !== 'running') break
    }

    const progress = Math.floor(Math.min(state.squad.z / state.level.length, 1) * 100) / 100
    if (state.status === 'won') {
      this.accumulator = 0
      this.publish({ screen: 'victory', squadCount: state.squad.count, progress: 1 })
    } else if (state.status === 'lost') {
      this.accumulator = 0
      this.publish({ screen: 'defeat', squadCount: 0, distanceReached: Math.floor(state.squad.z) })
    } else if (state.squad.count !== this.view.squadCount || progress !== this.view.progress || this.bossBarChanged()) {
      this.publish({ squadCount: state.squad.count, progress, boss: state.boss === null ? null : { hp: state.boss.hp, fullHp: state.boss.fullHp } })
    }
  }

  // The boss HP bar is redrawn only when its shown percentage changes, not on every hit.
  private bossBarChanged(): boolean {
    const boss = this.run.state.boss
    const shown = this.view.boss
    if (boss === null || shown === null) return boss !== shown
    return bossHpPercent(boss) !== bossHpPercent(shown)
  }

  private placeSquadLabel(alpha: number): void {
    if (this.squadLabel === null) return
    this.renderer.squadLabelPoint(this.run.state, alpha, this.labelPoint)
    const x = Math.round(this.labelPoint.x)
    const y = Math.round(this.labelPoint.y)
    // The transform is a new string each time, so it is written only when the label moves a whole pixel.
    if (x === this.shownLabelX && y === this.shownLabelY) return
    this.shownLabelX = x
    this.shownLabelY = y
    this.squadLabel.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }

  private publish(change: Partial<GameView>): void {
    this.view = { ...this.view, ...change }
    for (const listener of this.listeners) listener(this.view)
  }
}
