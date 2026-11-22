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
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useStore } from '@/lib/store';

type AiMode = 'short-notes' | 'key-points' | 'one-liner' | 'mcq';
type AiLanguage = 'en' | 'hinglish';

interface AiNoteLine {
  type: 'heading' | 'bullet' | 'paragraph';
  text: string;
}

interface AiResult {
  notes: string[];
  lines: AiNoteLine[];
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

interface SavedNote {
  id: string;
  title: string;
  source_text: string;
  mode: string;
  language: string;
  provider: string | null;
  model: string | null;
  content: string;
  created_at: string;
}

const HISTORY_KEY = 'nst-ai-notes-v1';

const MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: 'short-notes', label: 'Short Notes', hint: 'Exam-ready bullets' },
  { id: 'key-points', label: 'Key Points', hint: 'High-yield facts only' },
  { id: 'one-liner', label: 'One-Liners', hint: 'Flashcard style' },
  { id: 'mcq', label: 'MCQ Style', hint: 'Q + options + answer' },
];

function readLocalHistory(): SavedNote[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SavedNote[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(notes: SavedNote[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(notes.slice(0, 60)));
  } catch {
    /* storage full */
  }
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <b key={index} className="font-bold text-white">
        {part.slice(2, -2)}
      </b>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export default function AiNotesPage() {
  const { update, showToast } = useStore();

  const [text, setText] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<AiMode>('short-notes');
  const [language, setLanguage] = useState<AiLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [history, setHistory] = useState<SavedNote[]>([]);

  // provider status + saved history (cloud if Supabase connected, else localStorage)
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
        /* offline -> keep silent, generate button will show the error */
      }

      try {
        const response = await fetch('/api/ai-notes', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as SavedNote[];
          if (!cancelled && Array.isArray(data)) {
            setHistory(data);
            writeLocalHistory(data);
            return;
          }
        }
      } catch {
        /* fall back to localStorage below */
      }
      if (!cancelled) setHistory(readLocalHistory());
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProvider = providers.find((p) => p.configured);
  const plainText = useMemo(
    () => (result ? result.lines.map((l) => (l.type === 'heading' ? `**${l.text}**` : `- ${l.text}`)).join('\n') : ''),
    [result],
  );

  const generate = async () => {
    if (!text.trim()) {
      setError('Pehle topic ya text likho.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, topic, mode, language }),
      });
      const data = (await response.json()) as AiResult & { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'AI request fail ho gayi.');
        setResult(null);
        return;
      }
      setResult(data);
      showToast(`${data.providerLabel} ne notes bana diye ✨`);
    } catch {
      setError('Server tak request nahi pahunchi. Internet / server check karo.');
    } finally {
      setLoading(false);
    }
  };

  const copyAll = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      showToast('Notes copy ho gaye 📋');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy nahi hua — manually select karo.');
    }
  };

  const downloadMd = () => {
    if (!plainText) return;
    const blob = new Blob([`# ${topic || 'AI Short Notes'}\n\n${plainText}\n`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(topic || 'ai-short-notes').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveToBrainDump = () => {
    if (!result) return;
    const title = topic.trim() || result.notes[0]?.slice(0, 40) || 'AI Short Notes';
    const now = new Date().toISOString();
    update((draft) => {
      draft.notes.unshift({
        id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `an-${Date.now()}`,
        title: `AI: ${title}`,
        body: plainText,
        created_at: now,
        updated_at: now,
      });
    });
    showToast('Brain Dump me save ho gaya 🧠');
  };

  const saveToLibrary = async () => {
    if (!result) return;
    const note: SavedNote = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `an-${Date.now()}`,
      title: topic.trim() || result.notes[0]?.slice(0, 40) || 'AI Short Notes',
      source_text: text,
      mode,
      language,
      provider: result.provider,
      model: result.model,
      content: plainText,
      created_at: new Date().toISOString(),
    };
    const next = [note, ...history].slice(0, 60);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch('/api/ai-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
    } catch {
      /* local copy already saved */
    }
    showToast('AI library me save ho gaya ✨');
  };

  const removeFromLibrary = async (id: string) => {
    const next = history.filter((note) => note.id !== id);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch(`/api/ai-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* local copy already removed */
    }
  };

  const loadFromHistory = (note: SavedNote) => {
    setTopic(note.title);
    setText(note.source_text);
    setMode((note.mode as AiMode) || 'short-notes');
    setLanguage((note.language as AiLanguage) || 'en');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">phase 2 • ai</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            AI Short Note Maker
          </h1>
          <p className="muted mt-1 text-sm">
            Topic likho ya chapter ka text paste karo — Gemini usse exam-ready short notes bana dega.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {providers.length === 0 && <span className="chip">Checking providers…</span>}
          {providers.map((provider) => (
            <span
              key={provider.id}
              className={`chip ${provider.configured ? 'border-mint/40 bg-mint/10 text-mint' : 'opacity-50'}`}
              title={provider.configured ? `Model: ${provider.model}` : 'API key missing'}
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
            <b className="text-white">Koi AI provider configured nahi hai.</b> Project root me{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">.env.local</code> me{' '}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">GEMINI_API_KEY=…</code>{' '}
            add karo aur dev server restart karo. Vercel par same variable Environment Variables me daalo.
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------------- input ---------------- */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Wand2 size={18} className="text-violet" /> Input
          </h2>

          <label className="label mt-4">Topic (optional)</label>
          <input
            className="input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Anatomy of Heart"
          />

          <label className="label mt-4">Text / topic for the AI</label>
          <textarea
            className="input min-h-[240px] resize-y leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Anatomy of Heart\n\nYa chapter ka pura text yahan paste kar do…'}
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-500">
            <span>{text.trim().length} characters (max 12000)</span>
            <button className="hover:text-mint" onClick={() => setText('')}>
              Clear
            </button>
          </div>

          <label className="label mt-4">Style</label>
          <div className="flex flex-wrap gap-2">
            {MODES.map((item) => (
              <button
                key={item.id}
                onClick={() => setMode(item.id)}
                title={item.hint}
                className={`chip transition ${
                  mode === item.id ? 'border-mint/50 bg-mint/15 text-mint' : 'hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <label className="label mt-4">Language</label>
          <div className="flex flex-wrap gap-2">
            {(['en', 'hinglish'] as AiLanguage[]).map((lang) => (
              <button
                key={lang}
                onClick={() => setLanguage(lang)}
                className={`chip transition ${
                  language === lang ? 'border-violet/50 bg-violet/15 text-violet' : 'hover:bg-white/10'
                }`}
              >
                {lang === 'en' ? 'Simple English' : 'Hinglish'}
              </button>
            ))}
          </div>

          <button className="btn-primary mt-5 w-full" onClick={generate} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'AI soch raha hai…' : 'Short notes banao'}
          </button>

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </section>

        {/* ---------------- output ---------------- */}
        <section className="card flex min-h-[420px] flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2">
              <Sparkles size={18} className="text-mint" /> Result
            </h2>
            {result && (
              <div className="flex flex-wrap gap-2">
                <span className="chip border-mint/40 bg-mint/10 text-mint">
                  {result.providerLabel}
                  {result.usedFallback ? ' (fallback)' : ''}
                </span>
                <span className="chip">{result.model}</span>
              </div>
            )}
          </div>

          {!result ? (
            <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
              <Sparkles size={42} className="text-mint/50" />
              <h3 className="mt-4 text-lg font-bold text-white">Notes yahan aayenge</h3>
              <p className="muted mt-2 max-w-sm text-sm">
                Left side me topic ya text daalo aur button dabao. AI usse short bullet notes me badal
                dega.
              </p>
            </div>
          ) : (
            <>
              <div className="scroll-thin mt-4 max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
                {result.lines.length === 0 && <p className="text-sm text-slate-400">AI ne khaali note diya.</p>}
                {result.lines.map((line, index) =>
                  line.type === 'heading' ? (
                    <div key={index} className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-mint">
                      {line.text}
                    </div>
                  ) : line.type === 'paragraph' ? (
                    <p key={index} className="text-sm leading-relaxed text-slate-200">
                      {renderInline(line.text)}
                    </p>
                  ) : (
                    <div
                      key={index}
                      className="flex gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm leading-relaxed text-slate-200"
                    >
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                      <span>{renderInline(line.text)}</span>
                    </div>
                  ),
                )}
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
                <button className="btn-ghost" onClick={copyAll}>
                  {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy all'}
                </button>
                <button className="btn-ghost" onClick={downloadMd}>
                  <Download size={15} /> .md
                </button>
                <button className="btn-violet" onClick={saveToBrainDump}>
                  <Save size={15} /> Brain Dump me save
                </button>
                <button className="btn-ghost" onClick={() => void generate()}>
                  <RefreshCw size={15} /> Re-generate
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ---------------- history ---------------- */}
      <section className="card">
        <h2 className="section-title flex items-center gap-2">
          <History size={18} className="text-violet" /> Saved AI library
          <span className="text-xs font-normal text-slate-500">({history.length})</span>
        </h2>
        {history.length === 0 ? (
          <p className="muted mt-3 text-sm">
            Abhi kuch save nahi hua. Generate karke &quot;Save&quot; dabao — notes yahan aa jayenge
            (cloud me Supabase se sync honge).
          </p>
        ) : (
          <div className="scroll-thin mt-3 grid max-h-[320px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((note) => (
              <div
                key={note.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
              >
                <button className="min-w-0 flex-1 text-left" onClick={() => loadFromHistory(note)}>
                  <div className="truncate text-sm font-semibold text-white">{note.title}</div>
                  <div className="mt-0.5 text-[10px] uppercase tracking-wider text-mint">
                    {note.mode} • {note.provider ?? 'ai'}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-slate-500">{note.content}</div>
                </button>
                <button
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-coral/10 hover:text-coral"
                  onClick={() => removeFromLibrary(note.id)}
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
