# Levels

Terms as in the [glossary](glossary.md).

## Structure

- A level is a list of events, each placed at a distance z along the track, ending with a boss or a finish line. Example: a gate row at z = 40, a wave at z = 80, the boss at z = 400.
- Levels are hand-made by designers as data, so a new level needs no code change.
- Gate rows come every 40–60 units. This sets only the gaps between rows; the first row may come earlier.
- Between gate rows, enemy waves run at the squad.
- Barrels, coins and walls sit on the track: barrels to shoot, coins to collect, walls to steer around.
- Rhythm per 100 units: 1–2 gate rows, 1–2 waves, and a few coins or barrels.
- A level takes 60–120 s to play.

## Level file

Each level is one JSON file. Distances are in track units: x runs across the track from −5 (left edge) to 5 (right edge), z runs forward from the start (z = 0).

| Field | Value |
| --- | --- |
| `id` | Text, unique among levels, such as `"level-1"` |
| `level` | The level number, a whole number 1 or more. It sets the level's [scaling](#scaling). Two levels may share a number, such as a placeholder and the real level it stands in for |
| `length` | Distance from the start to the finish line, in units, 300–600 |
| `placeholder` | Optional. `true` marks a stand-in level that designers will replace |
| `events` | The level's events, sorted by `z` |

- A level without a boss ends at the finish line at z = `length`.
- Every event has a `type` and a `z` greater than 0 and less than `length`.
- Coins and the boss are added to this format when they are built.

### Gate row

| Field | Value |
| --- | --- |
| `type` | `"gates"` |
| `z` | Where the squad runs through the row |
| `left`, `right` | The two gates, each `{ "op", "value" }`. The left gate covers x −5..0, the right gate x 0..5 |
| `op` | `"add"`, `"subtract"`, `"multiply"`, `"divide"`, `"fireRate"`, `"damage"`, `"multiShot"` or `"range"` |
| `value` | The number shown, as a whole number without a sign: 1 or more for add and subtract, 2 for multiply and divide, 20 for fire rate (per cent), 1 for damage, 1 for multi-shot, 10 for range |

