import type { BossKind, Level } from '../content/level'
import { renderConfig, type GraphicsQuality } from '../content/renderConfig'
import { tuning } from '../content/tuning'
import { watchFocus, watchVisibility } from '../platform/focus'
import { createInput, type PlayerInput } from '../platform/input'
import { GameRenderer, type ScreenPoint } from '../render/gameRenderer'
import { firstLevel, levelAfter } from '../sim/levelOrder'
import { createRun, type LossCause, type Run, type SteerInput } from '../sim/run'
import { bossHpPercent, type BossHp } from '../ui/screens/Hud'
import { chooseGraphicsQuality } from './graphicsQuality'
import type { LaunchFlags } from './launchFlags'
import { PerfOverlay } from './perfOverlay'

export type Screen = 'title' | 'playing' | 'paused' | 'victory' | 'defeat'

interface RunView {
  // The level file's level number of the level played or about to be played.
  level: number
  squadCount: number
  progress: number
  // Null outside the boss arena.
  boss: BossHp | null
  // The hand icon that shows how to steer on level 1.
  handIcon: boolean
}

// What the Defeat screen shows about the lost run.
export interface DefeatView {
  screen: 'defeat'
  distanceReached: number
  lossCause: LossCause
  // The boss that caught the squad, or null when no boss did.
  caughtBy: BossKind | null
}

// What the screens show.
export type GameView = RunView & ({ screen: Exclude<Screen, 'defeat'> } | DefeatView)

const tickSeconds = 1 / tuning.tickRate
// Longer frames, such as after a stall, are cut short instead of being caught up tick by tick.
const maxFrameSeconds = 0.25
const handIconTicks = tuning.handIconTime * tuning.tickRate
const normalPlay: LaunchFlags = { perf: false, stress: false, graphics: null }

export class Game {
  private readonly renderer: GameRenderer
  private readonly input: PlayerInput
  private readonly stopWatchingFocus: () => void
  private readonly stopWatchingVisibility: () => void
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
  // Ticks stepped in this run, so paused time does not count toward the hand icon time.
  private runTicks = 0
  // Until the first steer input or the hand icon time, on every start of level 1.
  private handIconShown = false
  private frameRequest = 0
  // False while the tab is hidden, when no frame is requested.
  private looping = true
  // Null once the graphics quality is chosen; until then the start-up check counts the frames of play.
  private startupCheck: { frames: number; seconds: number } | null
  private readonly forcedGraphics: GraphicsQuality | null
  // The stress run starts at once and starts again when it ends.
  private readonly stress: boolean
  private readonly perfOverlay: PerfOverlay | null
  view: GameView

  constructor(
    private readonly levels: readonly Level[],
    canvas: HTMLCanvasElement,
    gameElement: HTMLElement,
    flags: LaunchFlags = normalPlay,
  ) {
    // The stress run measures the budget's heaviest case, which is at high graphics unless forced otherwise.
    this.forcedGraphics = flags.graphics ?? (flags.stress ? 'high' : null)
    this.startupCheck = this.forcedGraphics === null ? { frames: 0, seconds: 0 } : null
    this.stress = flags.stress
    this.renderer = new GameRenderer(canvas, this.forcedGraphics ?? 'high')
    this.perfOverlay = flags.perf ? new PerfOverlay(gameElement) : null
    this.input = createInput(gameElement, () => this.pause())
    this.stopWatchingFocus = watchFocus(() => this.pause())
    this.stopWatchingVisibility = watchVisibility((visible) => (visible ? this.wake() : this.sleep()))
    this.resizeObserver = new ResizeObserver(() => this.resize(gameElement))
    this.resizeObserver.observe(gameElement)
    this.resize(gameElement)
    this.level = firstLevel(levels)
    this.run = this.newRun()
    this.view = { screen: 'title', level: this.level.level, squadCount: this.run.state.squad.count, progress: 0, boss: null, handIcon: false }
    this.frameRequest = requestAnimationFrame(this.frame)
    if (this.stress) this.play()
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
    this.runTicks = 0
    this.handIconShown = this.level.level === 1
    this.input.takeDragPixels()
    this.publish({ screen: 'playing', level: this.level.level, squadCount: this.run.state.squad.count, progress: 0, boss: null, handIcon: this.handIconShown })
  }

  quitToTitle(): void {
    this.level = firstLevel(this.levels)
    this.run = this.newRun()
    this.publish({ screen: 'title', level: this.level.level, squadCount: this.run.state.squad.count, progress: 0, boss: null, handIcon: false })
  }

