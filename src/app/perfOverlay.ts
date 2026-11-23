import type { FrameStats, GameRenderer } from '../render/gameRenderer'
import type { RunState } from '../sim/run'

// The overlay's text is rebuilt this often, so it costs nothing per frame.
const refreshSeconds = 0.5

// Chrome's non-standard performance.memory; other browsers show no heap.
function usedHeapBytes(): number | null {
  const memory: unknown = Reflect.get(performance, 'memory')
  if (typeof memory !== 'object' || memory === null) return null
  const used: unknown = Reflect.get(memory, 'usedJSHeapSize')
  return typeof used === 'number' ? used : null
}

// The developer's performance overlay, shown only with the ?perf flag: fps, frame and work time, draw calls, triangles,
// GPU objects and the live object counts.
export class PerfOverlay {
  private readonly element = document.createElement('pre')
  private readonly stats: FrameStats = { drawCalls: 0, triangles: 0, geometries: 0, textures: 0, catsDrawn: 0, particles: 0 }
  private windowStart: number | null = null
  private frames = 0
  private longestFrame = 0
  private lastTimestamp: number | null = null
  private workMilliseconds = 0

  constructor(parent: HTMLElement) {
    this.element.className = 'perf-overlay'
    parent.append(this.element)
  }

  // Called at the end of each frame; work time runs from the frame's timestamp to now.
  frame(timestamp: number, renderer: GameRenderer, state: RunState): void {
    this.workMilliseconds += performance.now() - timestamp
    if (this.lastTimestamp !== null) this.longestFrame = Math.max(this.longestFrame, timestamp - this.lastTimestamp)
    this.lastTimestamp = timestamp
    this.frames++
    if (this.windowStart === null) this.windowStart = timestamp
    const windowMilliseconds = timestamp - this.windowStart
    if (windowMilliseconds < refreshSeconds * 1000) return

    renderer.readFrameStats(this.stats)
    const heap = usedHeapBytes()
    this.element.textContent = [
      `fps ${((this.frames * 1000) / windowMilliseconds).toFixed(0)}`,
      `frame ${(windowMilliseconds / this.frames).toFixed(1)} ms, longest ${this.longestFrame.toFixed(1)} ms`,
      `work ${(this.workMilliseconds / this.frames).toFixed(1)} ms`,
      `draw calls ${this.stats.drawCalls}`,
      `triangles ${this.stats.triangles}`,
      `geometries ${this.stats.geometries}, textures ${this.stats.textures}`,
      `cats ${this.stats.catsDrawn}, enemies ${state.enemies.length}`,
      `yarn balls ${state.yarnBalls.length}, particles ${this.stats.particles}`,
      heap === null ? 'heap n/a' : `heap ${(heap / 1e6).toFixed(1)} MB`,
    ].join('\n')
    this.windowStart = timestamp
    this.frames = 0
    this.longestFrame = 0
    this.workMilliseconds = 0
  }

  dispose(): void {
    this.element.remove()
  }
}
