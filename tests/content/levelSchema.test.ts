import { describe, expect, it } from 'vitest'
import { levelSchema } from './levelSchema'

// The examples from docs/domain/levels.md, in one level.
const documentedLevel = {
  id: 'level-1',
  level: 1,
  length: 400,
  stream: { interval: 2, enemies: ['puppy'] },
  events: [
    { type: 'gates', z: 40, left: { op: 'add', value: 10 }, centre: { op: 'multiply', value: 2 }, right: { op: 'subtract', value: 15 } },
    { type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 5 },
    { type: 'gates', z: 90, left: { op: 'add', value: 10 }, right: { op: 'damage', value: 1 } },
    { type: 'barrel', z: 120, x: 1.5 },
    { type: 'buffBlock', z: 120, lane: 'right', hp: 40, buff: 'multiply' },
    { type: 'wave', z: 130, enemy: 'puppy', pattern: 'block', columns: 5, rows: 4, x: 0, spacing: 1.5 },
    { type: 'gates', z: 140, centre: { op: 'fireRate', value: 20 } },
    { type: 'wall', z: 160, x: -2.5, width: 5 },
    { type: 'wave', z: 180, enemy: 'puppy', pattern: 'column', count: 8, x: -3, spacing: 2 },
    { type: 'wave', z: 230, enemy: 'puppy', pattern: 'flank', count: 4, spacing: 2 },
    { type: 'wave', z: 260, enemy: 'chihuahua', pattern: 'line', count: 10 },
  ],
}

function withEvent(event: object) {
  return { ...documentedLevel, events: [event] }
}

// The boss example from docs/domain/levels.md: length 400, expected squad at boss 60, the Dustbot at z = 400.
const documentedBossLevel = {
  ...documentedLevel,
  expectedSquadAtBoss: 60,
  events: [...documentedLevel.events, { type: 'boss', z: 400, boss: 'dustbot' }],
}

function bossLevelWith(change: object) {
  return { ...documentedBossLevel, ...change }
}

function withEventsBeforeTheBoss(...events: object[]) {
  return { ...documentedBossLevel, events: [...documentedLevel.events, ...events, { type: 'boss', z: 400, boss: 'dustbot' }] }
}

