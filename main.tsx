import { Devvit, useWebView } from '@devvit/public-api';
import type { RpcRequest, RpcReply } from '@shared/rpc';
import { dispatch } from './src/server/dispatcher';
import { onPostSubmit } from './src/server/triggers/onPostSubmit';
import { handleModAction } from './src/server/triggers/onModAction';

/**
 * Submission Guard is a port of nosleepautobot to Reddit's Devvit Web
 * platform. It enforces title-tag whitelist, NSFW-in-title, paragraph
 * length, code-block, and per-author rate-limit rules on every new post,
 * and auto-flairs series posts. All thresholds are configurable per-sub.
 *
 * The port layers stateful features the original (and AutoMod) lack:
 * account-age-aware rate tiers, cumulative violation escalation, and
 * cross-author raid detection.
 */
Devvit.configure({
  redditAPI: true,
  redis: true,
  http: true,
});

Devvit.addSettings([
  {
    type: 'string',
    name: 'anthropicApiKey',
    label: 'Anthropic API Key',
    helpText: 'API key for Claude AI summaries (get from console.anthropic.com)',
    scope: 'installation',
  },
]);

Devvit.addTrigger({
  event: 'PostSubmit',
  onEvent: (event, context) =>
    onPostSubmit(event as unknown as Parameters<typeof onPostSubmit>[0], context),
});

/**
 * ModAction trigger -- enables retroactive series detection. When a mod
 * manually applies the configured series flair to a post that was already
 * accepted (because it didn't have a series title tag), the handler fires
 * the series reminder DM + sticky comment.
 */
Devvit.addTrigger({
  event: 'ModAction',
  onEvent: (event, context) =>
    handleModAction(event as unknown as Parameters<typeof handleModAction>[0], context),
});

Devvit.addMenuItem({
  label: 'Submission Guard - Open mod panel',
  location: 'subreddit',
  forUserType: 'moderator',
  onPress: async (_event, context) => {
    const subredditName = await context.reddit.getCurrentSubredditName();
    await context.reddit.submitPost({
      title: 'Submission Guard - mod panel',
      subredditName,
      preview: (
        <vstack height="100%" width="100%" alignment="middle center">
          <text size="large">Loading Submission Guard...</text>
        </vstack>
      ),
    });
    context.ui.showToast({ text: 'Submission Guard mod panel created.' });
  },
});

Devvit.addCustomPostType({
  name: 'Submission Guard',
  height: 'tall',
  render: (context) => {
    const webView = useWebView<RpcRequest, RpcReply>({
      url: 'index.html',
      onMessage: async (msg, hooks) => {
        const reply = (payload: unknown): void => {
          hooks.postMessage({
            type: `${msg.type}:reply`,
            requestId: msg.requestId,
            payload: payload as RpcReply['payload'],
          } as unknown as RpcReply);
        };
        try {
          const result = await dispatch(context, msg);
          return reply(result);
        } catch (err) {
          return reply({ error: String(err) });
        }
      },
    });

    return (
      <vstack height="100%" width="100%" alignment="middle center" padding="medium" gap="medium">
        <text size="xlarge" weight="bold">Submission Guard</text>
        <text size="medium">Mod panel</text>
        <button appearance="primary" onPress={() => webView.mount()}>
          Open mod panel
        </button>
      </vstack>
    );
  },
});

export default Devvit;
