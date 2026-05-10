# Title
Submission Guard

# Tagline (one line)
The submission rules of r/nosleep, ported to Devvit and made configurable for every long-form sub.

# Description
Per-post enforcement of title tags, paragraph length, code blocks, NSFW detection, and per-author rate limits. Series auto-flair. Mod panel + per-sub settings. Apache-2.0 port of nosleepautobot, generalized.

# Permissions
- Read new posts (PostSubmit trigger)
- Remove posts that violate configured rules
- Post a single distinguished sticky comment per removed post explaining the rule
- Set link flair on series posts
- Send a private message to series-post authors

# Configuration
Six rules, each with an enable/disable toggle. Tunable thresholds: max words per paragraph, rate-limit window, series flair CSS class, custom title-tag regex patterns. Mod-only access enforced at the permission layer.

# Compatibility
Works on any subreddit. Defaults mirror r/nosleep; tune per-sub via the settings drawer.

# Origin
Apache-2.0 port of https://github.com/sofaworks/nosleepautobot. Original maintainers credited.
