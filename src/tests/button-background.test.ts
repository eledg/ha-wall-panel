import { describe, expect, it } from 'vitest';

/**
 * The wall display paints a `<button>` with no opaque background as the
 * browser's default grey, and `bg-transparent` does not override it (see
 * docs/display.md, "Buttons get a default grey background"). Dev and the
 * screenshot baseline cannot show this, so check the source instead: every
 * `<button>` must carry an opaque `bg-*` utility.
 */
const sources = import.meta.glob<string>(['../**/*.tsx', '!../**/*.test.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

const OPAQUE_BG = /(?<![\w:/-])bg-(?!transparent\b)[a-z][\w-]*(?![\w/-])/;

/** Opening tags of every `<button ...>`, ignoring `>` inside `{...}` and strings. */
const openingTags = (source: string) => {
  const tags: string[] = [];
  for (const match of source.matchAll(/<button\b/g)) {
    let depth = 0;
    let i = match.index;
    for (; i < source.length; i++) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && source[i - 1] !== '=') break;
    }
    tags.push(source.slice(match.index, i + 1));
  }
  return tags;
};

/** Source of `const NAME = ...` declarations, so classes held in constants resolve. */
const declarations = (all: string[]) => {
  const map = new Map<string, string>();
  for (const source of all) {
    for (const m of source.matchAll(
      /(?:const|let)\s+(\w+)\s*=\s*([\s\S]*?);\n/g,
    )) {
      map.set(m[1], m[2]);
    }
  }
  return map;
};

const decls = declarations(Object.values(sources));

/** The text plus the definitions of any constants or helpers it mentions, recursively. */
const expand = (text: string, seen = new Set<string>()): string => {
  let out = text;
  for (const [id] of text.matchAll(/\b\w+\b/g)) {
    if (seen.has(id) || !decls.has(id)) continue;
    seen.add(id);
    out += ` ${expand(decls.get(id)!, seen)}`;
  }
  return out;
};

describe('button backgrounds', () => {
  const found = Object.entries(sources).flatMap(([file, source]) =>
    openingTags(source).map((tag) => ({ file, tag })),
  );

  it('finds the buttons', () => {
    expect(found.length).toBeGreaterThan(5);
  });

  it.each(found.map(({ file, tag }) => [file, tag] as const))(
    '%s: has an opaque background',
    (file, tag) => {
      expect(
        OPAQUE_BG.test(expand(tag)),
        `${file}: <button> needs an opaque bg-* class (e.g. bg-bg, bg-surface); ` +
          `see docs/display.md "Buttons get a default grey background".\n${tag}`,
      ).toBe(true);
    },
  );
});
