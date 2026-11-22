# Screens

Terms as in the [glossary](glossary.md). The screens lie over the game view.

## Flow

Boot → Title → Playing ⇄ Paused → Victory or Defeat. From the title, the player can open upgrades and settings.

- Title → Playing starts the first level in [level order](levels.md#level-order).
- Victory → Playing starts the next level in level order. After the last level, Victory goes back to the Title.
- Defeat → Playing retries the same level.
- Pause's quit goes back to the Title.

## Screens

| Screen | Shows | Main action |
| --- | --- | --- |
| Title | Game name, level number, coins, settings icon | Tap to play |
| Upgrades | Upgrade cards with upgrade level and price | Buy, back |
| In-game HUD | Level progress bar (top), coins (top right), pause (top left), squad count above the squad, boss HP bar in the boss arena | Steer |
| Pause | Resume, restart, settings, quit | Resume |
| Victory | Stars, coins earned, optional coin multiplier spin | Next level |
| Defeat | Distance reached, tip text | Retry, one tap, instant |

- The first level starts with one tap from the title screen.
- The Defeat screen names why the run was lost: "Out of cats" when the squad count reached 0, or the boss that touched the squad, such as "Caught by the Dustbot".
- HUD: nothing important in the bottom 20% of the screen, where the finger is.
- HUD and screens respect the phone's safe areas (notch, rounded corners).

## Settings

| Setting | Values |
| --- | --- |
| Music | On, off |
| Sound | On, off |
| Vibration | On, off. Only where the browser supports it (Android browsers; not iOS Safari) |
| Steering sensitivity | 0.5–2.0, default 1.0 |
| Graphics quality | Low, high. Low turns off shadows and lowers render resolution |
| Language | English only at launch |

## Feedback

- Every hit, gate and kill gives instant feedback: popping numbers, screen shake on big hits, and sound.
- Sound effects: shot, hit, enemy death, good gate (happy meow), bad gate (hiss), coin, boss roar, win, lose. Shots from many cats sound as one batched shot, not one sound per cat.
- One looping music track per world. Music and sound start only after the player's first tap.
