import { describe, expect, it } from 'vitest'
import { tuning } from '../../src/content/tuning'
import { createRun, type RunStatus } from '../../src/sim/run'
import { worldOneLevel } from '../content/worldOneLevels'
import { scriptedPlayer, type Choice } from './scriptedPlayers'

// requirements S-6 (7–10, 9a, 9b): scripted players on the ten levels of world 1, each on the same 5 fixed seeds.

const seeds = [1, 42, 1234, 98765, 20261124]
// The longest road, 600 units, takes 50 s; a boss fight is over well before another 70 s.
const maxTicks = 120 * tuning.tickRate

interface Outcome {
  status: RunStatus
  // The squad count in the tick the boss entered, or null when no boss entered.
  squadAtBoss: number | null
  // Seconds from the tick the boss entered to the tick it was defeated, or null when it was not.
  bossFightSeconds: number | null
  mostEnemiesAlive: number
}

const outcomes = new Map<string, Outcome>()

function play(levelNumber: number, seed: number, choice: Choice): Outcome {
  const key = `${levelNumber}/${seed}/${choice}`
  const known = outcomes.get(key)
  if (known !== undefined) return known
  const level = worldOneLevel(levelNumber)
  if (level === null) throw new Error(`level-${levelNumber}.json is missing`)
  const run = createRun({ level, seed })
  const player = scriptedPlayer(choice)
  const outcome: Outcome = { status: 'running', squadAtBoss: null, bossFightSeconds: null, mostEnemiesAlive: 0 }
  let bossEnteredTick = 0
  for (let tick = 0; tick < maxTicks && run.state.status === 'running'; tick++) {
    const events = run.step(player(run.state))
    outcome.mostEnemiesAlive = Math.max(outcome.mostEnemiesAlive, run.state.enemies.length)
    if (outcome.squadAtBoss === null && run.state.boss !== null) {
      outcome.squadAtBoss = run.state.squad.count
      bossEnteredTick = tick
    }
    if (events.some((event) => event.type === 'bossDefeated')) outcome.bossFightSeconds = (tick - bossEnteredTick) / tuning.tickRate
  }
  outcome.status = run.state.status
  outcomes.set(key, outcome)
  return outcome
}

const allLevels = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap((level) => seeds.map((seed) => [level, seed] as const))
const hardLevels = [7, 8, 9, 10].flatMap((level) => seeds.map((seed) => [level, seed] as const))

describe('good player', () => {
  it.each(allLevels)('good_player_wins_level_%i_on_seed_%i', (level, seed) => {
    expect(play(level, seed, 'best').status).toBe('won')
  })

  it.each(seeds)('good_player_reaches_the_dustbot_of_level_5_with_75_to_150_percent_of_the_expected_squad_on_seed_%i', (seed) => {
    const expectedSquadAtBoss = worldOneLevel(5)?.expectedSquadAtBoss ?? Number.NaN
    const squadAtBoss = play(5, seed, 'best').squadAtBoss

    expect(squadAtBoss).not.toBeNull()
    expect(squadAtBoss).toBeGreaterThanOrEqual(0.75 * expectedSquadAtBoss)
    expect(squadAtBoss).toBeLessThanOrEqual(1.5 * expectedSquadAtBoss)
  })

  // Tightened in the PO's PR review: on level 10, 75–100 %.
  it.each(seeds)('good_player_reaches_the_mega_dustbot_of_level_10_with_75_to_100_percent_of_the_expected_squad_on_seed_%i', (seed) => {
    const expectedSquadAtBoss = worldOneLevel(10)?.expectedSquadAtBoss ?? Number.NaN
    const squadAtBoss = play(10, seed, 'best').squadAtBoss

    expect(squadAtBoss).not.toBeNull()
    expect(squadAtBoss).toBeGreaterThanOrEqual(0.75 * expectedSquadAtBoss)
    expect(squadAtBoss).toBeLessThanOrEqual(expectedSquadAtBoss)
  })

  // requirements S-6 (9b): from entering the arena to the Mega Dustbot's defeat.
  it.each(seeds)('good_player_fight_against_the_mega_dustbot_lasts_at_least_12_seconds_on_seed_%i', (seed) => {
    const bossFightSeconds = play(10, seed, 'best').bossFightSeconds

    expect(bossFightSeconds).not.toBeNull()
    expect(bossFightSeconds).toBeGreaterThanOrEqual(12)
  })

  it.each(allLevels)('good_player_never_reaches_the_enemy_cap_on_level_%i_seed_%i', (level, seed) => {
    expect(play(level, seed, 'best').mostEnemiesAlive).toBeLessThan(150)
  })
})

describe('bad player', () => {
  it.each(hardLevels)('bad_player_loses_level_%i_on_seed_%i', (level, seed) => {
    expect(play(level, seed, 'worst').status).toBe('lost')
  })
})

// requirements S-6 (9a): the middle player takes the middle-ranked gate of each row.
describe('middle player', () => {
  it.each([8, 9, 10])('middle_player_loses_level_%i_on_at_least_3_of_the_5_seeds', (level) => {
    const losses = seeds.filter((seed) => play(level, seed, 'middle').status === 'lost')

    expect(losses.length).toBeGreaterThanOrEqual(3)
  })
})
