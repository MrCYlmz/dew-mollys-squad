# The run

Terms as in the [glossary](glossary.md).

## Movement

- The squad moves forward at a constant 8 units/s. The player controls only the steering point.
- The steering point is clamped to the track edges: x stays within −5..5.
- The squad follows the steering point smoothly, closing the gap in about 80 ms, so it is responsive but not twitchy.
- Cats stay in a tight cluster around the steering point.

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
- A yarn ball stops at the first enemy, barrel, wall or gate it hits, deals its damage and disappears. One that hits nothing disappears at the end of its range. A wall takes no damage.
- A yarn ball that is beyond the track edge (x below −5 or above 5) when it reaches a gate row passes the row without hitting either gate. Example: a cat at x = 5.2 at the edge of a wide squad fires past the gates.

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
- A yarn ball standing for N cats deals N × damage, and counts as N hits on an add or subtract gate. It still stops at the first enemy, barrel, wall or gate it hits.
- At or below the cap, N is 1 and every cat fires its own yarn balls.
- Results are about equal, not exactly equal: when a yarn ball standing for N cats kills an enemy or destroys a barrel with less HP than its damage, the spare damage is lost, where N separate yarn balls would have gone on to the next target. Example: a yarn ball dealing 2 damage that hits a puppy with 1 HP left kills it, and the second point of damage is lost. This only happens above the cap, so with squads above about 200 at the base values.

Examples at the base values (2 yarn balls/s, range 30, speed 30, so each yarn ball flies 1 s): a squad of 200 would have 400 in flight, so N is 1. A squad of 300 would have 600, so N is 2: each yarn ball deals 2 damage, and about 300 are in flight. A squad of 999 would have 1,998, so N is 5, and about 400 are in flight. A squad of 100 with one +1 BULLET gate fires 2 yarn balls per shot, so it would have 400 in flight, and N is still 1.

## Gates

Each gate row has two gates. The squad takes the gate it runs through: a squad whose centre is at x < 0 takes the left gate, and one at x ≥ 0, including exactly 0, takes the right gate.

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
- Shooting a gate: an add or subtract gate counts the yarn ball hits it takes, and every 10 hits (the hits per gate step, in the tuning config) raise its value by 1. Example: −15 → −14 → … → 0 → +1, so a −15 gate turns blue at +1 after 160 hits.
- A gate is blue as soon as its value is positive. Example: a subtract gate shot from −2 to +1 turns blue and adds 1.
- Multiply, divide and weapon-buff gates do not change when shot. A yarn ball hitting one still stops there.
- Weapon-buff gates are always blue.
- A gate row may mix any two gate types. Example: +10 on the left and DMG +1 on the right.
- Each gate can be taken once. When the squad takes one gate of a row, the other disappears.
- Taking a gate shows a big floating number and plays a sound, and the squad count animates up or down.

### Weapon buffs

A weapon-buff gate changes a value of every cat, from the moment it is taken until the end of the run. Buffs from several gates add up. The squad count does not affect them: cats that join later fire with the same buffs.

| Gate | Effect per gate | Cap |
| --- | --- | --- |
| Fire rate | Fire rate + 20% of the base fire rate | 3 × the base fire rate |
| Damage | Yarn ball damage + 1 | None |
| Multi-shot | Yarn balls per shot + 1 | 5 per cat |
| Range | Range + 10 units | None |

- Fire rate adds up on the base rate, not on the current rate. Examples at the base of 2 yarn balls/s: one gate gives 2.4, two give 2.8, ten give 6, the cap. An eleventh gate changes nothing.
- A gate taken at its cap is still taken, and its row's other gate still disappears, but the value stays at the cap.
- Multi-shot: a cat's yarn balls of one shot leave together in a fan, spread evenly around straight ahead, with the multi-shot spread (5°, in the tuning config) between neighbouring yarn balls. Examples: 2 yarn balls fly at −2.5° and +2.5°; 3 at −5°, 0° and +5°.
- A yarn ball in a fan flies at the yarn ball speed along its own direction and drifts sideways as it goes. It may leave the track; it then passes gate rows as above.
- The damage buff does not change how many hits a yarn ball counts as on an add or subtract gate: one per cat it stands for, whatever its damage.

