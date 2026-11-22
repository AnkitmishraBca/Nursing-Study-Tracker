'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  History,
  Loader2,
  RefreshCw,
  Save,
  Siren,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react';
import { useStore } from '@/lib/store';

type AiLanguage = 'en' | 'hinglish';
type Group = 'backlog' | 'current' | 'norcet';

interface AiSection {
  heading: string;
  bullets: string[];
}

interface AiResult {
  sections: AiSection[];
  raw: string;
  provider: string;
  providerLabel: string;
  model: string;
  usedFallback: boolean;
  attempts: { provider: string; ok: boolean; error?: string }[];
}

interface ProviderStatus {
  id: string;
  label: string;
  model: string;
  configured: boolean;
}

interface SavedPanic {
  id: string;
  subject_id: string | null;
  subject_name: string;
  content: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

const HISTORY_KEY = 'nst-ai-panic-v1';
const PANIC_SECONDS = 5 * 60;

const GROUP_LABEL: Record<Group, string> = {
  backlog: 'Backlog (1–3 sem)',
  current: 'Current (4th sem)',
  norcet: 'NORCET',
};

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalHistory(): SavedPanic[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SavedPanic[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: SavedPanic[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    /* storage full */
  }
}

function mmss(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PanicRevisionPage() {
  const { state, showToast } = useStore();

  const [group, setGroup] = useState<Group>('current');
  const [subjectId, setSubjectId] = useState<string>('');
  const [extra, setExtra] = useState('');
  const [language, setLanguage] = useState<AiLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [history, setHistory] = useState<SavedPanic[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(PANIC_SECONDS);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const subjects = useMemo(
    () => state.subjects.filter((s) => s.group === group),
    [state.subjects, group],
  );

  useEffect(() => {
    if (!subjectId && subjects.length) setSubjectId(subjects[0].id);
  }, [subjectId, subjects]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/ai', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as { providers: ProviderStatus[] };
          if (!cancelled) setProviders(data.providers ?? []);
        }
      } catch {
        /* offline */
      }

      try {
        const response = await fetch('/api/panic-sessions', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as SavedPanic[];
          if (!cancelled && Array.isArray(data)) {
            setHistory(data);
            writeLocalHistory(data);
            return;
          }
        }
      } catch {
        /* fall back to localStorage */
      }
      if (!cancelled) setHistory(readLocalHistory());
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 5 minute countdown
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          showToast('5 minute over — ab ek round complete hai! 🎉');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, showToast]);

  const selectedSubject = state.subjects.find((s) => s.id === subjectId) ?? null;
  const subjectTopics = useMemo(
    () => state.topics.filter((t) => t.subject_id === subjectId),
    [state.topics, subjectId],
  );

  const activeProvider = providers.find((p) => p.configured);

  const generate = async () => {
    if (!selectedSubject) {
      setError('Pehle subject select karo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'panic-revision',
          language,
          text: '',
          context: {
            subject: `${selectedSubject.name} (${GROUP_LABEL[selectedSubject.group]})`,
            topics: subjectTopics.map((t) => ({
              title: t.title,
              status: t.level1 === 'done' ? 'done' : t.level1 === 'in_progress' ? 'in progress' : 'todo',
            })),
            extra,
          },
        }),
      });
      const data = (await response.json()) as AiResult & { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'AI request fail ho gayi.');
        return;
      }
      setResult(data);
      setSecondsLeft(PANIC_SECONDS);
      setRunning(true);
      showToast('5-minute panic sheet ready — timer chal raha hai ⏱️');
    } catch {
      setError('Server tak request nahi pahunchi. Check karo.');
    } finally {
      setLoading(false);
    }
  };

  const plainText = useMemo(() => {
    if (!result) return '';
    return result.sections
      .map((section) => {
        const head = section.heading.toUpperCase();
        const body = section.bullets.map((b) => `- ${b}`).join('\n');
        return `**${head}**\n${body}`;
      })
      .join('\n\n');
  }, [result]);

  const copyAll = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      showToast('Sheet copy ho gayi 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy nahi hua — manually select karo.');
    }
  };

  const downloadMd = () => {
    if (!plainText || !selectedSubject) return;
    const blob = new Blob([`# 5-Min Panic Revision — ${selectedSubject.name}\n\n${plainText}\n`], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `panic-${selectedSubject.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveToLibrary = async () => {
    if (!result || !selectedSubject) return;
    const item: SavedPanic = {
      id: uid(),
      subject_id: selectedSubject.id,
      subject_name: selectedSubject.name,
      content: plainText,
      provider: result.provider,
      model: result.model,
      created_at: new Date().toISOString(),
    };
    const next = [item, ...history].slice(0, 40);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch('/api/panic-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch {
      /* local copy already saved */
    }
    showToast('Panic sheet save ho gayi ✨');
  };

  const removeFromLibrary = async (id: string) => {
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch(`/api/panic-sessions?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* local copy already removed */
    }
  };

  const loadFromHistory = (item: SavedPanic) => {
    const sections: AiSection[] = item.content
      .split(/\n\n/)
      .map((block) => {
        const lines = block.split('\n');
        const heading = lines[0]?.replace(/\*\*/g, '').trim() ?? '';
        const bullets = lines.slice(1).map((l) => l.replace(/^[-*•]\s*/, '').trim()).filter(Boolean);
        return { heading, bullets };
      })
      .filter((section) => section.heading);
    setResult({
      sections,
      raw: item.content,
      provider: item.provider ?? 'ai',
      providerLabel: item.provider ?? 'Saved sheet',
      model: item.model ?? '',
      usedFallback: false,
      attempts: [],
    });
    setSecondsLeft(PANIC_SECONDS);
    setRunning(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const urgency = secondsLeft <= 60;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-coral">phase 3 • panic mode</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">5-Min Panic Revision</h1>
          <p className="muted mt-1 text-sm">
            Subject chuno → AI high-yield points (normal values, doses, mnemonics) ek 5-minute sheet me de dega.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['en', 'hinglish'] as AiLanguage[]).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`chip transition ${
                language === lang ? 'border-coral/50 bg-coral/15 text-coral' : 'hover:bg-white/10'
              }`}
            >
              {lang === 'en' ? 'Simple English' : 'Hinglish'}
            </button>
          ))}
          {providers.map((provider) => (
            <span
              key={provider.id}
              className={`chip ${provider.configured ? 'border-mint/40 bg-mint/10 text-mint' : 'opacity-50'}`}
            >
              {provider.configured ? <Check size={12} /> : <AlertTriangle size={12} />}
              {provider.label}
            </span>
          ))}
        </div>
      </div>

      {!activeProvider && providers.length > 0 && (
        <div className="card flex items-start gap-3 border-coral/30 bg-coral/[0.06]">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-coral" />
          <div className="text-sm text-slate-300">
            <b className="text-white">Koi AI provider configured nahi hai.</b> Vercel par{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">GEMINI_API_KEY</code> add karo.
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* ---------------- controls ---------------- */}
        <section className="card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Siren size={18} className="text-coral" /> Setup
          </h2>

          <div>
            <label className="label">Group</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(GROUP_LABEL) as Group[]).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGroup(g);
                    setSubjectId('');
                  }}
                  className={`chip transition ${
                    group === g ? 'border-mint/50 bg-mint/15 text-mint' : 'hover:bg-white/10'
                  }`}
                >
                  {GROUP_LABEL[g]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Subject</label>
            <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.length === 0 && <option value="">No subject in this group</option>}
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
            {selectedSubject && (
              <p className="mt-1 text-[11px] text-slate-500">
                {subjectTopics.length} topics •{' '}
                {subjectTopics.filter((t) => t.level1 === 'done').length} done
              </p>
            )}
          </div>

          <div>
            <label className="label">Extra focus (optional)</label>
            <textarea
              className="input min-h-[80px] resize-y"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="e.g. normal values aur drug doses pe extra focus"
            />
          </div>

          <button className="btn-primary w-full" onClick={() => void generate()} disabled={loading || !selectedSubject}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {loading ? 'Sheet ban rahi hai…' : '5-minute panic sheet banao'}
          </button>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
              <Timer size={13} /> Timer
            </div>
            <div className={`mt-1 text-3xl font-black tabular-nums ${urgency ? 'text-coral' : 'text-white'}`}>
              {mmss(secondsLeft)}
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="btn-ghost flex-1 px-3 py-1.5 text-xs"
                onClick={() => {
                  if (running) {
                    setRunning(false);
                  } else {
                    setSecondsLeft(PANIC_SECONDS);
                    setRunning(true);
                  }
                }}
              >
                {running ? 'Pause' : 'Start 5:00'}
              </button>
              <button
                className="btn-ghost px-3 py-1.5 text-xs"
                onClick={() => {
                  setRunning(false);
                  setSecondsLeft(PANIC_SECONDS);
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* ---------------- sheet ---------------- */}
        <section className="card flex min-h-[520px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2">
              <Zap size={18} className="text-sun" /> High-yield sheet
            </h2>
            {result && (
              <div className="flex flex-wrap gap-2">
                <span className="chip border-mint/40 bg-mint/10 text-mint">
                  {result.providerLabel}
                  {result.usedFallback ? ' (fallback)' : ''}
                </span>
                {result.model && <span className="chip">{result.model}</span>}
              </div>
            )}
          </div>

          {!result ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Siren size={42} className="text-coral/60" />
              <h3 className="mt-4 text-lg font-bold text-white">Exam 1 ghante me hai?</h3>
              <p className="muted mt-2 max-w-sm text-sm">
                Subject select karke button dabao — 5 minute me poora high-yield sheet padh lo.
              </p>
            </div>
          ) : (
            <>
              <div className="scroll-thin mt-4 max-h-[520px] space-y-4 overflow-y-auto pr-1">
                {result.sections.map((section, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-mint">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/15 text-[10px] text-mint">
                        {index + 1}
                      </span>
                      {section.heading}
                    </div>
                    <ul className="space-y-1.5">
                      {section.bullets.map((bullet, bulletIndex) => (
                        <li key={bulletIndex} className="flex gap-2 text-sm leading-relaxed text-slate-200">
                          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-sun" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {result.usedFallback && result.attempts.some((a) => !a.ok) && (
                <p className="mt-3 text-[11px] text-sun">
                  Primary provider fail hua, fallback use kiya:{' '}
                  {result.attempts
                    .filter((a) => !a.ok)
                    .map((a) => `${a.provider} (${a.error})`)
                    .join(', ')}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn-ghost" onClick={() => void copyAll()}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy all'}
                </button>
                <button className="btn-ghost" onClick={downloadMd}>
                  <Download size={15} /> .md
                </button>
                <button className="btn-ghost" onClick={() => void saveToLibrary()}>
                  <Save size={15} /> Save sheet
                </button>
                <button className="btn-violet" onClick={() => void generate()} disabled={loading}>
                  <RefreshCw size={15} /> Regenerate
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ---------------- history ---------------- */}
      <section className="card">
        <h2 className="section-title flex items-center gap-2">
          <History size={18} className="text-violet" /> Saved panic sheets
          <span className="text-xs font-normal text-slate-500">({history.length})</span>
        </h2>
        {history.length === 0 ? (
          <p className="muted mt-3 text-sm">Abhi kuch save nahi hua. Sheet bana ke &quot;Save sheet&quot; dabao.</p>
        ) : (
          <div className="scroll-thin mt-3 grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => loadFromHistory(item)}>
                  <div className="truncate text-sm font-semibold text-white">{item.subject_name}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-mint">
                    {item.provider ?? 'ai'} • {new Date(item.created_at).toLocaleDateString('en-IN')}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">{item.content}</div>
                </button>
                <button
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-coral/10 hover:text-coral"
                  onClick={() => void removeFromLibrary(item.id)}
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
