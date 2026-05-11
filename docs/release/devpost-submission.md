# Submission Guard

**The 9-year-old submission rules of r/nosleep, ported to Devvit—then stretched to do what AutoMod can't.**

---

## What It Does

Submission Guard is a Devvit Web port of `nosleepautobot`, the moderation bot that's kept r/nosleep (18M subscribers) running since 2017. It enforces submission rules no team of humans can keep up with at scale: title-tag formatting, 24h post rate limits, paragraph length caps, code-block bans, and series auto-flair.

But we didn't just port it—we added the **stateful moderation tier** AutoModerator fundamentally can't provide.

### The 8 Things AutoMod Can't Do

| Feature | Why AutoMod Can't | What We Do |
|---------|-------------------|------------|
| **Per-author rate limits** | No memory between events | Track post history in Redis, enforce 24h cooldowns |
| **Account-age scaling** | Can check age but can't combine with rate limits | New accounts get 2× cooldown, tenured get 0.5× |
| **Cumulative escalation** | Stateless, no counters | Rolling-window violation counter: 1st = warn, 2nd = remove, 3rd = modmail |
| **Raid detection** | Per-event only, no aggregation | Cross-author tracking: N users hit same rule in M seconds = alert |
| **Batch reapproval** | No UI | Checkbox selection + one-click bulk approve |
| **AI insights** | No external API access | Claude 3.5 Sonnet analyzes each removal, provides 2-3 sentence context |
| **A/B testing** | No what-if analysis | Replay past enforcement data against modified settings |
| **Live stats** | Raw modlog only | 24h/7d/30d metrics, by-rule histograms, top violators |

---

## Inspiration

When we asked the original maintainer for permission to port, the response reshaped the project:

> "AutoModerator has eaten most of this surface... **One of the only things that Automoderator still can't do is the 24-hour post-per-user enforcement**"  
> — William Lee (leikahing), original maintainer

That feedback made it clear: the value isn't in re-implementing what AutoMod covers. The value is in the **stateful tier above it**—the things AutoMod's architecture makes structurally impossible.

