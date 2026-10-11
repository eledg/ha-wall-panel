# End-to-end tests

`pnpm test:e2e` runs Playwright (`e2e/`) against `vite --mode mock`, so it needs
no token or HA. It runs in CI as the `e2e` job.

- **Display:** 944 x 459 CSS px at a pixel ratio of 1.5, touch, `en-GB`,
  `Europe/London` (see `docs/display.md`).
- **Deterministic:** the page clock is fixed (`page.clock`), so the time, date and
  forecast hours never change. The mock overlay is hidden and the pixel shift
  (`src/pixel-shift.ts`) is held still, so baselines never depend on its path or
  step. A separate test checks that it moves.
- **Baselines:** `e2e/__screenshots__/`, one per screenshot, with no platform in
  the name. Font rendering differs between macOS and Linux, so the baselines are
  Linux ones, taken from CI.

## Updating baselines

Local macOS runs will not match the Linux baselines. After an intended UI change,
regenerate them in the same image CI uses (the anonymous `node_modules` volume
keeps the container's install off your host's):

```sh
docker run --rm -v "$PWD":/w -v /w/node_modules -w /w mcr.microsoft.com/playwright:v1.64.0-noble \
  sh -c "corepack enable && pnpm install --frozen-lockfile && pnpm test:e2e:update"
```

Without Docker, run the `e2e` job in CI, download the `playwright-report`
artifact and copy the rendered `*-actual.png` over the baseline.