describe('level schema', () => {
  it('accepts_the_documented_examples', () => {
    expect(levelSchema.safeParse(documentedLevel).success).toBe(true)
  })

  // The second stream example from docs/domain/levels.md.
  it('accepts_a_stream_that_sends_a_kind_more_than_once', () => {
    expect(levelSchema.safeParse({ ...documentedLevel, stream: { interval: 0.8, enemies: ['puppy', 'puppy', 'chihuahua'] } }).success).toBe(true)
  })

  it('accepts_a_stream_of_every_enemy_kind', () => {
    expect(levelSchema.safeParse({ ...documentedLevel, stream: { interval: 0.01, enemies: ['puppy', 'chihuahua', 'bulldog', 'shieldDog'] } }).success).toBe(true)
  })

  it('accepts_a_level_marked_as_placeholder', () => {
    expect(levelSchema.safeParse({ ...documentedLevel, placeholder: true }).success).toBe(true)
  })

  it.each([
    ['multi-shot', { op: 'multiShot', value: 1 }],
    ['fire rate', { op: 'fireRate', value: 20 }],
    ['damage', { op: 'damage', value: 1 }],
    ['range', { op: 'range', value: 10 }],
  ])('accepts_a_%s_gate_with_its_fixed_value', (_case, buff) => {
    expect(levelSchema.safeParse(withEvent({ type: 'gates', z: 40, left: buff, right: { op: 'divide', value: 2 } })).success).toBe(true)
  })

  it.each(['left', 'centre', 'right'])('accepts_a_gate_row_with_a_single_gate_in_the_%s_lane', (lane) => {
    expect(levelSchema.safeParse(withEvent({ type: 'gates', z: 40, [lane]: { op: 'add', value: 1 } })).success).toBe(true)
  })

  it.each(['add', 'multiply', 'fireRate', 'damage', 'multiShot', 'range'])('accepts_a_buff_block_hiding_a_%s_big_buff', (buff) => {
    expect(levelSchema.safeParse(withEvent({ type: 'buffBlock', z: 80, lane: 'left', hp: 0.5, buff })).success).toBe(true)
  })

  it.each(['bulldog', 'shieldDog'])('accepts_a_wave_of_%s', (enemy) => {
    expect(levelSchema.safeParse(withEvent({ type: 'wave', z: 80, enemy, pattern: 'flank', count: 2, spacing: 1 })).success).toBe(true)
  })

  it('accepts_a_barrel_at_the_track_edge', () => {
    expect(levelSchema.safeParse(withEvent({ type: 'barrel', z: 80, x: -5 })).success).toBe(true)
  })

  it('accepts_a_wall_across_the_whole_track', () => {
    expect(levelSchema.safeParse(withEvent({ type: 'wall', z: 80, x: 0, width: 10 })).success).toBe(true)
  })

  it.each([
    ['without an id', { ...documentedLevel, id: undefined }],
    ['without a level number', { ...documentedLevel, level: undefined }],
    ['with level number 0', { ...documentedLevel, level: 0 }],
    ['with a fractional level number', { ...documentedLevel, level: 1.5 }],
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
    ['with a fire rate gate other than 20', withEvent({ type: 'gates', z: 40, left: { op: 'fireRate', value: 10 }, right: { op: 'add', value: 1 } })],
    ['with a damage gate other than 1', withEvent({ type: 'gates', z: 40, left: { op: 'damage', value: 2 }, right: { op: 'add', value: 1 } })],
    ['with a multi-shot gate other than 1', withEvent({ type: 'gates', z: 40, left: { op: 'multiShot', value: 2 }, right: { op: 'add', value: 1 } })],
    ['with a range gate other than 10', withEvent({ type: 'gates', z: 40, left: { op: 'range', value: 5 }, right: { op: 'add', value: 1 } })],
    ['with an unknown gate op', withEvent({ type: 'gates', z: 40, left: { op: 'speed', value: 1 }, right: { op: 'add', value: 1 } })],
    ['with a gate row without a gate', withEvent({ type: 'gates', z: 40 })],
    ['with a gate in a lane the format does not define', withEvent({ type: 'gates', z: 40, middle: { op: 'add', value: 1 } })],
    ['with a buff block in an unknown lane', withEvent({ type: 'buffBlock', z: 80, lane: 'middle', hp: 40, buff: 'add' })],
    ['with a buff block missing its lane', withEvent({ type: 'buffBlock', z: 80, hp: 40, buff: 'add' })],
    ['with a buff block of 0 hp', withEvent({ type: 'buffBlock', z: 80, lane: 'left', hp: 0, buff: 'add' })],
    ['with a buff block missing its hp', withEvent({ type: 'buffBlock', z: 80, lane: 'left', buff: 'add' })],
    ['with a buff block hiding a subtract', withEvent({ type: 'buffBlock', z: 80, lane: 'left', hp: 40, buff: 'subtract' })],
    ['with a buff block hiding a divide', withEvent({ type: 'buffBlock', z: 80, lane: 'left', hp: 40, buff: 'divide' })],
    ['with a buff block that states its buff value', withEvent({ type: 'buffBlock', z: 80, lane: 'left', hp: 40, buff: 'add', value: 30 })],
    ['with a buff block at the finish line', withEvent({ type: 'buffBlock', z: 400, lane: 'left', hp: 40, buff: 'add' })],
    ['with an unknown enemy', withEvent({ type: 'wave', z: 80, enemy: 'cat', pattern: 'line', count: 1 })],
    ['with an unknown pattern', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'circle', count: 1 })],
    ['with an empty line', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'line', count: 0 })],
    ['with a column missing its spacing', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'column', count: 3, x: 0 })],
    ['with zero spacing', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'flank', count: 3, spacing: 0 })],
    ['with a column off the track', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'column', count: 3, x: 5.5, spacing: 1 })],
    ['with a block wider than the track', withEvent({ type: 'wave', z: 80, enemy: 'puppy', pattern: 'block', columns: 5, rows: 1, x: 3, spacing: 1.5 })],
    ['with a barrel off the track', withEvent({ type: 'barrel', z: 80, x: 5.5 })],
    ['with a barrel missing its x', withEvent({ type: 'barrel', z: 80 })],
    ['with a barrel at the finish line', withEvent({ type: 'barrel', z: 400, x: 0 })],
    ['with a wall reaching past the left edge', withEvent({ type: 'wall', z: 80, x: -3, width: 5 })],
    ['with a wall reaching past the right edge', withEvent({ type: 'wall', z: 80, x: 3, width: 5 })],
    ['with a wall of zero width', withEvent({ type: 'wall', z: 80, x: 0, width: 0 })],
    ['with a wall missing its width', withEvent({ type: 'wall', z: 80, x: 0 })],
    ['without a stream', { ...documentedLevel, stream: undefined }],
    ['with a stream interval of 0', { ...documentedLevel, stream: { interval: 0, enemies: ['puppy'] } }],
    ['with a negative stream interval', { ...documentedLevel, stream: { interval: -1, enemies: ['puppy'] } }],
    ['with a stream missing its interval', { ...documentedLevel, stream: { enemies: ['puppy'] } }],
    ['with a stream without enemies', { ...documentedLevel, stream: { interval: 2, enemies: [] } }],
    ['with a stream missing its enemies', { ...documentedLevel, stream: { interval: 2 } }],
    ['with a stream of an unknown enemy', { ...documentedLevel, stream: { interval: 2, enemies: ['cat'] } }],
    ['with a stream that has a z', { ...documentedLevel, stream: { interval: 2, enemies: ['puppy'], z: 10 } }],
    ['with the stream as an event', withEvent({ type: 'stream', z: 80, interval: 2, enemies: ['puppy'] })],
    ['with an unknown event type', withEvent({ type: 'coin', z: 80, x: 0 })],
  ])('rejects_a_level_%s', (_case, level) => {
    expect(levelSchema.safeParse(level).success).toBe(false)
  })
})

