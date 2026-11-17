# Doorbell: what Home Assistant provides

Findings from a UniFi G6 Entry doorbell with a UniFi Access Hub, read from Home
Assistant on 2026-11-15, the day they were installed. They shape the planned
doorbell overlay (the `domain:doorbell` issues). The door tile and ring
detection are built ([entities.md](entities.md#doorbell)); the overlay is
described below.
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
- **WebRTC:** see [WebRTC](#webrtc) below.
- **The access token rotates** (about every 5 minutes), so build URLs from the
  current `access_token` attribute, not a saved one.
- At night the camera switches to infrared, so the picture is greyscale.

## Package camera

`camera.<entry>_package_camera` is a second camera on the same device:

- **Landscape 4:3**, 3264 x 2448, at **3 fps** and about 1.25 Mbps, unlike the
  main camera's portrait 3:4, so the two need different boxes.
- It looks straight down at the doorstep and mat from above the door, wide-angle,
  with the door frame along one edge. Colour by day.
- `supported_features: 2` (stream), and the usual `access_token` and `entity_picture`.
- **Scaling.** A full-size snapshot is far too large to fetch every few seconds on the
  display. `/api/camera_proxy/<entity>?token=…&width=…&height=…` makes HA scale the
  JPEG down, but only when both `width` and `height` are given and the camera serves
  JPEG. Ask for about twice the box's CSS size.

## WebRTC

HA brokers WebRTC over the WebSocket connection the panel already has; the panel
never talks to go2rtc's API (HA's built-in go2rtc only listens on localhost for
it). The messages, as HA 2026.11.1 sends them for the G6 Entry (the same ones HA's
own frontend uses; `src/services/ha/webrtc.ts`):

1. `{type: "camera/capabilities", entity_id}` returns
   `{frontend_stream_types: ["hls", "web_rtc"], two_way_audio: false}`. Without
   `web_rtc` there is no WebRTC.
2. `{type: "camera/webrtc/get_client_config", entity_id}` returns
   `{configuration: {iceServers: [{urls: ["stun:stun.home-assistant.io:3478", "stun:stun.home-assistant.io:80"]}]}}`,
   the `RTCConfiguration` for the peer connection.
3. `{type: "camera/webrtc/offer", entity_id, offer: <SDP>}` is a subscription. Its
   events are `{type: "session", session_id}` first, then `{type: "answer", answer: <SDP>}`
   and `{type: "candidate", candidate: {candidate, sdpMLineIndex}}`, or
   `{type: "error", code, message}`, for example
   `go2rtc_webrtc_offer_failed`.
4. `{type: "camera/webrtc/candidate", entity_id, session_id, candidate}` sends each
   local candidate. Candidates found before the `session` event wait for it, and
   HA's candidates wait until the answer is applied.

The panel offers receive-only video (`recvonly`, no audio), so the browser never
asks for the microphone.

- **Codec.** The G6 Entry's stream is **H.265**, and go2rtc does not transcode it. A
  browser that cannot receive H.265 over WebRTC gets
  `codecs not matched: audio:AAC, audio:OPUS, video:H265 => video:VP8, video:VP9, video:H264, video:AV1`
  and the panel falls back to MJPEG within a second. Desktop Google Chrome on a Mac
  played it (720 x 960, first frame in under a second); Playwright's bundled
  Chromium did not. Whether the display's browser can is for the on-device test.
- **Network.** The video goes from go2rtc on the HA host straight to the display,
  not through port 8123. Its candidates offered **TCP 18555** (passive) and UDP on
  ephemeral ports, on each of the host's addresses, plus a STUN-derived public
  address. If the display and HA are on different VLANs, allow the display to
  reach the HA host on TCP 18555 (and UDP, for the lower-latency path); otherwise
  WebRTC finds no route, shows no frame, and the panel falls back to MJPEG.

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
`off` all evening, even after the exit button was pressed). So the panel can show when
the door last rang, not whether anyone went to it.

## The overlay

A ring, or a tap on the door tile, opens `DoorbellOverlay`
(`src/components/doorbell/doorbell-overlay.tsx`) over everything: the sheets,
diagnostics and the night dimming. It is `z-50`, above the `z-40` wake overlay.

- The camera is on the left (portrait 3:4, `object-contain`), shown as the door tile's
  `liveView` says (`camera-feed.tsx`); the default is `webrtc`. The token is read from
  the entity each time the overlay opens, because HA rotates it about every 5 minutes.
  A badge shows the state: "Connecting" until the first frame, "● Live" on video,
  "Snapshot mode" on the fallback.
  - **WebRTC** ([above](#webrtc)): the snapshot shows until the video's first decoded
    frame. If WebRTC is unsupported, HA refuses the offer, the connection fails, or no
    frame arrives within 5 s (`WEBRTC_FRAME_MS`), the peer connection is closed and the
    picture moves on to MJPEG. Closing the overlay closes the peer connection.
  - **MJPEG:** HA's stream, `/api/camera_proxy_stream/<camera>?token=<access_token>`,
    in an `<img>`. If it errors, or shows no frame within 5 s, the picture falls back
    to `/api/camera_proxy/<camera>`, refreshed every second. A stream that stalls after
    its first frame is not detected (an `<img>` reports no per-frame event). Closing the
    overlay empties the image's `src`, so the browser drops the connection.
  - **Snapshot:** `liveView: "snapshot"` starts with the refreshed snapshot.

  There is no greyscale filter: the camera sends greyscale frames itself when it
  switches to infrared. In `pnpm dev:mock` the door panel's WebRTC chips make the
  mock camera stream (a canvas sent over a second, in-page peer connection),
  lack WebRTC, refuse the offer or never answer.

- **Failures.** A ring always opens the overlay. If the camera is `unavailable` or
  missing (whatever stale token it keeps), or the snapshot fails too, the feed is
  `failed`: "Camera unavailable" with a Retry button, which reads the token again and
  restarts the stream. If a frame had loaded, it stays dimmed behind the message with
  "Last frame 12s ago" (a canvas copy, so it outlives the rotating token). A ring entity
  `unavailable` for more than 3 minutes (`RING_UNAVAILABLE_MS`) is flagged in diagnostics;
  a missing or wrong-domain ring or camera is a config warning like any other role.
  With HA disconnected no ring arrives and the existing banner says so.
- On the right: "Doorbell", the door's label, "Rang at 14:32" while the ring is
  recent (30 minutes) or "Live view" if not, the auto-close countdown and Dismiss.
  On a narrow screen the camera stacks above them.
- It closes after the door tile's `timeoutSeconds` (default 45), on Dismiss, on
  a tap on the picture, or on Escape. A new ring while it is open restarts the countdown.
- **Dismiss clears the tile's ring.** Someone at the panel has seen it, so the
  door tile goes back to the camera badge; closing by timeout, a tap on the picture or
  Escape leaves "Rang 14:32" until `recentMinutes` runs out. The dismissed ring's time is
  kept in `localStorage` (`ha-wall-panel:door-dismissed:<tile id>`, see
  `src/lib/door-dismissed.ts`) and any ring at or before it stays hidden, so a reload
  neither brings it back nor loses an undismissed one (the time comes from the ring
  entity). If storage fails, the ring shows again after a reload.
- While open it sets `data-blocks-reload`, so auto-reload waits.
- **Package camera.** With the door tile's `packageCamera`, a 4:3 still sits beside
  the heading ("Doorstep · Still"; `package-camera.tsx`). It is a refreshing snapshot,
  not a stream: at 3 fps there is little motion to see, and a second live stream
  would compete with the main one for the display's CPU.
  - It loads only after the main camera's first picture (or its failure), so the
    visitor's picture is never slowed by it.
  - It is fetched [scaled](#package-camera) (480 x 360 in the inset, 1280 x 960
    enlarged) with the current token, then again 2 s (`PACKAGE_REFRESH_MS`) after
    each fetch finishes, so requests never overlap. Closing the overlay stops it and
    aborts the request in flight.
  - Until the first still a camera icon shows. If the entity is unavailable or a fetch
    fails it reads "Package camera unavailable" and keeps trying; the main feed is not
    touched. A still older than 10 s shows "Updated 14:32:05".
  - A tap on it swaps the two: the package camera becomes the large picture and the
    visitor a small "Visitor" thumbnail, which a tap swaps back. The boxes change
    places by their classes alone, so the live view is not restarted. The countdown
    keeps running, and a new ring goes back to the visitor.
