import { strings } from '../../content/strings'

// Shows how to steer on level 1, without visible text: a pointing hand that swipes left and right.
export function HandIcon() {
  return (
    <div class="hand-icon" role="img" aria-label={strings.howToSteer}>
      <svg viewBox="0 0 64 80" width="64" height="80" aria-hidden="true">
        {/* The outline is drawn under the fill, so finger and palm read as one shape. */}
        <g fill="#2d2b30" stroke="#2d2b30" stroke-width="6" stroke-linejoin="round">
          <rect x="22" y="4" width="14" height="44" rx="7" />
          <rect x="10" y="32" width="44" height="44" rx="14" />
        </g>
        <g fill="#ffffff">
          <rect x="22" y="4" width="14" height="44" rx="7" />
          <rect x="10" y="32" width="44" height="44" rx="14" />
        </g>
      </svg>
    </div>
  )
}
