# Submission Guard

Devvit Web port of `nosleepautobot`, generalized so any long-form content subreddit can install and tune it. Submitted to Reddit's Mod Tools and Migrated Apps Hackathon (May 2026), Best Ported Data API App category.

## Tagline

The submission rules of r/nosleep, ported to Devvit and made configurable for every long-form sub on Reddit.

## Inspiration

`nosleepautobot` has been a load-bearing part of r/nosleep (18M subscribers) since 2017. It enforces title-tag formatting, the 24h post rate limit, paragraph length, code-block bans, and series auto-flair -- moderation work no team of humans can keep up with at that scale. The codebase is Apache-2.0, the maintainers are responsive, and nothing in the Devvit App Directory does the same job.

The original is also tightly coupled to r/nosleep's specific rule set. Other long-form subs (r/HFY, r/WritingPrompts, r/shortscarystories, r/LetsNotMeet, r/Glitch_in_the_Matrix, r/UnresolvedMysteries) need the same machinery with different parameters. Submission Guard is the same engine, but every threshold is per-sub configurable.

## What it does

Runs on every new submission and enforces six rules, each with a per-sub toggle:

- **Title-tag whitelist** -- bracketed tags must match a regex schema. Default schema mirrors r/nosleep's (`[Part N]`, `[Volume N]`, `[Update]`, `[Final]`). Custom patterns added per-sub via the settings drawer.
- **NSFW in title** -- free-floating "NSFW" tokens flagged so authors use Reddit's native NSFW toggle instead.
- **Long paragraph cap** -- per-paragraph word count above a configurable threshold (default 350).
- **Code-block detection** -- 4-space indent or tab-prefixed paragraphs trigger Reddit's code rendering; flagged.
- **Per-author rate limit** -- one post per N seconds (default 86400 = 24h).
- **Series auto-flair** -- detects series tags, applies the configured series CSS class, posts a sticky locked UpdateMeBot reminder comment, DMs the author.

Removed posts get a sticky distinguished comment with a pre-filled modmail link the author can click to request reapproval (or, for NSFW/rate-limit, guidance on what to do instead).

A small mod panel (custom post) shows recent enforcement actions and exposes the per-sub settings drawer.

## How we built it

- **Devvit Web 0.12.22** (`PostSubmit` trigger + custom post + Devvit Redis)
- **React 18 + Vite + Tailwind** mod panel
- **TypeScript**, strict mode
- **Vitest** for the rule logic -- 44 unit tests, all passing on every commit, including direct ports of the original's test fixtures so we can prove behavioral parity

The whole port was structured as:

1. Read every line of the original. Catalogue every rule, every threshold, every edge case.
2. Reimplement each rule as a pure TypeScript function with the original's Python-test cases ported as TypeScript Vitest cases.
3. Wire the orchestrator (`evaluateSubmission`) that runs the rules in order, first-violation-wins.
4. Write the trigger handler that takes the orchestrator result and applies Devvit-side actions (remove, sticky distinguished comment, flair, DM).
5. Mirror the original Redis schema (`submission:<id>`, `activity:<author>`) inside Devvit's per-sub Redis.

## Challenges

- **Subtle test-case parity**. The original's regex for title-tag matching has non-obvious edge cases ("update3" without space is invalid, "Part 1 of 2" is invalid, text numbers stop at "nineteen"). Ported the original test suite verbatim so we could prove parity.
- **Devvit's Redis differs from stdlib**. `set()` takes a `Date` for expiration not seconds. `zRange(0, -1)` doesn't mean "everything". Caught both from prior hackathon work on Sankofa Mod.
- **CommentV2 author shape in 0.12.22**. The author field arrives as a `t2_` account id, not a username. Resolver detects and falls back to `getUserById`.

## Accomplishments

- 44 unit tests, all passing.
- Faithful port of every nosleepautobot rule with every original edge case.
- Generalized: rules that were hardcoded in the original are per-sub configurable in the port.
- Mod panel UI with paper-and-ink visual identity (homage to the typewritten-manuscript aesthetic that fits long-form fiction subs).

