import { useEffect, useState } from 'react';
import { rpc } from './lib/rpc';
import { useRpc } from './hooks/useRpc';
import type { EnforcementEvent, GuardSettings, RemovalReason } from '@shared/types';

interface WhoAmI {
  isMod: boolean;
  modName: string | null;
  modId: string | null;
  subreddit: string;
}

interface GuardStats {
  totalRemovals: number;
  windows: { last24h: number; last7d: number; last30d: number };
  byReason: Record<RemovalReason, number>;
  topAuthors: Array<{ author: string; count: number }>;
}

type EvaluateResult =
  | { type: 'accept'; isSeries: boolean; isFinal: boolean }
  | {
      type: 'remove';
      reason: RemovalReason;
      detail: string;
      waitPhrase?: string;
      allowReapproval: boolean;
      isSeries: boolean;
      isFinal: boolean;
    };

const REASON_STYLE: Record<RemovalReason, { label: string; chip: string; glyph: string }> = {
  'invalid-tags': { label: 'invalid tags', chip: 'bg-amber-400/15 text-amber-600', glyph: '#' },
  'nsfw-in-title': { label: 'NSFW in title', chip: 'bg-crimson-400/15 text-crimson-500', glyph: '!' },
  'long-paragraph': { label: 'long paragraph', chip: 'bg-amber-400/15 text-amber-600', glyph: 'P' },
  'code-block': { label: 'code block', chip: 'bg-ink-400/15 text-ink-600', glyph: '{' },
  'rate-limit': { label: 'rate limit', chip: 'bg-amber-500/15 text-amber-600', glyph: 'T' },
};

function StatsBar({ stats }: { stats: GuardStats }) {
  const Card = ({ label, value }: { label: string; value: number | string }) => (
    <div className="flex flex-col rounded-lg border border-paper-200 bg-white px-4 py-3 shadow-page">
      <span className="text-[10px] uppercase tracking-wider text-ink-400">{label}</span>
      <span className="mt-0.5 font-display text-2xl leading-tight text-ink-700">{value}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 px-6 pt-4 sm:grid-cols-4">
      <Card label="Last 24h" value={stats.windows.last24h} />
      <Card label="Last 7d" value={stats.windows.last7d} />
      <Card label="Last 30d" value={stats.windows.last30d} />
      <Card label="Total" value={stats.totalRemovals} />
    </div>
  );
}

