import { z } from 'zod'
import { tuning } from '../../src/content/tuning'

// The level file format of docs/domain/levels.md. A new field is a domain docs change first.

const trackEdge = 5
// Walls and buff blocks end at least this far before the arena start, so none stands in the boss arena.
const obstacleClearanceBeforeArena = 5

const addOrSubtractValue = z.int().min(1)
const gate = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('add'), value: addOrSubtractValue }),
  z.strictObject({ op: z.literal('subtract'), value: addOrSubtractValue }),
  z.strictObject({ op: z.literal('multiply'), value: z.literal(2) }),
  z.strictObject({ op: z.literal('divide'), value: z.literal(2) }),
  z.strictObject({ op: z.literal('fireRate'), value: z.literal(20) }),
  z.strictObject({ op: z.literal('damage'), value: z.literal(1) }),
  z.strictObject({ op: z.literal('multiShot'), value: z.literal(1) }),
  z.strictObject({ op: z.literal('range'), value: z.literal(10) }),
])

const lane = z.enum(['left', 'centre', 'right'])

const gateRow = z
  .strictObject({
    type: z.literal('gates'),
    z: z.number(),
    left: gate.optional(),
    centre: gate.optional(),
    right: gate.optional(),
  })
  .refine((row) => row.left !== undefined || row.centre !== undefined || row.right !== undefined, {
    message: 'a gate row has at least one gate',
  })

const enemyKind = z.enum(['puppy', 'chihuahua', 'bulldog', 'shieldDog'])

const stream = z.strictObject({
  interval: z.number().positive(),
  enemies: z.array(enemyKind).min(1),
})

const waveBase = {
  type: z.literal('wave'),
  z: z.number(),
  enemy: enemyKind,
}
const count = z.int().min(1)
const spacing = z.number().positive()

const lineWave = z.strictObject({ ...waveBase, pattern: z.literal('line'), count })
const blockWave = z.strictObject({
  ...waveBase,
  pattern: z.literal('block'),
  columns: count,
  rows: count,
  x: z.number(),
  spacing,
})
const columnWave = z.strictObject({ ...waveBase, pattern: z.literal('column'), count, x: z.number(), spacing })
const flankWave = z.strictObject({ ...waveBase, pattern: z.literal('flank'), count, spacing })

const wave = z.discriminatedUnion('pattern', [lineWave, blockWave, columnWave, flankWave])

const barrel = z.strictObject({
  type: z.literal('barrel'),
  z: z.number(),
  x: z.number().min(-trackEdge).max(trackEdge),
})

const wall = z
  .strictObject({
    type: z.literal('wall'),
    z: z.number(),
    x: z.number(),
    width: z.number().positive(),
  })
  .refine((wall) => wall.x - wall.width / 2 >= -trackEdge && wall.x + wall.width / 2 <= trackEdge, {
    message: 'the whole wall must lie on the track',
  })

const buffBlock = z.strictObject({
  type: z.literal('buffBlock'),
  z: z.number(),
  lane,
  hp: z.number().positive(),
  buff: z.enum(['add', 'multiply', 'fireRate', 'damage', 'multiShot', 'range']),
})

const boss = z.strictObject({
  type: z.literal('boss'),
  z: z.number(),
  boss: z.enum(['dustbot', 'megaDustbot']),
})

export type LevelFile = z.infer<typeof levelSchema>
type Wave = z.infer<typeof wave>

// Only block and column waves can be placed off the track; line and flank stand on it by definition.
function waveXRange(wave: Wave): [number, number] {
  switch (wave.pattern) {
    case 'block': {
      const halfWidth = ((wave.columns - 1) * wave.spacing) / 2
      return [wave.x - halfWidth, wave.x + halfWidth]
    }
    case 'column':
      return [wave.x, wave.x]
    default:
      return [-trackEdge, trackEdge]
  }
}

export const levelSchema = z
  .strictObject({
    id: z.string().min(1),
    level: z.int().min(1),
    length: z.number().min(300).max(600),
    placeholder: z.literal(true).optional(),
    expectedSquadAtBoss: z.int().min(1).optional(),
    stream,
    events: z.array(z.union([gateRow, wave, barrel, wall, buffBlock, boss])),
  })
  .superRefine((level, context) => {
    const hasBoss = level.events.some((event) => event.type === 'boss')
    if (hasBoss !== (level.expectedSquadAtBoss !== undefined)) {
      context.addIssue({
        code: 'custom',
        path: ['expectedSquadAtBoss'],
        message: 'expectedSquadAtBoss is required in a level with a boss and not allowed in one without',
      })
    }
    level.events.forEach((event, index) => {
      if (event.type === 'boss') {
        if (event.z !== level.length) {
          context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'the boss stands at z = length, the arena start' })
        }
        if (index !== level.events.length - 1) {
          context.addIssue({ code: 'custom', path: ['events', index], message: 'the boss is the last event' })
        }
      } else if (event.z <= 0 || event.z >= level.length) {
        context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'z must lie between 0 and length' })
      }
      if (index > 0 && event.z < level.events[index - 1].z) {
        context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'events must be sorted by z' })
      }
      if (hasBoss && (event.type === 'wall' || event.type === 'buffBlock')) {
        const depth = event.type === 'wall' ? tuning.wall.depth : tuning.buffBlock.depth
        if (event.z + depth > level.length - obstacleClearanceBeforeArena) {
          context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'walls and buff blocks end at least 5 units before the arena start' })
        }
      }
      if (event.type === 'wave') {
        const [left, right] = waveXRange(event)
        if (left < -trackEdge || right > trackEdge) {
          context.addIssue({ code: 'custom', path: ['events', index], message: 'every enemy must stand within x -5..5' })
        }
      }
    })
  })
