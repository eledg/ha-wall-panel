# Entity inventory

Entity IDs the dashboard uses, added one milestone at a time.

| Entity ID                                 | Domain   | Attributes read | Notes                                                   |
| ----------------------------------------- | -------- | --------------- | ------------------------------------------------------- |
| `switch.shellywallx2i_office`             | `switch` | `state`         | Office room light, via the display's relay. No dimming. |
| `sensor.shellywallx2i_office_illuminance` | `sensor` | `state` (lx)    | The display's own lux sensor.                           |
