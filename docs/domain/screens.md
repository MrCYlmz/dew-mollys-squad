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
- The Defeat screen names why the run was lost: "Out of cats" when the squad count reached 0, "Ran into a wall" or "Ran into a block" when the squad's centre ran into an obstacle, or the boss that touched the squad, such as "Caught by the Dustbot".
- Under the loss reason, the Defeat screen shows one tip, chosen by why the run was lost. The tips are in the string table, like every other text.

| Lost by | Tip |
| --- | --- |
| Out of cats | "Take the blue gates and shoot the dogs before they reach you." |
| Ran into a wall or a block | "Steer into a free lane early: walls and blocks end the run." |
| Caught by a boss | "Grow your squad before the boss: more cats, more yarn." |

- Hand icon on level 1: when level 1 starts, a hand icon over the lower part of the screen swipes left and right to show how to steer. It has no text. See [hand icon](#hand-icon).
- HUD: nothing important in the bottom 20% of the screen, where the finger is.
- HUD and screens respect the phone's safe areas (notch, rounded corners).

## Hand icon

- The hand icon shows on every start of level 1, also on a retry or a restart, and never on another level.
- It disappears on the player's first [steer input](run.md#controls) of the run, or 4 s into the run (the hand icon time, in the tuning config), whichever comes first. It does not come back in that run. Time paused does not count toward the 4 s.
- It does not pause or slow the run, and it does not block input: a drag that starts on the hand icon steers.
- Example: the player starts level 1 and drags after 2 s; the hand icon disappears at once. A player who does not steer sees it until 4 s into the run.

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

- Every hit, gate, big buff and kill gives instant feedback: popping numbers, screen shake on big hits, and sound.
- Sound effects: shot, hit, enemy death, good gate (happy meow), bad gate (hiss), coin, boss roar, win, lose. Shots from many cats sound as one batched shot, not one sound per cat.
- One looping music track per world. Music and sound start only after the player's first tap.
