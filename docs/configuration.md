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

The `heating` tile is built around Tado and needs the Tado Hijack integration
(HACS); the core Tado integration is not enough. See
[Heating system](entities.md#heating-system) for what is tested and how to find
the entity IDs.

A `weather` tile may also name a `sun` entity (`sun.sun`). Tapping the tile opens
the weather screen, which then also shows sunrise and sunset. Without `sun`
those two are left out.

The weather screen's contents come from an optional `details` object on the tile.
Every setting is optional; the defaults are what the screen shows without it. The
tile's own forecast strip is not affected.

| `details` setting | Meaning                                                                           | Default |
| ----------------- | --------------------------------------------------------------------------------- | ------- |
| `days`            | Days in the outlook, from today. 0 to 7; 0 hides the outlook.                     | 7       |
| `hoursStep`       | Hours between the columns of the hourly strip. 1 to 12.                           | 3       |
| `hoursCount`      | Columns in the hourly strip. 0 to 8; 0 hides the strip.                           | 5       |
| `stats`           | The stat boxes to show, in this order: a list of the keys below. `[]` hides them. | all     |

The `stats` keys are `wind` (speed, direction and gusts), `feelsLike`, `humidity`,
`uv`, `pressure`, `visibility`, `dewPoint`, `sunrise` and `sunset`. A stat the
weather source does not report (or `sunrise` and `sunset` without a `sun` entity)
is left out, never shown empty. The hourly forecast covers 48 hours and the daily
one 7 days, so a strip or outlook that asks for more simply stops at the end.

```jsonc
{
  "type": "weather",
  "col": 1,
  "row": 2,
  "w": 3,
  "entity": "weather.home",
  "details": {
    "days": 5,
    "hoursStep": 2,
    "hoursCount": 6,
    "stats": ["wind", "feelsLike", "humidity"],
  },
}
```

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
`entity`, an optional `label` (shown in the legend) and `color` (`yellow`, `blue`,
`green`, `red`, `purple`, `teal` or `pink`; by default they are used in that order).
Three more options tidy a calendar's events:

- `hideNotes: true` hides the events' notes (their description).
- `title` shortens the title in the tile's rows. `match` is a regular expression
  (with the `u` flag) and `replace` is what the part it matches becomes: `$1` to
  `$9` are the match's groups (`$0` all of it) and `{location}` is the event's
  location. A title that doesn't match, or an event with no location when
  `replace` uses `{location}`, is left as it is. The detail sheet always shows
  the full title. In JSON, write each backslash twice (`"\\S"`). An invalid
  `match` is reported and the rule ignored.
- `showYears: true` counts the years since a year in the event's notes, for
  birthdays, anniversaries and the like. The first four-digit year in the
  description is used (`Born 1977`, `Married 2010`). `Alex Example's Birthday`
  becomes `Alex Example's 49th Birthday`: the count goes after the last `'s`,
  or at the start of a title without one, so `Wedding Anniversary` becomes
  `16th Wedding Anniversary` (but `Our Anniversary` becomes `16th Our
Anniversary`). The count is the event's year minus that year, so next year's
  event shows next year's number. An event with no year in its notes, or a year
  that isn't before the event's, keeps its title. It applies to every event in
  the calendar, so use it on a calendar whose notes hold no other years. The `th`
  is English only.

For example, a Formula 1 calendar whose titles read
`🏁 FORMULA 1 SINGAPORE AIRLINES SINGAPORE GRAND PRIX 2026 - Race`, with the
place in the event's location, becomes `🏁 F1 Singapore - Race`:

```jsonc
{
  "entity": "calendar.formula_1",
  "hideNotes": true,
  "title": {
    "match": "^(\\S+)\\s+FORMULA 1\\s.*\\s-\\s(.+)$",
    "replace": "$1 F1 {location} - $2",
  },
}
```

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
