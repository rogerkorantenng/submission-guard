/**
 * Title-tag whitelist enforcement. Port of `PostAnalyzer.categorize_tags()`
 * in the original `autobot/autobot.py`.
 *
 * The original captures every bracketed segment in the title -- square
 * brackets, parens, braces, pipes -- and case-insensitively `re.fullmatch`es
 * each against a whitelist of allowed patterns. Any unmatched segment is
 * flagged.
 *
 * Same regex behavior is preserved here. Notable subtleties from the
 * source's tests (`autobot/tests/test_bot.py`):
 *
 *  - `Update#3` with a hash and no space is NOT valid -- the regex requires
 *    optional space then optional `#`.
 *  - `update1` (no space, no hash) is NOT valid -- the digits must be
 *    space-separated.
 *  - `Part 1 of 2` style is NOT valid -- "of N" suffix isn't in the schema.
 *  - "fifteen" through "nineteen" (text numbers) ARE valid; "oneteen" is not.
 *  - "final" / "finale" sets isFinal AND isSeries.
 *  - "vol", "vol.", "volume" + space + number is valid.
 *
 * Regex preserved verbatim from the Python source so behavior matches.
 */

const TEXT_NUMBERS = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)';
const NUMBER = `(?:\\d+|${TEXT_NUMBERS})`;

const BUILTIN_PATTERNS: { name: string; pattern: RegExp; isSeries?: boolean; isFinal?: boolean }[] = [
  { name: 'number-only', pattern: new RegExp(`^${NUMBER}$`, 'i') },
  { name: 'part', pattern: new RegExp(`^(?:part|pt\\.?)\\s?${NUMBER}$`, 'i'), isSeries: true },
  { name: 'volume', pattern: new RegExp(`^vol(?:\\.|ume)?\\s${NUMBER}$`, 'i'), isSeries: true },
  { name: 'update', pattern: new RegExp(`^update(?:\\s#?${NUMBER})?$`, 'i'), isSeries: true },
  { name: 'final', pattern: /^finale?$/i, isSeries: true, isFinal: true },
];

/** Capture every bracketed segment from the title (square, paren, brace, pipe). */
const BRACKET_RE = /(\[[^\]]*\]|\(.*?\)|\{.*?\}|\|.*?\|)/g;

/** Strip the outer bracket characters so the inner content can be matched. */
function stripBrackets(segment: string): string {
  return segment.replace(/^[[\]{}|()]+|[[\]{}|()]+$/g, '').trim();
}

export interface TitleTagsResult {
  invalidTags: string[];
  isSeries: boolean;
  isFinal: boolean;
}

export interface TitleTagsOptions {
  /** Extra regex patterns (as strings) to allow on top of the built-ins. */
  customPatterns?: string[];
}

export function analyzeTitleTags(title: string, opts: TitleTagsOptions = {}): TitleTagsResult {
  const matches = title.match(BRACKET_RE) ?? [];
  const customRegexes = (opts.customPatterns ?? [])
    .map((p) => safeCompile(p))
    .filter((r): r is RegExp => r !== null);
  const invalid: string[] = [];
  let isSeries = false;
  let isFinal = false;

  for (const raw of matches) {
    const inner = stripBrackets(raw);
    if (!inner) continue;
    let matched = false;
    for (const builtin of BUILTIN_PATTERNS) {
      if (builtin.pattern.test(inner)) {
        if (builtin.isSeries) isSeries = true;
        if (builtin.isFinal) isFinal = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (customRegexes.some((r) => r.test(inner))) continue;
    invalid.push(raw);
  }
  return { invalidTags: invalid, isSeries, isFinal };
}

function safeCompile(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}
