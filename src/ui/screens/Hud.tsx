import { strings } from '../../content/strings'

export interface BossHp {
  hp: number
  fullHp: number
}

// The share of HP left, rounded up, so a boss with any HP left never shows an empty bar.
export function bossHpPercent({ hp, fullHp }: BossHp): number {
  return Math.ceil((Math.max(hp, 0) / fullHp) * 100)
}

interface HudProps {
  // The level file's level number.
  level: number
  // Share of the level behind the squad, 0..1.
  progress: number
  // Null outside the boss arena.
  boss: BossHp | null
  onPause: () => void
}

export function Hud({ level, progress, boss, onPause }: HudProps) {
  const percent = Math.round(progress * 100)
  const bossPercent = boss === null ? 0 : bossHpPercent(boss)
  return (
    <div class="hud">
      <button type="button" class="pause-button" aria-label={strings.pause} onClick={onPause}>
        <span class="pause-icon" />
      </button>
      <span class="level-number">{strings.levelNumber.replace('{level}', String(level))}</span>
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
      {boss !== null && (
        <div
          class="boss-hp-bar"
          role="progressbar"
          aria-label={strings.bossHp}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={bossPercent}
        >
          <div class="boss-hp-fill" style={{ width: `${bossPercent}%` }} />
        </div>
      )}
    </div>
  )
}
