/** How far apart the two events of one press arrive, as seen from a G6 Entry. */
export const DOUBLE_FIRE_MS = 160;

/** The ring entity's attributes, as UniFi Protect gives them. */
export const ringAttributes = (eventType?: string) => ({
  device_class: 'doorbell',
  event_types: ['ring'],
  ...(eventType === undefined
    ? {}
    : { event_type: eventType, event_id: crypto.randomUUID() }),
});

/** A portrait 3:4 stand-in for the camera's snapshot, like the G6 Entry's. */
export const placeholder =
  () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 1024">
<rect width="768" height="1024" fill="#2a2f36"/>
<rect x="234" y="180" width="300" height="720" rx="8" fill="#3b424b"/>
<circle cx="480" cy="560" r="12" fill="#8a929c"/>
<rect y="900" width="768" height="124" fill="#1f2328"/>
<text x="384" y="110" fill="#8a929c" font-family="sans-serif" font-size="40" text-anchor="middle">Mock camera</text>
</svg>`;

/**
 * A landscape 4:3 stand-in for the package camera, which looks down at the
 * step from above the door: a mat, a parcel, and the door frame along one edge.
 */
export const packagePlaceholder =
  () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768">
<rect width="1024" height="768" fill="#3a352f"/>
<rect width="1024" height="70" fill="#22262b"/>
<rect x="282" y="250" width="460" height="300" rx="12" fill="#4a4038"/>
<rect x="560" y="300" width="150" height="120" rx="6" fill="#a07a4f"/>
<rect x="560" y="352" width="150" height="16" fill="#c9a77a"/>
<text x="512" y="700" fill="#8a929c" font-family="sans-serif" font-size="40" text-anchor="middle">Mock package camera</text>
</svg>`;

/**
 * The token that makes the mock's camera stream fail (HTTP 500), so the
 * overlay's snapshot fallback can be seen.
 */
export const FAILING_TOKEN = 'fail';

/** The token that makes both the stream and the snapshot fail (HTTP 500). */
export const DEAD_TOKEN = 'dead';

/**
 * The camera entity's attributes. The token lets the panel stream from the
 * dev server (`dev-ha.ts`); `entity_picture` is a placeholder image.
 */
export const cameraAttributes = (token = 'mock') => ({
  access_token: token,
  entity_picture: `data:image/svg+xml,${encodeURIComponent(placeholder())}`,
  friendly_name: 'Front door',
});

/** The package camera entity's attributes, like the main camera's. */
export const packageCameraAttributes = (token = 'mock') => ({
  access_token: token,
  entity_picture: `data:image/svg+xml,${encodeURIComponent(packagePlaceholder())}`,
  friendly_name: 'Front door package camera',
});
