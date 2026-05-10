/**
 * NSFW-in-title detection. Port of `PostAnalyzer.contains_nsfw_title()` in
 * the original `autobot/autobot.py`.
 *
 * The behavior preserved here from the source's tests:
 *  - `[NSFW]` -> brackets stripped to spaces -> token `nsfw` -> match.
 *  - `Is this NSFW?` -> `?` stripped -> token `nsfw` -> match.
 *  - `nsfw_title_in_bars` -> underscore is NOT in the strip set ->
 *    one fused token `nsfw_title_in_bars` -> NO match.
 */

const STRIP_CHARS = '{}[]()|.!?$*@#';

export function containsNsfwTitle(title: string): boolean {
  let cleaned = '';
  for (const ch of title) {
    cleaned += STRIP_CHARS.includes(ch) ? ' ' : ch;
  }
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .some((tok) => tok === 'nsfw');
}
