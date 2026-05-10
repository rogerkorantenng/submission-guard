/**
 * Per-paragraph word-cap enforcement. Port of `PostAnalyzer.contains_long_paragraphs()`
 * in the original `autobot/autobot.py`.
 *
 * The original splits on blank lines, two-or-more spaces+newline, or tab+newline,
 * then word-counts each paragraph using `\w+` (so `&` and `--` are not counted).
 * Any single paragraph exceeding the word cap (default 350) flags the post.
 */

const PARAGRAPH_SPLIT = /(?:\n\s*\n|[ \t]{2,}\n|\t\n)/;
const WORD_RE = /\w+/g;

export interface LongParagraphResult {
  offending: { index: number; wordCount: number }[];
}

export function findLongParagraphs(body: string, maxWords = 350): LongParagraphResult {
  const paragraphs = body.split(PARAGRAPH_SPLIT);
  const offending: { index: number; wordCount: number }[] = [];
  paragraphs.forEach((p, i) => {
    const words = p.match(WORD_RE) ?? [];
    if (words.length > maxWords) {
      offending.push({ index: i, wordCount: words.length });
    }
  });
  return { offending };
}
