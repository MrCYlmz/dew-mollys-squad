import { describe, expect, it } from 'vitest'
import { tuning } from '../../src/content/tuning'
import { createRun, type RunStatus } from '../../src/sim/run'
import { worldOneLevel } from '../content/worldOneLevels'
import { scriptedPlayer, type Choice } from './scriptedPlayers'

// requirements S-6 (7–10, 9a, 9b), S-11 (10–13) and S-12 (13–15): scripted players on the twenty-five levels of world 1,
// each on the same 5 fixed seeds, at each level's level speed.

const seeds = [1, 42, 1234, 98765, 20261124]
// The longest road, 600 units, takes 50 s at every level speed; a boss fight is over well before another 70 s.
const maxTicks = 120 * tuning.tickRate

interface Outcome {
  status: RunStatus
  // The squad count in the tick the boss entered, or null when no boss entered.
  squadAtBoss: number | null
  // Seconds from the tick the boss entered to the tick it was defeated, or null when it was not.
  bossFightSeconds: number | null
  mostEnemiesAlive: number
  mysteryGatesTaken: number
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
  const outcome: Outcome = { status: 'running', squadAtBoss: null, bossFightSeconds: null, mostEnemiesAlive: 0, mysteryGatesTaken: 0 }
  let bossEnteredTick = 0
  for (let tick = 0; tick < maxTicks && run.state.status === 'running'; tick++) {
    const events = run.step(player(run.state))
    outcome.mostEnemiesAlive = Math.max(outcome.mostEnemiesAlive, run.state.enemies.length)
    if (outcome.squadAtBoss === null && run.state.boss !== null) {
      outcome.squadAtBoss = run.state.squad.count
      bossEnteredTick = tick
    }
    if (events.some((event) => event.type === 'bossDefeated')) outcome.bossFightSeconds = (tick - bossEnteredTick) / tuning.tickRate
    outcome.mysteryGatesTaken += events.filter((event) => event.type === 'gateTaken' && event.mystery).length
  }
  outcome.status = run.state.status
  outcomes.set(key, outcome)
  return outcome
}

const levelNumbers = Array.from({ length: 25 }, (_, index) => index + 1)
const megaDustbotLevels = [10, 11, 12, 13, 14, 15, 20, 25]
// requirements S-11 (11): the Mega Dustbot gets stronger on each of levels 11–15.
const growingBossLevels = [11, 12, 13, 14, 15]
const allLevels = levelNumbers.flatMap((level) => seeds.map((seed) => [level, seed] as const))
const badPlayerLevels = levelNumbers.filter((level) => level >= 7).flatMap((level) => seeds.map((seed) => [level, seed] as const))
const megaDustbotRuns = megaDustbotLevels.flatMap((level) => seeds.map((seed) => [level, seed] as const))

function shortestBossFight(level: number): number {
  return Math.min(...seeds.map((seed) => play(level, seed, 'best').bossFightSeconds ?? Number.NaN))
}

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

  // Tightened in the PO's PR review of S-6 for level 10, set for levels 10–15 by S-11 (10) and for 20 and 25 by S-12 (13): 75–100 %.
  it.each(megaDustbotRuns)('good_player_reaches_the_mega_dustbot_of_level_%i_with_75_to_100_percent_of_the_expected_squad_on_seed_%i', (level, seed) => {
    const expectedSquadAtBoss = worldOneLevel(level)?.expectedSquadAtBoss ?? Number.NaN
    const squadAtBoss = play(level, seed, 'best').squadAtBoss

    expect(squadAtBoss).not.toBeNull()
    expect(squadAtBoss).toBeGreaterThanOrEqual(0.75 * expectedSquadAtBoss)
    expect(squadAtBoss).toBeLessThanOrEqual(expectedSquadAtBoss)
  })

  // requirements S-6 (9b), S-11 (11) and S-12 (13): from entering the arena to the Mega Dustbot's defeat.
  it.each(megaDustbotRuns)('good_player_fight_against_the_mega_dustbot_of_level_%i_lasts_at_least_12_seconds_on_seed_%i', (level, seed) => {
    const bossFightSeconds = play(level, seed, 'best').bossFightSeconds

    expect(bossFightSeconds).not.toBeNull()
    expect(bossFightSeconds).toBeGreaterThanOrEqual(12)
  })

  // requirements S-11 (11): the boss gets stronger each time, so the shortest fight over the seeds never gets shorter.
  it.each(growingBossLevels)('shortest_good_player_fight_on_level_%i_is_not_shorter_than_on_the_level_before', (level) => {
    expect(shortestBossFight(level)).toBeGreaterThanOrEqual(shortestBossFight(level - 1))
  })

  // requirements S-12 (11a): mystery gates matter, so the good player takes one on each of levels 21–25 and still wins.
  const mysteryGateRuns = levelNumbers.filter((level) => level >= 21).flatMap((level) => seeds.map((seed) => [level, seed] as const))

  it.each(mysteryGateRuns)('good_player_takes_at_least_one_mystery_gate_and_wins_level_%i_on_seed_%i', (level, seed) => {
    const outcome = play(level, seed, 'best')

    expect(outcome.mysteryGatesTaken).toBeGreaterThanOrEqual(1)
    expect(outcome.status).toBe('won')
  })

  it.each(allLevels)('good_player_never_reaches_the_enemy_cap_on_level_%i_seed_%i', (level, seed) => {
    expect(play(level, seed, 'best').mostEnemiesAlive).toBeLessThan(150)
  })
})

describe('bad player', () => {
  it.each(badPlayerLevels)('bad_player_loses_level_%i_on_seed_%i', (level, seed) => {
    expect(play(level, seed, 'worst').status).toBe('lost')
  })
})

// requirements S-6 (9a), S-11 (12) and S-12 (14): the middle player takes the middle-ranked gate of each row.
describe('middle player', () => {
  it.each(levelNumbers.filter((level) => level >= 8 && level <= 15))('middle_player_loses_level_%i_on_at_least_3_of_the_5_seeds', (level) => {
    const losses = seeds.filter((seed) => play(level, seed, 'middle').status === 'lost')

    expect(losses.length).toBeGreaterThanOrEqual(3)
  })

  const middlePlayerLevels = levelNumbers.filter((level) => level >= 16).flatMap((level) => seeds.map((seed) => [level, seed] as const))

  it.each(middlePlayerLevels)('middle_player_loses_level_%i_on_seed_%i', (level, seed) => {
    expect(play(level, seed, 'middle').status).toBe('lost')
  })
})
