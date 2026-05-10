# Porting plan: nosleepautobot -> Submission Guard

A side-by-side mapping of every behavior in the original `sofaworks/nosleepautobot` (PRAW + Redis + supervisord, Python) to its Devvit Web equivalent.

## Architecture diff

| Original | Submission Guard |
|---|---|
| Python 3.11 + PRAW 7.8.1 | TypeScript + Devvit Web 0.12.22 |
| Polls `/r/nosleep/new` every 30s with cursor-based pagination | `PostSubmit` trigger -- event-driven, no polling |
| Single-sub deployment per env-var | Multi-sub install, each install scoped per-sub |
| Redis (single instance, env URL) | Devvit Redis (per-app, per-sub keyed) |
| Supervisord runs 2 processes (bot + report service) | Devvit runs the trigger; weekly digest deferred to Phase 3 |
| Vector + BetterStack log shipping | Devvit native logging |
| Prometheus metrics on :9091 | Devvit dashboard metrics |
| Mako templates for messages | TypeScript template literal functions |
| Env vars for config | Devvit `addSettings` per install + Redis-backed per-sub settings |

## Rule-by-rule port

### Rule 1: 24h post rate limit
- **Original:** `AutoBot.reject_by_timelimit()` (`autobot/autobot.py:182`)
- **Port:** `evaluateRateLimit()` in `src/server/lib/rules/rateLimit.ts`
- **Test parity:** rate-limit test cases ported (no prior, same-post dedupe, within-window, past-window).
- **Edge case preserved:** if `prior.lastPostId === newPostId` (re-process), treat as not-rate-limited. The trigger handler ALSO does deduplication via the `submission:<sub>:<id>` cache, but the rule itself is defensive.
- **Edge case preserved:** activity row is NOT updated on rate-limit removal -- the existing row keeps the cooldown clock honest.

### Rule 2: Title-tag whitelist
- **Original:** `PostAnalyzer.categorize_tags()` (`autobot/autobot.py:70`)
- **Port:** `analyzeTitleTags()` in `src/server/lib/rules/titleTags.ts`
- **Test parity:** every test in `autobot/tests/test_bot.py::test_categorize_tags*` ported.
- **Edge cases preserved:** `update3` rejected (no space), `Part 1 of 2` rejected, text numbers `one`-`nineteen` accepted, "oneteen" rejected, `final`/`finale` sets isFinal+isSeries.
- **NEW:** custom regex patterns slot for per-sub additions (e.g. r/WritingPrompts `[WP]`, `[CW]`, `[EU]`).

### Rule 3: NSFW in title
- **Original:** `PostAnalyzer.contains_nsfw_title()` (`autobot/autobot.py:128`)
- **Port:** `containsNsfwTitle()` in `src/server/lib/rules/nsfwTitle.ts`
- **Test parity:** all 6 test cases ported including the underscore-glued non-match.

### Rule 4: Long paragraph
- **Original:** `PostAnalyzer.contains_long_paragraphs()` (`autobot/autobot.py:120`)
- **Port:** `findLongParagraphs()` in `src/server/lib/rules/longParagraphs.ts`
- **Edge cases preserved:** same paragraph-split regex (blank lines, two-spaces+newline, tab+newline), `\w+` word-counting (so `&` and `--` don't count), default cap 350.
- **NEW:** the cap is per-sub configurable.

### Rule 5: Code blocks
- **Original:** `PostAnalyzer.contains_codeblocks()` (`autobot/autobot.py:136`)
- **Port:** `containsCodeBlocks()` in `src/server/lib/rules/codeBlocks.ts`
- **Edge cases preserved:** 4-space, tab, 3-spaces+tab; whitespace-only paragraphs ignored.

### Rule 6: Series auto-flair
- **Original:** `set_series_flair()` + `post_series_reminder()` + `send_series_pm()` (`autobot/autobot.py:425+`)
- **Port:** in `src/server/triggers/onPostSubmit.ts` (the series block at the bottom)
- **Behavior preserved:** series detection via title tag OR mod-applied flair (`isSeriesByFlair`); skip the reminder flow for `[Final]`/`[Finale]`; reminder comment is sticky+distinguished+locked; author DM uses the same UpdateMeBot subscribe phrasing.

## Persistence model

| Original key | Port key | TTL | Purpose |
|---|---|---|---|
| `submission.<id>` | `submission:<sub>:<id>` | 48h | Dedupe + series tracking |
| `activity.<author>` | `activity:<sub>:<author>` | rate-limit window | Per-author rate limit |
| -- | `enforcement_feed:<sub>` | none (capped) | Mod panel feed |
| -- | `settings:<sub>` | none | Per-sub config |

## What we did NOT port (and why)

- **`moderation/activity_tracker.py`** -- legacy. Dead-coded in the original (not wired to supervisord). References dead PushShift API.
- **Vector + BetterStack log shipping** -- Devvit handles logs natively.
- **Prometheus metrics on :9091** -- Devvit dashboard handles metrics.
- **`run_report_service.py` weekly mod digest** -- deferred to Phase 3.
- **`process_previous()` hourly retro-scan** -- the Devvit trigger model fires once per submission, so we don't poll. Retroactive series detection (a mod manually applies series flair after the bot accepted the post) is best handled by a `ModAction` trigger watching for flair edits -- deferred to Phase 3.
- **`AUTOBOT_IGNORE_OLD_POSTS` filter** -- not needed. Triggers only fire on live events; there's no bot-restart backfill problem.
- **Cross-sub deployment via env vars** -- Devvit installs are per-sub by design; the multi-sub story is "install on each sub" not "one bot serves N subs".

## Phasing

- **Phase 1 (shipped):** all 6 rules, PostSubmit trigger, per-sub settings, mod panel UI, full test parity.
- **Phase 2 (next):** retroactive series detection via `ModAction` trigger; richer modmail-prefill templates; preset configs for r/nosleep / r/HFY / r/WritingPrompts.
- **Phase 3:** weekly modmail mod-activity digest; wiki-page-driven rule imports; cross-sub author-allowlist (if Devvit ships cross-sub state).