- The two gates of a row may have any two ops, the same or different.
- The weapon-buff values are fixed, like multiply and divide, because [the run](run.md#weapon-buffs) defines each buff's effect.

Examples:

- `{ "type": "gates", "z": 40, "left": { "op": "add", "value": 10 }, "right": { "op": "subtract", "value": 15 } }` is a row of +10 on the left and −15 on the right.
- `{ "type": "gates", "z": 90, "left": { "op": "add", "value": 10 }, "right": { "op": "damage", "value": 1 } }` is a row of +10 on the left and DMG +1 on the right.
- `{ "type": "gates", "z": 140, "left": { "op": "fireRate", "value": 20 }, "right": { "op": "range", "value": 10 } }` is a row of FIRE RATE +20% on the left and RANGE +10 on the right.

### Wave

| Field | Value |
| --- | --- |
| `type` | `"wave"` |
| `z` | Where the wave's front row stands when it appears |
| `enemy` | `"puppy"`, `"chihuahua"`, `"bulldog"` or `"shieldDog"`. A wave has one kind of enemy |
| `pattern` | `"line"`, `"block"`, `"column"` or `"flank"`, with that pattern's fields below |

- A wave appears when the squad is 40 units (the spawn distance) before its `z`. Its enemies then start moving.
- Rows of a wave stand one behind the other, away from the squad: the front row at `z`, the next at `z` + `spacing`, and so on.
- Every enemy of a wave must stand within x −5..5.

| Pattern | Fields | Where the enemies stand |
| --- | --- | --- |
| Line | `count`: 1 or more | One row of `count` enemies at `z`, spread evenly across the whole track: enemy i (from 0) at x = −5 + 10 × (i + 0.5) ÷ `count` |
| Block | `columns`: 1 or more; `rows`: 1 or more; `x`: the block's centre; `spacing`: units between neighbouring enemies, more than 0 | `rows` rows of `columns` enemies, `spacing` apart across and along the track, centred on `x` |
| Column | `count`: 1 or more; `x`: the lane; `spacing`: units between neighbouring enemies, more than 0 | `count` enemies in single file at `x`, from `z` back, `spacing` apart |
| Flank | `count`: 1 or more per side; `spacing`: units between neighbouring enemies, more than 0 | `count` enemies in single file at the left edge (x = −5) and `count` at the right edge (x = 5), from `z` back, `spacing` apart |

- Line, block and column enemies run straight at the squad along the track.
- Flank enemies walk inward at 45° while running at the squad, at their usual speed, until they reach the centre (x = 0), then run straight at the squad.

Examples:

- `{ "type": "wave", "z": 80, "enemy": "puppy", "pattern": "line", "count": 5 }`: 5 puppies at x −4, −2, 0, 2 and 4.
- `{ "type": "wave", "z": 130, "enemy": "puppy", "pattern": "block", "columns": 5, "rows": 4, "x": 0, "spacing": 1.5 }`: 20 puppies at x −3, −1.5, 0, 1.5 and 3, in rows at z 130, 131.5, 133 and 134.5.
- `{ "type": "wave", "z": 180, "enemy": "puppy", "pattern": "column", "count": 8, "x": -3, "spacing": 2 }`: 8 puppies at x −3, from z 180 to 194.
- `{ "type": "wave", "z": 230, "enemy": "puppy", "pattern": "flank", "count": 4, "spacing": 2 }`: 4 puppies at each edge, from z 230 to 236.
- `{ "type": "wave", "z": 260, "enemy": "chihuahua", "pattern": "line", "count": 10 }`: 10 chihuahuas across the track.
- These counts are for level 1. On higher levels the wave has more enemies (see [scaling](#scaling)).

### Barrel

| Field | Value |
| --- | --- |
| `type` | `"barrel"` |
| `z` | Where the barrel stands |
| `x` | Where the barrel stands across the track, within −5..5 |

- A barrel is on the track from the start of the run.

Example: `{ "type": "barrel", "z": 120, "x": 1.5 }` is a barrel at x = 1.5, z = 120.

### Wall

| Field | Value |
| --- | --- |
| `type` | `"wall"` |
| `z` | The wall's front edge, the side facing the squad. The wall reaches from `z` to `z` + the wall depth |
| `x` | The wall's centre across the track |
| `width` | The wall's width across the track, more than 0 |

- The whole wall must lie on the track: `x` − `width` ÷ 2 is at least −5, and `x` + `width` ÷ 2 is at most 5.
- A wall is on the track from the start of the run.

Example: `{ "type": "wall", "z": 160, "x": -2.5, "width": 5 }` is a wall over the left half of the track, x −5..0, from z = 160 to 161.

## Scaling

- For each level number above 1, enemy HP is multiplied by 1.08 (the enemy HP growth) and wave size by 1.05 (the wave size growth), both in the tuning config. The level number is the level file's `level`.
- On level L, enemy HP is the level 1 HP × 1.08^(L − 1), kept as is, without rounding. Examples: a puppy has 3 HP on level 1, 3 × 1.08 = 3.24 HP on level 2 and 3 × 1.08² = 3.4992 HP on level 3. A shield dog's shield and body both scale.
- On level L, a wave's size is its size in the level file × 1.05^(L − 1), rounded to the nearest whole number, halves up. For line, column and flank waves this scales `count` (per side for flank). For block waves it scales `rows`, so the block keeps its width and grows backwards. Examples: a line of 10 has 10 × 1.05 = 10.5, so 11 enemies on level 2; a line of 5 has 5.25, so still 5. A block of 5 columns and 4 rows on level 5 has 4 × 1.05⁴ = 4.86, so 5 rows of 5.
- Scaled waves follow the same placement rules: a scaled line still spreads evenly across the track, and extra rows and enemies stand further back at the same `spacing`.
- Barrels, walls and gates do not scale.

## Balancing

- Each level states its expected squad at boss.
- Boss HP = the expected squad's damage per second × 8 seconds.
- A bad run still reaches the boss with about 40% of the expected squad, so it can win with good aim.
- Each gate row offers one clearly better gate and one that looks tempting. Example: +20 against ×2 when the squad count is 8 (+20 gives 28, ×2 gives 16).

## The first world (MVP)

10 levels in one world. Later worlds change the look and add one new enemy each.

| Levels | Content |
| --- | --- |
| 1 | Teaches gates. Puppies only, generous gates, no boss. A hand icon shows how to steer; there is no text tutorial. |
| 2 | Teaches enemies. Puppies only, generous gates, no boss. |
| 3 | Teaches shooting a red gate to fix it. Puppies only, generous gates. |
| 4–6 | Chihuahuas and barrels, the first weapon buffs. The first boss is on level 5. |
| 7–9 | Bulldogs and shield dogs, tighter gate choices. |
| 10 | The world boss. |
