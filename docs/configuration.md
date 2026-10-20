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

- **`tiles`** (required): the tiles on the display, in the order they stack in
  portrait. See [Tiles](#tiles).
- **`night`** (optional): from `startHour` until `endHour` (local time, 0 to 23,
  may span midnight) the palette turns warm and dim. A tap wakes the display for
  `wakeMs` milliseconds. Defaults: 21, 7 and 15000.

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

Tiles may not overlap, and a cell with no tile stays empty. In portrait the grid
becomes two columns: tiles stack in the order they are listed, a tile wider than
one column takes both, and `row`, `col` and `h` are ignored.

A `calendar` tile lists its calendars instead of a single entity. Each has an
`entity`, an optional `label` (shown in the legend) and `color` (`yellow`, `blue`
or `green`; by default the three are used in turn), and an optional `kind`:
`f1` shortens Formula 1 race titles and hides their notes, `birthdays` adds the
age from a "Born 1977" note.

### Moving from the old format

Earlier versions used a flat `entities` object (and `labels`), with a fixed layout.
The app now shows a banner if it finds `entities`. To move over, add a tile for
each thing you want on the display and copy the entity IDs across:

| Old key                                                                                               | Now                                                                                                             |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `light`, `labels.light`                                                                               | a `toggle` tile: `entity`, `label`                                                                              |
| `weather`                                                                                             | a `weather` tile: `entity`                                                                                      |
| `calendarFamily`, `calendarBirthdays`, `calendarF1`                                                   | `calendars` of a `calendar` tile (`kind`: `birthdays`, `f1`)                                                    |
| `roomTemperature`, `roomHumidity`, `roomBattery`, `labels.room`                                       | a `temperature` tile: `temperature`, `humidity`, `battery`, `label`                                             |
| `heatingClimate`, `heatingSchedule`, `heatingDemand`, `heatingCloud`, `heatingResume`, `heatingBoost` | a `heating` tile: `climate`, `schedule`, `demand`, `cloud`, `resume`, `boost`                                   |
| `acClimate`, `acPowerful`, `acEconomy`, `acQuietFan`, `labels.ac`                                     | an `ac` tile: `climate`, `powerful`, `economy`, `quietFan`, `label`; `room` for the room sensor the sheet shows |

The old layout was: clock at column 1 row 1 spanning 3 columns, weather at column
1 row 2 spanning 3, calendar at column 4 spanning 3 columns and 2 rows, then light
(columns 1 to 2), room, heating and AC along row 3. `config.example.jsonc` is that
layout.

## When something is wrong

The app never fails silently. If the file is missing or isn't valid JSON, or an
entity is missing, of the wrong type, in the wrong domain or still a
placeholder (`TODO:...`), or a tile is outside the grid, overlaps another, or
has an unknown type or setting, the dashboard shows a banner saying what is the matter. Edits show on the next load: the app asks for the file without caching it.

The Diagnostics screen (tap the version, bottom right) shows the build (version,
commit, when it was built), the live state of every configured entity, and a
performance probe.