  dispose(): void {
    cancelAnimationFrame(this.frameRequest)
    this.resizeObserver.disconnect()
    this.stopWatchingFocus()
    this.stopWatchingVisibility()
    this.perfOverlay?.dispose()
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

  // A hidden tab gets no frames, and on its return the run goes on from where it was, without catching up the time away.
  private sleep(): void {
    if (!this.looping) return
    this.looping = false
    cancelAnimationFrame(this.frameRequest)
  }

  private wake(): void {
    if (this.looping) return
    this.looping = true
    this.lastTimestamp = null
    this.frameRequest = requestAnimationFrame(this.frame)
  }

  private readonly frame = (timestamp: number): void => {
    this.frameRequest = requestAnimationFrame(this.frame)
    const elapsedSeconds = this.lastTimestamp === null ? 0 : (timestamp - this.lastTimestamp) / 1000
    const frameSeconds = Math.min(elapsedSeconds, maxFrameSeconds)
    const firstFrame = this.lastTimestamp === null
    this.lastTimestamp = timestamp

    const playing = this.view.screen === 'playing'
    if (playing) this.advance(frameSeconds)
    if (playing && !firstFrame) this.checkStartupSpeed(elapsedSeconds)
    const alpha = playing ? this.accumulator / tickSeconds : 1
    this.renderer.draw(this.run.state, alpha, playing ? frameSeconds : 0)
    this.placeSquadLabel(alpha)
    this.perfOverlay?.frame(timestamp, this.renderer, this.run.state)
  }

  // Until the settings screen, the frames of the first seconds of play choose the graphics quality, once per session.
  private checkStartupSpeed(elapsedSeconds: number): void {
    const check = this.startupCheck
    if (check === null) return
    check.frames++
    check.seconds += elapsedSeconds
    if (check.seconds < renderConfig.graphics.autoCheckSeconds) return
    this.startupCheck = null
    const quality = chooseGraphicsQuality(this.forcedGraphics, check.frames / check.seconds)
    if (quality === 'low') this.renderer.setQuality('low')
  }

  private advance(frameSeconds: number): void {
    this.accumulator += frameSeconds
    const state = this.run.state
    while (this.accumulator >= tickSeconds) {
      this.accumulator -= tickSeconds
      this.steerInput.drag = this.input.takeDragPixels() * this.renderer.trackUnitsPerPixel()
      this.steerInput.left = this.input.left
      this.steerInput.right = this.input.right
      this.runTicks++
      if (this.steerInput.drag !== 0 || this.steerInput.left || this.steerInput.right || this.runTicks >= handIconTicks) {
        this.handIconShown = false
      }
      for (const event of this.run.step(this.steerInput)) {
        if (event.type === 'catsLost') this.renderer.scatterCats(event.count)
        else if (event.type === 'bossHit') this.renderer.flashBoss()
        else if (event.type === 'enemyKilled') this.renderer.showKill(event.x, event.z)
        else if (event.type === 'barrelDestroyed') this.renderer.showBarrelSplash(event.x, event.z)
      }
      if (state.status !== 'running') break
    }

    const progress = Math.floor(Math.min(state.squad.z / state.length, 1) * 100) / 100
    if (this.stress && state.status !== 'running') {
      this.restart()
    } else if (state.status === 'won') {
      this.accumulator = 0
      this.publish({ screen: 'victory', squadCount: state.squad.count, progress: 1 })
    } else if (state.lossCause !== null) {
      this.accumulator = 0
      const caughtBy = state.lossCause === 'caughtByBoss' && state.boss !== null ? state.boss.kind : null
      this.publish({ screen: 'defeat', squadCount: 0, distanceReached: Math.floor(state.squad.z), lossCause: state.lossCause, caughtBy })
    } else if (
      state.squad.count !== this.view.squadCount ||
      progress !== this.view.progress ||
      this.bossBarChanged() ||
      this.handIconShown !== this.view.handIcon
    ) {
      this.publish({
        squadCount: state.squad.count,
        progress,
        boss: state.boss === null ? null : { hp: state.boss.hp, fullHp: state.boss.fullHp },
        handIcon: this.handIconShown,
      })
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

  private publish(change: Partial<RunView> & ({ screen?: Exclude<Screen, 'defeat'> } | DefeatView)): void {
    this.view = { ...this.view, ...change }
    for (const listener of this.listeners) listener(this.view)
  }
}
