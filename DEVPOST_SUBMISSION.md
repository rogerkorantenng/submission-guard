# Devpost Submission Guide - Submission Guard

Complete submission information for Reddit's Mod Tools and Migrated Apps Hackathon (May 2026).

## Basic Information

**Project Title:**
```
Submission Guard
```

**Tagline (max 60 characters):**
```
AutoMod + the stateful tier it can't do
```

**Category:**
```
Best Ported Data API App
```

**Built With (tags):**
```
devvit-web
react-18
vite-5
tailwindcss-3
typescript
vitest
redis
anthropic-claude
```

## Project Description

Use the full content from `docs/release/devpost-submission.md`. Key sections include:

### Elevator Pitch
Devvit Web port of `nosleepautobot`, plus the stateful tier AutoModerator still can't do. Submitted to Reddit's Mod Tools and Migrated Apps Hackathon (May 2026), Best Ported Data API App category.

### What AutoModerator Can't Do (Core Value Prop)

| Feature | Why AutoMod can't |
|---------|-------------------|
| **Account-age-aware rate limits** | AutoMod has no access to `account_age_days`. We pull it via `getUserById` and scale the rate-limit window per tier. |
| **Cumulative violation escalation** | AutoMod is stateless. We keep a per-author rolling-window violation counter in Redis. 1st = warn, 2nd = remove, 3rd = remove + modmail. |
| **Raid detection** | AutoMod fires per-event, in isolation. We aggregate across authors: N distinct authors hitting the same rule within M seconds = modmail alert. |
| **Rule preview** | AutoMod requires editing the wiki and submitting test posts. We dry-run the evaluator against current settings. |
| **Batch reapproval** | AutoMod has no UI to undo its own removals. We surface every removal with checkboxes for bulk reapproval. |
| **AI-powered insights** | AutoMod has no external API access. We integrate Claude 3.5 Sonnet to analyze enforcement events and provide context summaries. |
| **A/B test simulator** | AutoMod provides no what-if analysis. We replay past enforcement data against modified settings. |
| **Live stats** | AutoMod's modlog is raw events. We aggregate (24h/7d/30d, by rule, top authors). |

### Technical Highlights

- **63 passing unit tests** - 44 ported directly from the original Python test suite
- **Full behavioral parity** - All edge cases preserved from the 9-year-old original
- **TypeScript strict mode** - Type-safe throughout
- **Professional dark theme** - GitHub-inspired design for enterprise moderation workflows
- **Devvit Redis** - Stateful moderation layer AutoMod fundamentally cannot provide

## Links

**GitHub Repository:**
```
https://github.com/rogerkorantenng/submission-guard
```

**Try It Out:**
```
https://developers.reddit.com/apps/submission-guard
```

**Original Bot (Permission Granted):**
```
https://github.com/sofaworks/nosleepautobot
```

**Permission from Original Maintainer:**
```
https://github.com/sofaworks/nosleepautobot/issues/190
```

**Terms & Conditions:**
```
https://github.com/rogerkorantenng/submission-guard/blob/master/docs/TERMS.md
```

**Privacy Policy:**
```
https://github.com/rogerkorantenng/submission-guard/blob/master/docs/PRIVACY.md
```

## Team

**Developer:**
```
Roger Korantenng
Reddit: u/Flat_Lawfulness8889
GitHub: rogerkorantenng
Devvit: Hot-Smell6959
```

## Media Assets

### Required Screenshots (4-6 images)

**1. Mod Panel Overview**
- Show the main enforcement feed with multiple removal events
- Highlight the professional dark theme
- Caption: "GitHub-inspired moderation dashboard with live enforcement feed"

**2. AI Summary Feature**
- Click "AI Summary" on an enforcement event
- Show Claude's analysis appearing
- Caption: "AI-powered contextual analysis using Claude 3.5 Sonnet"

**3. Batch Reapproval**
- Multiple items selected with checkboxes
- "Reapprove 3" button visible
- Caption: "Bulk reapproval workflow - what AutoMod can't do"

**4. A/B Test Simulator**
- Simulator drawer open
- Modified settings input
- Results showing delta
- Caption: "Evidence-based policy tuning: test rule changes against past data"

**5. Stats Dashboard**
- 24h/7d/30d metrics visible
- By-rule histogram
- Top authors list
- Caption: "Real-time enforcement analytics"

**6. Settings Drawer**
- Show configuration options
- Rule toggles
- Threshold inputs
- Caption: "Per-subreddit configuration with preset templates"

### Optional Video Demo (Recommended)

**Script (2-3 minutes):**