## Enemies

Every enemy shows its HP as a number above it. Values are for level 1 and scale with the level number (see [levels](levels.md#scaling)).

| Enemy | Role | HP | Speed (units/s) | Contact damage (cats) | Typical use |
| --- | --- | --- | --- | --- | --- |
| Puppy | Grunt | 3 | 4 | 1 | Groups of 5–20 |
| Chihuahua | Runner | 1 | 9 | 1 | Fast lines |
| Bulldog | Brute | 40 | 2.5 | 10 | A slow tank, alone or in small groups |
| Shield dog | Shield bearer | 15, plus a shield of 30 | 3 | 3 | The shield must break before the body takes damage |

- Every enemy runs at the squad as its wave's spawn pattern says (see [levels](levels.md#wave)), at its own speed. Every enemy can come in every spawn pattern; the typical use is a guide for designers.
- When an enemy touches the squad, the enemy dies and the squad loses cats equal to its contact damage, whatever HP it has left. Example: a bulldog touching a squad of 25 leaves 15; touching a squad of 6 leaves 0 and loses the run.
- An enemy that gets past the squad disappears behind it and does no damage.
- An enemy is past the squad only once it is past the squad's last cat. Until then, an enemy touching any cat, even one inside the cluster, costs cats.
- An enemy dies when its HP reaches 0 or less. HP can be a fraction after scaling; the number shown is rounded up. Example: a puppy with 0.24 HP left shows 1.
- Enemies are not stopped by walls, barrels or each other.

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
| Column | Enemies in single file in one lane; steering away avoids them |
| Flank | Enemies from the left and right edges walking inward |

Where each pattern places its enemies is set in the [level file](levels.md#wave).

## Barrels

- A barrel has 10 HP and does not move. It shows its HP as a number above it.
- It does no contact damage: the squad passes it without losing cats, and the barrel stays.
- It stops yarn balls like an enemy and takes their damage.
- When its HP reaches 0 or less, it is destroyed and deals 30 damage (the barrel splash damage) to every enemy whose centre is within 3 units (the barrel splash radius) of the barrel's centre, measured on the ground plane. A barrel's splash does not damage other barrels.
- A barrel that gets past the squad's last cat disappears.
- Barrel HP, splash damage and splash radius are in the tuning config and do not scale with the level number.

## Walls

- A wall is a static block on the track. Its place and width across the track are set in the [level file](levels.md#wall); its depth along the track is the wall depth (1 unit, in the tuning config).
- A wall stops yarn balls and takes no damage, so it cannot be destroyed.
- When any cat touches a wall, the squad loses 10 cats (the wall cat loss, in the tuning config), down to 0, which loses the run. Each wall costs cats once: touching it again costs nothing more. Cats lost to a wall scatter off-screen unhurt.
- The squad is not stopped by a wall and keeps moving forward through it.
- A wall that gets past the squad's last cat disappears.

## Boss

- The boss is a giant robot vacuum cleaner with a big HP bar.
- At the boss arena the squad stops moving forward. The boss walks toward the squad at 1.5 units/s.
- If the boss touches the squad, the run is lost, whatever the squad count.
- Some bosses throw projectiles that each remove 2–5 cats.
- Boss HP is set by [balancing](levels.md#balancing).

## Coins

- Coins come from pickups on the track, from kills and from a bonus on the victory screen.

## Win and loss

- A run is won when the boss is defeated, or, in a level without a boss, when the squad crosses the finish line.
- A run is lost when the squad count reaches 0, or when the boss touches the squad.
- A won run earns 1–3 stars based on the squad count left.
- After a loss, one tap restarts the level instantly, with no loading screen.
- After a win, the player goes to the victory screen, then upgrades and the next level.
