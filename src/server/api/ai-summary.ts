import type { Context } from '@devvit/public-api';
import type { EnforcementEvent } from '@shared/types';
import { isCallerMod } from '../lib/permissions';
import Anthropic from '@anthropic-ai/sdk';

export interface AiSummaryInput {
  event: EnforcementEvent;
}

export interface AiSummaryOutput {
  summary: string;
}

/**
 * Generates a 2-3 sentence AI analysis of an enforcement event using Claude.
 * Called when user clicks "AI Summary" button in the enforcement feed.
 */
export async function aiSummaryHandler(
  context: Context,
  payload: unknown,
): Promise<AiSummaryOutput | { error: string }> {
  if (!(await isCallerMod(context))) {
    console.log('[ai-summary] Forbidden: caller is not a mod');
    return { error: 'forbidden' };
  }

  const body = (payload ?? {}) as Partial<AiSummaryInput>;

  if (!body.event || typeof body.event !== 'object') {
    console.log('[ai-summary] Bad request: missing event');
    return { error: 'event required' };
  }

  const { event } = body;
  console.log(`[ai-summary] Generating summary for postId=${event.postId}, reason=${event.reason}`);

  try {
    // Get API key from app settings
    const apiKey = await context.settings.get<string>('anthropicApiKey');
    if (!apiKey) {
      console.error('[ai-summary] Anthropic API key not configured in app settings');
      return { error: 'API key not configured. Please add it in app settings.' };
    }

    const anthropic = new Anthropic({
      apiKey,
    });

    const prompt = `You are analyzing a Reddit post removal by an automated moderation system. Generate a brief 2-3 sentence analysis explaining what triggered the removal and any context that might be relevant for moderators reviewing this decision.

Post title: "${event.title}"
Removal reason: ${event.reason}
Detail: ${event.detail}
Author: u/${event.authorName}

Provide a concise, professional analysis suitable for a moderation dashboard.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log(`[ai-summary] Generated summary: ${summary.substring(0, 100)}...`);

    return { summary };
  } catch (err) {
    console.error('[ai-summary] Error:', err);
    return { error: String(err) };
  }
}
