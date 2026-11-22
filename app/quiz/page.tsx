'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  History,
  Loader2,
  ListChecks,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import { useStore } from '@/lib/store';

type AiLanguage = 'en' | 'hinglish';
type Group = 'backlog' | 'current' | 'norcet';

interface AiQuizOption {
  label: string;
  text: string;
}

interface AiQuizQuestion {
  id: string;
  question: string;
  options: AiQuizOption[];
  correct: string;
  explanation: string;
  topic?: string;
}

interface QuizAttempt {
  id: string;
  subject_name: string;
  topic: string | null;
  total: number;
  score: number;
  created_at: string;
  provider?: string | null;
}

interface ProviderStatus {
  id: string;
  label: string;
  model: string;
  configured: boolean;
}

const HISTORY_KEY = 'nst-quiz-attempts-v1';
const GROUP_LABEL: Record<Group, string> = {
  backlog: 'Backlog (1–3 sem)',
  current: 'Current (4th sem)',
  norcet: 'NORCET',
};

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalHistory(): QuizAttempt[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as QuizAttempt[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: QuizAttempt[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 60)));
  } catch {
    /* storage full */
  }
}

export default function QuizPage() {
  const { state, showToast } = useStore();

  const [group, setGroup] = useState<Group>('current');
  const [subjectId, setSubjectId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [count, setCount] = useState(10);
  const [language, setLanguage] = useState<AiLanguage>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [history, setHistory] = useState<QuizAttempt[]>([]);

  const [questions, setQuestions] = useState<AiQuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [quizMeta, setQuizMeta] = useState<{ subject: string; topic: string | null; provider: string } | null>(null);

  const subjects = useMemo(() => state.subjects.filter((s) => s.group === group), [state.subjects, group]);
  const topics = useMemo(
    () => state.topics.filter((t) => t.subject_id === subjectId),
    [state.topics, subjectId],
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
        const response = await fetch('/api/quizzes', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as QuizAttempt[];
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

  const activeProvider = providers.find((p) => p.configured);
  const selectedSubject = state.subjects.find((s) => s.id === subjectId) ?? null;
  const selectedTopic = state.topics.find((t) => t.id === topicId) ?? null;

  const generate = async () => {
    if (!selectedSubject) {
      setError('Pehle subject select karo.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const topicTitles = selectedTopic
        ? [selectedTopic.title]
        : topics.map((t) => t.title);

      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'quiz',
          language,
          text: '',
          context: {
            subject: selectedTopic
              ? `${selectedSubject.name} - ${selectedTopic.title}`
              : selectedSubject.name,
            topics: topicTitles.map((title) => ({ title })),
            count,
          },
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        questions?: AiQuizQuestion[];
        provider?: string;
        providerLabel?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Quiz generate nahi hui.');
        return;
      }
      const list = data.questions ?? [];
      if (list.length === 0) {
        setError('AI ne valid MCQs nahi diye. Dobara try karo.');
        return;
      }
      setQuestions(list);
      setAnswers({});
      setSubmitted(false);
      setQuizMeta({
        subject: selectedTopic ? `${selectedSubject.name} - ${selectedTopic.title}` : selectedSubject.name,
        topic: selectedTopic?.title ?? null,
        provider: data.providerLabel ?? data.provider ?? 'ai',
      });
      showToast(`${list.length} MCQs ready — let's go! 🎯`);
    } catch {
      setError('Server tak request nahi pahunchi. Check karo.');
    } finally {
      setLoading(false);
    }
  };

  const correctCount = questions.filter((q) => answers[q.id] === q.correct).length;
  const answeredCount = Object.keys(answers).length;
  const scorePercent = questions.length ? Math.round((correctCount / questions.length) * 100) : 0;

  const submitQuiz = async () => {
    setSubmitted(true);
    const attempt: QuizAttempt = {
      id: uid(),
      subject_name: quizMeta?.subject ?? 'General',
      topic: quizMeta?.topic ?? null,
      total: questions.length,
      score: correctCount,
      created_at: new Date().toISOString(),
      provider: quizMeta?.provider ?? null,
    };
    const next = [attempt, ...history].slice(0, 60);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt),
      });
    } catch {
      /* local copy already saved */
    }
    showToast(`Score: ${correctCount}/${questions.length} — ${scorePercent}% 🎯`);
  };

  const resetQuiz = () => {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setQuizMeta(null);
  };

  const removeAttempt = async (id: string) => {
    const next = history.filter((item) => item.id !== id);
    setHistory(next);
    writeLocalHistory(next);
    try {
      await fetch(`/api/quizzes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* local copy already removed */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">phase 4 • ai quiz</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">AI Quiz Generator</h1>
          <p className="muted mt-1 text-sm">
            Subject chuno → AI 10 MCQs banaye → do aur apna score check kar.
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
              {lang === 'en' ? 'English' : 'Hinglish'}
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

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* ---------------- setup ---------------- */}
        <section className="card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <ListChecks size={18} className="text-mint" /> Quiz setup
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
                    setTopicId('');
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
            <select className="input" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); }}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Topic (optional — empty = full subject)</label>
            <select className="input" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
              <option value="">Full subject ({topics.length} topics)</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Number of MCQs</label>
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`chip transition ${
                    count === n ? 'border-sun/50 bg-sun/15 text-sun' : 'hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary w-full" onClick={() => void generate()} disabled={loading || !selectedSubject}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? 'MCQs ban rahi hain…' : `Generate ${count} MCQs`}
          </button>

          {questions.length > 0 && (
            <button className="btn-ghost w-full" onClick={resetQuiz}>
              <RefreshCw size={15} /> Naya quiz
            </button>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </section>

        {/* ---------------- quiz ---------------- */}
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title flex items-center gap-2">
              <Trophy size={18} className="text-sun" /> {questions.length ? 'Quiz' : 'Quiz ready hoga'}
            </h2>
            {questions.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>
                  {answeredCount}/{questions.length} answered
                </span>
                {submitted && (
                  <span className="chip border-mint/40 bg-mint/10 text-mint">
                    Score {correctCount}/{questions.length} ({scorePercent}%)
                  </span>
                )}
              </div>
            )}
          </div>

          {questions.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Trophy size={42} className="text-sun/60" />
              <h3 className="mt-4 text-lg font-bold text-white">Practice quiz shuru karo</h3>
              <p className="muted mt-2 max-w-sm text-sm">
                Subject aur topic select karke MCQs generate karo — har question me 4 options, correct
                answer aur explanation aayega.
              </p>
            </div>
          ) : (
            <>
              <div className="scroll-thin mt-4 max-h-[560px] space-y-4 overflow-y-auto pr-1">
                {questions.map((question, index) => {
                  const picked = answers[question.id];
                  const isCorrect = picked === question.correct;
                  return (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4"
                    >
                      <div className="mb-3 flex items-start gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-mint/15 text-[11px] font-black text-mint">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-relaxed text-white">{question.question}</p>
                          {question.topic && (
                            <span className="mt-1 inline-block text-[10px] uppercase tracking-wider text-slate-500">
                              {question.topic}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {question.options.map((option) => {
                          const isPicked = picked === option.label;
                          const isAnswer = option.label === question.correct;
                          let tone = 'border-white/[0.07] bg-white/[0.02] text-slate-300 hover:border-mint/40';
                          if (submitted && isAnswer) tone = 'border-mint/50 bg-mint/10 text-mint';
                          else if (submitted && isPicked && !isAnswer) tone = 'border-coral/50 bg-coral/10 text-coral';
                          else if (!submitted && isPicked) tone = 'border-violet/50 bg-violet/10 text-violet';

                          return (
                            <button
                              key={option.label}
                              disabled={submitted}
                              onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.label }))}
                              className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${tone}`}
                            >
                              <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current/30 text-[10px] font-black">
                                {option.label}
                              </span>
                              <span className="flex-1">{option.text}</span>
                              {submitted && isAnswer && <Check size={15} className="mt-0.5 shrink-0" />}
                              {submitted && isPicked && !isAnswer && <X size={15} className="mt-0.5 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {submitted && (
                        <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-xs text-slate-300">
                          {isCorrect ? (
                            <Check size={14} className="mt-0.5 shrink-0 text-mint" />
                          ) : (
                            <X size={14} className="mt-0.5 shrink-0 text-coral" />
                          )}
                          <span>
                            <b className="text-white">Answer: {question.correct}</b>
                            {question.explanation ? ` — ${question.explanation}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!submitted ? (
                <button
                  className="btn-primary mt-4 w-full"
                  onClick={() => void submitQuiz()}
                  disabled={answeredCount === 0}
                >
                  Submit quiz <ChevronRight size={16} />
                </button>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="flex-1 rounded-xl border border-mint/30 bg-mint/10 p-3">
                    <div className="text-xs uppercase tracking-wider text-slate-400">Final score</div>
                    <div className="text-2xl font-black text-white">
                      {correctCount}/{questions.length} • {scorePercent}%
                    </div>
                  </div>
                  <button className="btn-violet" onClick={resetQuiz}>
                    <RefreshCw size={15} /> Naya quiz
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* ---------------- history ---------------- */}
      <section className="card">
        <h2 className="section-title flex items-center gap-2">
          <History size={18} className="text-violet" /> Quiz history
          <span className="text-xs font-normal text-slate-500">({history.length})</span>
        </h2>
        {history.length === 0 ? (
          <p className="muted mt-3 text-sm">Abhi koi attempt nahi. Ek quiz de aur yahan score dikhega.</p>
        ) : (
          <div className="scroll-thin mt-3 grid max-h-[280px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((item) => {
              const percent = item.total ? Math.round((item.score / item.total) * 100) : 0;
              return (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{item.subject_name}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-mint">
                      {item.score}/{item.total} • {percent}% •{' '}
                      {new Date(item.created_at).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <button
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-coral/10 hover:text-coral"
                    onClick={() => void removeAttempt(item.id)}
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
