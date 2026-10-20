import type { ComponentChild } from 'preact';

const EMOJI =
  /\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/gu;

/**
 * Text with each emoji wrapped in `.emoji`, so the palette can tone it down
 * (src/index.css). Colour emoji ignore the text colour and look glaring beside
 * the dark theme, especially at night.
 */
export const EmojiText = ({ text }: { text: string }) => {
  const nodes: ComponentChild[] = [];
  let end = 0;
  for (const { 0: emoji, index } of text.matchAll(EMOJI)) {
    if (index > end) nodes.push(text.slice(end, index));
    // Keyed by offset in the text: it names the emoji and never shifts.
    nodes.push(
      <span key={index} class="emoji">
        {emoji}
      </span>,
    );
    end = index + emoji.length;
  }
  if (end < text.length) nodes.push(text.slice(end));
  return <>{nodes}</>;
};
