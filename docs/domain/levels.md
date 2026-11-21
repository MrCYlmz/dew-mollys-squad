# Levels

Terms as in the [glossary](glossary.md).

## Structure

- A level is a list of events, each placed at a distance z along the track, ending with a boss or a finish line. Example: a gate row at z = 40, a wave at z = 80, the boss at z = 400.
- Levels are hand-made by designers as data, so a new level needs no code change.
- Gate rows come every 40–60 units.
- Between gate rows, enemy waves run at the squad.
- Pickups and obstacles sit on the track: barrels to shoot, coins to collect, walls to steer around.
- Rhythm per 100 units: 1–2 gate rows, 1–2 waves, and a few coins or barrels.
- A level takes 60–120 s to play.

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
