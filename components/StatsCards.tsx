'use client';

import Link from 'next/link';
import { CalendarClock, Flame, ShieldCheck, Sparkles, TimerReset, Zap } from 'lucide-react';
import { daysUntil, localDate } from '@/lib/dates';
import { useStore } from '@/lib/store';

export default function StatsCards() {
  const { state, update, showToast } = useStore();
  const today = localDate();
  const frozenToday = state.settings.frozenDates.includes(today);
  const remainingDays = daysUntil(state.settings.examDate);
  const todayStudy = state.study_sessions
    .filter((s) => localDate(new Date(s.ended_at)) === today)
    .reduce((sum, s) => sum + s.minutes, 0);
  const todayWaste = state.waste_sessions
    .filter((s) => localDate(new Date(s.ended_at)) === today)
    .reduce((sum, s) => sum + s.minutes, 0);
  const level = Math.floor(state.stats.xp / 500) + 1;

  const useFreeze = () => {
    if (frozenToday || state.settings.streakFreezes <= 0) return;
    update((draft) => {
      draft.settings.streakFreezes -= 1;
      draft.settings.frozenDates.push(today);
    });
    showToast('Streak freeze aaj ke liye activate ho gaya ❄️');
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">XP Points</span>
          <Zap size={17} className="text-sun" />
        </div>
        <div className="mt-2 text-3xl font-black text-white">{state.stats.xp}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-sun to-orange-400" style={{ width: `${(state.stats.xp % 500) / 5}%` }} />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">Level {level} • next level {500 - (state.stats.xp % 500)} XP</div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Study Streak</span>
          <Flame size={17} className="text-coral" />
        </div>
        <div className="mt-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-white">{state.stats.streak}</span>
          <span className="text-sm text-slate-400">din</span>
        </div>
        <button
          onClick={useFreeze}
          disabled={frozenToday || state.settings.streakFreezes <= 0}
          className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300 transition hover:text-white disabled:cursor-default disabled:opacity-60"
        >
          <ShieldCheck size={13} />
          {frozenToday ? 'Freeze aaj use ho chuka' : `Streak freeze: ${state.settings.streakFreezes} available`}
        </button>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Exam Countdown</span>
          <CalendarClock size={17} className="text-violet" />
        </div>
        {remainingDays === null ? (
          <>
            <div className="mt-2 text-lg font-bold text-white">Date set nahi hai</div>
            <Link href="/settings" className="mt-2 inline-block text-[11px] font-semibold text-violet hover:underline">
              {state.settings.examName} ka date set kar →
            </Link>
          </>
        ) : (
          <>
            <div className="mt-2 text-3xl font-black text-white">{remainingDays > 0 ? remainingDays : 0}</div>
            <div className="mt-2 text-[11px] text-slate-500">
              {remainingDays > 0 ? 'din baaki' : 'exam aaj / guzar gaya'} • {state.settings.examName}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Aaj ka hisaab</span>
          <TimerReset size={17} className="text-mint" />
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div>
            <div className="text-3xl font-black text-mint">{todayStudy}<span className="ml-1 text-sm text-slate-400">min</span></div>
            <div className="text-[11px] text-slate-500">study</div>
          </div>
          <div>
            <div className="text-2xl font-black text-coral">{todayWaste}<span className="ml-1 text-xs text-slate-500">min</span></div>
            <div className="text-[11px] text-slate-500">waste</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500">
          {todayStudy >= todayWaste && todayStudy > 0 ? 'Aaj tum jeet rahe ho 💪' : 'Study time thoda badha de bhai.'}
        </div>
      </div>

      <div className="col-span-full flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-[11px] text-slate-500">
        <Sparkles size={13} className="text-violet" />
        1 minute study = 1 XP • Level 3 complete = +20 XP • Fully studied din = +10 XP
      </div>
    </div>
  );
}
