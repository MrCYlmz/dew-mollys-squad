# Levels

Terms as in the [glossary](glossary.md).

## Structure

- A level is a list of events, each placed at a distance z along the track, ending with a boss or a finish line. Example: a gate row at z = 40, a wave at z = 80, the boss at z = 400.
- Levels are hand-made by designers as data, so a new level needs no code change.
- Gate rows come every 40–60 units. This sets only the gaps between rows; the first row may come earlier.
- Between gate rows, enemy waves run at the squad.
- Pickups and obstacles sit on the track: barrels to shoot, coins to collect, walls to steer around.
- Rhythm per 100 units: 1–2 gate rows, 1–2 waves, and a few coins or barrels.
- A level takes 60–120 s to play.

## Level file

Each level is one JSON file. Distances are in track units: x runs across the track from −5 (left edge) to 5 (right edge), z runs forward from the start (z = 0).

| Field | Value |
| --- | --- |
| `id` | Text, unique among levels, such as `"level-1"` |
| `length` | Distance from the start to the finish line, in units, 300–600 |
| `placeholder` | Optional. `true` marks a stand-in level that designers will replace |
| `events` | The level's events, sorted by `z` |

- A level without a boss ends at the finish line at z = `length`.
- Every event has a `type` and a `z` greater than 0 and less than `length`.
- Barrels, coins, obstacles and the boss are added to this format when they are built.

### Gate row

| Field | Value |
| --- | --- |
| `type` | `"gates"` |
| `z` | Where the squad runs through the row |
| `left`, `right` | The two gates, each `{ "op", "value" }`. The left gate covers x −5..0, the right gate x 0..5 |
| `op` | `"add"`, `"subtract"`, `"multiply"` or `"divide"` |
| `value` | The number shown, as a whole number without a sign: 1 or more for add and subtract, 2 for multiply and divide |

Example: `{ "type": "gates", "z": 40, "left": { "op": "add", "value": 10 }, "right": { "op": "subtract", "value": 15 } }` is a row of +10 on the left and −15 on the right.

### Wave

| Field | Value |
| --- | --- |
| `type` | `"wave"` |
| `z` | Where the wave's front row stands when it appears |
| `enemy` | `"puppy"` |
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

## Scaling

- For each level number, enemy HP is multiplied by 1.08 and wave size by 1.05. Example: a puppy has 3 HP on level 1 and 3 × 1.08 = 3.24 HP on level 2.
- Both factors are tunable in one place.

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
