/** Where the string starting at `start` ends, escapes included (or the end of the text). */
const stringEnd = (text: string, start: number) => {
  let i = start + 1;
  while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
  return i + 1;
};

const lineEnd = (text: string, start: number) => {
  const newline = text.indexOf('\n', start);
  return newline === -1 ? text.length : newline;
};

const blockEnd = (text: string, start: number) => {
  const end = text.indexOf('*/', start + 2);
  return end === -1 ? text.length : end + 2;
};

/** Spaces in place of everything but newlines, so line numbers hold. */
const blank = (text: string) => text.replace(/[^\n]/g, ' ');

/**
 * Blanks out line (`//`) and block (slash-star) comments so `config.json` can
 * be annotated. Text inside strings is left alone (a URL's `//` is not a
 * comment). Comments become spaces and newlines stay, so a JSON error still
 * points at the right line. Anything else, trailing commas included, is the
 * parser's business.
 */
export const stripJsonComments = (text: string) => {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const pair = text.slice(i, i + 2);
    let end = i + 1;
    if (text[i] === '"') {
      end = stringEnd(text, i);
      out += text.slice(i, end);
    } else if (pair === '//') {
      end = lineEnd(text, i);
      out += blank(text.slice(i, end));
    } else if (pair === '/*') {
      end = blockEnd(text, i);
      out += blank(text.slice(i, end));
    } else {
      out += text[i];
    }
    i = end;
  }
  return out;
};
