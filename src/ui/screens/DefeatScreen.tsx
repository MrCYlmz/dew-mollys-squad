import { strings } from '../../content/strings'

interface DefeatScreenProps {
  distanceReached: number
  onRetry: () => void
}

export function DefeatScreen({ distanceReached, onRetry }: DefeatScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{strings.defeat}</h2>
      <p class="result">
        {strings.distanceReached}: {distanceReached}
      </p>
      <button type="button" class="primary retry-button" onClick={onRetry}>
        {strings.retry}
      </button>
    </div>
  )
}
