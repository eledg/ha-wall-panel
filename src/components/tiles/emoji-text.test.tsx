// @vitest-environment happy-dom
import { render } from 'preact';
import { afterEach, describe, expect, it } from 'vitest';

import { EmojiText } from '@/components/tiles/emoji-text.tsx';

describe('EmojiText', () => {
  afterEach(() => render(null, document.body));

  const emojis = (text: string) => {
    render(<EmojiText text={text} />, document.body);
    return [...document.querySelectorAll('.emoji')].map((e) => e.textContent);
  };

  it('wraps each emoji and keeps the text unchanged', () => {
    expect(emojis('🏁 F1 Monza 🏎️')).toEqual(['🏁', '🏎️']);
    expect(document.body.textContent).toBe('🏁 F1 Monza 🏎️');
  });

  it('keeps joined and skin-tone emoji whole, and ignores digits', () => {
    expect(emojis('👨‍👩‍👧 and 👍🏽 at 10:30')).toEqual(['👨‍👩‍👧', '👍🏽']);
  });

  it('renders plain text with no wrapper', () => {
    expect(emojis('Dentist 2')).toEqual([]);
  });
});
