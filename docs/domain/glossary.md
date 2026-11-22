# Glossary

One term per concept. Code, tests and docs use these words exactly.

| Term | Definition |
| --- | --- |
| Run | One attempt at one level, from the first tap to win or loss. |
| Track | The straight road a run takes place on, 10 units wide and 300–600 units long. |
| Squad | The group of cats the player steers. |
| Cat | One member of the squad. Every cat fires. |
| Squad count | The number of cats in the squad, 0–999. It is the squad's health and firepower. |
| Steering point | The sideways position (x) the squad follows, set by the player. |
| Yarn ball | A shot fired by a cat. |
| Gate | A panel the squad runs through that changes the squad count or a weapon stat. |
| Gate row | Two gates side by side. The squad takes one of them. |
| Gate value | The number on a gate, such as +10 or −15. |
| Good gate | A gate shown in blue. It helps the squad. |
| Bad gate | A gate shown in red. It hurts the squad. |
| Weapon buff | A gate effect on fire rate, damage, multi-shot or range that lasts until the end of the run. |
| Weapon-buff gate | A gate that gives a weapon buff. It is always blue. |
| Multi-shot | Several yarn balls per cat per shot, fanned out in a spread. |
| Enemy | A dog that runs at the squad: puppy, chihuahua, bulldog or shield dog. |
| Contact damage | The number of cats an enemy removes when it touches the squad. |
| Wave | A group of enemies spawned together in one spawn pattern. |
| Spawn pattern | The formation of a wave: line, block, column or flank. |
| Spawn distance | How far before a wave's position the squad is when the wave appears. |
| Barrel | A static water bucket on the track that splashes nearby enemies when destroyed. |
| Shield | The shield dog's extra HP, which takes all damage before its body does. |
| Wall | A static block on the track that stops yarn balls and costs cats when the squad touches it, so the squad steers around it. |
| Coin | A fish. Coins are the currency for upgrades. |
| Boss | A giant robot vacuum cleaner at the end of some levels: the Dustbot or the Mega Dustbot. |
| Dustbot | The boss of level 5 in world 1. It does not throw dust balls. |
| Mega Dustbot | The world boss of world 1, on level 10. It throws dust balls. |
| World boss | The boss of a world's last level. |
| Dust ball | A projectile the Mega Dustbot throws at the squad. It removes cats when it touches the squad. |
| Boss arena | The end of a boss level's track, from z = `length` on, where the squad stops and fights the boss. |
| Arena start | Where the boss arena begins, at z = `length`. The squad's centre stops there. |
| Boss HP time | The seconds the expected squad needs to defeat the boss at the base weapon values. Boss HP is worked out from it. |
| Finish line | The end of a level that has no boss. |
| Level | A hand-made sequence of events placed at distances along the track. |
| Level number | A level's number, stated in its level file. It sets how much enemy HP and wave size grow. |
| Level order | The order levels are played in: by level number, then by `id`. |
| Event | One thing placed at a distance (z) in a level: a gate row, a wave, a barrel, a wall, coins or the boss. |
| World | A set of levels sharing a look and a boss. The MVP has one world of 10 levels. |
| Stars | The 1–3 rating of a won run, based on the squad count left. |
| Upgrade | A permanent improvement bought with coins between runs. |
| Upgrade level | How many times an upgrade has been bought. |
| Expected squad at boss | The squad count a good run has when it reaches the boss, stated in each boss level. It sets the boss HP. |
| Good run | A run that takes the better gate in every gate row. |
| Bad run | A run that takes the worse gate in every gate row. |
