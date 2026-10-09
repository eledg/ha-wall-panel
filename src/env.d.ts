interface ImportMetaEnv {
  /** HA base URL for local dev, e.g. http://192.168.1.100:8123. */
  readonly VITE_HA_URL?: string;
  /** Long-lived access token. Only read in dev; never baked into a release. */
  readonly VITE_HA_TOKEN?: string;
}
