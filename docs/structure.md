# Source layout

`src/` is organised by kind of code. Imports across folders use the `@/` alias
(`@/lib/format.ts`); only same-folder siblings use `./`. Tests sit next to the
file they cover. ESLint enforces the alias and the layering below
(`eslint.config.js`).

| Folder        | What belongs here                                                              |
| ------------- | ------------------------------------------------------------------------------ |
| `config/`     | The entity list, night hours and shared timings. A leaf: imports nothing.      |
| `services/`   | The data layer: the HA store, auth, connection, history, perf counters.        |
| `lib/`        | Plain logic with no preact: formatting, grid, night maths, entity view models. |
| `hooks/`      | Preact hooks.                                                                  |
| `components/` | All UI: icons, layout, tiles (`base/` is the shared shell), sheets, controls.  |
| `dev/mock/`   | The in-page fake HA. Never part of a build.                                    |
| `types/`      | Ambient globals injected by Vite.                                              |

## Layering

Imports only flow down: `config` → `services` → `lib` → `hooks` → `components`.
A folder may import anything above it in that list, never below. `lib` may use
`services` because the view models read HA entities. `app.tsx` and `main.tsx`
may import anything, and tests may cross layers.

## Special cases

- Production code never imports `dev/`. The one seam is the `__HA_MOCK__`-gated
  dynamic import in `services/ha/instance.ts`, which keeps the mock out of every
  build.
- `lib/recover.js` is a plain script that `build-info.ts` inlines into
  `index.html`. It cannot import anything or use the alias.
