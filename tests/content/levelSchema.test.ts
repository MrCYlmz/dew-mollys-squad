import { describe, expect, it } from 'vitest'
import { levelSchema } from './levelSchema'

// The examples from docs/domain/levels.md, in one level.
const documentedLevel = {
  id: 'level-1',
  length: 400,
  events: [
    { type: 'gates', z: 40, left: { op: 'add', value: 10 }, right: { op: 'subtract', value: 15 } },
    { type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 },
    { type: 'wave', z: 130, enemy: 'puppy', pattern: 'block', columns: 5, rows: 4, x: 0, spacing: 1.5 },
    { type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 },
    { type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 },
  ],
}

function withEvent(event: object) {
  return { ...documentedLevel, events: [event] }
}

describe('level schema', () => {
  it('accepts_the_documented_examples', () => {
    expect(levelSchema.safeParse(documentedLevel).success).toBe(true)
  })

  it('accepts_a_level_marked_as_placeholder', () => {
    expect(levelSchema.safeParse({ ...documentedLevel, placeholder: true }).success).toBe(true)
  })

  it.each([
    ['without an id', { ...documentedLevel, id: undefined }],
    ['shorter than 300 units', { ...documentedLevel, length: 299 }],
    ['longer than 600 units', { ...documentedLevel, length: 601 }],
    ['with a field the format does not define', { ...documentedLevel, startSquad: 1 }],
    ['with an event at z 0', withEvent({ type: 'wave', z: 0, enemy: 'puppy', pattern: 'line', count: 1 })],
    ['with an event at the finish line', withEvent({ type: 'wave', z: 400, enemy: 'puppy', pattern: 'line', count: 1 })],
    ['with events out of z order', { ...documentedLevel, events: [...documentedLevel.events].reverse() }],
    ['with a multiply gate other than 2', withEvent({ type: 'gates', z: 40, left: { op: 'multiply', value: 3 }, right: { op: 'add', value: 1 } })],
    ['with a signed subtract value', withEvent({ type: 'gates', z: 40, left: { op: 'subtract', value: -15 }, right: { op: 'add', value: 1 } })],
    ['with a zero add value', withEvent({ type: 'gates', z: 40, left: { op: 'add', value: 0 }, right: { op: 'add', value: 1 } })],
    ['with a fractional add value', withEvent({ type: 'gates', z: 40, left: { op: 'add', value: 1.5 }, right: { op: 'add', value: 1 } })],
    ['with a weapon-buff gate', withEvent({ type: 'gates', z: 40, left: { op: 'fireRate', value: 20 }, right: { op: 'add', value: 1 } })],
    ['with an enemy other than puppy', withEvent({ type: 'wave', z: 80, enemy: 'bulldog', pattern: 'line', count: 1 })],
    ['with an unknown pattern', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'circle', count: 1 })],
    ['with an empty line', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 0 })],
    ['with a column missing its spacing', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'column', count: 3, x: 0 })],
    ['with zero spacing', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'flank', count: 3, spacing: 0 })],
    ['with a column off the track', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'column', count: 3, x: 5.5, spacing: 1 })],
    ['with a block wider than the track', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'block', columns: 5, rows: 1, x: 3, spacing: 1.5 })],
    ['with an unknown event type', withEvent({ type: 'barrel', z: 80, x: 0 })],
  ])('rejects_a_level_%s', (_case, level) => {
    expect(levelSchema.safeParse(level).success).toBe(false)
  })
})
