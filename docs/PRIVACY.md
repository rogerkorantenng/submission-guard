# Privacy Policy - Submission Guard

**Last Updated:** May 11, 2026

## Introduction

Submission Guard ("the App") is committed to protecting your privacy. This Privacy Policy explains how the App collects, uses, and stores data.

## Data We Collect

### Automatically Collected Data

When the App processes submissions, it collects:
- **Post metadata**: Post ID, title, submission timestamp
- **Author information**: Reddit username (public information)
- **Removal details**: Rule triggered, reason, detail message
- **Moderation actions**: Reapproval events, moderator usernames

### User-Provided Data

- **API Keys**: Optional Anthropic API key for AI summaries (stored securely in Reddit's encrypted settings)
- **Configuration**: Rule thresholds and settings chosen by moderators

## How We Use Data

Data is used solely for:
- **Rule enforcement**: Evaluating submissions against configured rules
- **Rate limiting**: Tracking per-author post frequency
- **Escalation**: Counting violations in rolling windows
- **Raid detection**: Identifying patterns across authors
- **Moderation dashboard**: Displaying enforcement events to moderators
- **AI summaries**: Generating contextual analysis (only if enabled)

## Data Storage

- **Location**: All data is stored in Reddit's Devvit infrastructure (Redis)
- **Scope**: Data is stored per-subreddit and not shared between subreddits
- **Retention**: Enforcement events are trimmed to the most recent 200 entries
- **Access**: Only moderators of the subreddit can access the data

## Data Sharing

We do **not**:
- Share data with third parties except as required for functionality
- Sell or rent user data
- Use data for advertising or tracking
- Share data between subreddits

**Third-party services:**
- **Anthropic API** (optional): Post titles and removal details are sent to Claude for AI summary generation only if the moderator explicitly requests a summary. Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/legal/privacy).

## Data Security

- API keys are stored as encrypted secrets in Reddit's infrastructure
- The App uses Reddit's permission system to restrict access to moderators only
- All RPC endpoints verify moderator status before processing requests

## User Rights

Moderators can:
- View all enforcement data via the mod panel
- Delete the App to remove all associated data
- Configure or disable individual features
- Export data by viewing the enforcement feed

## Children's Privacy

The App does not knowingly collect data from users under 13. Reddit's Terms of Service prohibit users under 13 from using the platform.

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted in the App's GitHub repository with an updated "Last Updated" date.

## Reddit's Privacy Policy

This App operates on Reddit's platform and is subject to [Reddit's Privacy Policy](https://www.reddit.com/policies/privacy-policy).

## Contact

For privacy questions or concerns:
- GitHub: https://github.com/rogerkorantenng/submission-guard
- Reddit: u/Flat_Lawfulness8889

## Your Consent

By using the App, you consent to this Privacy Policy.
