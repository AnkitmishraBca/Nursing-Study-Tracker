'use client';

import { useState } from 'react';
import { Award, BarChart3, Flame, Plus, Trash2, TrendingUp, Zap } from 'lucide-react';
import TimePieChart from '@/components/TimePieChart';
import { addDays, localDate, parseLocalDate } from '@/lib/dates';
import { subjectPercent } from '@/lib/stats';
import { useStore } from '@/lib/store';
import { uid } from '@/lib/seed';

export default function ProgressPage() {
  const { state, update } = useStore();
  const [title, setTitle] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('100');

  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = localDate(addDays(today, i - 6));
    const minutes = state.study_sessions
      .filter((s) => localDate(new Date(s.ended_at)) === date)
      .reduce((sum, s) => sum + s.minutes, 0);
    return { date, minutes };
  });
  const maxMinutes = Math.max(60, ...week.map((d) => d.minutes));
  const doneLevels = state.topics.reduce((sum, t) => sum + [t.level1, t.level2, t.level3].filter((l) => l === 'done').length, 0);

  const subjectStats = state.subjects
    .map((s) => ({
      subject: s,
      percent: subjectPercent(state.topics, s.id),
      minutes: state.study_sessions.filter((session) => session.subject_id === s.id).reduce((sum, x) => sum + x.minutes, 0),
    }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 8);

  const addMock = () => {
    if (!title.trim() || !score || !total) return;
    update((draft) => {
      draft.mock_tests.unshift({
        id: uid(),
        title: title.trim(),
        score: Math.min(Number(score), Number(total)),
        total: Number(total),
        taken_at: new Date().toISOString(),
      });
    });
    setTitle('');
    setScore('');
    setTotal('100');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">numbers don&apos;t lie</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Progress & Analytics</h1>
        <p className="muted mt-1 text-sm">Time kaise laga raha hai, kaunse subject weak hain — sab yahin.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total study', value: `${Math.floor(state.stats.total_minutes / 60)}h ${state.stats.total_minutes % 60}m`, icon: BarChart3, color: 'text-mint' },
          { label: 'Current streak', value: `${state.stats.streak} din`, icon: Flame, color: 'text-coral' },
          { label: 'Longest streak', value: `${state.stats.longest_streak} din`, icon: TrendingUp, color: 'text-sun' },
          { label: 'Levels completed', value: `${doneLevels}/${state.topics.length * 3}`, icon: Award, color: 'text-violet' },
        ].map((item) => (
          <div key={item.label} className="card">
            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
              {item.label} <item.icon size={16} className={item.color} />
            </div>
            <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <TimePieChart />

        <section className="card">
          <h2 className="section-title">Last 7 days</h2>
          <p className="muted mt-1 text-xs">Roz kitne minute padha — daily bar graph.</p>
          <div className="mt-8 flex h-52 items-end gap-2 sm:gap-3">
            {week.map((day) => {
              const height = (day.minutes / maxMinutes) * 100;
              const label = parseLocalDate(day.date).toLocaleDateString('en-IN', { weekday: 'short' });
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] text-slate-500">{day.minutes || ''}</span>
                  <div className="flex w-full flex-1 items-end rounded-lg bg-white/[0.04]">
                    <div
                      className="w-full rounded-lg bg-gradient-to-t from-violet to-mint transition-all duration-500"
                      style={{ height: `${Math.max(day.minutes ? 6 : 2, height)}%` }}
                      title={`${day.date}: ${day.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">{label}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="card">
        <h2 className="section-title">Subject mastery</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {subjectStats.map(({ subject, percent, minutes }) => (
            <div key={subject.id} className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate font-medium text-slate-200">{subject.icon} {subject.name}</span>
                <span className="ml-2 font-bold" style={{ color: subject.color }}>{percent}%</span>
              </div>
              <div className="progress-track mt-2">
                <div className="progress-fill" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${subject.color}, #34e0a1)` }} />
              </div>
              <div className="mt-1.5 text-[10px] text-slate-500">{minutes} min studied • {state.topics.filter((t) => t.subject_id === subject.id).length} topics</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="section-title flex items-center gap-2"><Zap size={17} className="text-sun" /> Mock tests</h2>
        <p className="muted mt-1 text-xs">Score daal kar apni preparation ka track rakho. Phase 2 mein AI analysis aayega.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_100px_100px_auto]">
          <input className="input" placeholder="Test name (e.g. NORCET Mock 3)" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" type="number" min="0" placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
          <input className="input" type="number" min="1" placeholder="Total" value={total} onChange={(e) => setTotal(e.target.value)} />
          <button className="btn-primary" onClick={addMock}><Plus size={15} /> Add</button>
        </div>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {state.mock_tests.length === 0 && <p className="py-3 text-sm text-slate-500">Abhi koi mock test add nahi kiya.</p>}
          {state.mock_tests.slice(0, 10).map((test) => (
            <div key={test.id} className="flex items-center gap-3 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate text-slate-200">{test.title}</div>
                <div className="text-[11px] text-slate-500">{new Date(test.taken_at).toLocaleDateString('en-IN')}</div>
              </div>
              <div className="font-bold text-white">{test.score ?? '–'}/{test.total}</div>
              <div className="chip text-mint">{test.score != null ? Math.round((test.score / test.total) * 100) : 0}%</div>
              <button
                className="rounded-lg p-2 text-slate-500 hover:bg-coral/10 hover:text-coral"
                onClick={() => update((draft) => { draft.mock_tests = draft.mock_tests.filter((t) => t.id !== test.id); })}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
