import { strings } from '../../content/strings'

interface VictoryScreenProps {
  catsLeft: number
  onNextLevel: () => void
  onBackToTitle: () => void
}

export function VictoryScreen({ catsLeft, onNextLevel, onBackToTitle }: VictoryScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{strings.levelComplete}</h2>
      <p class="result">
        {strings.catsLeft}: {catsLeft}
      </p>
      <button type="button" class="primary" onClick={onNextLevel}>
        {strings.nextLevel}
      </button>
      <button type="button" onClick={onBackToTitle}>
        {strings.backToTitle}
      </button>
    </div>
  )
}
