# Entity inventory

Entity IDs the dashboard uses, added one milestone at a time.

| Entity ID                                 | Domain    | Attributes read                                                                    | Notes                                                   |
| ----------------------------------------- | --------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `switch.shellywallx2i_office`             | `switch`  | `state`                                                                            | Office room light, via the display's relay. No dimming. |
| `sensor.shellywallx2i_office_illuminance` | `sensor`  | `state` (lx)                                                                       | The display's own lux sensor.                           |
| `weather.met_office_london`          | `weather` | `state`, `temperature`, `supported_features`; forecast via `weather.get_forecasts` | Met Office, London. See [Weather](#weather).       |

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
