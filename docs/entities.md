# Entity inventory

Entity IDs the dashboard uses, added one milestone at a time.

| Entity ID                                 | Domain     | Attributes read                                                                    | Notes                                                   |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `switch.shellywallx2i_office`             | `switch`   | `state`                                                                            | Office room light, via the display's relay. No dimming. |
| `sensor.shellywallx2i_office_illuminance` | `sensor`   | `state` (lx)                                                                       | The display's own lux sensor.                           |
| `weather.met_office_london`          | `weather`  | `state`, `temperature`, `supported_features`; forecast via `weather.get_forecasts` | Met Office, London. See [Weather](#weather).       |
| `calendar.family`                         | `calendar` | `state`; events via REST                                                           | Shared family calendar. See [Calendars](#calendars).    |
| `calendar.f1`                             | `calendar` | `state`; events via REST                                                           | Formula 1 race weekends.                                |
| `calendar.birthdays`                      | `calendar` | `state`; events via REST                                                           | Yearly all-day birthdays.                               |

## Calendars

Only the three calendars above are shown. HA also has `calendar.calendar` and
three `calendar.octopus_energy_*` entities; the dashboard ignores them.

- **State** is `on` while an event is in progress, else `off`. The attributes
  describe a single event (`message`, `all_day`, `start_time`, `end_time`), so
  they cannot build an agenda.
- **Events** come from `GET /api/calendars/<entity_id>?start=<ISO>&end=<ISO>`,
  fetched with the websocket session's bearer token (`auth.accessToken`)
  from a relative `/api/...` URL. HA serves the page, so that is same-origin;
  `pnpm dev` proxies `/api` to `HA_DEV_URL`, since HA's REST API answers CORS
  preflights from other origins with 403. Each item is
  `{ summary, start, end, description, location, uid, recurrence_id, rrule }`.
  - Timed events: `start` / `end` are `{ dateTime }` with a UTC offset, which
    differs across a clock change (`+01:00`, then `+00:00`).
  - All-day events: `start` / `end` are `{ date }`, and `end` is **exclusive**
    (a one-day event ends the next day).
  - `description` and `location` may be missing, `null` or `""`. F1 descriptions
    are ~1.5 KB of links, so the store keeps only `summary`, `start` and `end`.
- **Order is not guaranteed.** Neither this endpoint nor the `calendar.get_events`
  service sorts or takes a sort option, so the tile sorts by start time.
- F1 summaries are long and carry sponsor names (`🏁 FORMULA 1 SINGAPORE AIRLINES
SINGAPORE GRAND PRIX 2026 - Race`), so the store rewrites them as
  `🏁 F1 Singapore - Race`: the leading emoji, `F1`, the event's `location`
  (clean: `Singapore`, `United States`, ...) and the text after the last `-`.
  Sessions seen in 2026: Practice 1-3, Qualifying, Race, Sprint Qualification and
  Sprint Race. A title that doesn't fit the pattern, or has no location, is kept
  as HA sends it. `location` is read for this only; other calendars are untouched.
- **Health:** a calendar whose entity is missing is a config error and is left out.
  One that is `unavailable` is usually transient, so its cached events stay,
  flagged in the legend. Cached events are badged `stale` once 15 minutes pass
  without a successful refresh.
- HA sends no event when a calendar changes, so the store refetches on
  connect and every 5 minutes, for today and the next 7 days.

## Weather

`weather.forecast_home` (Met.no) also exists but only supports daily and hourly
forecasts, and the Met Office entity reports local observations.

- **State** is the condition (`sunny`, `partlycloudy`, `rainy`, `pouring`, ...).
  The tile maps every HA condition onto the design's eight icons.
- **Attributes** carry `temperature` (`temperature_unit` is `°C`), humidity, wind,
  pressure. There is **no `forecast` attribute**: HA removed it.
- **Forecast** comes from the `weather.get_forecasts` service with
  `{ type: 'hourly' }`, called with `return_response`. The response is
  `{ [entity_id]: { forecast: [{ datetime, condition, temperature, ... }] } }`,
  one item per hour, starting from the current hour, with UTC `datetime`s.
- **`supported_features`** is a bitmask: 1 daily, 2 hourly, 4 twice-daily. Met Office
  reports 7. The store skips the forecast call when the hourly bit is unset.
- HA sends no event when a forecast changes, so the store refetches on entity
  changes, on reconnect, and every 30 minutes.
