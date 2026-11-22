'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BellRing,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Cloud,
  CloudOff,
  FileBarChart,
  Flame,
  HeartPulse,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  MessageCircleQuestion,
  Mic,
  Pause,
  PieChart,
  Play,
  Settings2,
  Siren,
  Sparkles,
  StickyNote,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { useEffect } from 'react';
import Logo from '@/components/Logo';
import RewardManager from '@/components/RewardManager';
import { mmss } from '@/lib/dates';
import { useStore } from '@/lib/store';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/subjects', label: 'Subjects', icon: BookOpen },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/progress', label: 'Progress', icon: PieChart },
  { href: '/notes', label: 'Brain Dump', icon: StickyNote },
  { href: '/ai-notes', label: 'AI Notes', icon: Sparkles },
  { href: '/doubt-solver', label: 'Doubt Solver', icon: MessageCircleQuestion },
  { href: '/panic-revision', label: '5-Min Panic', icon: Siren },
  { href: '/quiz', label: 'AI Quiz', icon: ListChecks },
  { href: '/voice-notes', label: 'Voice Notes', icon: Mic },
  { href: '/report', label: 'Weekly Report', icon: FileBarChart },
  { href: '/health', label: 'Health & Mood', icon: HeartPulse },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

function FocusOverlay() {
  const { timer, focusActive, setFocusActive, pauseTimer, resumeTimer, state } = useStore();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusActive(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setFocusActive]);

  if (!focusActive || timer.status === 'idle') return null;
  const subject = state.subjects.find((s) => s.id === timer.subjectId);
  const topic = state.topics.find((t) => t.id === timer.topicId);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#04060f] px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(52,224,161,0.12),transparent_55%)]" />
      <div className="relative w-full max-w-2xl">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-mint">
          <LockKeyhole size={13} /> Focus lock
        </div>
        <div className="timer-digits text-[clamp(5rem,20vw,11rem)] font-black leading-none text-white">{mmss(timer.remainingSec)}</div>
        <div className="mt-6 text-2xl font-semibold text-white">{topic?.title ?? 'General study'}</div>
        <div className="mt-2 text-sm text-slate-400">{subject ? `${subject.icon} ${subject.name}` : 'Apna topic timer se pehle select kar le'}</div>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
          {timer.status === 'running' ? (
            <button className="btn-ghost" onClick={pauseTimer}>
              <Pause size={16} /> Pause
            </button>
          ) : (
            <button className="btn-primary" onClick={resumeTimer}>
              <Play size={16} /> Resume
            </button>
          )}
          <button className="btn border border-white/10 text-slate-400 hover:text-white" onClick={() => setFocusActive(false)}>
            <X size={16} /> Exit focus (Esc)
          </button>
        </div>
        <p className="mt-8 text-xs text-slate-600">Distraction-free mode • notification aur alarm chalu rahenge</p>
      </div>
    </div>
  );
}

function AlarmOverlay() {
  const { activeAlarm, dismissAlarm, snoozeAlarm, alarmToStudy, state } = useStore();
  if (!activeAlarm) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#1a0410]/90 px-4 backdrop-blur-md">
      <div className="alarm-pulse w-full max-w-lg rounded-3xl border border-coral/40 bg-[#1b0d1c] p-8 text-center shadow-2xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-coral/15 text-coral">
          <Volume2 size={40} className="animate-pulse" />
        </div>
        <div className="mb-2 text-xs font-black uppercase tracking-[0.32em] text-coral">Loud alarm • study reminder</div>
        <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">Bhai, padhne ka time ho gaya!</h2>
        <p className="mt-3 text-sm text-slate-300">
         {state.settings.studyTime} baj gaye. Ab timer shuru kar — {state.settings.examName} ka countdown chal raha hai.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button className="btn-primary justify-center" onClick={alarmToStudy}>
            <Play size={16} /> Timer shuru kar
          </button>
          <button className="btn-ghost justify-center" onClick={snoozeAlarm}>
            <BellRing size={16} /> {state.settings.snoozeMinutes} min snooze
          </button>
          <button className="btn border border-white/10 text-slate-400" onClick={dismissAlarm}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast() {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="fixed bottom-20 right-4 z-[130] max-w-sm float-in rounded-xl border border-mint/30 bg-[#0f1b25] px-4 py-3 text-sm font-medium text-white shadow-2xl md:bottom-8">
      <CheckCircle2 size={16} className="mr-2 inline text-mint" />
      {toast}
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, syncStatus, cloud } = useStore();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b1020]/80 px-4 py-6 backdrop-blur-xl md:flex">
          <Link href="/" className="mb-8 flex items-center gap-3 px-2">
            <Logo size={44} rounded="rounded-2xl" />
            <div>
              <div className="text-sm font-black leading-tight text-white">Nursing Tracker</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-mint">BSc + NORCET</div>
            </div>
          </Link>

          <nav className="scroll-thin flex-1 space-y-1 overflow-y-auto">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active ? 'bg-mint/12 text-mint shadow-[inset_2px_0_0_#34e0a1]' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon size={17} /> {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Zap size={13} className="text-sun" /> XP
                </span>
                <b className="text-white">{state.stats.xp}</b>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Flame size={13} className="text-coral" /> Streak
                </span>
                <b className="text-white">{state.stats.streak} din</b>
              </div>
            </div>
            <div className="flex items-center gap-2 px-2 text-[11px] text-slate-500">
              {cloud ? <Cloud size={13} /> : <CloudOff size={13} />}
              {cloud ? `Supabase • ${syncStatus}` : 'Local demo mode'}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0a0d1a]/90 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <Logo size={30} rounded="rounded-xl" />
                <span className="text-sm font-black text-white">
                  N<span className="text-mint">·</span>Tracker
                </span>
              </Link>
              <span className="chip py-1 text-[10px]">
                <Zap size={12} className="text-sun" /> {state.stats.xp} XP
              </span>
            </div>
            <nav className="scroll-thin flex gap-1 overflow-x-auto px-3 pb-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      active ? 'bg-mint/15 text-mint' : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    <Icon size={13} /> {label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-10 pt-5 md:px-8 md:pt-8">{children}</main>
        </div>
      </div>

      <footer className="border-t border-white/[0.07] py-5 text-center">
        <span className="watermark text-2xl font-bold tracking-wide sm:text-3xl">Made by 💖 Ankit</span>
        <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-600">Phase 4 • AI study tracker</div>
      </footer>

      <FocusOverlay />
      <AlarmOverlay />
      <Toast />
      <RewardManager />
    </div>
  );
}
