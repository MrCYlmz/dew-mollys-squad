import type { BossKind } from '../../content/level'
import { strings } from '../../content/strings'

const caughtByHeading: Record<BossKind, string> = {
  dustbot: strings.caughtByDustbot,
  megaDustbot: strings.caughtByMegaDustbot,
}

interface DefeatScreenProps {
  distanceReached: number
  // The boss that touched the squad, or null when the squad ran out of cats.
  caughtBy: BossKind | null
  onRetry: () => void
}

export function DefeatScreen({ distanceReached, caughtBy, onRetry }: DefeatScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{caughtBy === null ? strings.defeat : caughtByHeading[caughtBy]}</h2>
      <p class="result">
        {strings.distanceReached}: {distanceReached}
      </p>
      <button type="button" class="primary retry-button" onClick={onRetry}>
        {strings.retry}
      </button>
    </div>
  )
}
