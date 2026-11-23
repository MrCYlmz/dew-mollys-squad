import { renderConfig, type GraphicsQuality } from '../content/renderConfig'

// A forced quality wins; otherwise a start below the fps threshold, measured over the first seconds of play, switches to low.
export function chooseGraphicsQuality(forced: GraphicsQuality | null, startupFps: number): GraphicsQuality {
  if (forced !== null) return forced
  return startupFps < renderConfig.graphics.autoLowBelowFps ? 'low' : 'high'
}
