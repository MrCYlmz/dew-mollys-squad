# Levels

Terms as in the [glossary](glossary.md).

## Structure

- A level is a list of events, each placed at a distance z along the track, ending with a boss or a finish line. Example: a gate row at z = 40, a wave at z = 80, the boss at z = 400.
- Levels are hand-made by designers as data, so a new level needs no code change.
- Gate rows come every 40–60 units. This sets only the gaps between rows; the first row may come earlier.
- Between gate rows, enemy waves run at the squad.
- On top of the waves, an endless enemy stream sends one enemy every few seconds for the whole level (see [stream](#stream)). Its interval is the level's main difficulty setting: a shorter interval makes the level harder.
- Barrels, coins, walls and buff blocks sit on the track: barrels to shoot, coins to collect, walls to steer around, buff blocks to shoot open for a big buff.
- Rhythm per 100 units: 1–2 gate rows, 1–2 waves, and a few coins, barrels or buff blocks.
- The road of a level takes 25–50 s (300–600 units at 12 units/s), plus the boss fight in a boss level. It takes the same time at every [level speed](run.md#level-speed), because the run stretches the level's distances by its speed factor.
- Every distance and rhythm rule in this file, such as the 40–60 units between gate rows, the 300–600 length and the 5 units before the arena start, is about the values written in the level file, at speed factor 1, not the stretched ones.

## Level order

- Levels are played in level order: by level number, lowest first, and levels with the same number by `id`, in alphabetical order.
- The title screen starts the first level in level order. After a won run, the victory screen's next level is the next level in level order; after the last level, it goes back to the title screen.
- After a lost run, retry plays the same level again.
- Example: with the files `level-1` (level 1) and `level-5` (level 5), the title starts `level-1`, its victory leads to `level-5`, and the victory of `level-5` leads back to the title.

## Level file

Each level is one JSON file. Distances are in track units: x runs across the track from −5 (left edge) to 5 (right edge), z runs forward from the start (z = 0).

The level file's `length` and every event's `z` are written at speed factor 1. The run stretches them by the level's speed factor (see [level speed](run.md#level-speed)); every other field, such as `x`, `width` and `spacing`, is used as written. Example: on level 15, with a speed factor of 1.98, a wave at `"z": 80` stands at 158.4 in the run, and its rows stand `spacing` apart behind it.

| Field | Value |
| --- | --- |
| `id` | Text, unique among levels, such as `"level-1"` |
| `level` | The level number, a whole number 1 or more. It sets the level's [scaling](#scaling). Two levels may share a number, such as a placeholder and the real level it stands in for |
| `length` | Distance from the start to the finish line, or in a boss level to the boss arena, in units, 300–600 |
| `placeholder` | Optional. `true` marks a stand-in level that designers will replace |
| `expectedSquadAtBoss` | The expected squad at boss, a whole number 1 or more. Required in a level with a boss, and not allowed in a level without one. It sets the [boss HP](#balancing) |
| `stream` | The level's endless enemy stream, `{ "interval", "enemies" }`. Required in every level (see [stream](#stream)) |
| `events` | The level's events, sorted by `z` |

- A level without a boss ends at the finish line at z = `length`.
- A level with a boss ends at the boss arena at z = `length`, and has no finish line.
- Every event has a `type` and a `z` greater than 0 and less than `length`, except the boss event, whose `z` equals `length`. So no gate row, wave, barrel, wall or buff block starts past the arena start.
- In a level with a boss, every wall and buff block ends at least 5 units before the arena start: its `z` + its depth is at most `length` − 5. So no obstacle stands in the boss arena, where the road has stopped. Example: with `"length": 400`, a wall or buff block 1 unit deep has a `z` of at most 394.
- Gate rows and buff blocks are placed by [lane](run.md#lanes): `"left"`, `"centre"` or `"right"`.
- Coins are added to this format when they are built.

### Gate row

| Field | Value |
| --- | --- |
| `type` | `"gates"` |
| `z` | Where the squad runs through the row |
| `left`, `centre`, `right` | The gates, each `{ "op", "value" }` and each optional, but at least one must be there. Each gate fills its lane; a lane whose field is missing is empty |
| `op` | `"add"`, `"subtract"`, `"multiply"`, `"divide"`, `"fireRate"`, `"damage"`, `"multiShot"` or `"range"` |
| `value` | The number shown, as a whole number without a sign: 1 or more for add and subtract, 2 for multiply and divide, 20 for fire rate (per cent), 1 for damage, 1 for multi-shot, 10 for range |

- The gates of a row may have any ops, the same or different.
- The weapon-buff values are fixed, like multiply and divide, because [the run](run.md#weapon-buffs) defines each buff's effect.

Examples:

- `{ "type": "gates", "z": 40, "left": { "op": "add", "value": 10 }, "centre": { "op": "multiply", "value": 2 }, "right": { "op": "subtract", "value": 15 } }` is a row of +10 on the left, ×2 in the centre and −15 on the right.
- `{ "type": "gates", "z": 90, "left": { "op": "add", "value": 10 }, "right": { "op": "damage", "value": 1 } }` is a row of +10 on the left, an empty centre lane and DMG +1 on the right.
- `{ "type": "gates", "z": 140, "centre": { "op": "fireRate", "value": 20 } }` is a single FIRE RATE +20% gate in the centre lane, with both outer lanes empty.

### Wave

| Field | Value |
| --- | --- |
| `type` | `"wave"` |
| `z` | Where the wave's front row stands when it appears |
| `enemy` | `"puppy"`, `"chihuahua"`, `"bulldog"` or `"shieldDog"`. A wave has one kind of enemy |
| `pattern` | `"line"`, `"block"`, `"column"` or `"flank"`, with that pattern's fields below |

- A wave appears when the squad is the spawn distance (40 units at speed factor 1, in the tuning config) × the speed factor before its stretched `z`. Its enemies then start moving. Example: a wave at `"z": 80` appears at distance travelled 40 on level 1 and 158.4 − 79.2 = 79.2 on level 15, both 3⅓ s into the run.
- Rows of a wave stand one behind the other, away from the squad: the front row at the stretched `z`, the next at that + `spacing`, and so on. `spacing` is not stretched.
- Every enemy of a wave must stand within x −5..5.

| Pattern | Fields | Where the enemies stand |
| --- | --- | --- |
| Line | `count`: 1 or more | One row of `count` enemies at `z`, spread evenly across the whole track: enemy i (from 0) at x = −5 + 10 × (i + 0.5) ÷ `count` |
| Block | `columns`: 1 or more; `rows`: 1 or more; `x`: the block's centre; `spacing`: units between neighbouring enemies, more than 0 | `rows` rows of `columns` enemies, `spacing` apart across and along the track, centred on `x` |
| Column | `count`: 1 or more; `x`: where the column stands across the track; `spacing`: units between neighbouring enemies, more than 0 | `count` enemies in single file at `x`, from `z` back, `spacing` apart |
| Flank | `count`: 1 or more per side; `spacing`: units between neighbouring enemies, more than 0 | `count` enemies in single file at the left edge (x = −5) and `count` at the right edge (x = 5), from `z` back, `spacing` apart |

- The pattern sets only where the enemies start. From their first tick, enemies of every pattern chase the squad's centre (see [the run](run.md#enemies)).

Examples:

- `{ "type": "wave", "z": 80, "enemy": "puppy", "pattern": "line", "count": 5 }`: 5 puppies at x −4, −2, 0, 2 and 4.
- `{ "type": "wave", "z": 130, "enemy": "puppy", "pattern": "block", "columns": 5, "rows": 4, "x": 0, "spacing": 1.5 }`: 20 puppies at x −3, −1.5, 0, 1.5 and 3, in rows at z 130, 131.5, 133 and 134.5 on level 1.
- `{ "type": "wave", "z": 180, "enemy": "puppy", "pattern": "column", "count": 8, "x": -3, "spacing": 2 }`: 8 puppies at x −3, from z 180 to 194.
- `{ "type": "wave", "z": 230, "enemy": "puppy", "pattern": "flank", "count": 4, "spacing": 2 }`: 4 puppies at each edge, from z 230 to 236.
- `{ "type": "wave", "z": 260, "enemy": "chihuahua", "pattern": "line", "count": 10 }`: 10 chihuahuas across the track.
- These counts and places are for level 1. On higher levels the wave has more enemies (see [scaling](#scaling)) and its `z` is stretched.

### Stream

| Field | Value |
| --- | --- |
| `interval` | Seconds between two stream enemies, more than 0 |
| `enemies` | One or more of `"puppy"`, `"chihuahua"`, `"bulldog"` and `"shieldDog"`, sent in this order and then again from the start. A kind may appear more than once, to send it more often |

- The stream is not an event: it has no `z` and runs from the start of the run until the finish line or the arena start.
- Where stream enemies appear and how the interval is counted is set in [the run](run.md#enemy-stream).
- Many stream and wave enemies alive at once can reach the [enemy cap](run.md#enemy-cap) of 150; then new enemies are dropped until some are gone. Designers keep the interval long enough that this does not happen in normal play.

Examples:

- `"stream": { "interval": 2, "enemies": ["puppy"] }`: one puppy every 2 s.
- `"stream": { "interval": 0.8, "enemies": ["puppy", "puppy", "chihuahua"] }`: an enemy every 0.8 s, two puppies for each chihuahua.

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

### Buff block

| Field | Value |
| --- | --- |
| `type` | `"buffBlock"` |
| `z` | The block's front edge, the side facing the squad. The block reaches from `z` to `z` + the buff block depth |
| `lane` | `"left"`, `"centre"` or `"right"`: the lane the block fills |
| `hp` | The block's HP at level 1, more than 0. It [scales](#scaling) like enemy HP |
| `buff` | The big buff behind the block: `"add"`, `"multiply"`, `"fireRate"`, `"damage"`, `"multiShot"` or `"range"` |

- The big buff's value is not written in the level file: each big buff has one fixed value, set in [the run](run.md#big-buffs).
- A buff block is on the track from the start of the run.

Example: `{ "type": "buffBlock", "z": 120, "lane": "right", "hp": 40, "buff": "multiply" }` is a block with 40 HP at level 1 filling the right lane from z = 120 to 121, hiding a ×3.

### Boss

| Field | Value |
| --- | --- |
| `type` | `"boss"` |
| `z` | The arena start. It must equal the level's `length` |
| `boss` | `"dustbot"` or `"megaDustbot"` |

- A level has at most one boss event, and it is the last event.
- Where the boss appears and how it fights is set in [the run](run.md#boss).

Example: a level with `"length": 400` and `"expectedSquadAtBoss": 60` ends with `{ "type": "boss", "z": 400, "boss": "dustbot" }`: the Dustbot at the arena starting at z = 400.

## Scaling

- For each level number above 1, enemy HP is multiplied by 1.08 (the enemy HP growth) and wave size by 1.05 (the wave size growth), both in the tuning config. The level number is the level file's `level`.
- On level L, enemy HP is the level 1 HP × 1.08^(L − 1), kept as is, without rounding. Examples: a puppy has 3 HP on level 1, 3 × 1.08 = 3.24 HP on level 2 and 3 × 1.08² = 3.4992 HP on level 3. A shield dog's shield and body both scale.
- Stream enemies' HP scales the same way as wave enemies'. The stream's `interval` does not scale with the level number; each level sets its own.
- A buff block's HP scales the same way from its `hp`. Example: a block with `"hp": 40` has 40 × 1.08⁴ = 54.419… HP on level 5.
- On level L, a wave's size is its size in the level file × 1.05^(L − 1), rounded to the nearest whole number, halves up. For line, column and flank waves this scales `count` (per side for flank). For block waves it scales `rows`, so the block keeps its width and grows backwards. Examples: a line of 10 has 10 × 1.05 = 10.5, so 11 enemies on level 2; a line of 5 has 5.25, so still 5. A block of 5 columns and 4 rows on level 5 has 4 × 1.05⁴ = 4.86, so 5 rows of 5.
- Scaled waves follow the same placement rules: a scaled line still spreads evenly across the track, and extra rows and enemies stand further back at the same `spacing`.
- Barrels, walls and gates do not scale. Boss HP does not scale with the level number either; it follows the expected squad at boss (see [balancing](#balancing)).
- The level speed grows with the level number too, and stretches the level's distances by the same factor (see [level speed](run.md#level-speed)). Example: the speed factor is 1 on level 1, 1.07 on level 2 and 1.98 on level 15.

## Balancing

- Each boss level states its expected squad at boss (`expectedSquadAtBoss`): the squad count a good run has when it reaches the boss arena.
- Boss HP = the expected squad's damage per second at the base weapon values × the boss's boss HP time. Each boss has its own boss HP time, in the tuning config: 8 s for the Dustbot, 20 s for the Mega Dustbot, so the world boss takes longer to defeat.
- The expected squad's damage per second at the base weapon values = expected squad at boss × base fire rate × base damage × base yarn balls per shot, with the base values at level 1 from [the run](run.md#shooting), before weapon buffs and upgrades. The yarn ball cap does not change it.
- Boss HP is kept as is, without rounding.
- Example: an expected squad at boss of 60 at the base values (2 yarn balls/s, 1 damage, 1 yarn ball per shot) deals 60 × 2 × 1 × 1 = 120 damage per second, so the Dustbot has 120 × 8 = 960 HP, and the Mega Dustbot would have 120 × 20 = 2,400 HP.
- A bad run still reaches the boss with about 40% of the expected squad, so it can win with good aim.
- The Mega Dustbot gets stronger on each of levels 11–15: each level's boss HP is at least 1.2 × the boss HP of the level before it. With the same boss and the same base values, that is an `expectedSquadAtBoss` at least 1.2 × the level before's. Example: level 10 with an expected squad at boss of 100 needs at least 120 on level 11.
- Each gate row offers one clearly better gate and at least one that looks tempting. Example: +20 against ×2 when the squad count is 8 (+20 gives 28, ×2 gives 16).
- The expected squad at boss counts gates only, not big buffs: a big buff is a reward on top of a good run.

## The first world (MVP)

15 levels in one world, from `level-1` to `level-15`, each running faster than the one before (see [level speed](run.md#level-speed)). Later worlds change the look and add one new enemy each.

| Levels | Content |
| --- | --- |
| 1 | Teaches gates across the three lanes. Puppies only, generous gates, no boss. A [hand icon](screens.md#hand-icon) shows how to steer; there is no text tutorial. |
| 2 | Teaches enemies. Puppies only, generous gates, no boss. |
| 3 | Teaches buff blocks: shoot a block open, then steer into its lane to collect the big buff. Puppies only, generous gates. |
| 4–6 | Chihuahuas and barrels, the first weapon buffs. The first boss, the Dustbot, is on level 5. |
| 7–9 | Bulldogs and shield dogs, tighter gate choices. |
| 10 | The world boss, the Mega Dustbot, which throws dust balls. |
| 11–15 | Much harder: all four enemy kinds, and at least half of the gate rows put a red gate next to a blue one. Each ends with a Mega Dustbot fight that is stronger than the last (see [balancing](#balancing)). Level 15's stream interval is at most 0.6 s. |

Levels 5 and 10–15 have a boss: the Dustbot on level 5 and the Mega Dustbot on levels 10–15. The others end at a finish line. After level 15, the victory screen goes back to the title.
