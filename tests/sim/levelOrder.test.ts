import { describe, expect, it } from 'vitest'
import type { Level } from '../../src/content/level'
import { levels } from '../../src/content/levels'
import { firstLevel, levelAfter } from '../../src/sim/levelOrder'

function levelFile(id: string, level: number): Level {
  return { id, level, length: 300, events: [] }
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

  it('game_starts_at_level_1_and_its_victory_leads_to_the_dustbot_level_5', () => {
    const first = firstLevel(levels)
    const second = levelAfter(levels, first)

    expect(first.level).toBe(1)
    expect(second?.level).toBe(5)
    expect(second?.events.at(-1)).toEqual({ type: 'boss', z: second?.length, boss: 'dustbot' })
  })
})
