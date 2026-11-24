import type { BossKind } from '../../content/level'
import { strings } from '../../content/strings'
import type { LossCause } from '../../sim/run'

const caughtByHeading: Record<BossKind, string> = {
  dustbot: strings.caughtByDustbot,
  megaDustbot: strings.caughtByMegaDustbot,
}

const obstacleHeading = {
  ranIntoWall: strings.ranIntoWall,
  ranIntoBlock: strings.ranIntoBlock,
}

const tip: Record<LossCause, string> = {
  outOfCats: strings.tipOutOfCats,
  ranIntoWall: strings.tipRanIntoObstacle,
  ranIntoBlock: strings.tipRanIntoObstacle,
  caughtByBoss: strings.tipCaughtByBoss,
}

interface DefeatScreenProps {
  distanceReached: number
  lossCause: LossCause
  // The boss that touched the squad, or null when no boss did.
  caughtBy: BossKind | null
  onRetry: () => void
}

function heading(lossCause: LossCause, caughtBy: BossKind | null): string {
  if (lossCause === 'ranIntoWall' || lossCause === 'ranIntoBlock') return obstacleHeading[lossCause]
  return caughtBy === null ? strings.defeat : caughtByHeading[caughtBy]
}

export function DefeatScreen({ distanceReached, lossCause, caughtBy, onRetry }: DefeatScreenProps) {
  return (
    <div class="screen overlay">
      <h2>{heading(lossCause, caughtBy)}</h2>
      <p class="tip">{tip[lossCause]}</p>
      <p class="result">
        {strings.distanceReached}: {distanceReached}
      </p>
      <button type="button" class="primary retry-button" onClick={onRetry}>
        {strings.retry}
      </button>
    </div>
  )
}
