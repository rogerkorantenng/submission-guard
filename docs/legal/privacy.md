# Privacy Policy - Submission Guard

**Last updated:** May 10, 2026

## TL;DR

- The App runs **inside Reddit's Devvit platform**. No separate hosted servers.
- All persistent storage is in **Devvit's per-app Redis**, scoped to the installing subreddit.
- The App **does not transmit data to any third party**.
- The App **does not collect telemetry, analytics, or PII**. It does not send anything to the developer.

## Data accessed

The App reads the following from Reddit's APIs (via Devvit), scoped to the installing subreddit only:

- The current moderator's username, account id, and mod permissions (to gate the panel).
- New post events (title, body, author, created-at, permalink, link flair).
- The post author's username and account id (for per-author rate limiting only).

The App does **not** read modmail, mod notes, AutoMod configuration, comments outside the bot's own replies, or any data outside the installing subreddit.

## Data stored

All data is stored in Devvit's per-app Redis. Per-sub keyed:

| Key family | Purpose | TTL |
|---|---|---|
| `submission:<sub>:<id>` | Cached submission row for dedupe + series follow-up | 48h |
| `activity:<sub>:<author>` | Per-author rate-limit row | rate-limit window |
| `enforcement_feed:<sub>` | Sorted set of recent enforcement events | None (capped to 200 by trim job) |
| `settings:<sub>` | Per-sub configuration | None |

## Data shared with third parties

**None.** The App makes no outbound HTTP calls beyond Reddit's own APIs.

## What we don't do

- No analytics, telemetry, or crash reporting.
- No data shared across subreddits - each installation is fully isolated.
- No data collected for the developer's own use.
- No data sold, leased, or commercialized.

## Children

The App is a moderator tool for adults running adult-or-general-audience subreddits. It is not directed at children under 13.

## Changes

We may update this Privacy Policy from time to time. The "Last updated" date will reflect the most recent change.

## Contact

Privacy questions? Email **roger@wgghana.com** or open an issue at <https://github.com/rogerkorantenng/submission-guard/issues>.
