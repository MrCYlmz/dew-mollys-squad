import type { Ref } from 'preact'
import { strings } from '../../content/strings'

interface SquadCountLabelProps {
  count: number
  ref: Ref<HTMLDivElement>
}

export function SquadCountLabel({ count, ref }: SquadCountLabelProps) {
  return (
    <div class="squad-count" ref={ref} aria-label={strings.squadCount}>
      {count}
    </div>
  )
}