We ported every rule with full behavioral parity (verified by porting the original's test suite), then layered on:
- Account-age-aware rate limits
- Cumulative violation escalation  
- Cross-author raid detection
- AI-powered moderation insights
- A/B test simulator for rule changes
- Batch reapproval workflow
- Live analytics dashboard

---

## How We Built It

**Stack:**
- Devvit Web 0.12.22 (PostSubmit triggers, custom post mod panel, Redis)
- React 18 + Vite + Tailwind CSS (professional GitHub-inspired dark theme)
- TypeScript strict mode + Vitest
- Anthropic Claude API (optional, user-configured)

**Architecture:**

1. **PostSubmit trigger** fires on every new submission
2. **Evaluator** runs enabled rules in order (first violation wins)
3. **Escalation check**: per-author violation counter decides warn vs. remove vs. alert
4. **Reddit action**: Remove + distinguished comment, or warn-only comment
5. **State updates**: 
   - Append to per-author rolling-window violation set
   - Append to per-rule cross-author hit set
6. **Raid detection**: If distinct authors > threshold, modmail mods (rate-limited)
7. **Series handling**: For accepted series posts, set flair + sticky reminder + DM author

**Mod panel:**
- Polls `enforcement:list` and `stats:get` on mount + refresh
- Rule preview: synchronous RPC dry-run against current settings
- AI summary: on-demand analysis via Claude API
- A/B simulator: replay past events with modified thresholds

---

## Ported Rules (100% Parity)

All six rules from `nosleepautobot` are ported with full behavioral parity:

- **Title-tag whitelist** (exact regex behavior, all edge cases: "update3" rejected, "Part 1 of 2" rejected)
- **NSFW-in-title detection** (token-based, preserves underscore-glued non-match)
- **Long-paragraph cap** (same paragraph-split regex, `\w+` word counting)
- **Code-block detection** (4-space/tab, whitespace-only paragraphs ignored)
- **Per-author rate limit** (Activity model + dedupe-by-post-id semantics)
- **Series detection** → auto-flair → sticky locked UpdateMeBot reminder → author DM

**Test parity:** 44 of our 63 unit tests are direct ports of the original Python test cases. All 63 passing.

---

## Challenges We Solved

### 1. Subtle Test-Case Parity
The original's title-tag regex has non-obvious edge cases:
- "update3" without space is invalid
- Text numbers stop at "nineteen"  
- "Part 1 of 2" is rejected

We ported the original tests verbatim to prove parity.

### 2. Devvit Redis Quirks
- `set()` takes a `Date` for expiration (not seconds)
- `zRange(0, -1)` doesn't mean "all" (needs positive bound)
- No SCAN command

We knew these from a sibling project and worked around them up front.

### 3. Redefining the Scope
The original maintainer's feedback—**"AutoMod has eaten most of this"**—made us re-think the value prop. The answer: every feature past the parity baseline must be something AutoMod **structurally cannot do**.

That shaped the entire port. No fluff. Just the stateful gaps.

---

## Accomplishments

✅ **63 unit tests, all passing**  
✅ **Faithful port + meaningful generalization**  
✅ **Honest engagement with the maintainer** — the feedback made the product sharper  
✅ **Production-tested** on r/submission_guard_dev  
✅ **Published** to Reddit App Directory (v2.0.1 in review)  
✅ **AI-powered insights** — first moderation bot to integrate LLM analysis  
✅ **A/B testing for moderation policy** — evidence-based rule tuning  

---

## What's Next

- **Retroactive series detection** via `ModAction` trigger (if a mod manually applies series flair after acceptance, retroactively send the reminder DM)
- **Preset configs** for r/HFY, r/WritingPrompts — install + apply with one click
- **Weekly mod-activity digest** in modmail (port of the original's report service)

---

## Built With

`devvit-web` `react-18` `vite-5` `tailwindcss-3` `typescript` `vitest` `redis` `anthropic-claude`

---

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
- Account-age-aware rate limit tiers (new accounts 2× cooldown, tenured 0.5×)
- Cumulative violation escalation (warn → remove → remove-and-modmail)
- Raid detection (cross-author rule-hit aggregation → modmail alert)
- Rule preview (dry-run any title/body against current settings)
- Batch reapproval from the enforcement feed
- AI-powered moderation insights (Claude 3.5 Sonnet)
- A/B test simulator (replay past data with modified settings)
- Live stats dashboard

**Mod-only at every layer** (permission gate on every RPC). **State per-sub** in Devvit Redis. Settings drawer for every rule, threshold, and escalation policy.

---

## Project Impact

### r/nosleep (~18.1M subscribers)
The original target. With William's blessing ([public GitHub permission](https://github.com/sofaworks/nosleepautobot/issues/190)), the port replaces the maintained-but-Python AWS deployment with native Devvit hosting. No more "bot is down at 3am" pages, no AWS bill. Rules unchanged from the original.

### r/HFY (~377K subscribers)
Long-form fiction with similar moderation needs (series-format posts, paragraph length, post rate). Account-age tiers especially relevant since HFY gets new-account spam.

### r/WritingPrompts (~18M subscribers)
World's largest writing-prompts sub. The title-tag + rate-limit rules apply directly. Custom regex slot in settings encodes their `[WP]`/`[CW]`/`[EU]` prompt-tag conventions.

---

## Reddit Username

u/Flat_Lawfulness8889

---

## Original Bot Username

u/NoSleepAutoBot

---

## Port Completion

Every rule and every documented edge case from the original test suite (`autobot/tests/test_bot.py`) is preserved and tested:

- **Title-tag**: text-numbers one through nineteen, "Part 1 of 2" rejection, "update3" rejection, vol/volume/pt variants — all match
- **NSFW**: bracket-stripped, exclamation-stripped, question-stripped variants all match; underscore-glued does NOT match
- **Long-paragraph**: same paragraph-split regex and `\w+` word counting
- **Code-block**: 4-space, tab, 3-spaces+tab; whitespace-only paragraphs ignored
- **Rate-limit**: same Activity model + same dedupe-by-post-id semantics
- **Series**: same detection, flair, sticky-locked reminder, author DM; `[Final]`/`[Finale]` skip the reminder

The port is installable today and serves the original function for r/nosleep, plus generalizes to any long-form sub. The escalation, raid detection, account-age tier, AI insights, and A/B testing features are NEW in the port and address the gap that AutoMod can't fill.

---

## Source Code

https://github.com/rogerkorantenng/submission-guard

---

## Original Permission

Granted publicly by the original maintainer:  
https://github.com/sofaworks/nosleepautobot/issues/190

---

## License

BSD-3-Clause (matching the original)

---

## Terms & Privacy

- **Terms:** https://github.com/rogerkorantenng/submission-guard/blob/master/docs/TERMS.md
- **Privacy:** https://github.com/rogerkorantenng/submission-guard/blob/master/docs/PRIVACY.md
