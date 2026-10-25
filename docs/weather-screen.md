# Weather screen

Tapping the weather tile opens a full-screen sheet (`components/sheets/weather-sheet.tsx`),
built like the heating and AC sheets on `ClimateSheet`. It is read-only: no
sliders, one Close button, and it closes after 30 s without a touch. The layout
is the Lovable design's, filled with the fields HA really gives
([entities.md](entities.md#weather)).

- **Left:** the current temperature, condition and today's high and low, then
  stat boxes: feels like, humidity, wind (with compass point and a direction
  arrow), gusts, UV index, pressure, visibility, dew point, sunrise and sunset.
- **Right:** the next five 3-hourly periods (icon, temperature, rain chance, and
  rain in mm when above zero), and the week with a temperature-range bar per day.

## Settings

A weather tile's `details` object sets how many days, which hours and which stats
the screen shows (`days`, `hoursStep`, `hoursCount`, `stats`); see
[configuration.md](configuration.md#tiles). Without it the screen is as drawn
above: 7 days, 5 columns 3 hours apart, and every stat the source reports. The
settings are read by `parseWeatherSheet` in `src/config/load.ts` and applied in
`weather-sheet.tsx`. Only the screen follows them; the tile's strip stays at
5 columns, 3 hours apart.

## Rules it follows

- A figure appears only when the entity or forecast reports it. A box with no
  data is left out, never shown as zero; a `null` rain amount is "no data".
- Wind and the other units are HA's own (`*_unit`), not converted.
- Hourly only: no week. Daily only: no hours. Neither: current conditions only.
- Offline, the last data stays, dimmed and marked stale.
- Sunrise and sunset need the optional `sun` role on the tile.
- The forecasts are refetched on open when over 10 minutes old
  (`store.refreshWeather`).

## Where things are

| What                                        | Where                               |
| ------------------------------------------- | ----------------------------------- |
| Reading and picking the data, compass, bars | `src/lib/weather-model.ts`          |
| Hourly and daily fetch, `refreshWeather`    | `src/services/ha/store.ts`          |
| Mock scenarios in HA's real shape           | `src/dev/mock/scenarios/weather.ts` |

## Not included

Radar, alerts, air quality, pollen, history, a 24 hour chart, wind unit
conversion, switching location.
