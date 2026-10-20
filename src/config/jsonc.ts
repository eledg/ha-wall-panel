/**
 * Blanks out line (`//`) and block (slash-star) comments so `config.json` can be annotated. Text
 * inside strings is left alone (a URL's `//` is not a comment). Comments become
 * spaces and newlines stay, so a JSON error still points at the right line.
 * Anything else, trailing commas included, is the parser's business.
 */
export const stripJsonComments = (text: string) => {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text[i]!;
    const pair = text.slice(i, i + 2);
    if (char === '"') {
      const start = i;
      i++;
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1;
      i++;
      out += text.slice(start, i);
    } else if (pair === '//') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (pair === '/*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += char;
      i++;
    }
  }
  return out;
};
