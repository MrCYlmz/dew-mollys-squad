# The run

Terms as in the [glossary](glossary.md).

## Movement

- The squad holds a fixed place on screen and does not visibly run forward. The road and everything on it (gate rows, enemies, barrels, walls and buff blocks) come toward the squad at the run speed, a constant 12 units/s (in the tuning config). The player controls only the steering point.
- Every rule is measured in distance travelled, as if the squad ran down a still road: the squad's distance travelled grows by 12 units/s, z is a place along the road measured from the start, and something standing still at z reaches the squad's centre when the distance travelled is z. Example: the squad meets a gate row at z = 60 after 5 s.
- The camera does not move forward. It frames the squad and the road ahead of it.
- The steering point is clamped to the track edges: x stays within −5..5.
- The squad follows the steering point smoothly, closing the gap in about 80 ms, so it is responsive but not twitchy.
- Cats stay in a tight cluster around the steering point.

### Lanes

The track has three marked lanes of equal width. Steering stays free: the squad can stand anywhere across the track, and the lanes only mark where gates and buff blocks stand.

| Lane | Across the track | Lane centre |
| --- | --- | --- |
| Left | x −5 to −5/3 | x = −10/3 |
| Centre | x −5/3 to 5/3 | x = 0 |
| Right | x 5/3 to 5 | x = 10/3 |

- The squad is in the lane its centre is in. A centre exactly on a lane border is in the lane to its right. Examples: a squad at x = −2 is in the left lane; at x = −5/3 it is in the centre lane; at x = 5/3 it is in the right lane.

## Controls

One input steers. Firing is always on.

| Device | Steer | Pause |
| --- | --- | --- |
| Phone or tablet | Drag a finger anywhere on screen (relative drag) | Pause button, or the app goes to the background |
| Mouse | Click and drag, or hold the button and move | Esc or pause button |
| Keyboard | A / D or ← / → | Esc or P |

- Relative drag: the steering point moves by the finger's change in x times the steering sensitivity. Sensitivity defaults to 1.0 and can be set from 0.5 to 2.0. Example: at sensitivity 2.0, a drag of 1 unit moves the steering point 2 units.
- Holding a steering key moves the steering point at 12 units/s.
- Touch, mouse and pen behave the same.
- Page scroll and pinch-zoom are blocked over the game.
- When the game loses focus or goes to the background, it pauses.

## Squad count

- A run starts with 1 cat plus the starting-squad upgrade (see [meta progression](meta-progression.md)).
- The squad count is shown as a big number above the squad.
- The squad count never exceeds 999. At most about 60 cats are drawn; the number shows the rest. Example: a squad of 300 is drawn as about 60 cats with "300" above it.
- When the squad count reaches 0, the run is lost.
- Lost cats scatter off-screen unhurt.

## Shooting

