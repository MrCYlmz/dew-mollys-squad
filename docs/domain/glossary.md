# Glossary

One term per concept. Code, tests and docs use these words exactly.

| Term | Definition |
| --- | --- |
| Run | One attempt at one level, from the first tap to win or loss. |
| Track | The straight road a run takes place on, 10 units wide and 300–600 units long, with three lanes. |
| Lane | One of the three equal strips of the track: left, centre or right. Gates and buff blocks are placed by lane; steering is free. |
| Run speed | The 12 units/s at which the road and everything on it comes toward the squad. |
| Distance travelled | How far the road has carried the squad from the start, in units. Every z is measured in it. |
| Squad | The group of cats the player steers. It holds a fixed place on screen while the road comes at it. |
| Cat | One member of the squad. Every cat fires. |
| Squad count | The number of cats in the squad, 0–999. It is the squad's health and firepower. |
| Steering point | The sideways position (x) the squad follows, set by the player. |
| Yarn ball | A shot fired by a cat. |
| Gate | A panel filling one lane that changes the squad count or a weapon stat when the squad takes it. Yarn balls fly through it. |
| Gate row | One to three gates side by side, one per lane. The squad takes the gate in its lane, if there is one. |
| Gate value | The number on a gate, such as +10 or −15. |
| Good gate | A gate shown in blue. It helps the squad. |
| Bad gate | A gate shown in red. It hurts the squad. |
| Weapon buff | An effect on fire rate, damage, multi-shot or range from a gate or big buff that lasts until the end of the run. |
| Weapon-buff gate | A gate that gives a weapon buff. It is always blue. |
| Multi-shot | Several yarn balls per cat per shot, fanned out in a spread. |
| Enemy | A dog that chases the squad's centre: puppy, chihuahua, bulldog or shield dog. |
| Contact damage | The number of cats an enemy removes when it touches the squad. |
| Wave | A group of enemies spawned together in one spawn pattern. |
| Spawn pattern | The starting formation of a wave: line, block, column or flank. |
| Spawn distance | How far before a wave's position the squad is when the wave appears. |
| Enemy stream | The endless enemies of a level besides its waves: one every interval, from the start of the run until the finish line or the arena start. |
| Stream interval | The seconds between two enemies of the enemy stream, set per level. |
| Stream spawn distance | How far ahead of the squad's centre a stream enemy appears. |
| Enemy chase speed | The speed at which every enemy moves across the track toward the squad's centre x, 6 units/s. |
| Enemy cap | The most enemies alive at once, 150. An enemy that would spawn beyond it is dropped. |
| Barrel | A static water bucket on the track that splashes nearby enemies when destroyed. |
| Shield | The shield dog's extra HP, which takes all damage before its body does. |
| Obstacle | A wall or an unbroken buff block. The squad's centre running into one loses the run. |
| Wall | A static block on the track that stops yarn balls and is an obstacle, so the squad steers around it. |
| Buff block | A block filling one lane, with HP, that hides a big buff. Yarn balls break it; an unbroken one is an obstacle. |
| Big buff | The reward behind a buff block: +30 cats, ×3 cats, FIRE RATE +60%, DMG +3, +2 BULLET or RANGE +30. The squad collects it by being in its lane when it arrives. |
| Coin | A fish. Coins are the currency for upgrades. |
| Boss | A giant robot vacuum cleaner at the end of some levels: the Dustbot or the Mega Dustbot. |
| Dustbot | The boss of level 5 in world 1. It does not throw dust balls. |
| Mega Dustbot | The world boss of world 1, on level 10. It throws dust balls. |
| World boss | The boss of a world's last level. |
| Dust ball | A projectile the Mega Dustbot throws at the squad. It removes cats when it touches the squad. |
| Boss arena | The end of a boss level's track, from z = `length` on, where the squad stops and fights the boss. |
| Arena start | Where the boss arena begins, at z = `length`. The road stops there. |
| Boss HP time | The seconds the expected squad needs to defeat the boss at the base weapon values, set per boss. Boss HP is worked out from it. |
| Finish line | The end of a level that has no boss. |
| Level | A hand-made sequence of events placed at distances along the track. |
| Level number | A level's number, stated in its level file. It sets how much enemy HP and wave size grow. |
| Level order | The order levels are played in: by level number, then by `id`. |
| Event | One thing placed at a distance (z) in a level: a gate row, a wave, a barrel, a wall, a buff block, coins or the boss. |
| World | A set of levels sharing a look and a boss. The MVP has one world of 10 levels. |
| Stars | The 1–3 rating of a won run, based on the squad count left. |
| Upgrade | A permanent improvement bought with coins between runs. |
| Upgrade level | How many times an upgrade has been bought. |
| Expected squad at boss | The squad count a good run has when it reaches the boss, stated in each boss level. It sets the boss HP. |
| Good run | A run that takes the best gate in every gate row. |
| Bad run | A run that takes the worst gate in every gate row. |
