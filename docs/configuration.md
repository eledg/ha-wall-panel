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

Start from [`config.example.jsonc`](../config.example.jsonc), which documents every setting
in comments. It lists the tiles to
show, where each sits and which Home Assistant entities it reads:

```json
{
  "tiles": [
    { "type": "clock", "col": 1, "row": 1, "w": 3 },
    {
      "type": "toggle",
      "label": "Light",
      "col": 1,
      "row": 3,
      "w": 2,
      "entity": "switch.living_room_light"
    }
  ],
  "night": { "startHour": 21, "endHour": 7, "wakeMs": 15000 }
}
```

(The real file has more tiles; the example above is shortened.)

The file is JSON that allows `//` and block comments, so you can annotate your own
copy as the example does. Trailing commas are not allowed. A comment marker inside
a string, such as a URL, is not a comment.

- **`tiles`** (required): the tiles on the display, each with its position. The
  order of the list only matters if the display is turned to portrait. See
  [Tiles](#tiles).
- **`night`** (optional): from `startHour` until `endHour` (local time, 0 to 23,
  may span midnight) the palette turns warm and dim. A tap wakes the display for
  `wakeMs` milliseconds. Defaults: 21, 7 and 15000. Optionally set `overrideSwitch`
  to a `switch.*` entity ID: while that switch is on, night mode is off (normal
  palette, no dimming), and it applies again when the switch goes off. If the
  switch is unknown or unavailable, the clock decides. The switch need not be on a
  tile.
- **`locale`** (optional): a language tag such as `"en-GB"` or `"de-DE"`. It sets
  the order of day and month, the weekday and month names, and whether the clock
  is 12 or 24 hours. Default: the display's own language, which a kiosk WebView
  sometimes reports as `en-US`; set `"en-GB"` for a UK date order and 24 hour
  clock. Only dates and times change: the rest of the text stays English.
- **`timeZone`** (optional): an IANA name such as `"Europe/London"`. It drives
  every time the panel shows (clock, calendar, heating history, Diagnostics) and
  works out (night mode, "Today" and "Tmrw", the weather hours). Default: the
  display's own time zone; set it only if the display reports the wrong one.

### Tiles

Every tile has a `type` and a position, and may be repeated: two `toggle` tiles
with different entities are two independent lights.

| Setting    | Meaning                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| `type`     | `clock`, `weather`, `calendar`, `toggle`, `temperature`, `heating` or `ac`.                            |
| `col`      | Left column, 1 to 6. Required.                                                                         |
| `row`      | Top row, 1 to 3. Required.                                                                             |
| `w`, `h`   | Columns and rows the tile spans. Default 1. The tile must stay inside the 6 x 3 grid.                  |
| `id`       | Optional name, unique across the file. Default: the type and a count (`toggle-1`).                     |
| `label`    | Optional name shown on the tile. Default: "Light" for a toggle, "Room", "Heating", "AC", "Weather".    |
| _entities_ | The Home Assistant entity IDs the tile reads, named per type. See the [entity reference](entities.md). |

Tiles may not overlap, and a cell with no tile stays empty.

A `heating` or `ac` tile may also set `roomLabel`, the room named in the caption
above its current temperature on the controls screen ("Living room now"). Default:
"Room".

**Portrait.** If the display is turned so it is taller than wide, the 6 x 3 grid
is replaced by two columns, and `col`, `row` and `h` are ignored. The tiles are
placed one after another from the top, in the order they appear in `tiles`. A
tile with `w` of 2 or more takes the full width; a tile with `w` of 1 takes half,
so two of them sit side by side. Put the tiles in the order you want to read them
down the screen. In landscape the order of the list makes no difference.

A `calendar` tile lists its calendars instead of a single entity. Each has an
`entity`, an optional `label` (shown in the legend) and `color` (`yellow`, `blue`
or `green`; by default the three are used in turn), and an optional `kind`:
`f1` shortens Formula 1 race titles and hides their notes, `birthdays` adds the
age from a "Born 1977" note.

## Editor support

[`config.schema.json`](../config.schema.json) is a JSON schema of the file, so an
editor can suggest settings and underline a misspelled one (`quietfan`) as you type.
It covers structure only; the app still checks the grid, overlaps, duplicate ids and
entity domains when it loads.

The example already points at it with a `"$schema"` line, which the app ignores. Keep
that line in your own copy, or in VS Code map the schema to your file instead:

```json
"json.schemas": [
  {
    "fileMatch": ["*.config.json"],
    "url": "https://raw.githubusercontent.com/eledg/ha-wall-panel/main/config.schema.json"
  }
]
```

The schema is generated from the tile definitions in `src/config/config.ts`. After
changing them, run `pnpm schema:generate` and commit the result; a test fails if it is stale.

## When something is wrong

The app never fails silently. If the file is missing or isn't valid JSON, or an
entity is missing, of the wrong type, in the wrong domain or still a
placeholder (`TODO:...`), or a tile is outside the grid, overlaps another, or
has an unknown type or setting, the dashboard shows a banner saying what is the matter. Edits show on the next load: the app asks for the file without caching it.

The Diagnostics screen (tap the version, bottom right) shows the build (version,
commit, when it was built), the live state of every configured entity, and a
performance probe.
