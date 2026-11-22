'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Copy,
  CornerDownLeft,
  History,
  Loader2,
  MessageCircleQuestion,
  Save,
  Send,
  Trash2,
} from 'lucide-react';
import { useStore } from '@/lib/store';

type AiLanguage = 'en' | 'hinglish';

interface AiNoteLine {
  type: 'heading' | 'bullet' | 'paragraph';
  text: string;
}

interface AiAnswer {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  lines?: AiNoteLine[];
  provider?: string;
  model?: string;
  usedFallback?: boolean;
  error?: boolean;
}

interface ProviderStatus {
  id: string;
  label: string;
  model: string;
  configured: boolean;
}

interface SavedDoubt {
  id: string;
  question: string;
  answer: string;
  provider: string | null;
  model: string | null;
  language: string;
  created_at: string;
}

const HISTORY_KEY = 'nst-ai-doubts-v1';

const SUGGESTIONS = [
  'Normal value of platelet count?',
  'Most common cause of DIC?',
  'Dose of adrenaline in anaphylaxis?',
  'Difference between Type 1 and Type 2 respiratory failure?',
  'Stages of pressure ulcer and their nursing management',
];

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalHistory(): SavedDoubt[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as SavedDoubt[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: SavedDoubt[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 60)));
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

export default function DoubtSolverPage() {
  const { update, showToast } = useStore();

  const [messages, setMessages] = useState<AiAnswer[]>([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState<AiLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [history, setHistory] = useState<SavedDoubt[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

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
        const response = await fetch('/api/doubts', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as SavedDoubt[];
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  const activeProvider = providers.find((p) => p.configured);

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || loading) return;

    const userMessage: AiAnswer = { id: uid(), role: 'user', content: text };
    const historyForApi = messages
      .filter((m) => !m.error && m.content)
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          mode: 'doubt-solver',
          language,
          history: historyForApi,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        lines?: AiNoteLine[];
        raw?: string;
        provider?: string;
        providerLabel?: string;
        model?: string;
        usedFallback?: boolean;
        error?: string;
      };

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: 'assistant', content: data.error ?? 'AI request fail ho gayi.', error: true },
        ]);
        return;
      }

      const answerText = data.raw ?? '';
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: 'assistant',
          content: answerText,
          lines: data.lines ?? [],
          provider: data.providerLabel ?? data.provider,
          model: data.model,
          usedFallback: data.usedFallback,
        },
      ]);

      // Save the doubt in history (cloud if Supabase connected, else localStorage).
      const saved: SavedDoubt = {
        id: uid(),
        question: text,
        answer: answerText,
        provider: data.provider ?? null,
        model: data.model ?? null,
        language,
        created_at: new Date().toISOString(),
      };
      const next = [saved, ...history].slice(0, 60);
      setHistory(next);
      writeLocalHistory(next);
      try {
        await fetch('/api/doubts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saved),
        });
      } catch {
        /* local copy already saved */
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'assistant', content: 'Server tak request nahi pahunchi. Check karo.', error: true },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const copyAnswer = async (message: AiAnswer) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      showToast('Answer copy ho gaya 📋');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast('Copy nahi hua — manually select karo.');
    }
  };

  const saveToBrainDump = (message: AiAnswer) => {
    const question = messages.find((m) => m.role === 'user' && m.id !== message.id);
    const now = new Date().toISOString();
    update((draft) => {
      draft.notes.unshift({
        id: uid(),
        title: `Doubt: ${(question?.content ?? 'AI doubt').slice(0, 45)}`,
        body: `${question?.content ?? ''}\n\n${message.content}`,
        created_at: now,
        updated_at: now,
      });
    });
    showToast('Brain Dump me save ho gaya 🧠');
  };

  const removeFromHistory = async (id: string) => {
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch(`/api/doubts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* local copy already removed */
    }
  };

  const loadFromHistory = (item: SavedDoubt) => {
    setMessages([
      { id: uid(), role: 'user', content: item.question },
      {
        id: uid(),
        role: 'assistant',
        content: item.answer,
        provider: item.provider ?? undefined,
        model: item.model ?? undefined,
      },
    ]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void ask(input);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">phase 3 • ai</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">AI Doubt Solver</h1>
          <p className="muted mt-1 text-sm">
            Apna doubt type kar — AI pehle seedha jawab dega, phir explanation, memory trick aur exam angle.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">GEMINI_API_KEY</code> (ya
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">DEEPSEEK_API_KEY</code> /
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs text-mint">GROQ_API_KEY</code>) add karo.
          </div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* ---------------- chat ---------------- */}
        <section className="card flex min-h-[560px] flex-col">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2">
              <MessageCircleQuestion size={18} className="text-mint" /> Doubt chat
            </h2>
            {messages.length > 0 && (
              <button className="text-xs text-slate-500 hover:text-coral" onClick={() => setMessages([])}>
                Clear chat
              </button>
            )}
          </div>

          <div className="scroll-thin mt-4 flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                <BrainCircuit size={42} className="text-mint/50" />
                <h3 className="mt-4 text-lg font-bold text-white">Doubt puchh, doubt clear</h3>
                <p className="muted mt-2 max-w-sm text-sm">
                  Normal values, doses, complications, nursing management — jo bhi confuse kar raha hai,
                  seedha puchho.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void ask(s)}
                      className="chip transition hover:border-mint/40 hover:bg-mint/10 hover:text-mint"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-mint px-4 py-2.5 text-sm font-medium text-[#04231a]">
                    {message.content}
                  </div>
                </div>
              ) : (
                <div
                  key={message.id}
                  className={`rounded-2xl rounded-bl-md border p-4 text-sm leading-relaxed ${
                    message.error
                      ? 'border-coral/40 bg-coral/10 text-coral'
                      : 'border-white/[0.07] bg-white/[0.03] text-slate-200'
                  }`}
                >
                  {message.error ? (
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {message.content}
                    </div>
                  ) : (
                    <>
                      {message.lines?.length ? (
                        <div className="space-y-2">
                          {message.lines.map((line, index) =>
                            line.type === 'heading' ? (
                              <div
                                key={index}
                                className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-mint first:mt-0"
                              >
                                {line.text}
                              </div>
                            ) : line.type === 'bullet' ? (
                              <div key={index} className="flex gap-2">
                                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                                <span>{renderInline(line.text)}</span>
                              </div>
                            ) : (
                              <p key={index}>{renderInline(line.text)}</p>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3">
                        {message.provider && <span className="chip border-mint/30 bg-mint/10 text-mint">{message.provider}</span>}
                        {message.model && <span className="chip">{message.model}</span>}
                        {message.usedFallback && <span className="chip border-sun/40 bg-sun/10 text-sun">fallback</span>}
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => void copyAnswer(message)}>
                          {copiedId === message.id ? <Check size={13} /> : <Copy size={13} />} Copy
                        </button>
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => saveToBrainDump(message)}>
                          <Save size={13} /> Save
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ),
            )}

            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Loader2 size={15} className="animate-spin text-mint" /> Soch raha hai…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="mt-4 border-t border-white/[0.07] pt-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="input min-h-[52px] resize-none"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Apna doubt puchho... (Enter = send, Shift+Enter = new line)"
              />
              <button
                className="btn-primary h-[52px] shrink-0 px-5"
                onClick={() => void ask(input)}
                disabled={loading || !input.trim()}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
              </button>
            </div>
            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-600">
              <CornerDownLeft size={11} /> Enter se bhejo, Shift+Enter se newline.
            </p>
          </div>
        </section>

        {/* ---------------- history ---------------- */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <History size={18} className="text-violet" /> Doubt history
            <span className="text-xs font-normal text-slate-500">({history.length})</span>
          </h2>
          {history.length === 0 ? (
            <p className="muted mt-3 text-sm">Abhi koi doubt save nahi hua. Puchho — jawab yahan save ho jayega.</p>
          ) : (
            <div className="scroll-thin mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                >
                  <button className="min-w-0 flex-1 text-left" onClick={() => loadFromHistory(item)}>
                    <div className="line-clamp-2 text-sm font-semibold text-white">{item.question}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-mint">
                      {item.provider ?? 'ai'} • {new Date(item.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </button>
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-coral/10 hover:text-coral"
                    onClick={() => void removeFromHistory(item.id)}
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
    </div>
  );
}