function ByReasonBlock({ byReason }: { byReason: Record<RemovalReason, number> }) {
  const reasons = Object.entries(byReason) as Array<[RemovalReason, number]>;
  const max = Math.max(1, ...reasons.map(([, n]) => n));
  return (
    <div className="mx-6 my-3 rounded-lg border border-paper-200 bg-white p-4 shadow-page">
      <h3 className="font-display text-base text-ink-700">By rule</h3>
      <ul className="mt-2 space-y-1.5">
        {reasons.map(([reason, count]) => {
          const style = REASON_STYLE[reason];
          const pct = Math.round((count / max) * 100);
          return (
            <li key={reason} className="flex items-center gap-3 text-xs">
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${style.chip}`}
              >
                {style.glyph}
              </span>
              <span className="w-32 text-ink-600">{style.label}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-paper-100">
                <div className={`h-2 ${style.chip.split(' ')[0]}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right tabular-nums text-ink-700">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeedRow({
  ev,
  onReapprove,
}: {
  ev: EnforcementEvent;
  onReapprove: (postId: string) => void;
}) {
  const [reapproving, setReapproving] = useState(false);
  const [done, setDone] = useState(false);
  const style = REASON_STYLE[ev.reason];
  return (
    <li className="border-b border-paper-200 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3 text-xs">
        <span
          className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${style.chip}`}
          aria-label={style.label}
        >
          {style.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-sm leading-snug text-ink-700">
            {ev.title || '(no title)'}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
            <span>u/{ev.authorName}</span>
            <span>|</span>
            <span className="font-medium text-ink-600">{style.label}</span>
            <span>|</span>
            <span>
              {new Date(ev.ts).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="mt-1 text-[11px] italic text-ink-400">{ev.detail}</div>
          <div className="mt-1.5 flex items-center gap-3">
            {ev.permalink && (
              <a
                href={`https://www.reddit.com${ev.permalink}`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-amber-600 underline-offset-2 hover:underline"
              >
                View post
              </a>
            )}
            {!done && (
              <button
                type="button"
                disabled={reapproving}
                onClick={async () => {
                  setReapproving(true);
                  try {
                    await onReapprove(ev.postId);
                    setDone(true);
                  } finally {
                    setReapproving(false);
                  }
                }}
                className="text-[11px] text-sage-500 underline-offset-2 hover:underline disabled:opacity-50"
              >
                {reapproving ? 'Reapproving...' : 'Reapprove'}
              </button>
            )}
            {done && <span className="text-[11px] text-sage-500">Reapproved</span>}
          </div>
        </div>
      </div>
    </li>
  );
}

function PreviewDrawer({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setErr(null);
    try {
      const r = await rpc<{ title: string; body: string }, EvaluateResult>('preview', {
        title,
        body,
      });
      setResult(r);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const inputCls =
    'rounded-md border border-paper-200 bg-paper-50 px-2 py-1.5 text-sm text-ink-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40';

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-800/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[640px] overflow-y-auto rounded-xl border border-paper-200 bg-paper-50 shadow-page"
      >
        <header className="flex items-center justify-between border-b border-paper-200 bg-paper-100 px-5 py-4">
          <h2 className="font-display text-xl text-ink-700">Rule preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-paper-200"
            aria-label="close"
          >
            ×
          </button>
        </header>
        <div className="space-y-3 p-5">
          <p className="text-xs text-ink-400">
            Paste a hypothetical post title + body. Submission Guard will run every active rule
            against your current settings and tell you exactly what would happen. AutoMod doesn't
            let you dry-run rule changes -- this does.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-ink-400">Title</span>
            <input
              type="text"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Test post [Part 2]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs uppercase tracking-wider text-ink-400">Body</span>
            <textarea
              rows={8}
              className={inputCls}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Test body text..."
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={running || !title}
              onClick={() => void run()}
              className="rounded-md bg-ink-700 px-4 py-1.5 text-sm font-medium text-paper-50 hover:bg-ink-800 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run preview'}
            </button>
          </div>
          {err && (
            <p className="rounded border border-crimson-400/30 bg-crimson-400/10 p-3 text-xs text-crimson-500">
              {err}
            </p>
          )}
          {result && (
            <div className="rounded-lg border border-paper-200 bg-white p-4 text-sm shadow-page">
              {result.type === 'accept' ? (
                <div>
                  <div className="font-display text-base text-sage-500">Would be accepted</div>
                  <div className="mt-1 text-xs text-ink-400">
                    {result.isSeries
                      ? result.isFinal
                        ? 'Detected as final series entry (series flair would apply, reminder skipped).'
                        : 'Detected as series. Auto-flair + reminder DM + sticky comment would fire.'
                      : 'No rule fires. Post passes.'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-display text-base text-crimson-500">
                    Would be removed: {REASON_STYLE[result.reason].label}
                  </div>
                  <div className="mt-1 text-xs text-ink-400">{result.detail}</div>
                  {result.waitPhrase && (
                    <div className="mt-1 text-xs text-ink-400">
                      Author would be told to wait: {result.waitPhrase}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsDrawer({
  settings,
  onSave,
  onClose,
}: {
  settings: GuardSettings;
  onSave: (next: GuardSettings) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GuardSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      await onSave(draft);
      onClose();
    } catch (e) {
      setErr(String(e));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'rounded-md border border-paper-200 bg-paper-50 px-2 py-1 text-sm text-ink-700 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40';

  const Toggle = ({ k, label }: { k: keyof GuardSettings; label: string }) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(draft[k])}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })}
        className="h-4 w-4 rounded border-paper-300 text-amber-500"
      />
      <span className="text-ink-700">{label}</span>
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink-800/30 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[640px] overflow-y-auto rounded-xl border border-paper-200 bg-paper-50 shadow-page"
      >
        <header className="flex items-center justify-between border-b border-paper-200 bg-paper-100 px-5 py-4">
          <h2 className="font-display text-xl text-ink-700">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-400 hover:bg-paper-200"
            aria-label="close"
          >
            ×
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <h3 className="font-display text-base text-ink-700">Enforce</h3>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Toggle k="enableTitleTags" label="Title tag whitelist" />
              <Toggle k="enableNsfwTitle" label="NSFW in title" />
              <Toggle k="enableLongParagraph" label="Long paragraph" />
              <Toggle k="enableCodeBlock" label="Code blocks" />
              <Toggle k="enableRateLimit" label="Rate limit" />
              <Toggle k="enableSeriesAutoFlair" label="Auto-flair series" />
              <Toggle k="enableSeriesReminderComment" label="Series reminder DM/comment" />
              <Toggle k="enableEscalation" label="Cumulative warnings (1st = warn only)" />
              <Toggle k="enableRaidDetection" label="Raid alert (modmail mods)" />
            </div>
          </section>

          <section className="border-t border-paper-200 pt-4">
            <h3 className="font-display text-base text-ink-700">Thresholds</h3>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  Max words / paragraph
                </span>
                <input
                  type="number"
                  min={50}
                  max={5000}
                  className={inputCls}
                  value={draft.maxWordsPerParagraph}
                  onChange={(e) =>
                    setDraft({ ...draft, maxWordsPerParagraph: Number(e.target.value) || 350 })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  Rate limit window (seconds)
                </span>
                <input
                  type="number"
                  min={60}
                  max={604800}
                  className={inputCls}
                  value={draft.rateLimitWindowSec}
                  onChange={(e) =>
                    setDraft({ ...draft, rateLimitWindowSec: Number(e.target.value) || 86400 })
                  }
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  Series flair CSS class
                </span>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.seriesFlairCssClass}
                  onChange={(e) => setDraft({ ...draft, seriesFlairCssClass: e.target.value })}
                />
              </label>
              <label className="col-span-2 flex flex-col gap-1 text-sm">
                <span className="text-xs uppercase tracking-wider text-ink-400">
                  Custom title tag patterns (one regex per line)
                </span>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={draft.customTitleTagPatterns.join('\n')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      customTitleTagPatterns: e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>
          </section>

          {err && (
            <p className="rounded border border-crimson-400/30 bg-crimson-400/10 p-3 text-xs text-crimson-500">
              {err}
            </p>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-paper-200 bg-paper-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-1.5 text-sm text-ink-600 hover:bg-paper-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-md bg-ink-700 px-4 py-1.5 text-sm font-medium text-paper-50 hover:bg-ink-800 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function App() {
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settings, setSettings] = useState<GuardSettings | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    rpc<undefined, WhoAmI>('whoami').then(setMe).catch((e: unknown) => setMeErr(String(e)));
  }, []);

  useEffect(() => {
    if (settingsOpen && !settings) {
      rpc<undefined, GuardSettings>('settings:get').then(setSettings).catch(() => undefined);
    }
  }, [settingsOpen, settings]);

  const enforcement = useRpc<undefined, { events: EnforcementEvent[] }>(
    'enforcement:list',
    undefined,
    [refreshNonce],
  );
  const stats = useRpc<undefined, GuardStats>('stats:get', undefined, [refreshNonce]);

  const handleReapprove = async (postId: string) => {
    await rpc<{ postId: string }, { ok: true }>('reapprove', { postId });
    setRefreshNonce((n) => n + 1);
  };

  if (meErr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-50 p-8">
        <p className="text-sm text-crimson-500">Failed to load: {meErr}</p>
      </div>
    );
  }
  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper-50 p-8">
        <p className="text-sm text-ink-400">Loading...</p>
      </div>
    );
  }
  if (!me.isMod) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-paper-50 p-8 text-center">
        <h2 className="font-display text-2xl text-ink-700">Mod-only tool</h2>
        <p className="mt-2 max-w-sm text-sm text-ink-400">
          Submission Guard's mod panel is reserved for moderators of{' '}
          <span className="font-medium text-ink-700">r/{me.subreddit}</span>.
        </p>
      </div>
    );
  }

  const events = enforcement.data?.events ?? [];

  return (
    <main className="min-h-screen bg-paper-50 font-sans text-ink-700">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-paper-200 bg-paper-100 px-6 py-3 shadow-page">
        <div>
          <h1 className="font-display text-xl text-ink-700">Submission Guard</h1>
          <p className="text-[11px] uppercase tracking-wider text-ink-400">r/{me.subreddit}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="rounded-md border border-paper-200 bg-paper-50 px-3 py-1 text-xs text-ink-600 hover:bg-paper-200"
          >
            Preview rules
          </button>
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="rounded-md border border-paper-200 bg-paper-50 px-3 py-1 text-xs text-ink-600 hover:bg-paper-200"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md bg-ink-700 px-3 py-1 text-xs font-medium text-paper-50 hover:bg-ink-800"
          >
            Settings
          </button>
        </div>
      </header>

      {stats.data && <StatsBar stats={stats.data} />}
      {stats.data && <ByReasonBlock byReason={stats.data.byReason} />}

      <section>
        <h2 className="px-6 pt-2 font-display text-base text-ink-700">Recent enforcement</h2>
        {enforcement.loading && <p className="px-6 py-3 text-xs text-ink-400">Loading...</p>}
        {enforcement.error && (
          <p className="mx-6 my-3 rounded border border-crimson-400/30 bg-crimson-400/10 p-3 text-xs text-crimson-500">
            {enforcement.error}
          </p>
        )}
        {!enforcement.loading && !enforcement.error && events.length === 0 && (
          <p className="px-6 py-6 text-sm italic text-ink-400">
            No enforcement actions yet. Submit a post that breaks a rule, or wait for the next user
            submission.
          </p>
        )}
        {events.length > 0 && (
          <ul className="mx-6 mt-3 mb-8 overflow-hidden rounded-lg border border-paper-200 bg-white shadow-page">
            {events.map((ev) => (
              <FeedRow key={ev.id} ev={ev} onReapprove={handleReapprove} />
            ))}
          </ul>
        )}
      </section>

      {settingsOpen && settings && (
        <SettingsDrawer
          settings={settings}
          onSave={async (next) => {
            const saved = await rpc<GuardSettings, GuardSettings>('settings:save', next);
            setSettings(saved);
            setRefreshNonce((n) => n + 1);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {previewOpen && <PreviewDrawer onClose={() => setPreviewOpen(false)} />}
    </main>
  );
}
