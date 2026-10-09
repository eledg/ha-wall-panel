/** Marks an entity ID that hasn't been confirmed yet (see #13). */
export const PLACEHOLDER_PREFIX = 'TODO:';

export const placeholder = (what: string) => `${PLACEHOLDER_PREFIX}${what}`;

export type EntityDomain = 'sensor' | 'switch';

type EntitySpec = { domain: EntityDomain; id: string };

const spec = (domain: EntityDomain, id: string): EntitySpec => ({ domain, id });

/** Only the entities Milestone 1 needs; add to this each milestone. */
export const config = {
  entities: {
    /** Office light, via the display's relay. A plain switch: no dimming. */
    officeLight: spec('switch', 'switch.shellywallx2i_office'),
    /** The display's own lux sensor. */
    officeIlluminance: spec(
      'sensor',
      'sensor.shellywallx2i_office_illuminance',
    ),
  },
} as const satisfies { entities: Record<string, EntitySpec> };

export type Config = {
  entities: Record<string, EntitySpec>;
};

export type ConfigIssue = { key: string; message: string };

const ENTITY_ID = /^([a-z_]+)\.([a-z0-9_]+)$/;

/** Returns one issue per missing, placeholder or malformed entity. */
export const validateConfig = (cfg: Config = config): ConfigIssue[] =>
  Object.entries(cfg.entities).flatMap(
    ([key, { domain, id }]): ConfigIssue[] => {
      if (id.trim() === '') return [{ key, message: 'entity ID is missing' }];
      if (id.startsWith(PLACEHOLDER_PREFIX))
        return [{ key, message: 'entity ID is still a placeholder' }];
      const match = ENTITY_ID.exec(id);
      if (!match) return [{ key, message: `"${id}" is not a valid entity ID` }];
      if (match[1] !== domain)
        return [{ key, message: `"${id}" should be in the ${domain} domain` }];
      return [];
    },
  );
