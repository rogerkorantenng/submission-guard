# AutoModerator Capabilities Research

Research to validate claims in Devpost submission about what AutoModerator cannot do.

## What AutoModerator CAN Do

Based on the original maintainer's feedback and AutoModerator documentation:

### ✅ Pattern Matching (Static Rules)
- **Title regex checks** - Can validate title formats, detect patterns
- **Body text checks** - Can scan for keywords, phrases, patterns
- **Code block detection** - Can detect markdown code blocks (`code` or indented blocks)
- **NSFW keyword scanning** - Can check for specific words/phrases
- **User flair checks** - Can read and set user/post flair
- **Account age checks** - **CAN** check `account_age` (maintainer was incorrect about this being impossible)

### ✅ Single-Event Actions
- Remove posts/comments
- Approve posts/comments  
- Report items
- Set flair
- Add removal reasons
- Send modmail
- Filter to queue

## What AutoModerator CANNOT Do

### ❌ Stateful Operations (No Memory)

**1. Per-Author Rate Limiting**
- **Claim:** AutoMod cannot track when a user last posted
- **Verified:** ✅ TRUE
- **Why:** AutoMod has no persistent storage. It can check `author.post_karma` or `author.comment_karma` but cannot remember "user X posted 12 hours ago"
- **Evidence:** Original maintainer says "One of the only things that Automoderator still can't do is the 24-hour post-per-user enforcement"

**2. Cumulative Violation Tracking**
- **Claim:** AutoMod cannot count violations over time
- **Verified:** ✅ TRUE  
- **Why:** No state persistence between events. Cannot maintain counters like "this user has violated 3 times this month"
- **Our Implementation:** Redis sorted sets with rolling windows

**3. Cross-Author Aggregation (Raid Detection)**
- **Claim:** AutoMod cannot aggregate across multiple authors
- **Verified:** ✅ TRUE
- **Why:** AutoMod evaluates each post/comment in isolation. Cannot track "5 different users hit the same rule in 10 minutes"
- **Our Implementation:** Per-rule sorted sets tracking distinct authors + timestamps

### ❌ No User Interface

**4. Rule Preview/Testing**
- **Claim:** AutoMod has no preview functionality
- **Verified:** ✅ TRUE
- **Why:** AutoMod is wiki-configured. Testing requires:
  1. Edit wiki page
  2. Save changes
  3. Make test post
  4. Check if it works
  5. Repeat if wrong
- **Our Implementation:** Dry-run RPC endpoint that evaluates hypothetical input against current settings

**5. Batch Reapproval UI**
- **Claim:** AutoMod has no UI for undoing removals
- **Verified:** ✅ TRUE
- **Why:** AutoMod has no UI at all. Mods must:
  1. Find removed post in modqueue
  2. Click through to post
  3. Click "Approve"
  4. Repeat for each post
- **Our Implementation:** Checkbox selection + bulk reapprove button in mod panel

**6. Live Statistics Dashboard**
- **Claim:** AutoMod has no aggregated stats
- **Verified:** ✅ TRUE
- **Why:** AutoMod writes to modlog but provides no analytics. Mods must manually review modlog entries
- **Our Implementation:** Redis aggregation with 24h/7d/30d windows, by-rule histograms, top authors

### ❌ No External API Access

**7. AI-Powered Insights**
- **Claim:** AutoMod cannot call external APIs
- **Verified:** ✅ TRUE
- **Why:** AutoMod is a rule-based system with no ability to make HTTP requests or integrate external services
- **Our Implementation:** Anthropic Claude API integration via Devvit's HTTP fetch

**8. A/B Test Simulator**
- **Claim:** AutoMod cannot replay past events with modified rules
- **Verified:** ✅ TRUE
- **Why:** AutoMod has no access to historical data and no what-if analysis capability
- **Our Implementation:** Fetch past enforcement events from Redis, re-evaluate with modified settings

## Account Age Clarification

**IMPORTANT CORRECTION:**

The original maintainer said: "AutoMod has no access to `account_age_days`"

This is **OUTDATED**. AutoModerator **CAN** check account age using:
```yaml
author:
    account_age: "< 7 days"
```

However, AutoMod **CANNOT**:
- Use account age to **scale** rate limits dynamically
- Apply **different rate limit windows** based on account age
- **Remember** when a user posted to enforce any rate limit at all

Our implementation is still a differentiator because we:
1. Track post history (AutoMod can't remember past posts)
2. Scale the rate limit window based on account age (new accounts = 2x window, tenured = 0.5x)
3. Maintain this state in Redis across all posts

## Revised Claims for Devpost

### Account-Age-Aware Rate Limits
**OLD:** "AutoMod has no access to `account_age_days`"
**NEW:** "AutoMod can check account age but cannot maintain per-author post history to enforce rate limits. We combine account age with Redis-backed post tracking to scale cooldown windows dynamically."

### Everything Else
All other claims are **VERIFIED TRUE** and can remain as-is:
- ✅ Cumulative violation escalation
- ✅ Raid detection  
- ✅ Rule preview
- ✅ Batch reapproval
- ✅ AI-powered insights
- ✅ A/B test simulator
- ✅ Live stats

## Sources

1. Original maintainer feedback (William Lee / leikahing): https://github.com/sofaworks/nosleepautobot/issues/190
   - Quote: "One of the only things that Automoderator still can't do is the 24-hour post-per-user enforcement"
   - Quote: "some of this bot's functionality could be handled by Automoderator now (probably the title checking)"

2. nosleepautobot README: https://github.com/sofaworks/nosleepautobot
   - Confirms bot is needed for tasks "too complex for reddit's own AutoMod"
   - Specifically calls out 24-hour rule enforcement as beyond AutoMod

3. AutoModerator known limitations:
   - No persistent storage
   - No cross-event memory
   - No API access
   - No UI
   - Wiki-only configuration

## Conclusion

**7 out of 8 claims are 100% accurate.**

The one that needs revision is the account-age rate limits claim - we should focus on the "stateful rate limiting" aspect rather than account age access, since AutoMod CAN check age but CANNOT maintain post history or enforce time-based limits.

All other differentiators (escalation, raid detection, preview, batch UI, AI, A/B testing, stats) are genuine gaps that AutoMod fundamentally cannot fill due to its stateless, rule-based architecture.
