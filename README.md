# Submission Guard

Stateful submission moderation for any subreddit. Devvit Web port of [`nosleepautobot`](https://github.com/sofaworks/nosleepautobot), with the things AutoModerator still can't do.

## What it does that AutoMod can't

**AutoModerator is great at pattern matching.** It can't remember anything. Submission Guard adds the stateful tier on top:

- **Account-age-aware rate limits.** Brand-new accounts (default <7 days) get 2x the configured cooldown; tenured accounts (>30 days) get 0.5x. AutoMod has no access to `account_age`.
- **Cumulative escalation.** Per-author violation counter in a rolling window. 1st violation = warn only (post stays up). 2nd = standard removal. 3rd+ = removal + modmail to the mod team. AutoMod is stateless.
- **Raid detection.** N distinct authors trip the same rule in M seconds -> modmail alert to mods. Idempotent so they don't get spammed.
- **One-click reapproval** from the mod panel's enforcement feed.
- **Rule preview** — paste a hypothetical title + body, see what would fire against your current settings. AutoMod requires wiki edits and real test posts.
- **Live stats dashboard** — 24h/7d/30d windows, by-rule histogram, top 5 authors.

## Ported rules (from nosleepautobot)

All six rules from the original are ported with full behavioral parity, verified by porting the original Python test suite to TypeScript:

- **Title-tag whitelist** — `[Part 2]`, `[Volume 3]`, `[Update]`, `[Final]` etc. Custom regex slot for per-sub additions.
- **NSFW-in-title detection** — free-floating "NSFW" tokens flagged; authors directed to Reddit's native NSFW toggle.
- **Per-paragraph word cap** — default 350 words. Configurable per-sub.
- **Code-block detection** — 4-space indent or tab-prefixed paragraphs.
- **Per-author 24h rate limit** — now with account-age tiers.
- **Series auto-flair** — detect `[Part N]`, apply the configured flair, post a sticky locked UpdateMeBot reminder, DM the author.

All rules are individually toggleable per-sub.

## How to use

1. Install from the Reddit App Directory.
2. **Mod Tools -> Submission Guard - Open mod panel** creates one persistent post in the sub.
3. Open the post (mods only — non-mods see a splash).
4. Configure rules + thresholds via the **Settings** drawer.
5. Use **Preview rules** to dry-run a hypothetical post against your current settings before going live.
6. Watch enforcement happen in the live feed; **Reapprove** any false-positive with one click.

## Local development

```bash
npm install
npm test                  # 63 unit tests
npm run typecheck         # client + server
npm run build:client      # vite build into webroot/
devvit playtest <sub>     # upload + watch mode
```

## Origin & credit

Submission Guard is an Apache-2.0 port of [`sofaworks/nosleepautobot`](https://github.com/sofaworks/nosleepautobot). Original maintainers: William Lee (u/SofaAssassin) and the r/nosleep mod team. The port preserves the original's rule semantics; the differentiator layer (account-age tiers, escalation, raid detection, rule preview) is new in this port.
