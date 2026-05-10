/**
 * Code-block detection. Port of `PostAnalyzer.contains_codeblocks()` in the
 * original `autobot/autobot.py`.
 *
 * Same paragraph split as `longParagraphs.ts`. A paragraph is flagged as a
 * code block if (after skipping whitespace-only paragraphs) it starts with 4+
 * spaces OR -- after left-stripping spaces only -- starts with a tab. So
 * "   \t..." (3 spaces then tab) is flagged.
 */

const PARAGRAPH_SPLIT = /(?:\n\s*\n|[ \t]{2,}\n|\t\n)/;

export function containsCodeBlocks(body: string): boolean {
  const paragraphs = body.split(PARAGRAPH_SPLIT);
  for (const p of paragraphs) {
    if (p.trim() === '') continue;
    if (p.startsWith('    ')) return true;
    if (p.replace(/^ +/, '').startsWith('\t')) return true;
  }
  return false;
}