## What's next

- Preset configurations for major long-form subs (r/HFY, r/WritingPrompts) so install is one-click.
- Optional weekly mod activity digest (port of the original's `report_service`).
- Wiki-page rule import so mods can manage the title-tag whitelist alongside their other docs.

## Built with

`devvit-web` `react-18` `vite-5` `tailwindcss-3` `typescript` `vitest` `redis`

## Tool Overview

Submission Guard runs on every PostSubmit event in any subreddit it's installed on. It enforces moderator-configured rules:
- Title-tag whitelist (regex-based, default mirrors r/nosleep's schema)
- NSFW-in-title detection (free-floating "NSFW" token)
- Per-paragraph word cap (default 350)
- Code-block detection (4-space indent or tab-prefixed)
- Per-author post rate limit (default 86400 seconds = 24h)
- Series auto-flair + UpdateMeBot reminder comment + author DM

When a rule fires, the post is removed and a sticky distinguished bot comment is posted explaining the violation, with a pre-filled modmail link for reapproval requests. Mods access a custom-post panel showing recent enforcement actions and a settings drawer to tune every rule per-sub.

The original `nosleepautobot` is a single-sub Python bot tightly coupled to r/nosleep's parameters. This port preserves the rule semantics exactly (verified by porting the original test suite) but exposes every threshold as a Devvit setting, so any sub can install it and configure for their own rules.

## Project Impact

**r/nosleep (~18.1M subscribers)** -- The original target. With the operator's blessing, the port replaces a maintained-but-Python AWS deployment with native Devvit hosting. No more "bot is down at 3am" pages, no AWS bill. Rules unchanged.

**r/HFY (~377K subscribers)** -- Long-form fiction sub with very similar moderation needs (series-format posting, paragraph length, post rate). Same engine, different default thresholds. Ready to install day one.

**r/WritingPrompts (~18M subscribers)** -- The world's largest writing-prompt sub. The title-tag whitelist + paragraph length + rate limit rules apply directly. Custom regex slot in settings can encode their `[WP]`/`[CW]`/`[EU]` prompt-tag conventions.

## Reddit username

- u/Flat_Lawfulness8889

## Original Bot username

- u/NoSleepAutoBot

## Port Completion

The port preserves every rule and every documented edge case from the original test suite (`autobot/tests/test_bot.py`):
- Title-tag matching: every text-number, part/pt/vol/volume/update variant, "Part 1 of 2" rejection, "update3" rejection -- all preserved and tested.
- NSFW token detection: bracket-stripped, exclamation-stripped, question-stripped variants all match; underscore-glued does NOT match (matches original behavior).
- Long-paragraph: `\w+` word-counting (so `&` and `--` don't count); same paragraph-split regex (blank lines, two-spaces+newline, tab+newline).
- Code-block: 4-space, tab, 3-spaces+tab; whitespace-only paragraphs ignored.
- Rate-limit: same Activity model + same dedupe-by-post-id semantics.
- Series detection + flair + UpdateMeBot reminder + author DM: all preserved; "final" / "finale" correctly skips the reminder flow.

What's intentionally NOT ported (and why):
- The Vector log-shipping sidecar (Devvit handles logs).
- Prometheus metrics (Devvit handles metrics).
- The legacy `moderation/activity_tracker.py` -- it's dead code in the original, superseded by `moderation/activity.py` and references the dead PushShift API.
- Cross-sub features -- Devvit doesn't expose cross-sub state.

What's NEW in the port that the original didn't have:
- Per-sub configuration: every rule individually toggleable, every threshold tunable. The original needs an env-var rebuild.
- Mod panel UI with recent-enforcement feed.
- Custom regex slot for additional title-tag patterns.

The port is installable today and serves the original function for r/nosleep, plus generalizes to any long-form sub.

## Source code

https://github.com/rogerkorantenng/submission-guard
