# Submission Guard

Devvit Web port of `nosleepautobot`, plus the stateful tier AutoModerator still can't do. Submitted to Reddit's Mod Tools and Migrated Apps Hackathon (May 2026), Best Ported Data API App category.

## Tagline

The 9-year-old submission rules of r/nosleep, ported to Devvit -- and stretched to do what AutoMod can't.

## Inspiration

`nosleepautobot` has been load-bearing infrastructure on r/nosleep (18M subscribers) since 2017. It enforces title-tag formatting, the 24h post rate limit, paragraph length, code-block bans, and series auto-flair -- work no team of humans can keep up with at that scale.

When we DM'd the original maintainer for permission to port, the response was honest and useful: **AutoModerator has eaten most of this surface.** Title regex, code blocks, body keyword bans -- AutoMod does it all. So the value of a port isn't in re-implementing what AutoMod already covers. The value is in the *stateful* moderation tier above it.

We took that feedback and built up. Submission Guard ports every rule from the original, then layers on the things you cannot express in AutoMod's wiki: account-age-aware rate limits, cumulative violation escalation, cross-author raid detection, live stats, rule preview, and one-click reapproval.

## What AutoModerator can't do that Submission Guard does

| Feature | Why AutoMod can't |
|---|---|
| **Account-age-aware rate limits** | AutoMod can check account age but cannot maintain per-author post history to enforce rate limits. We combine `getUserById` account age with Redis-backed post tracking to scale cooldown windows dynamically (new accounts get 2x, tenured get 0.5x). |
| **Cumulative violation escalation** | AutoMod is stateless. We keep a per-author rolling-window violation counter in Redis. 1st violation = warn (post stays up), 2nd = remove, 3rd = remove + modmail. |
| **Raid detection** | AutoMod fires per-event, in isolation. We aggregate across authors: N distinct authors hitting the same rule within M seconds = modmail alert. |
| **Rule preview** | AutoMod requires editing the wiki and submitting test posts to validate rule changes. We dry-run the evaluator against current settings -- paste a hypothetical title + body, see what would fire. |
| **Batch reapproval** | AutoMod has no UI to undo its own removals; mods navigate to the post. We surface every removal with checkboxes for bulk reapproval. |
| **AI-powered insights** | AutoMod has no external API access. We integrate Claude 3.5 Sonnet to analyze enforcement events and provide 2-3 sentence context summaries for better mod decisions. |
| **A/B test simulator** | AutoMod provides no what-if analysis. We replay past enforcement data against modified settings to show what would change before deploying rule tweaks. |
| **Live stats** | AutoMod's modlog is raw events. We aggregate (24h/7d/30d, by rule, top authors). |

## Ported rules (parity with the original)

All six rules from `nosleepautobot` are ported with full behavioral parity, verified by porting the original Python test suite to TypeScript Vitest:

