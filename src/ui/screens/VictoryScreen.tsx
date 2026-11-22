import { strings } from '../../content/strings'

interface VictoryScreenProps {
  catsLeft: number
  onPlayAgain: () => void
  onBackToTitle: () => void
}

export function VictoryScreen({ catsLeft, onPlayAgain, onBackToTitle }: VictoryScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{strings.levelComplete}</h2>
      <p class="result">
        {strings.catsLeft}: {catsLeft}
      </p>
      <button type="button" class="primary" onClick={onPlayAgain}>
        {strings.playAgain}
      </button>
      <button type="button" onClick={onBackToTitle}>
        {strings.backToTitle}
      </button>
    </div>
  )
}
