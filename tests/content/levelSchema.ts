import { z } from 'zod'

// The level file format of docs/domain/levels.md. A new field is a domain docs change first.

const trackEdge = 5

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

const gateRow = z.strictObject({
  type: z.literal('gates'),
  z: z.number(),
  left: gate,
  right: gate,
})

const waveBase = {
  type: z.literal('wave'),
  z: z.number(),
  enemy: z.enum(['puppy', 'chihuahua', 'bulldog', 'shieldDog']),
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
    events: z.array(z.union([gateRow, wave, barrel, wall])),
  })
  .superRefine((level, context) => {
    level.events.forEach((event, index) => {
      if (event.z <= 0 || event.z >= level.length) {
        context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'z must lie between 0 and length' })
      }
      if (index > 0 && event.z < level.events[index - 1].z) {
        context.addIssue({ code: 'custom', path: ['events', index, 'z'], message: 'events must be sorted by z' })
      }
      if (event.type === 'wave') {
        const [left, right] = waveXRange(event)
        if (left < -trackEdge || right > trackEdge) {
          context.addIssue({ code: 'custom', path: ['events', index], message: 'every enemy must stand within x -5..5' })
        }
      }
    })
  })