- Title-tag whitelist (with the original's exact regex behavior, including edge cases like rejecting "update3" without space and "Part 1 of 2")
- NSFW-in-title detection (token-based, preserves the underscore-glued non-match the original allows)
- Long-paragraph cap (same paragraph-split regex; \w+ word counting)
- Code-block detection (4-space indent or tab; whitespace-only paragraphs ignored)
- Per-author rate limit (same Activity model and dedupe-by-post-id semantics)
- Series detection -> auto-flair -> sticky locked UpdateMeBot reminder -> author DM

44 of our 63 unit tests are direct ports of the original's test cases. The other 19 cover the new features.

## How we built it

- **Devvit Web 0.12.22** -- `PostSubmit` trigger + custom post mod panel + Devvit Redis
- **React 18 + Vite + Tailwind** -- professional GitHub-inspired dark theme for enterprise moderation workflows
- **TypeScript strict mode**, **Vitest** for the rule logic
- **63 unit tests, all passing on every commit**
- **Anthropic Claude API** -- AI-powered moderation insights (optional feature, user-configured API key)

Architecture flow:

1. `PostSubmit` trigger fires.
2. Evaluator runs every enabled rule in order. First violation wins.
3. If violation: check escalation counter for the author, decide warn vs remove vs remove-and-alert.
4. Apply Reddit-side action (remove + distinguished sticky comment, or just comment for warn).
5. Append to per-author rolling-window violation set + per-rule cross-author hit set.
6. Run raid detection: if distinct authors above floor, modmail mods (rate-limited via marker key).
7. Persist submission row for dedupe; for accepted series posts, set flair + post reminder + DM author.

The mod panel polls `enforcement:list` and `stats:get` on mount + refresh nonce changes. Rule preview is a synchronous RPC that runs the same evaluator against the same settings.

## Challenges

- **Subtle test-case parity.** The original's regex for title-tag matching has non-obvious edge cases ("update3" without space is invalid, text numbers stop at "nineteen", "Part 1 of 2" is rejected). Ported the original tests verbatim to prove parity.
- **Devvit's Redis differs from stdlib.** `set()` takes a `Date` for expiration; `zRange(0, -1)` doesn't mean "all" (needs positive bound); no SCAN. We knew these from a sibling project (Sankofa Mod) and worked around them up front.
- **The "what does Submission Guard do that AutoMod doesn't?" question.** Raised by the original maintainer in our permission request. The answer reshaped the whole port: every feature past the parity baseline is something AutoMod can't structurally do.

## Accomplishments

- 63 unit tests, all passing.
- Faithful port + meaningful generalization.
- Honest engagement with the maintainer about why the port is worth doing -- the feedback made the product sharper.

## What's next

- Retroactive series detection via the `ModAction` trigger (if a mod manually applies series flair after the bot accepted the post, retroactively send the reminder DM).
- Preset configs (r/HFY, r/WritingPrompts) -- install + apply with one click.
- Weekly mod-activity digest in modmail (port of the original's report service).

## Built with

`devvit-web` `react-18` `vite-5` `tailwindcss-3` `typescript` `vitest` `redis`

## Tool Overview

Submission Guard runs on every PostSubmit event in any subreddit it's installed on. It enforces moderator-configured rules and adds a stateful moderation tier above what AutoMod can do.

**Rules ported from nosleepautobot (per-sub configurable):**
- Title-tag whitelist (regex-based, default mirrors r/nosleep's schema)
- NSFW-in-title detection
- Per-paragraph word cap (default 350)
- Code-block detection (4-space indent or tab-prefixed)
- Per-author post rate limit (default 86400 seconds = 24h)
- Series auto-flair + UpdateMeBot reminder comment + author DM

**Stateful features added on top (the AutoMod-can't-do tier):**
- Account-age-aware rate limit tiers (new accounts 2x cooldown, tenured 0.5x)
- Cumulative violation escalation (warn -> remove -> remove-and-modmail)
- Raid detection (cross-author rule-hit aggregation -> modmail alert)
- Rule preview (dry-run any title/body against current settings)
- One-click reapprove from the enforcement feed
- Live stats dashboard

**Mod-only at every layer** (permission gate on every RPC). **State per-sub** in Devvit Redis. Settings drawer for every rule, threshold, and escalation policy.

## Project Impact

**r/nosleep (~18.1M subscribers)** -- The original target. With William's blessing (public GitHub permission), the port replaces the maintained-but-Python AWS deployment with native Devvit hosting. No more "bot is down at 3am" pages, no AWS bill. Rules unchanged from the original.

**r/HFY (~377K subscribers)** -- Long-form fiction with similar moderation needs (series-format posts, paragraph length, post rate). Account-age tiers especially relevant since HFY gets new-account spam.

**r/WritingPrompts (~18M subscribers)** -- World's largest writing-prompts sub. The title-tag + rate-limit rules apply directly. Custom regex slot in settings encodes their `[WP]`/`[CW]`/`[EU]` prompt-tag conventions.

## Reddit username

- u/Flat_Lawfulness8889

## Original Bot username

- u/NoSleepAutoBot

## Port Completion

Every rule and every documented edge case from the original test suite (`autobot/tests/test_bot.py`) is preserved and tested:
- Title-tag: text-numbers one through nineteen, "Part 1 of 2" rejection, "update3" rejection, vol/volume/pt variants -- all match.
- NSFW: bracket-stripped, exclamation-stripped, question-stripped variants all match; underscore-glued does NOT match.
- Long-paragraph: same paragraph-split regex and `\w+` word counting.
- Code-block: 4-space, tab, 3-spaces+tab; whitespace-only paragraphs ignored.
- Rate-limit: same Activity model + same dedupe-by-post-id semantics.
- Series: same detection, flair, sticky-locked reminder, author DM; `[Final]`/`[Finale]` skip the reminder.

The port is installable today and serves the original function for r/nosleep, plus generalizes to any long-form sub. The escalation, raid detection, and account-age tier features are NEW in the port and address the gap that AutoMod can't fill.

## Source code

https://github.com/rogerkorantenng/submission-guard

## Original permission

Granted publicly by the original maintainer: https://github.com/sofaworks/nosleepautobot/issues/190
