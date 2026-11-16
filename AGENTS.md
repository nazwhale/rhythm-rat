# Rhythm Rat

## Local development

- Use Node.js 22 and `npm ci` to install the locked dependencies.
- Run `npm run db:local` to initialize local D1, then `npm run build` and `npm run dev:worker` to serve the built game and API on localhost:8787. See [online setup](docs/online-ratings.md) for the local email stub and required variables.
- Run `npm run dev` for Vite hot reload. It proxies API requests to the local Worker.
- Run `npm test` and `npm run build` to verify changes. The test suite includes the game rules, Glicko-2 reference example, and Worker/D1 integration tests.

## Code map

- `src/App.tsx` renders play. `src/gameplay/useGameRun.ts` owns input, audio and frame scheduling. `src/gameplay/runState.ts` defines phase transitions.
- `src/styles/site.css` covers the shared shell and navigation. `src/styles/gameplay.css` covers play and its controls. `src/styles/account.css` covers profiles, puzzles, leaderboards and sign-in.
- Add or edit authored levels in `src/levels/`. Read the [level format](src/levels/README.md) before changing rhythm or IDs. The build derives puzzle versions from content and generates the Worker catalog.
- `src/shared/apiContract.ts` defines the client and Worker API. Browser rated runs and retries live in `src/ratings/`. Worker routes start in `worker/index.ts`, and `worker/results.ts` owns the atomic ratings write.
- D1 results are the replay source. Rating state and history are rebuildable caches. See [replay and rollout](docs/replay-rollout.md) for migrations, model activation, and preview deployment.
