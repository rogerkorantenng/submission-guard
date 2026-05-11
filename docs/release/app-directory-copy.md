# Title
Submission Guard

# Tagline (one line)
The submission rules of r/nosleep, ported to Devvit -- plus the stateful tier AutoMod can't do.

# Description
Per-post rule enforcement (title tags, paragraph length, code blocks, NSFW, rate limit, series auto-flair). Account-age tiers, cumulative escalation, raid detection, rule preview, one-click reapprove. Apache-2.0 port of nosleepautobot with original-author blessing.

# Permissions
- Read new posts (PostSubmit trigger)
- Read author account age (for tier-aware rate limits)
- Remove posts that violate configured rules
- Post a single distinguished sticky comment per removed post
- Set link flair on series posts
- Send a private message to series-post authors
- Send modmail to the mod team on raid detection

# Configuration
Every rule individually toggleable. Tunable thresholds: max words per paragraph, rate-limit window, account-age tier multipliers, escalation policy (warn -> remove -> alert), raid detection floor, series flair CSS class, custom title-tag regex patterns. Mod-only access enforced at the permission layer.

# Compatibility
Works on any subreddit. Defaults mirror r/nosleep; tune per-sub via the settings drawer. Preset configs available for r/HFY and r/WritingPrompts.

# Origin
Apache-2.0 port of https://github.com/sofaworks/nosleepautobot with explicit permission from the original maintainer.
