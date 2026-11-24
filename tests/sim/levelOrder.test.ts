import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { levels } from '../../src/content/levels'
import { firstLevel, levelAfter } from '../../src/sim/levelOrder'
import { quietStream } from './runHarness'

function levelFile(id: string, level: number): Level {
  return { id, level, length: 300, stream: quietStream, events: [] }
}

// The example from docs/domain/levels.md: the files level-1 (level 1) and level-5 (level 5).
const documentedLevels = [levelFile('level-5', 5), levelFile('level-1', 1)]

describe('level order', () => {
  it('title_starts_the_level_with_the_lowest_level_number', () => {
    expect(firstLevel(documentedLevels).id).toBe('level-1')
  })

  it('victory_leads_to_the_next_level_number', () => {
    expect(levelAfter(documentedLevels, documentedLevels[1])?.id).toBe('level-5')
  })

  it('victory_of_the_last_level_leads_back_to_the_title', () => {
    expect(levelAfter(documentedLevels, documentedLevels[0])).toBeNull()
  })

  it('levels_with_the_same_number_are_played_in_alphabetical_order_of_id', () => {
    const sharedNumber = [levelFile('level-2-real', 2), levelFile('level-3', 3), levelFile('level-2-placeholder', 2)]

    expect(firstLevel(sharedNumber).id).toBe('level-2-placeholder')
    expect(levelAfter(sharedNumber, sharedNumber[2])?.id).toBe('level-2-real')
    expect(levelAfter(sharedNumber, sharedNumber[0])?.id).toBe('level-3')
  })

  // Level numbers are whole numbers, so level 10 must come after level 5, not before it as the text "10" does.
  it('level_numbers_are_compared_as_numbers', () => {
    const world = [levelFile('level-10', 10), levelFile('level-5', 5)]

    expect(firstLevel(world).id).toBe('level-5')
    expect(levelAfter(world, world[1])?.id).toBe('level-10')
  })

  it('victory_leads_to_the_nearest_level_after_wherever_the_files_list_it', () => {
    const world = [levelFile('level-10', 10), levelFile('level-3', 3), levelFile('level-1', 1)]

    expect(levelAfter(world, world[2])?.id).toBe('level-3')
    expect(levelAfter(world, world[1])?.id).toBe('level-10')
  })

  // requirements S-11 (6): the shipped levels run level-1 → level-15, and the victory after level-15 goes back to the title.
  it('shipped_levels_are_played_from_level_1_to_level_15_then_back_to_the_title', () => {
    const played = [firstLevel(levels)]
    for (let next = levelAfter(levels, played[0]); next !== null; next = levelAfter(levels, next)) played.push(next)

    expect(played.map((level) => level.id)).toEqual(Array.from({ length: 15 }, (_, index) => `level-${index + 1}`))
  })
})
