# Entity inventory

Entity IDs the dashboard uses, added one milestone at a time.

| Entity ID                                                         | Domain          | Attributes read                                                                                                                         | Notes                                                   |
| ----------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `switch.shellywallx2i_office`                                     | `switch`        | `state`                                                                                                                                 | Office room light, via the display's relay. No dimming. |
| `weather.met_office_london`                                       | `weather`       | `state`, `temperature`, `supported_features`; forecast via `weather.get_forecasts`                                                      | Met Office, London. See [Weather](#weather).            |
| `calendar.family`                                                 | `calendar`      | `state`; events via REST                                                                                                                | Shared family calendar. See [Calendars](#calendars).    |
| `calendar.f1`                                                     | `calendar`      | `state`; events via REST                                                                                                                | Formula 1 race weekends.                                |
| `calendar.birthdays`                                              | `calendar`      | `state`; events via REST                                                                                                                | Yearly all-day birthdays.                               |
| `climate.office_climate_air_conditioning_office`                  | `climate`       | `state`, `hvac_modes`, `temperature`, `current_temperature`, `min_temp`, `max_temp`, `target_temp_step`, `fan_mode(s)`, `swing_mode(s)` | Office AC. See [Air conditioning](#air-conditioning).   |
| `switch.office_climate_air_conditioning_office_powerful`          | `switch`        | `state`                                                                                                                                 | AC Powerful boost.                                      |
| `switch.office_climate_air_conditioning_office_economy_mode`      | `switch`        | `state`                                                                                                                                 | AC economy mode.                                        |
| `switch.office_climate_air_conditioning_office_quiet_fan`         | `switch`        | `state`                                                                                                                                 | AC quiet fan.                                           |
| `sensor.blu_ht_office_temperature`                                | `sensor`        | `state`                                                                                                                                 | Office temperature. See [Office](#office-temperature).  |
| `sensor.blu_ht_office_humidity`                                   | `sensor`        | `state`                                                                                                                                 | Office humidity.                                        |
| `sensor.blu_ht_office_battery`                                    | `sensor`        | `state`                                                                                                                                 | Office sensor battery; diagnostics only.                |
| `climate.wireless_temperature_sensor_x`                           | `climate`       | `state`, `temperature`, `current_temperature`, `min_temp`, `max_temp`                                                                   | Central heating (Tado). See [Heating](#heating).        |
| `switch.living_room_schedule`                                     | `switch`        | `state`                                                                                                                                 | Heating control: on follows the schedule.               |
| `binary_sensor.tado_home_heating_demand`                          | `binary_sensor` | `state`                                                                                                                                 | Boiler demand, whole house.                             |
| `binary_sensor.tado_temperature_sensor_x_000000_cloud_connection` | `binary_sensor` | `state`                                                                                                                                 | Tado cloud link; `off` makes the heating unavailable.   |
| `button.living_room_resume_schedule`                              | `button`        | none (press only)                                                                                                                       | Heating: Resume schedule.                               |
| `button.tado_home_boost_all_zones`                                | `button`        | none (press only)                                                                                                                       | Heating: Boost.                                         |

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
  - `description` and `location` may be missing, `null` or `""`; the store keeps
    them only when they hold text. The store reads `summary`, `start`, `end`,
    `location` and `description` and ignores the rest. The detail sheet shows
    the full title, the times, the `location` and the description as notes.
  - F1 descriptions are the same ~1.5 KB of promotional links on every event, so
    the store drops the description for that calendar and the sheet shows no notes.
- **Order is not guaranteed.** Neither this endpoint nor the `calendar.get_events`
  service sorts or takes a sort option, so the tile sorts by start time.
- F1 summaries are long and carry sponsor names (`🏁 FORMULA 1 SINGAPORE AIRLINES
SINGAPORE GRAND PRIX 2026 - Race`), so the store rewrites them as
  `🏁 F1 Singapore - Race`: the leading emoji, `F1`, the event's `location`
  (clean: `Singapore`, `United States`, ...) and the text after the last `-`.
  Sessions seen in 2026: Practice 1-3, Qualifying, Race, Sprint Qualification and
  Sprint Race. A title that doesn't fit the pattern, or has no location, is kept
  as HA sends it. Other calendars' titles are untouched. The detail sheet shows the title in full, as HA sends it.
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
  `{ [entity_id]: { forecast: [{ datetime, condition, temperature, precipitation_probability, ... }] } }`,
  one item per hour, starting from the current hour, with UTC `datetime`s.
- **`supported_features`** is a bitmask: 1 daily, 2 hourly, 4 twice-daily. Met Office
  reports 7. The store skips the forecast call when the hourly bit is unset.
- HA sends no event when a forecast changes, so the store refetches on entity
  changes, on reconnect, and every 30 minutes.

## Air conditioning

The office unit is the only one shown; the master bedroom has its own climate
entity, which the dashboard ignores. The tile (`components/tiles/ac-tile.tsx`) opens a control
sheet (`ac-sheet.tsx`).

- **State** is the HVAC mode: `off`, `cool`, `heat`, `fan_only`, `dry` or `auto`.
  The sheet's power button uses `climate.turn_on` / `climate.turn_off`; the mode
  picker lists `hvac_modes` without `off`.
- **Attributes** read: `temperature` (the target), `current_temperature`,
  `min_temp` (16), `max_temp` (30), `target_temp_step` (0.5), `fan_mode` /
  `fan_modes` (`Quiet`, `low`, `medium`, `high`, `auto`) and `swing_mode` /
  `swing_modes` (`Vertical Swing`, `Highest`, `High`, `Low`, `Lowest`). The
  limits and step are never shown: they only stop the − / + buttons. The
  remaining attributes (`indoor_tmp: "7400"`, `set_tmp`, ...) are the unit's
  raw values in odd units; ignore them.
- **Services** (`supported_features` 425): `turn_on`, `turn_off`,
  `set_hvac_mode`, `set_temperature`, `set_fan_mode`, `set_swing_mode`. No
  presets or humidity. Rapid − / + taps are sent as one `set_temperature`.
- **Swing** is one setting with two kinds of value: `Vertical Swing` sweeps the
  flap, the other four hold it at a fixed height. The picker labels the first
  `Swing`.
- **Switches** Powerful, Economy and Quiet are separate `switch` entities. HA
  also has `..._power` (duplicates the climate on/off), `..._energy_saving_fan`,
  `..._indoor_led` and outdoor / indoor temperature sensors; the dashboard
  ignores them (the indoor sensor repeats `current_temperature`).

## Office temperature

The Office tile (`components/tiles/temperature-tile.tsx`) reads a Shelly BLU H&T sensor:
`sensor.blu_ht_office_temperature` (shown to one decimal) and
`sensor.blu_ht_office_humidity` (whole percent, with a droplet, above the
temperature). A missing, `unavailable` or non-numeric
temperature shows "— n/a"; an unusable humidity shows "—" and leaves the
temperature alone. `sensor.blu_ht_office_battery` is subscribed too, but only so the diagnostics
screen lists it (`100 %`); no tile shows it.

## Heating

The Heating tile (`components/tiles/heating-tile.tsx`) and its sheet
(`heating-sheet.tsx`) show the **whole-house** Tado heating. The tile shows the
target (or "Off"), with no humidity, as in the design; the sheet shows the living
room Tado sensor's temperature, the room the heating controls.

Two signals, kept separate (`heating-model.ts`):

| State    | Power (`climate.wireless_temperature_sensor_x`) | Control (`switch.living_room_schedule`) |
| -------- | ----------------------------------------------- | --------------------------------------- |
| Schedule | `heat`                                          | `on`                                    |
| Manual   | `heat`                                          | `off`                                   |
| Off      | `off`                                           | `off`                                   |
| Paused   | `off`                                           | `on`                                    |

- **Control comes from the schedule switch**, not `sensor.living_room_zone_mode`:
  after switching off by hand the zone mode lags the switch by ~4 s and would show
  a false "Paused".
- **Paused** is Tado's automatic ~15-minute shut-off (probably open-window
  detection, unconfirmed). The UI says "Paused" and never a cause or countdown.
- **Demand** (`binary_sensor.tado_home_heating_demand`) is home-wide and drives the
  heat-waves icon alone: filled when `on`, outlined when `off`, in every state. In
  Schedule or Manual the target can be reached with no demand, so a lit tile with
  outlined waves is correct.
- **Unavailable**: the climate or schedule entity unusable, or
  `binary_sensor.tado_temperature_sensor_x_000000_cloud_connection` `off`. The cloud
  link drops without an error, so this is the only signal that the data is stale.
- **Services**: power is `climate.set_hvac_mode` (`heat` / `off`); the target is
  `climate.set_temperature` (5 to 30, 0.5 steps; the entity has no
  `target_temp_step`), with rapid taps sent as one call. Resume is `button.press`
  on `button.living_room_resume_schedule` and Boost on
  `button.tado_home_boost_all_zones`. The buttons stay `unknown` after a press, so
  the sheet's pending state is a short local timer, and Boost shows no state.
- **Resume** is enabled in Manual and Off (`canResume`). Whether Resume from Off
  returns to the schedule is **untested** (`docs/Next steps.md`, open question 1).
  Boost is enabled whenever heating is on.
- **Demand history** is read from `/api/history/period` when the sheet opens and
  every minute while it is open (`services/ha/history.ts`). An empty or failed first read
  shows "No demand history available"; a failed refresh keeps the last bars.
- The controls come from the **Tado Hijack** custom integration (the core Tado
  integration doesn't support Tado X). Tado's cloud API allows 20,000 calls a day, so
  the dashboard doesn't poll.
