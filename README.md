# Submission Guard

Devvit Web port of [`nosleepautobot`](https://github.com/sofaworks/nosleepautobot) -- generalized so any long-form content subreddit can install it and tune the rules per-sub.

## What it does

Runs on every new post submission and enforces moderator-configurable rules:

- **Title-tag whitelist** -- only allow specific bracketed tags (e.g. `[Part 2]`, `[Volume 3]`, `[Update]`, `[Final]`). Custom regex patterns supported per-sub.
- **NSFW in title** -- detect free-floating "NSFW" tokens; ask authors to use Reddit's native NSFW toggle instead.
- **Long paragraph cap** -- per-paragraph word limit (default 350).
- **Code-block detection** -- 4-space indent or tab-prefixed paragraphs trigger Reddit's code formatting; flagged.
- **Per-author rate limit** -- one post per N seconds (default 24h).
- **Series auto-flair** -- detect `[Part N]` / `[Update]` / `[Volume N]` style tags, apply the configured series flair, post a sticky locked UpdateMeBot reminder, DM the author.

Removals come with a sticky distinguished comment containing a pre-filled modmail link the author clicks to request reapproval (or be told to wait, for rate-limit and NSFW-title removals).

A small mod panel (custom post) shows the most recent enforcement actions and the per-sub settings drawer.

## Per-sub configuration

Every rule has an enable/disable toggle. Tunable knobs:

- Custom title-tag regex patterns
- Max words per paragraph
- Rate-limit window (seconds)
- Series flair CSS class
- Series reminder DM/comment on/off

All persisted in Devvit Redis, scoped per-installing-subreddit.

## Origin & credit

Submission Guard is a port of [`sofaworks/nosleepautobot`](https://github.com/sofaworks/nosleepautobot) (Apache-2.0). Original maintainers: William Lee (u/SofaAssassin) and the r/nosleep mod team. The port preserves the original's rule semantics including subtle edge cases captured in the original test suite.

## Local development

```bash
npm install
npm test                  # 44 unit tests
npm run typecheck         # client + server
npm run build:client      # vite build into webroot/
devvit playtest <sub>     # upload + watch mode
```
