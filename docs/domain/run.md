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
- Each yarn ball travels up to the squad's range and damages the enemy, barrel or gate it hits.

## Gates

Each gate row has two gates. The squad takes the gate it runs through.

| Gate | Shown as | Effect when taken | Colour |
| --- | --- | --- | --- |
| Add | +10 | squad count + value | Blue |
| Subtract | −15 | squad count − value; can reach 0, which loses the run | Red |
| Multiply | ×2 | squad count × 2 | Blue |
| Divide | ÷2 | squad count ÷ 2, rounded down, at least 1 | Red |
| Fire rate | FIRE RATE +20% | every cat fires 20% faster | Blue |
| Damage | DMG +1 | yarn ball damage + 1 | Blue |
| Multi-shot | +1 BULLET | each cat fires one more yarn ball, in a spread | Blue |
| Range | RANGE +10 | yarn balls travel 10 units farther | Blue |

- Examples: a squad of 8 taking ×2 becomes 16. A squad of 7 taking ÷2 becomes 3. A squad of 1 taking ÷2 stays 1. A squad of 10 taking −15 becomes 0 and the run is lost.
- Shooting a gate: each yarn ball that hits an add or subtract gate raises its value by 1. Example: −15 → −14 → … → 0 → +1.
- A gate is blue as soon as its value is positive. Example: a subtract gate shot from −2 to +1 turns blue and adds 1.
- Multiply and divide gates do not change when shot.
- Weapon buffs last until the end of the run.
- Caps: fire rate at most ×3 the base rate; multi-shot at most 5 yarn balls per cat; squad count at most 999.
- Each gate can be taken once. When the squad takes one gate of a row, the other disappears.
- Taking a gate shows a big floating number and plays a sound, and the squad count animates up or down.

## Enemies

Every enemy shows its HP as a number or bar. Values are for level 1 and scale per level (see [levels](levels.md)).

| Enemy | Role | HP | Speed (units/s) | Contact damage (cats) | Behaviour |
| --- | --- | --- | --- | --- | --- |
| Puppy | Grunt | 3 | 4 | 1 | Runs straight at the squad in groups of 5–20 |
| Chihuahua | Runner | 1 | 9 | 1 | Fast, comes in lines |
| Bulldog | Brute | 40 | 2.5 | 10 | Slow tank |
| Shield dog | Shield bearer | 15, plus a shield of 30 from the front | 3 | 3 | The shield must break before the body takes damage |

- When an enemy touches the squad, the enemy dies and the squad loses cats equal to its contact damage. Example: a bulldog touching a squad of 25 leaves 15; touching a squad of 6 leaves 0 and loses the run.
- Shield dog: hits from the front reduce the shield first. The body takes damage only once the shield is at 0.

### Barrels

- A barrel has 10 HP and does not move. It does no contact damage.
- When destroyed, it deals 30 damage to every enemy within 3 units.

### Spawn patterns

| Pattern | Formation |
| --- | --- |
| Line | A row of N enemies across the track |
| Block | A grid, such as 5 × 4 puppies |
| Column | Enemies in single file in one lane; steering away avoids them |
| Flank | Enemies from the left and right edges walking inward |

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
