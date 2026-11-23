# Performance

The budget is in the playbook ("Deployment"): 60 fps on a mid-range phone and never below 30, at most 60 drawn cats, 150 enemies and 400 yarn balls, under 100 draw calls, under 5 MB download and first play under 3 s on 4G.

## URL flags

Add them to the game's URL, locally (`http://localhost:5173/dew-mollys-squad/?perf`) or on the live site. Without a flag the game plays normally. Flags combine: `?stress&perf&graphics=low`.

| Flag | What it does |
|---|---|
| `?perf` | Shows the performance overlay at the top left: fps, average and longest frame time, work time (the game's own time per frame), draw calls, triangles, GPU geometries and textures, drawn cats, enemies, yarn balls, particles, and the JS heap (Chrome only). It refreshes twice a second. |
| `?stress` | Plays the stress run instead of the levels: refill gates keep the squad near 999 cats, so all 60 formation slots are drawn and yarn balls fly at the cap, while a fast stream and close-packed waves of high-level puppies keep the enemy cap of 150 filled. Barrels, walls, buff blocks and big buffs come into view along the way. A run lasts about 70 s and starts again when it ends. It draws at high graphics unless `graphics` says otherwise. |
| `?graphics=low` or `?graphics=high` | Forces the graphics quality. Without it, the first 3 s of play choose: below 45 fps switches to low (`renderConfig.graphics`). Low turns off shadows and caps the pixel ratio at 1.5, high caps it at 2. |

## How to measure

1. `npm run build`, then `npx vite preview --port <free port>`, and open `http://localhost:<port>/dew-mollys-squad/?stress&perf` in Chrome.
2. In DevTools, Performance panel, set CPU to 4x slowdown, and for the load time set the network to a 4G profile with the cache disabled.
3. Let the stress run play for 60 s and read the overlay. For the heap, collect garbage (Memory panel) at the start and after 60 s and compare.
4. Restart the stress run or replay a level a few times: geometries and textures in the overlay must come back to the same numbers.

## Measured numbers

Developer machine, 2026-11-23: Chrome 157 headless on Linux, Intel Arc (Meteor Lake) GPU, a 412 x 915 phone viewport at device pixel ratio 2.625, CPU throttled 4x. Headless Chrome caps frames at 60 fps, so the work time per frame says more about the headroom than the fps. Production build.

Stress run, 60 s, high graphics:

| Measure | Result |
|---|---|
| fps | 60 throughout, frame 16.7 ms, longest 16.8 ms |
| Work time per frame | 2.3 ms average, 3.0 ms highest |
| Draw calls | 45 at most (budget: under 100) |
| Triangles | about 470,000 |
| Drawn cats | 60 throughout |
| Enemies | 136 on average, often 150 |
| Yarn balls | 299 on average, 273 at least, up to about 365 |
| Particles | about 150 |
| JS heap after a forced GC | 4.9 MB at the start, 5.2 MB after 60 s; 5.0, 5.3, 5.4 and 5.5 MB at the same point of four runs in a row. The growth is V8's compiled code, not game objects. |
| Short-lived allocations | about 1 MB/s, mostly numbers boxed in the sim's and renderer's float maths; they never reach the old generation |
| GPU memory | 28 geometries and 21 textures after each restart |

The same at low graphics: 30 draw calls at most, about 290,000 triangles, work 2.1 ms.

With S-10's chasing enemies most yarn balls hit an enemy early, so with the enemy cap full about 300 are in flight rather than the cap of 400. All of them are one instanced draw call, so the draw call count does not depend on it.

The start-up check: with the CPU throttled 40x the first 3 s ran below 45 fps and switched to low (the canvas went from 824 to 618 pixels wide, draw calls from 33 to 25).

Load, with the cache disabled and CPU throttled 4x: 168 kB transferred.

| Network | Title screen painted | Game ready to play |
|---|---|---|
| Slow 4G (Lighthouse mobile: 1.6 Mbps, 150 ms round trip) | 0.40 s | 1.60 s |
| 4G (9 Mbps, 85 ms round trip) | 0.22 s | 0.66 s |

Built sizes, minified:

| File | Size | Gzipped |
|---|---|---|
| `index-*.js`: start code, Preact, screens, levels | 24.0 kB | 9.2 kB |
| `game-*.js`: the game and Three.js, loaded after the title shows | 615.2 kB | 157.0 kB |
| JS total | 639.2 kB | 166.2 kB |
| `dist/` total | 0.64 MB (budget: 5 MB) | |
