import { strings } from '../../content/strings'

interface HudProps {
  // Share of the level behind the squad, 0..1.
  progress: number
  onPause: () => void
}

export function Hud({ progress, onPause }: HudProps) {
  const percent = Math.round(progress * 100)
  return (
    <div class="hud">
      <button type="button" class="pause-button" aria-label={strings.pause} onClick={onPause}>
        <span class="pause-icon" />
      </button>
      <div
        class="progress-bar"
        role="progressbar"
        aria-label={strings.levelProgress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div class="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
