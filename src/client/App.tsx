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

interface SimulationResult {
  totalEvents: number;
  currentRemovals: number;
  simulatedRemovals: number;
  wouldAccept: number;
  wouldRemove: number;
  delta: number;
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

const REASON_STYLE: Record<RemovalReason, { label: string; bg: string; text: string; glyph: string }> = {
  'invalid-tags': { label: 'Invalid Tags', bg: 'bg-accent-yellow/20', text: 'text-accent-yellow', glyph: '#' },
  'nsfw-in-title': { label: 'NSFW in Title', bg: 'bg-accent-red/20', text: 'text-accent-red', glyph: '!' },
  'long-paragraph': { label: 'Long Paragraph', bg: 'bg-accent-orange/20', text: 'text-accent-orange', glyph: 'P' },
  'code-block': { label: 'Code Block', bg: 'bg-accent-purple/20', text: 'text-accent-purple', glyph: '{' },
  'rate-limit': { label: 'Rate Limit', bg: 'bg-accent-blue/20', text: 'text-accent-blue', glyph: 'T' },
};

function StatsBar({ stats }: { stats: GuardStats }) {
  const Card = ({ label, value }: { label: string; value: number | string }) => (
    <div className="flex flex-col rounded-md border border-dark-border bg-dark-card px-4 py-3 shadow-card">
      <span className="text-[10px] font-medium uppercase tracking-wide text-text-muted">{label}</span>
      <span className="mt-1.5 text-2xl font-semibold tabular-nums text-text-primary">{value}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3 px-5 pt-5 sm:grid-cols-4">
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
    <div className="mx-5 my-4 rounded-md border border-dark-border bg-dark-card p-4 shadow-card">
      <h3 className="text-sm font-semibold text-text-primary">By Rule</h3>
      <ul className="mt-3 space-y-2">
        {reasons.map(([reason, count]) => {
          const style = REASON_STYLE[reason];
          const pct = Math.round((count / max) * 100);
          return (
            <li key={reason} className="flex items-center gap-2.5 text-xs">
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
              >
                {style.glyph}
              </span>
              <span className="w-32 text-text-secondary">{style.label}</span>
              <div className="flex-1 overflow-hidden rounded-full bg-dark-hover">
                <div className={`h-1.5 rounded-full ${style.bg}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="w-8 text-right font-mono tabular-nums text-text-primary">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FeedRow({
  ev,
  selected,
  onToggle,
  onReapprove,
}: {
  ev: EnforcementEvent;
  selected: boolean;
  onToggle: (id: string) => void;
  onReapprove: (postId: string) => void;
}) {
  const [reapproving, setReapproving] = useState(false);
  const [done, setDone] = useState(ev.reapproved ?? false);
  const [showAiSummary, setShowAiSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const style = REASON_STYLE[ev.reason];

  const fetchAiSummary = async () => {
    if (aiSummary) return; // Already loaded
    setLoadingAi(true);
    try {
      const result = await rpc<{ event: EnforcementEvent }, { summary: string } | { error: string }>('ai:summary', { event: ev });
      if ('summary' in result) {
        setAiSummary(result.summary);
      } else {
        setAiSummary(`Error: ${result.error}`);
      }
    } catch (err) {
      setAiSummary(`Error: ${String(err)}`);
    } finally {
      setLoadingAi(false);
    }
  };
  return (
    <li className={`border-b border-dark-border px-4 py-3 transition hover:bg-dark-hover last:border-b-0 ${ev.reapproved ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(ev.id)}
          className="mt-1 h-4 w-4 rounded border-dark-border bg-dark-bg text-accent-blue focus:ring-2 focus:ring-accent-blue/40"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 items-center justify-center rounded px-1.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
            >
              {style.glyph}
            </span>
            <span className="text-sm text-text-primary">{ev.title}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            <span>u/{ev.authorName}</span>
            <span>•</span>
            <span className={`font-semibold ${style.text}`}>{style.label}</span>
            <span>•</span>
            <span>
              {new Date(ev.ts).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
          <div className="mt-2 text-xs italic text-text-muted">{ev.detail}</div>
          <div className="mt-2 flex items-center gap-3">
            {ev.permalink && (
              <a
                href={`https://www.reddit.com${ev.permalink}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent-blue hover:underline"
              >
                View post
              </a>
            )}
            <button
              type="button"
              onClick={async () => {
                if (!showAiSummary) {
                  await fetchAiSummary();
                }
                setShowAiSummary(!showAiSummary);
              }}
              disabled={loadingAi}
              className="text-xs text-accent-purple hover:underline disabled:opacity-50"
            >
              {loadingAi ? 'Loading...' : showAiSummary ? 'Hide' : 'AI Summary'}
            </button>
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
                className="text-xs text-accent-green hover:underline disabled:opacity-50"
              >
                {reapproving ? 'Reapproving...' : 'Reapprove'}
              </button>
            )}
            {done && (
              <span className="text-xs text-accent-green">
                ✓ Reapproved
                {ev.reapprovedBy && ev.reapprovedAt && (
                  <span className="ml-1 text-text-muted">
                    by {ev.reapprovedBy} {new Date(ev.reapprovedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </span>
            )}
          </div>
          {showAiSummary && (
            <div className="mt-3 rounded border border-accent-purple/30 bg-accent-purple/5 p-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-purple">AI Analysis</span>
                <span className="text-[10px] text-text-muted">(Claude 3.5 Sonnet)</span>
              </div>
              {loadingAi ? (
                <p className="text-xs text-text-muted">Generating analysis...</p>
              ) : (
                <p className="text-xs leading-relaxed text-text-secondary">{aiSummary}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function SimulatorDrawer({ onClose }: { onClose: () => void }) {
  const [maxWords, setMaxWords] = useState(350);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setErr(null);
    setResult(null);
    try {
      const response = await rpc<
        { settingsOverride: { maxWordsPerParagraph: number } },
        SimulationResult | { error: string }
      >('simulator:run', {
        settingsOverride: {
          maxWordsPerParagraph: maxWords,
        },
      });

      if ('error' in response) {
        setErr(response.error);
      } else {
        setResult(response);
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const inputCls =
    'rounded border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[640px] overflow-y-auto rounded-lg border border-dark-border bg-dark-card shadow-card"
      >
        <header className="flex items-center justify-between border-b border-dark-border bg-dark-bg px-5 py-3">
          <h2 className="text-sm font-semibold text-text-primary">A/B Test Simulator</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-text-muted transition hover:bg-dark-hover hover:text-text-primary"
            aria-label="close"
          >
            ✕
          </button>
        </header>
        <div className="space-y-3 p-5">
          <p className="text-xs leading-relaxed text-text-secondary">
            Test rule changes against past enforcement data. The simulator replays the last 30 days of cached events
            with your new thresholds and shows what would have changed. Evidence-based policy decisions.
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-muted">Max words per paragraph (current: 350)</span>
            <input
              type="number"
              min="50"
              className={inputCls}
              value={maxWords}
              onChange={(e) => setMaxWords(parseInt(e.target.value, 10) || 350)}
              placeholder="400"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              disabled={running}
              onClick={() => void run()}
              className="rounded bg-accent-blue px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {running ? 'Simulating...' : 'Run Simulation'}
            </button>
          </div>
          {err && (
            <p className="rounded border border-accent-red/30 bg-accent-red/10 p-3 text-xs text-accent-red">
              {err}
            </p>
          )}
          {result && (
            <div className="rounded border border-dark-border bg-dark-bg p-4 text-xs shadow-card">
              <div className="font-semibold text-text-primary">Simulation Results (Last 30 Days)</div>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total events analyzed</span>
                  <span className="font-mono font-medium text-text-primary">{result.totalEvents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Current removals</span>
                  <span className="font-mono font-medium text-text-primary">{result.currentRemovals}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Simulated removals</span>
                  <span className="font-mono font-medium text-text-primary">{result.simulatedRemovals}</span>
                </div>
                <div className="mt-3 border-t border-dark-border pt-3">
                  <div className="flex justify-between">
                    <span className="font-medium text-text-secondary">Would accept</span>
                    <span className="font-mono font-semibold text-accent-green">+{result.wouldAccept}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-text-secondary">Would remove</span>
                    <span className="font-mono font-semibold text-accent-red">+{result.wouldRemove}</span>
                  </div>
                  <div className="mt-2 flex justify-between border-t border-dark-border pt-2">
                    <span className="font-semibold text-text-primary">Net change</span>
                    <span className={`font-mono font-bold ${result.delta < 0 ? 'text-accent-green' : 'text-accent-red'}`}>
                      {result.delta > 0 ? '+' : ''}{result.delta}
                    </span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] italic text-text-muted">
                Increasing to {maxWords} words would have accepted {result.wouldAccept} more posts.
                {result.delta < 0 ? ' This change reduces false positives.' : ' Consider impact on queue volume.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
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
    'rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[680px] overflow-y-auto rounded-2xl border border-dark-border bg-dark-card shadow-glow"
      >
        <header className="flex items-center justify-between border-b border-dark-border bg-dark-bg px-6 py-5">
          <h2 className="text-xl font-bold text-text-primary">Rule Preview</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition hover:bg-dark-hover hover:text-text-primary"
            aria-label="close"
          >
            ✕
          </button>
        </header>
        <div className="space-y-4 p-6">
          <p className="text-xs leading-relaxed text-text-secondary">
            Paste a hypothetical post title + body. Submission Guard will run every active rule against your current settings and tell you exactly what would happen.
          </p>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Title</span>
            <input
              type="text"
              className={inputCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Test post [Part 2]"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Body</span>
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
              className="rounded-lg bg-accent-blue px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-blue/90 disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run Preview'}
            </button>
          </div>
          {err && (
            <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-4 text-xs text-accent-red">
              {err}
            </p>
          )}
          {result && (
            <div className="rounded-lg border border-dark-border bg-dark-bg p-5 text-sm shadow-card">
              {result.type === 'accept' ? (
                <div>
                  <div className="font-bold text-accent-green">Would be accepted</div>
                  <div className="mt-2 text-xs leading-relaxed text-text-secondary">
                    {result.isSeries
                      ? result.isFinal
                        ? 'Detected as final series entry (series flair would apply, reminder skipped).'
                        : 'Detected as series. Auto-flair + reminder DM + sticky comment would fire.'
                      : 'No rule fires. Post passes.'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-accent-red">
                    Would be removed: {REASON_STYLE[result.reason].label}
                  </div>
                  <div className="mt-2 text-xs leading-relaxed text-text-secondary">{result.detail}</div>
                  {result.waitPhrase && (
                    <div className="mt-2 text-xs leading-relaxed text-text-secondary">
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

interface PresetSummary {
  id: string;
  label: string;
  description: string;
}

function SettingsDrawer({
  settings,
  onSave,
  onPresetApplied,
  onClose,
}: {
  settings: GuardSettings;
  onSave: (next: GuardSettings) => Promise<void>;
  onPresetApplied: () => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<GuardSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [presets, setPresets] = useState<PresetSummary[]>([]);
  const [applyingPreset, setApplyingPreset] = useState<string | null>(null);

  useEffect(() => {
    rpc<undefined, { presets: PresetSummary[] }>('presets:list')
      .then((r) => setPresets(r.presets))
      .catch(() => undefined);
  }, []);

  const applyPreset = async (id: string) => {
    setApplyingPreset(id);
    setErr(null);
    try {
      await rpc<{ id: string }, { ok: true }>('presets:apply', { id });
      const next = await rpc<undefined, GuardSettings>('settings:get');
      setDraft(next);
      await onPresetApplied();
    } catch (e) {
      setErr(String(e));
    } finally {
      setApplyingPreset(null);
    }
  };

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

  type ToggleKey = keyof Pick<
    GuardSettings,
    | 'enableTitleTags'
    | 'enableNsfwTitle'
    | 'enableLongParagraph'
    | 'enableCodeBlock'
    | 'enableRateLimit'
    | 'enableSeriesAutoFlair'
    | 'enableSeriesReminderComment'
    | 'enableEscalation'
    | 'enableRaidDetection'
  >;
  const Toggle = ({ k, label }: { k: ToggleKey; label: string }) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(draft[k])}
        onChange={(e) => setDraft({ ...draft, [k]: e.target.checked })}
        className="h-4 w-4 rounded border-dark-border text-accent-blue focus:ring-accent-blue/40"
      />
      <span className="text-text-primary">{label}</span>
    </label>
  );

  const inputCls =
    'rounded-lg border border-dark-border bg-dark-bg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none focus:ring-2 focus:ring-accent-blue/40';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-[720px] overflow-y-auto rounded-2xl border border-dark-border bg-dark-card shadow-glow"
      >
        <header className="flex items-center justify-between border-b border-dark-border bg-dark-bg px-6 py-5">
          <h2 className="text-xl font-bold text-text-primary">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-muted transition hover:bg-dark-hover hover:text-text-primary"
            aria-label="close"
          >
            ✕
          </button>
        </header>

        <div className="space-y-6 p-6">
          {presets.length > 0 && (
            <section>
              <h3 className="text-lg font-bold text-text-primary">Presets</h3>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Apply a tuned preset for a known long-form sub. Overwrites your current settings; you can still edit afterward.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={applyingPreset !== null}
                    onClick={() => void applyPreset(p.id)}
                    className="rounded-lg border border-dark-border bg-dark-bg p-4 text-left transition hover:border-accent-blue disabled:opacity-50"
                  >
                    <div className="font-semibold text-text-primary">{p.label}</div>
                    <div className="mt-1 text-xs leading-snug text-text-secondary">{p.description}</div>
                    {applyingPreset === p.id && (
                      <div className="mt-2 text-xs font-semibold uppercase tracking-wider text-accent-blue">
                        Applying...
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="border-t border-dark-border pt-6">
            <h3 className="text-lg font-bold text-text-primary">Enforce</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
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

          <section className="border-t border-dark-border pt-6">
            <h3 className="text-lg font-bold text-text-primary">Thresholds</h3>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Max words per paragraph
                </span>
                <input
                  type="number"
                  min="50"
                  className={inputCls}
                  value={draft.maxWordsPerParagraph}
                  onChange={(e) =>
                    setDraft({ ...draft, maxWordsPerParagraph: parseInt(e.target.value, 10) || 350 })
                  }
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Rate limit window (seconds)
                </span>
                <input
                  type="number"
                  min="3600"
                  className={inputCls}
                  value={draft.rateLimitWindowSec}
                  onChange={(e) =>
                    setDraft({ ...draft, rateLimitWindowSec: parseInt(e.target.value, 10) || 86400 })
                  }
                />
              </label>
              <label className="col-span-2 flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Custom title tag patterns (one regex per line)
                </span>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={draft.customTitleTagPatterns.join('\n')}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      customTitleTagPatterns: e.target.value.split('\n').filter((x) => x.trim()),
                    })
                  }
                  placeholder="[WP]\n[EU]\n[CW]"
                />
              </label>
              <label className="col-span-2 flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Series flair CSS class
                </span>
                <input
                  type="text"
                  className={inputCls}
                  value={draft.seriesFlairCssClass}
                  onChange={(e) => setDraft({ ...draft, seriesFlairCssClass: e.target.value })}
                  placeholder="flair-series"
                />
              </label>
            </div>
          </section>

          {err && (
            <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-4 text-xs text-accent-red">
              {err}
            </p>
          )}

          <div className="flex justify-end gap-3 border-t border-dark-border pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-dark-border bg-dark-bg px-5 py-2 text-sm font-semibold text-text-primary transition hover:bg-dark-hover"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-accent-blue px-5 py-2 text-sm font-semibold text-white transition hover:bg-accent-blue/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function App() {
  const [me, setMe] = useState<WhoAmI | null>(null);
  const [meErr, setMeErr] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [settings, setSettings] = useState<GuardSettings | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkReapproving, setBulkReapproving] = useState(false);

  useEffect(() => {
    rpc<undefined, WhoAmI>('whoami')
      .then(setMe)
      .catch(() => setMeErr('Failed to load user info'));
  }, []);

  useEffect(() => {
    if (!settingsOpen && !settings) {
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

  const handleBulkReapprove = async () => {
    setBulkReapproving(true);
    try {
      const events = enforcement.data?.events ?? [];
      const selected = events.filter((ev) => selectedIds.has(ev.id));
      console.log(`[BulkReapprove] Starting bulk reapproval of ${selected.length} items`, selected.map(ev => ev.postId));

      let succeeded = 0;
      let failed = 0;

      for (const ev of selected) {
        try {
          console.log(`[BulkReapprove] Reapproving ${ev.postId}...`);
          const result = await rpc<{ postId: string }, { ok: true } | { error: string }>('reapprove', { postId: ev.postId });
          if ('error' in result) {
            console.error(`[BulkReapprove] Failed to reapprove ${ev.postId}:`, result.error);
            failed++;
          } else {
            console.log(`[BulkReapprove] Successfully reapproved ${ev.postId}`);
            succeeded++;
          }
        } catch (err) {
          console.error(`[BulkReapprove] Exception reapproving ${ev.postId}:`, err);
          failed++;
        }
      }

      console.log(`[BulkReapprove] Complete: ${succeeded} succeeded, ${failed} failed`);
      setSelectedIds(new Set());
      setRefreshNonce((n) => n + 1);
    } finally {
      setBulkReapproving(false);
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const events = enforcement.data?.events ?? [];
    if (selectedIds.size === events.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((ev) => ev.id)));
    }
  };

  if (meErr) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg p-8">
        <p className="rounded-lg border border-accent-red/30 bg-accent-red/10 p-6 text-center text-sm text-accent-red">
          {meErr}
        </p>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg p-8">
        <div className="text-center text-sm text-text-secondary">Loading...</div>
      </div>
    );
  }

  if (!me.isMod) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-bg p-8">
        <div className="max-w-md rounded-xl border border-dark-border bg-dark-card p-8 text-center shadow-card">
          <h1 className="text-2xl font-bold text-text-primary">Submission Guard</h1>
          <p className="mt-4 leading-relaxed text-text-secondary">
            This is a mod-only panel. Only moderators of r/{me.subreddit} can access this.
          </p>
        </div>
      </div>
    );
  }

  const events = enforcement.data?.events ?? [];

  return (
    <main className="min-h-screen bg-dark-bg font-sans text-text-primary">
      <header className="border-b border-dark-border bg-dark-card px-5 py-4 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Submission Guard</h1>
            <p className="mt-0.5 text-xs text-text-muted">r/{me.subreddit}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSimulatorOpen(true)}
              className="rounded border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-dark-hover hover:text-text-primary"
            >
              A/B Test
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="rounded border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-dark-hover hover:text-text-primary"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="rounded border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:bg-dark-hover hover:text-text-primary"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="rounded bg-accent-blue px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
            >
              Settings
            </button>
          </div>
        </div>
      </header>

      {stats.data && <StatsBar stats={stats.data} />}
      {stats.data && <ByReasonBlock byReason={stats.data.byReason} />}

      <section>
        <div className="flex items-center justify-between px-5 pt-5">
          <h2 className="text-sm font-semibold text-text-primary">Recent Enforcement</h2>
          {events.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={selectedIds.size === events.length && events.length > 0}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 rounded border-dark-border bg-dark-bg text-accent-blue"
                />
                Select all
              </label>
              {selectedIds.size > 0 && (
                <button
                  type="button"
                  disabled={bulkReapproving}
                  onClick={handleBulkReapprove}
                  className="rounded bg-accent-green px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {bulkReapproving ? `Reapproving ${selectedIds.size}...` : `Reapprove ${selectedIds.size}`}
                </button>
              )}
            </div>
          )}
        </div>
        {enforcement.loading && <p className="px-6 py-4 text-sm text-text-secondary">Loading...</p>}
        {enforcement.error && (
          <p className="mx-6 my-4 rounded-lg border border-accent-red/30 bg-accent-red/10 p-4 text-xs text-accent-red">
            {enforcement.error}
          </p>
        )}
        {!enforcement.loading && !enforcement.error && events.length === 0 && (
          <p className="px-6 py-8 text-sm italic text-text-muted">
            No enforcement actions yet. Submit a post that breaks a rule, or wait for the next user submission.
          </p>
        )}
        {events.length > 0 && (
          <ul className="mx-5 mt-3 mb-6 overflow-hidden rounded-md border border-dark-border bg-dark-card shadow-card">
            {events.map((ev) => (
              <FeedRow
                key={ev.id}
                ev={ev}
                selected={selectedIds.has(ev.id)}
                onToggle={toggleSelection}
                onReapprove={handleReapprove}
              />
            ))}
          </ul>
        )}
      </section>

      {settingsOpen && settings && (
        <SettingsDrawer
          settings={settings}
          onSave={async (saved) => {
            await rpc<GuardSettings, { ok: true }>('settings:save', saved);
            setSettings(saved);
            setRefreshNonce((n) => n + 1);
          }}
          onPresetApplied={async () => {
            const next = await rpc<undefined, GuardSettings>('settings:get');
            setSettings(next);
            setRefreshNonce((n) => n + 1);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {simulatorOpen && <SimulatorDrawer onClose={() => setSimulatorOpen(false)} />}
      {previewOpen && <PreviewDrawer onClose={() => setPreviewOpen(false)} />}
    </main>
  );
}
