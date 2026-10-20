import { describe, expect, it } from 'vitest';

import { stripJsonComments } from './jsonc.ts';

const parse = (text: string) => JSON.parse(stripJsonComments(text)) as unknown;

describe('stripJsonComments', () => {
  it('leaves plain JSON untouched', () => {
    const text = '{ "a": [1, 2], "b": "x" }';

    expect(stripJsonComments(text)).toBe(text);
  });

  it('removes line and block comments', () => {
    expect(
      parse(`{
        // where it goes
        "a": 1, /* inline */ "b": 2 // trailing
        /* spans
           lines */
      }`),
    ).toEqual({ a: 1, b: 2 });
  });

  it('keeps comment markers inside strings, escapes included', () => {
    expect(
      parse(
        '{ "url": "https://example.com/a", "c": "/* no */", "q": "a\\"//b" }',
      ),
    ).toEqual({ url: 'https://example.com/a', c: '/* no */', q: 'a"//b' });
  });

  it('keeps line numbers, so a JSON error points at the right line', () => {
    const text = '{\n  // note\n  /* two\n  lines */\n  "a": 1\n}';

    expect(stripJsonComments(text).split('\n')).toHaveLength(6);
  });

  it('copes with an unterminated block comment or string', () => {
    expect(() => parse('{ "a": 1 } /* never closed')).not.toThrow();
    expect(() => parse('{ "a": "open')).toThrow();
  });
});
