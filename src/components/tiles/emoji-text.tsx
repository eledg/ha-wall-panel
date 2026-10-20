const EMOJI =
  /(\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*)/u;

/**
 * Text with each emoji wrapped in `.emoji`, so the palette can tone it down
 * (src/index.css). Colour emoji ignore the text colour and look glaring beside
 * the dark theme, especially at night.
 */
export const EmojiText = ({ text }: { text: string }) => (
  <>
    {text.split(EMOJI).map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} class="emoji">
          {part}
        </span>
      ) : (
        part
      ),
    )}
  </>
);