- Every cat fires yarn balls straight ahead, all the time.
- Each yarn ball travels up to the squad's range, measured along its path.
- A yarn ball stops at the first enemy, barrel, wall, buff block or boss it hits, deals its damage and disappears. One that hits nothing disappears at the end of its range. A wall takes no damage.
- Yarn balls fly through gates without stopping and without changing them (see [gates](#gates)).

Base values at level 1, before weapon buffs and upgrades:

| Value | Base |
| --- | --- |
| Fire rate | 2 yarn balls/s per cat |
| Damage | 1 per yarn ball |
| Range | 30 units |
| Yarn ball speed | 30 units/s |
| Yarn balls per shot | 1 per cat |

[Weapon buffs](#weapon-buffs) change these values from the moment they are taken until the end of the run. The base fire rate that fire-rate buffs and their cap are measured from is the fire rate at the start of the run.

### Yarn ball cap

Never more than 400 yarn balls are in flight (the yarn ball cap, in the tuning config). A big squad fires fewer, stronger yarn balls instead, so results are about equal to every cat firing its own:

- If every cat fired its own yarn balls, the squad would have squad count × fire rate × yarn balls per shot × range ÷ yarn ball speed yarn balls in flight, using the current, buffed values.
- When that is above the cap, each yarn ball stands for N cats: N is that number divided by the cap, rounded up. The squad then fires N times fewer yarn balls.
- A yarn ball standing for N cats deals N × damage. It still stops at the first enemy, barrel, wall, buff block or boss it hits.
- At or below the cap, N is 1 and every cat fires its own yarn balls.
- Results are about equal, not exactly equal: when a yarn ball standing for N cats kills an enemy, destroys a barrel, breaks a buff block or defeats the boss with less HP than its damage, the spare damage is lost, where N separate yarn balls would have gone on to the next target. Example: a yarn ball dealing 2 damage that hits a puppy with 1 HP left kills it, and the second point of damage is lost. This only happens above the cap, so with squads above about 200 at the base values.

Examples at the base values (2 yarn balls/s, range 30, speed 30, so each yarn ball flies 1 s): a squad of 200 would have 400 in flight, so N is 1. A squad of 300 would have 600, so N is 2: each yarn ball deals 2 damage, and about 300 are in flight. A squad of 999 would have 1,998, so N is 5, and about 400 are in flight. A squad of 100 with one +1 BULLET gate fires 2 yarn balls per shot, so it would have 400 in flight, and N is still 1.

## Gates

A gate row has one, two or three gates, each filling one [lane](#lanes); a lane without a gate is empty. When the row reaches the squad, the squad takes the gate in the lane its centre is in. Example: in a row of +10 on the left, ×2 in the centre and an empty right lane, a squad at x = 0 takes ×2, and a squad at x = 3 takes nothing.

| Gate | Shown as | Effect when taken | Colour |
| --- | --- | --- | --- |
| Add | +10 | squad count + value | Blue |
| Subtract | −15 | squad count − value; can reach 0, which loses the run | Red |
| Multiply | ×2 | squad count × 2 | Blue |
| Divide | ÷2 | squad count ÷ 2, rounded down, at least 1 | Red |
| Fire rate | FIRE RATE +20% | every cat fires faster, by 20% of the base fire rate | Blue |
| Damage | DMG +1 | yarn ball damage + 1 | Blue |
| Multi-shot | +1 BULLET | each cat fires one more yarn ball, in a spread | Blue |
| Range | RANGE +10 | yarn balls travel 10 units farther | Blue |

- Examples: a squad of 8 taking ×2 becomes 16. A squad of 7 taking ÷2 becomes 3. A squad of 1 taking ÷2 stays 1. A squad of 10 taking −15 becomes 0 and the run is lost.
- Gates cannot be shot. Yarn balls fly through every gate, good, bad or weapon-buff, without stopping, without dealing damage and without changing it. A gate's value never changes during a run.
- Add, multiply and weapon-buff gates are blue; subtract and divide gates are red.
- A gate row may mix any gate types. Example: +10 on the left, −15 in the centre and DMG +1 on the right.
- Each gate can be taken once. When the squad takes one gate of a row, the rest of the row disappears.
- When the squad's centre is in an empty lane as the row reaches it, the squad takes no gate, and the row passes behind the squad and disappears.
- Taking a gate shows a big floating number and plays a sound, and the squad count animates up or down.

### Weapon buffs

A weapon-buff gate changes a value of every cat, from the moment it is taken until the end of the run. Buffs from several gates, and from [big buffs](#big-buffs), add up. The squad count does not affect them: cats that join later fire with the same buffs.

| Gate | Effect per gate | Cap |
| --- | --- | --- |
| Fire rate | Fire rate + 20% of the base fire rate | 3 × the base fire rate |
| Damage | Yarn ball damage + 1 | None |
| Multi-shot | Yarn balls per shot + 1 | 5 per cat |
| Range | Range + 10 units | None |

- Fire rate adds up on the base rate, not on the current rate. Examples at the base of 2 yarn balls/s: one gate gives 2.4, two give 2.8, ten give 6, the cap. An eleventh gate changes nothing.
- A gate taken at its cap is still taken, and the rest of its row still disappears, but the value stays at the cap.
- Multi-shot: a cat's yarn balls of one shot leave together in a fan, spread evenly around straight ahead, with the multi-shot spread (5°, in the tuning config) between neighbouring yarn balls. Examples: 2 yarn balls fly at −2.5° and +2.5°; 3 at −5°, 0° and +5°.
- A yarn ball in a fan flies at the yarn ball speed along its own direction and drifts sideways as it goes. It may leave the track.

## Enemies

Every enemy shows its HP as a number above it. Values are for level 1 and scale with the level number (see [levels](levels.md#scaling)).

| Enemy | Role | HP | Speed (units/s) | Contact damage (cats) | Typical use |
| --- | --- | --- | --- | --- | --- |
| Puppy | Grunt | 3 | 4 | 1 | Groups of 5–20 |
| Chihuahua | Runner | 1 | 9 | 1 | Fast lines |
| Bulldog | Brute | 40 | 2.5 | 10 | A slow tank, alone or in small groups |
| Shield dog | Shield bearer | 15, plus a shield of 30 | 3 | 3 | The shield must break before the body takes damage |

- An enemy starts where its wave's spawn pattern (see [levels](levels.md#wave)) or the [enemy stream](#enemy-stream) places it. Every enemy can come in every spawn pattern; the typical use is a guide for designers.
- Every enemy chases the squad's centre, in any lane, from its first tick, following the squad as it steers:
  - Along the road it runs toward the squad's centre at its own speed. An enemy ahead of the centre or level with it runs toward the squad; one behind the centre runs back toward it.
  - Across the track it moves toward the squad's centre x at up to 6 units/s (the enemy chase speed, in the tuning config, the same for every kind). When the squad's centre x is closer than one tick's move, the enemy stops exactly at it and does not overshoot. So it never leaves the track, because the squad's centre is always on it.
- The road brings an enemy toward the squad as well, at the run speed, so an enemy ahead of the squad closes in at the run speed plus its own speed, wherever it is across the track. Example: a puppy closes in at 12 + 4 = 16 units/s. In the boss arena, where the road has stopped, it closes in at its own speed.
- Example: a puppy appears 40 units ahead at the left lane centre (x = −10/3) while the squad stays at the right lane centre (x = 10/3). It crosses the 20/3 units in about 1.1 s at 6 units/s and then runs at the squad's x, reaching the squad about 2.5 s after it appeared, if it is not shot. Steering away does not escape it, because the squad cannot leave the track.
- Every kind reaches a squad anywhere on the track from the spawn distance: the chihuahua, the fastest, closes the 40 units in 40 ÷ (12 + 9) ≈ 1.9 s, and in that time moves up to 6 × 1.9 ≈ 11.4 units across, more than the 10 units of the whole track. Slower kinds take longer along the road and so have more time to cross.
- When an enemy touches the squad, the enemy dies and the squad loses cats equal to its contact damage, whatever HP it has left. Example: a bulldog touching a squad of 25 leaves 15; touching a squad of 6 leaves 0 and loses the run.
- An enemy that gets past the squad disappears behind it and does no damage.
- An enemy is past the squad only once it is past the squad's last cat. Until then, an enemy touching any cat, even one inside the cluster, costs cats.
- An enemy dies when its HP reaches 0 or less. HP can be a fraction after scaling; the number shown is rounded up. Example: a puppy with 0.24 HP left shows 1.
- Enemies are not stopped by walls, barrels, buff blocks or each other.

### Enemy stream

Besides its waves, every level has an endless enemy stream, set by the level file's `stream` (see [levels](levels.md#stream)): one enemy every `interval` seconds.

- The stream runs from the start of the run while the squad's distance travelled is less than `length`, so until the finish line or the arena start. It stops there, and when the run ends. Stream enemies still alive at the arena start keep coming, like wave enemies.
- Timing counts whole ticks: the interval is `interval` × the tick rate (60 ticks/s), rounded to the nearest whole number of ticks, halves up, and at least 1 tick. Counting the run's first tick as tick 1, an enemy spawns on every tick that is a whole multiple of the interval. Example: an `interval` of 1.5 is 90 ticks, so enemies spawn on ticks 90, 180, 270 and so on, the first 1.5 s into the run.
- The stream's enemies come in the order of its `enemies` list, starting over after the last. Example: with `["puppy", "puppy", "chihuahua"]` the stream sends puppy, puppy, chihuahua, puppy, puppy, chihuahua and so on.
- A stream enemy spawns 40 units (the stream spawn distance, in the tuning config) ahead of the squad's centre, at z = distance travelled + 40, at an x drawn evenly from −5..5 by the seeded RNG.
- A stream enemy is an enemy like any other: it chases, touches, dies and gets past the squad as above. Its HP scales with the level number like a wave enemy's (see [levels](levels.md#scaling)).

### Enemy cap

- At most 150 enemies are alive at once (the enemy cap, in the tuning config), from the performance budget.
- An enemy that would spawn, from a wave or the stream, while 150 are alive is dropped: it never appears. Enemies already alive are not affected.

### Shield dog

- A shield dog has a shield (30 HP at level 1) and a body (15 HP at level 1). It shows both: the shield's HP and the body's HP, as two numbers.
- All damage, from yarn balls and barrels, goes to the shield first. Damage beyond what the shield has left goes on to the body. Example: a yarn ball dealing 5 damage to a shield with 2 HP left breaks the shield and deals 3 to the body.
- Once the shield is at 0, it is gone and the body takes all damage. The shield dog dies when its body's HP reaches 0.
- Level scaling multiplies both the shield's and the body's HP.

### Spawn patterns

| Pattern | Formation |
| --- | --- |
| Line | A row of N enemies across the track |
| Block | A grid, such as 5 × 4 puppies |
| Column | Enemies in single file at one place across the track |
| Flank | Enemies in single file at the left and right edges |

A spawn pattern sets only where a wave's enemies start, as in the [level file](levels.md#wave). From their first tick they all chase the squad.

## Barrels

- A barrel has 10 HP and does not move. It shows its HP as a number above it.
- It does no contact damage: the squad passes it without losing cats, and the barrel stays.
- It stops yarn balls like an enemy and takes their damage.
- When its HP reaches 0 or less, it is destroyed and deals 30 damage (the barrel splash damage) to every enemy whose centre is within 3 units (the barrel splash radius) of the barrel's centre, measured on the ground plane. A barrel's splash does not damage other barrels.
- A barrel that gets past the squad's last cat disappears.
- Barrel HP, splash damage and splash radius are in the tuning config and do not scale with the level number.

## Obstacles

Walls and unbroken buff blocks are obstacles.

- When the squad's centre runs into an obstacle, the run is lost at once, whatever the squad count.
- The squad's centre is in an obstacle when it is inside the obstacle's x-range across the track and between its front and back edge along the track (distance travelled from the obstacle's `z` to its `z` + its depth). For a wall the x-range is from `x` − `width` ÷ 2 to `x` + `width` ÷ 2, both edges included; for a buff block it is the block's lane, so the squad's centre is in its x-range when the squad is in that lane (see [lanes](#lanes)).
- This is checked every tick, so a squad whose centre is in an obstacle's x-range as the obstacle reaches it is lost, and so is one that steers its centre into an obstacle while the obstacle passes. Example: a wall over x −5..0 at z = 160 loses the run of a squad at x = −1 when the distance travelled reaches 160, and of a squad at x = 0; a squad at x = 0.5 passes it.
- Cats at the side of the squad that only clip an obstacle are not lost and do not lose the run: the obstacle passes through them.
- Barrels are not obstacles: the squad passes them unharmed.

## Walls

- A wall is a static block on the track. Its place and width across the track are set in the [level file](levels.md#wall); its depth along the track is the wall depth (1 unit, in the tuning config).
- A wall stops yarn balls and takes no damage, so it cannot be destroyed.
- A wall is an [obstacle](#obstacles): when the squad's centre runs into it, the run is lost.
- A wall does not stop the road: one that the squad's centre misses passes through the cats it clips and on behind the squad.
- A wall that gets past the squad's last cat disappears.

## Buff blocks

A buff block is a block filling one [lane](#lanes), with HP, that hides a big buff behind it. Its place, lane, HP and buff are set in the [level file](levels.md#buff-block).

- A buff block is as wide as its lane and as deep as the buff block depth (1 unit, in the tuning config). It is on the track from the start of the run and comes at the squad with the road.
- Its HP is set per block in the level file for level 1 and scales with the level number like enemy HP (see [levels](levels.md#scaling)). HP can be a fraction after scaling; the number shown is rounded up.
- The block shows its HP as a number and the label of its big buff, such as "×3" or "DMG +3", so the player knows what it is worth before breaking it.
- It stops yarn balls like an enemy and takes their damage, as many times over as the cats a yarn ball stands for.
- Barrel splashes do not damage buff blocks.
- When its HP reaches 0 or less, the block breaks and uncovers its big buff, which stands where the block's front edge was, at its lane.
- A big buff is collected when it reaches the squad's centre while the squad's centre is in the big buff's lane. Otherwise it passes the squad and is lost. Example: a block in the left lane breaks; the squad steers to x = −3 and collects its buff, but a squad still at x = 0 when the buff reaches it loses it.
- A big buff that is uncovered only after it has reached the squad's centre is lost.
- An unbroken block is an [obstacle](#obstacles): when the squad's centre runs into it, the run is lost. A broken block is no obstacle. One that the squad's centre misses passes through the cats it clips and can still be shot until it is past the squad's last cat.
- A block or big buff that gets past the squad's last cat disappears.

### Big buffs

| Big buff | Shown as | Effect when collected | Cap |
| --- | --- | --- | --- |
| Add | +30 | squad count + 30 | 999 cats |
| Multiply | ×3 | squad count × 3 | 999 cats |
| Fire rate | FIRE RATE +60% | fire rate + 60% of the base fire rate | 3 × the base fire rate |
| Damage | DMG +3 | yarn ball damage + 3 | None |
| Multi-shot | +2 BULLET | yarn balls per shot + 2 | 5 per cat |
| Range | RANGE +30 | range + 30 units | None |

- The values are in the tuning config (the big buff values).
- Big buffs add up with gates and other big buffs, and last until the end of the run, like [weapon buffs](#weapon-buffs). At a cap the value stays at the cap. Examples: a squad of 400 collecting ×3 becomes 999. Yarn balls per shot of 4 with +2 BULLET become 5. A fire rate of 5.2 at a base of 2 with FIRE RATE +60% becomes 6, the cap.
- Collecting a big buff shows a big floating number and plays the good gate sound, as when taking a gate; for +30 and ×3 the squad count animates up.

## Boss

A boss level ends in a boss arena instead of a finish line (see the [level file](levels.md#boss)). Bosses are giant robot vacuum cleaners.

| Boss | World 1 level | Hit radius (units) | Walk speed (units/s) | Boss HP time (s) | Throws dust balls |
| --- | --- | --- | --- | --- | --- |
| Dustbot | 5 | 2 | 1.5 | 8 | No |
| Mega Dustbot (the world boss) | 10 | 2.5 | 1.5 | 20 | Yes |

The hit radii, walk speeds and boss HP times are in the tuning config.

### The boss arena

- The boss arena starts at the level's `length`. When the squad's centre reaches it, the road stops coming at the squad, and the squad's distance travelled stays at `length`. Steering still works as before, within x −5..5, and every cat keeps firing straight ahead.
- At that moment the boss enters: it appears at x = 0, 35 units (the boss start distance, in the tuning config) beyond the arena start, so at z = `length` + 35.
- From then on the boss walks straight toward the squad's centre at its walk speed, following the squad as it steers.
- A big HP bar shows the boss's HP while it is in the arena.
- Enemies still alive when the squad reaches the arena keep coming and work as before. Enemies and the boss do not stop each other.

### Boss HP

- The boss's HP is worked out from the level's expected squad at boss when it enters, as set by [balancing](levels.md#balancing). It is not written in the level file and does not scale with the level number.
- HP is kept as is, without rounding; the HP bar shows the HP left out of the full HP.

### Hitting the boss

- The boss stops yarn balls like an enemy: a yarn ball that touches it deals its damage, as many times over as the cats it stands for, and disappears.
- A yarn ball touches the boss when their centres are within the yarn ball's hit radius plus the boss's hit radius, measured on the ground plane.
- Barrel splashes do not damage the boss.
- The boss is defeated when its HP reaches 0 or less. Then the run is won, whatever enemies or dust balls are left.

### The boss touching the squad

- The boss touches the squad when its centre is within its hit radius plus a cat's hit radius of any cat, as an enemy does.
- If the boss touches the squad, the run is lost, whatever the squad count.

### Dust balls

Only the Mega Dustbot throws dust balls.

| Value | Base |
| --- | --- |
| Dust ball interval | One every 3 s |
| Dust ball speed | 10 units/s |
| Dust ball cat loss | 3 cats |
| Dust ball hit radius | 0.5 units |

These values are in the tuning config.

- The Mega Dustbot throws its first dust ball 3 s (the dust ball interval) after it enters, and one more every 3 s while the run goes on.
- A dust ball leaves from the boss's centre and flies in a straight line toward where the squad's centre was when it was thrown. It does not follow the squad, so steering away dodges it. It flies on past that point at the same speed and direction.
- A dust ball touches the squad when its centre is within its hit radius plus a cat's hit radius of any cat. Then the squad loses 3 cats (the dust ball cat loss), down to 0, which loses the run, and the dust ball disappears. Cats lost to a dust ball scatter off-screen unhurt.
- Nothing else stops a dust ball: yarn balls, enemies, barrels and walls do not, and it does not stop yarn balls.
- A dust ball that is past the squad's last cat disappears.
- Example: the squad stands at x = 0 when a dust ball is thrown from 30 units ahead. It arrives about 3 s later at x = 0; a squad that has steered 2 units aside by then is missed.

## Coins

- Coins come from pickups on the track, from kills and from a bonus on the victory screen.

## Win and loss

- A run is won when the boss is defeated, or, in a level without a boss, when the squad's centre reaches the finish line.
- A run is lost when the squad count reaches 0, when the squad's centre runs into an [obstacle](#obstacles), or when the boss touches the squad.
- The run ends at its first win or loss in the playbook's tick order. Yarn ball hits come before contacts with the squad, so a yarn ball that defeats the boss wins the run even if the boss or a dust ball would touch the squad in the same tick, and a buff block that a yarn ball breaks in the tick the squad's centre runs into it does not lose the run.
- Contacts in one tick are checked in this order: enemies, walls, buff blocks, dust balls, the boss. The first one that loses the run is why it was lost.
- A won run earns 1–3 stars based on the squad count left.
- After a loss, one tap restarts the level instantly, with no loading screen.
- After a win, the player goes to the victory screen, then upgrades and the next level.