describe('boss level schema', () => {
  it('accepts_the_documented_boss_level', () => {
    expect(levelSchema.safeParse(documentedBossLevel).success).toBe(true)
  })

  it('accepts_a_mega_dustbot_level_marked_as_placeholder', () => {
    const megaDustbotLevel = bossLevelWith({
      placeholder: true,
      events: [...documentedLevel.events, { type: 'boss', z: 400, boss: 'megaDustbot' }],
    })

    expect(levelSchema.safeParse(megaDustbotLevel).success).toBe(true)
  })

  // decisions.md: walls and buff blocks end at least 5 units before the arena start, z + depth ≤ length − 5.
  it.each([
    ['wall', { type: 'wall', z: 394, x: 0, width: 2 }],
    ['buff block', { type: 'buffBlock', z: 394, lane: 'centre', hp: 40, buff: 'add' }],
  ])('accepts_a_%s_that_ends_5_units_before_the_arena_start', (_case, event) => {
    expect(levelSchema.safeParse(withEventsBeforeTheBoss(event)).success).toBe(true)
  })

  it('accepts_an_expected_squad_at_boss_of_1', () => {
    expect(levelSchema.safeParse(bossLevelWith({ expectedSquadAtBoss: 1 })).success).toBe(true)
  })

  it.each([
    ['without expectedSquadAtBoss', bossLevelWith({ expectedSquadAtBoss: undefined })],
    ['with an expectedSquadAtBoss of 0', bossLevelWith({ expectedSquadAtBoss: 0 })],
    ['with a fractional expectedSquadAtBoss', bossLevelWith({ expectedSquadAtBoss: 60.5 })],
    ['with the boss before the arena start', bossLevelWith({ events: [...documentedLevel.events, { type: 'boss', z: 399, boss: 'dustbot' }] })],
    ['with the boss past the arena start', bossLevelWith({ events: [...documentedLevel.events, { type: 'boss', z: 401, boss: 'dustbot' }] })],
    ['with an unknown boss', bossLevelWith({ events: [...documentedLevel.events, { type: 'boss', z: 400, boss: 'toaster' }] })],
    ['with a boss event missing its boss', bossLevelWith({ events: [...documentedLevel.events, { type: 'boss', z: 400 }] })],
    [
      'with two bosses',
      bossLevelWith({ events: [...documentedLevel.events, { type: 'boss', z: 400, boss: 'dustbot' }, { type: 'boss', z: 400, boss: 'megaDustbot' }] }),
    ],
    ['with a wall ending less than 5 units before the arena start', withEventsBeforeTheBoss({ type: 'wall', z: 394.5, x: 0, width: 2 })],
    [
      'with a buff block ending less than 5 units before the arena start',
      withEventsBeforeTheBoss({ type: 'buffBlock', z: 394.5, lane: 'centre', hp: 40, buff: 'add' }),
    ],
    ['with a gate row at the arena start', withEventsBeforeTheBoss({ type: 'gates', z: 400, centre: { op: 'add', value: 1 } })],
    ['with a wave at the arena start', withEventsBeforeTheBoss({ type: 'wave', z: 400, enemy: 'puppy', pattern: 'line', count: 1 })],
    ['with a barrel at the arena start', withEventsBeforeTheBoss({ type: 'barrel', z: 400, x: 0 })],
    ['with a wall at the arena start', withEventsBeforeTheBoss({ type: 'wall', z: 400, x: 0, width: 2 })],
    ['with a buff block at the arena start', withEventsBeforeTheBoss({ type: 'buffBlock', z: 400, lane: 'centre', hp: 40, buff: 'add' })],
    [
      'with a wave past the arena start',
      bossLevelWith({
        events: [...documentedLevel.events, { type: 'boss', z: 400, boss: 'dustbot' }, { type: 'wave', z: 410, enemy: 'puppy', pattern: 'line', count: 1 }],
      }),
    ],
  ])('rejects_a_boss_level_%s', (_case, level) => {
    expect(levelSchema.safeParse(level).success).toBe(false)
  })

  it('rejects_expected_squad_at_boss_in_a_level_without_a_boss', () => {
    expect(levelSchema.safeParse({ ...documentedLevel, expectedSquadAtBoss: 60 }).success).toBe(false)
  })
})
