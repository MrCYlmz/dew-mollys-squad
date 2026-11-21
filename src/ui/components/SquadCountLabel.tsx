import type { Ref } from 'preact'
import { strings } from '../../content/strings'

interface SquadCountLabelProps {
  count: number
  // The owner moves the label over the squad by writing style.transform through this ref.
  ref: Ref<HTMLDivElement>
}

export function SquadCountLabel({ count, ref }: SquadCountLabelProps) {
  return (
    <div class="squad-count" ref={ref} aria-label={strings.squadCount}>
      {count}
    </div>
  )
}