1. **Opening (15s):**
   - "This is Submission Guard, a port of r/nosleep's 9-year-old submission bot"
   - "But we didn't just port it - we added the stateful tier AutoModerator can't do"

2. **Show Enforcement Feed (20s):**
   - Scroll through recent removals
   - Point out the clean, professional UI
   - "Every removal is tracked with full context"

3. **Demo AI Summary (30s):**
   - Click "AI Summary" on an event
   - Wait for Claude to analyze
   - Read the summary aloud
   - "This uses Anthropic's Claude API to help mods make better decisions"

4. **Demo Batch Reapproval (25s):**
   - Select 2-3 items
   - Click bulk reapprove
   - Refresh page
   - Show items marked as reapproved
   - "AutoMod has no way to undo its own removals - we do"

5. **Demo A/B Simulator (30s):**
   - Open simulator
   - Change word limit from 350 to 400
   - Run simulation
   - Show results: "5 posts would have been accepted instead"
   - "Test rule changes before deploying them"

6. **Show Stats (20s):**
   - Quick tour of metrics
   - "Real-time insights AutoMod's modlog doesn't provide"

7. **Closing (10s):**
   - "Submission Guard: the original bot, plus the stateful layer AutoMod fundamentally can't do"
   - Show GitHub link

## Third-Party API Declaration

**API Used:** Anthropic Claude API  
**Purpose:** AI-powered moderation insights  
**Configuration:** User-provided API key in app settings  
**Status:** Optional feature (app works without it)  
**Data Sent:** Post title, removal reason, detail (public Reddit data only)  
**Privacy:** Subject to Anthropic's Privacy Policy  

**Domain Request:** `api.anthropic.com` - Submitted for approval with v2.0.1

## Hackathon Fit

### Why This Qualifies for "Best Ported Data API App"

1. **Faithful Port:** All 6 rules from the original with full behavioral parity (verified by porting 44 test cases)
2. **Data API Usage:** Leverages Reddit Data API extensively (getUserById for account age, post metadata, moderation actions)
3. **Beyond Simple Port:** Adds stateful features the original AND AutoMod cannot provide
4. **Original Permission:** Public blessing from the original maintainer (sofaworks)
5. **Production Ready:** Used on r/nosleep (18M subscribers) for 9 years - we're bringing it to Devvit

### Differentiators from AutoMod

The original maintainer's feedback reshaped our approach: **"AutoMod has eaten most of this surface."**

We focused on what AutoMod structurally CANNOT do:
- No access to account_age_days → we have account-age tiers
- Stateless → we have rolling-window counters
- Per-event only → we aggregate across authors for raid detection
- No preview → we dry-run against hypothetical input
- No external APIs → we integrate Claude for AI insights
- No what-if analysis → we simulate rule changes against past data

## Port Completion Status

✅ **100% Feature Parity** with original nosleepautobot:
- Title-tag whitelist (exact regex behavior, all edge cases)
- NSFW-in-title detection (token-based matching)
- Long-paragraph cap (same word counting)
- Code-block detection (4-space/tab, whitespace handling)
- Per-author rate limit (Activity model preserved)
- Series auto-flair + UpdateMeBot reminder + author DM

✅ **New Stateful Features** (AutoMod can't do):
- Account-age-aware rate limit tiers
- Cumulative violation escalation
- Cross-author raid detection
- Batch reapproval workflow
- AI-powered moderation insights
- A/B test simulator for rule changes
- Live stats dashboard

✅ **63 Unit Tests** - All passing
✅ **TypeScript Strict Mode** - Type-safe
✅ **Production Ready** - Tested on r/submission_guard_dev

## Submission Checklist

- [x] GitHub repository public
- [x] README with installation instructions
- [x] LICENSE file (BSD-3-Clause)
- [x] Terms & Conditions published
- [x] Privacy Policy published
- [x] App published to Reddit (v2.0.1 in review)
- [x] Domain request submitted (api.anthropic.com)
- [x] All features tested and working
- [x] Developer Settings form completed
- [x] Devpost submission form ready
- [ ] Screenshots captured (do before submitting)
- [ ] Video demo recorded (optional but recommended)
- [ ] Submit to Devpost!

## Post-Submission

After submitting to Devpost:
1. Monitor email for Reddit app approval (v2.0.1)
2. Monitor email for domain approval (api.anthropic.com)
3. Check Devpost for hackathon updates
4. Respond to any judge questions promptly

## Support

For questions about the submission:
- GitHub: https://github.com/rogerkorantenng/submission-guard
- Reddit: u/Flat_Lawfulness8889

---

**Ready to submit!** All technical requirements are complete. Just add screenshots/video and fill out the Devpost form.
