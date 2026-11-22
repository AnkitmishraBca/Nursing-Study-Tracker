'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  MessageCircleQuestion,
  PieChart,
  HeartPulse,
  Play,
  Siren,
  StickyNote,
  Target,
} from 'lucide-react';
import StatsCards from '@/components/StatsCards';
import TimerWidget from '@/components/TimerWidget';
import WasteWidget from '@/components/WasteWidget';
import { localDate, timeAgo } from '@/lib/dates';
import { useStore } from '@/lib/store';

const QUICK_LINKS = [
  { href: '/subjects', label: 'Backlog & topics', icon: BookOpen, color: 'text-mint' },
  { href: '/calendar', label: 'Calendar marks', icon: CalendarDays, color: 'text-sun' },
  { href: '/progress', label: 'Progress graph', icon: PieChart, color: 'text-violet' },
  { href: '/notes', label: 'Brain dump', icon: StickyNote, color: 'text-cyan-300' },
  { href: '/doubt-solver', label: 'Ask a doubt', icon: MessageCircleQuestion, color: 'text-violet' },
  { href: '/panic-revision', label: '5-min panic revision', icon: Siren, color: 'text-coral' },
  { href: '/health', label: 'Health & mood', icon: HeartPulse, color: 'text-coral' },
];

export default function DashboardPage() {
  const { state, startTimer, setTimerSelection } = useStore();

  const backlogSubjects = new Map(state.subjects.filter((s) => s.group === 'backlog').map((s) => [s.id, s]));
  const nextTopics = state.topics
    .filter((t) => t.level1 !== 'done' && backlogSubjects.has(t.subject_id))
    .slice(0, 5);

  const recent = state.study_sessions.slice(0, 5);
  const today = localDate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">Phase 3 • control room</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Kaise ho bhai? <span className="text-slate-500">Aaj ka target: backlog thoda kam.</span>
          </h1>
          <p className="muted mt-1 text-sm">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • 1st–3rd sem saaf karna hai, 4th sem chal raha hai, NORCET parallel.
          </p>
        </div>
        <div className="chip border-mint/20 text-mint">
          <Target size={13} /> {state.topics.filter((t) => t.level1 === 'done').length}/{state.topics.length} topics Level 1 done
        </div>
      </div>

      <StatsCards />

      <div className="grid gap-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <div className="space-y-5">
          <TimerWidget />
          <WasteWidget />
        </div>

        <div className="space-y-5">
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Aaj ka next target 🎯</h2>
              <Link href="/subjects" className="flex items-center gap-1 text-xs font-semibold text-mint hover:underline">
                Sab topics <ArrowRight size={13} />
              </Link>
            </div>
            <p className="muted mt-1 text-xs">Backlog se sabse pehle ye topics pakdega — 25 min ka ek pomodoro bas.</p>
            <div className="mt-4 space-y-2">
              {nextTopics.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                  Sab backlog topics Level 1 ho gaye! Shabash 🎉
                </div>
              ) : (
                nextTopics.map((topic) => {
                  const subject = backlogSubjects.get(topic.subject_id)!;
                  return (
                    <div key={topic.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${subject.color}22` }}>
                        {subject.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{topic.title}</div>
                        <div className="text-[11px] text-slate-500">Sem {subject.semester} • {subject.name}</div>
                      </div>
                      <button
                        className="btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => {
                          setTimerSelection(topic.subject_id, topic.id);
                          startTimer('study', topic.subject_id, topic.id);
                        }}
                      >
                        <Play size={13} /> 25 min
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Quick access</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {QUICK_LINKS.map(({ href, label, icon: Icon, color }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 transition hover:border-mint/30 hover:bg-mint/[0.06]">
                  <Icon size={17} className={color} />
                  <span className="flex-1 text-sm font-medium text-slate-200">{label}</span>
                  <ArrowRight size={14} className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-mint" />
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Recent study sessions</h2>
            {recent.length === 0 ? (
              <p className="muted mt-3 text-sm">Abhi koi session nahi. Upar timer start kar — pehla session yahin dikhega.</p>
            ) : (
              <div className="mt-3 divide-y divide-white/[0.06]">
                {recent.map((session) => {
                  const topic = state.topics.find((t) => t.id === session.topic_id);
                  return (
                    <div key={session.id} className="flex items-center justify-between py-2.5 text-sm">
                      <div className="min-w-0 pr-3">
                        <div className="truncate text-slate-200">{topic?.title ?? 'General study'}</div>
                        <div className="text-[11px] text-slate-500">{timeAgo(session.ended_at)}</div>
                      </div>
                      <span className="chip shrink-0 text-mint">+{session.minutes} min</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] px-4 py-2 text-center text-[11px] text-slate-600">
        Local time: {today} • Data {state.study_sessions.length ? 'is device / Supabase par safe hai' : 'abhi bhi demo mode mein hai'}
      </div>
    </div>
  );
}
