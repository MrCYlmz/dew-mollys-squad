# Molly's Squad

A browser runner game for phones: lead a squad of cats down the road, pick the gates that grow it, and outlast the dogs and the robot vacuums.

Play it at https://mrcylmz.github.io/dew-mollys-squad/

## Develop

Node 24 or later.

```sh
npm ci
npm run dev        # play locally
npm run typecheck
npm run lint
npm test
npm run build      # production build into dist/
npm run size       # fails when dist/ is above 5 MB
```

## Deploy

Every push to `main` deploys the game to GitHub Pages through `.github/workflows/pages.yml`. The workflow runs the typecheck, lint, tests, build and size check first, and a failing check stops the deploy. Only the latest push deploys.

The site is served under `/dew-mollys-squad/`, the `base` in `vite.config.ts`. A renamed repo needs a new `base`.

One-time setup, after the workflow first reaches `main`: in the repo's Settings, Pages, set "Source" to "GitHub Actions". To deploy again without a new commit, rerun the latest "Deploy to GitHub Pages" run in the Actions tab.

## Performance

How to show the performance overlay, run the stress run and force a graphics quality, and the numbers last measured: [docs/performance.md](docs/performance.md).
