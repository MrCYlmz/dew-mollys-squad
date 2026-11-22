import { strings } from '../../content/strings'

interface PauseScreenProps {
  onResume: () => void
  onRestart: () => void
  onQuit: () => void
}

export function PauseScreen({ onResume, onRestart, onQuit }: PauseScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{strings.paused}</h2>
      <button type="button" class="primary" onClick={onResume}>
        {strings.resume}
      </button>
      <button type="button" onClick={onRestart}>
        {strings.restart}
      </button>
      <button type="button" onClick={onQuit}>
        {strings.quitToTitle}
      </button>
    </div>
  )
}
