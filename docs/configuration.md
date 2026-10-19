# Configuration

The build does not contain home specific code. The app reads a `config.json` when it
starts, so one release works for every setup. The build itself takes no
settings and works from any folder.

## Where the file goes

Home Assistant serves `/config/www/<folder>/` at `/local/<folder>/`. Put the app
in a folder there, and the config **beside** it, named after the folder:

```
/config/www/wall-panel/            the app (replaced on every deploy)
/config/www/wall-panel.config.json your config (never touched by a deploy)
```

The app works out its folder from the page's own address, so the page at
`/local/wall-panel/index.html` reads `/local/wall-panel.config.json`. The page
URL must end in `index.html` or a slash; Home Assistant needs `index.html`
anyway (see [display.md](display.md#kiosk-url)).

Everything under `/local/` is served without login, so never put secrets in the
config.

Under `pnpm dev` the dev server serves `./config.json` from the repo root
(git-ignored) at `/config.json`, so the app loads it as a deploy would. Set
`HA_DEV_CONFIG` in `.env.local` to read another file.

## The file

Start from [`config.example.json`](../config.example.json):

```json
{
  "entities": {
    "light": "switch.living_room_light",
    "weather": "weather.home"
  },
  "night": { "startHour": 21, "endHour": 7, "wakeMs": 15000 },
  "labels": { "light": "Light", "room": "Room", "ac": "AC" }
}
```

(The real file lists every key in `entities`; the example above is shortened.)

- **`entities`** (required): the Home Assistant entity ID for each key. Every key
  is required and has a fixed domain, so a `light` ID must start `switch.`. The
  [entity reference](entities.md) lists each key, its domain and what the app
  reads from it.
- **`night`** (optional): from `startHour` until `endHour` (local time, 0 to 23,
  may span midnight) the palette turns warm and dim. A tap wakes the display for
  `wakeMs` milliseconds. Defaults: 21, 7 and 15000.
- **`labels`** (optional): the names shown on the `light`, `room` and `ac` tiles.
  Defaults: "Light", "Room" and "AC".

## When something is wrong

The app never fails silently. If the file is missing or isn't valid JSON, or an
entity is missing, unknown, of the wrong type, in the wrong domain or still a
placeholder (`TODO:...`), the dashboard shows a banner saying what is the matter. Edits show on the next load: the app asks for the file without caching it.

The Diagnostics screen (tap the version, bottom right) shows the build (version,
commit, when it was built), the live state of every configured entity, and a
performance probe.
