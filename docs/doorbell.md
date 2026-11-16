# Doorbell: what Home Assistant provides

Findings from a UniFi G6 Entry doorbell with a UniFi Access Hub, read from Home
Assistant on 2026-11-15, the day they were installed. They shape the planned
doorbell overlay (the `domain:doorbell` issues). Nothing here is built yet.
Other doorbells will differ; the [checklist](#checking-another-doorbell) at the
end says what to look at.

Entity IDs below are shortened to `<entry>` (the G6 Entry's Protect device) and
`<hub>` (the Access Hub). Yours depend on the names and areas in UniFi and HA.

## Two integrations, one door

The G6 Entry is adopted by **UniFi Protect**, which provides the camera, the ring
and detections. The Access Hub, which drives the lock, comes in through the
separate **UniFi Access** integration as its own device. HA does not link the
two, so the panel has to be told about both.

| What             | Entity                                                  | Integration | Notes                                                        |
| ---------------- | ------------------------------------------------------- | ----------- | ------------------------------------------------------------ |
| Ring             | `event.<entry>_doorbell`                                | Protect     | The one to use. See [Ring](#ring).                           |
| Ring (Access)    | `event.<hub>_doorbell`                                  | Access      | Did not fire for a ring at the G6 Entry. Do not rely on it.  |
| Camera           | `camera.<entry>_medium_resolution_channel`              | Protect     | 720 x 960, about 4 Mbps. Best fit for a small display.       |
| Camera (high)    | `camera.<entry>_high_resolution_channel`                | Protect     | 1920 x 2560, 16 Mbps. Too heavy for the display.             |
| Package camera   | `camera.<entry>_package_camera`                         | Protect     | 3264 x 2448 at 3 fps, pointing down at the step.             |
| Package          | `event.<entry>_package`                                 | Protect     | `event_type: detected`.                                      |
| Unlock           | `button.<hub>_unlock`                                   | Access      | Only does something if a lock is wired to the hub.           |
| Door position    | `binary_sensor.<hub>`                                   | Access      | Needs a door contact on the hub; without one it stays `off`. |
| Access log       | `event.<hub>_access`                                    | Access      | `access_granted` / `access_denied`, with `actor`.            |
| Last visitor     | `image.<hub>_thumbnail`                                 | Access      | Updated on access events.                                    |
| Lock rule        | `select.<hub>_lock_rule`                                | Access      | `keep_lock`, `keep_unlock`, `custom`, `reset`.               |
| Doorbell speaker | `media_player.<entry>_speaker`                          | Protect     | Can play media or TTS at the door.                           |
| Indoor chime     | `button.<chime>_play_chime`, `sensor.<chime>_last_ring` | Protect     | Only with a UniFi Smart PoE Chime, which rings on its own.   |

## Ring

`event.<entry>_doorbell` is an [event entity](https://www.home-assistant.io/integrations/event/):

- `event_types: ["ring"]`, `device_class: doorbell`.
- The **state is the time of the last ring** (ISO 8601), not `on`/`off`. Before
  the first ring after a restart it is `unknown`; while Protect reconnects it is
  `unavailable`, then `unknown` again.
- A ring is a `state_changed` whose new state is a timestamp different from the
  old one. The initial state sent on connect is **not** a ring: it is the last
  ring, possibly hours ago. Reconnects resend it too.
- **One press fired two events** about 160 ms apart, each with its own
  `event_id`. Debounce rings for a few seconds.
- Each event carries an `event_id` attribute (Protect's event).

## Camera

- **The image is portrait** (3:4, taller than wide). A landscape display such as
  the X2i (944 x 459 CSS px) fits it at about 344 x 459, leaving the rest of the
  screen for controls. Do not crop it to landscape: the G6 Entry's view is the
  person at the door.
- `supported_features: 2` (stream), so RTSPS is enabled in Protect and HA can
  stream it. HA's built-in **go2rtc** integration is loaded (it is part of
  `default_config` since 2024.11).
- **Snapshot:** `entity_picture` gives
  `/api/camera_proxy/<entity_id>?token=<access_token>`. It needs no login, and
  returned a JPEG at the channel's size.
- **MJPEG:** `/api/camera_proxy_stream/<entity_id>?token=<access_token>`. Protect
  does not provide its own MJPEG stream, so HA's default builds one from repeated
  snapshots (to be measured; expect a low frame rate).
- **WebRTC:** HA brokers it over the WebSocket connection the panel already has:
  `camera/webrtc/get_client_config` for ICE servers, then `camera/webrtc/offer`
  and `camera/webrtc/candidate`. go2rtc sends the media straight to the
  browser, so the display must be able to reach the HA host on go2rtc's WebRTC
  port (its config, generated by HA, says which) as well as on 8123.
- **The access token rotates** (about every 5 minutes), so build URLs from the
  current `access_token` attribute, not a saved one.
- At night the camera switches to infrared, so the picture is greyscale.

## Waking the display

On the X2i, HA's Shelly integration exposes `button.<display>_turn_on_the_screen`
and `button.<display>_turn_off_the_screen`. An HA automation that presses the
first on a ring wakes a blanked screen without a `rest_command` or RPC call.
The panel's own night dimming is separate: the panel must undim itself on a ring.

## Checking another doorbell

1. Find the ring entity. An `event` entity with `device_class: doorbell` is the
   usual shape; some integrations use a `binary_sensor` that turns `on` for a
   moment instead.
2. Ring it a few times and look at the history: how many state changes per
   press, and what the state looks like.
3. Pick the camera channel nearest the display's size, and check its
   orientation.
4. Check `supported_features` on the camera: without `2` there is no stream, only
   snapshots.
5. If a lock is involved, find its unlock entity and how the result is reported.

## Answered or missed?

Nothing here says whether a ring was answered: opening the door, answering on a
phone or hearing the chime never reaches HA. The Access Hub's door input would
show the door opening, but only with a door contact wired to it (here it stayed
`off` all evening, through people coming and going). So the panel can show when
the door last rang, not whether anyone went to it.
