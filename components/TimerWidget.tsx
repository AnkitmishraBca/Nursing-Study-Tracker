'use client';

import { LockKeyhole, Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { mmss } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { TimerMode } from '@/lib/types';

const MODES: { id: TimerMode; label: string }[] = [
  { id: 'study', label: 'Study' },
  { id: 'short', label: 'Short break' },
  { id: 'long', label: 'Long break' },
];

export default function TimerWidget() {
  const {
    state, timer, startTimer, pauseTimer, resumeTimer, resetTimer,
    setTimerMode, setTimerSelection, focusActive, setFocusActive,
  } = useStore();

  const total = (timer.mode === 'study'
    ? state.settings.pomodoroMin
    : timer.mode === 'short'
      ? state.settings.shortBreakMin
      : state.settings.longBreakMin) * 60;
  const ratio = total > 0 ? Math.min(1, Math.max(0, timer.remainingSec / total)) : 0;
  const circumference = 2 * Math.PI * 104;
  const topics = state.topics.filter((t) => !timer.subjectId || t.subject_id === timer.subjectId);

  return (
    <section className="card relative overflow-hidden">
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-mint/10 blur-3xl" />
      <div className="relative flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Timer size={19} className="text-mint" /> Study Timer
        </h2>
        <button
          onClick={() => setFocusActive(!focusActive)}
          className={`chip transition ${focusActive ? 'border-mint/40 bg-mint/15 text-mint' : ''}`}
          title="Focus lock: timer chalte waqt sirf timer dikhega"
        >
          <LockKeyhole size={12} /> Focus {focusActive ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="relative mt-5 flex flex-col items-center">
        <div className="relative h-[240px] w-[240px]">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="104" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
            <circle
              cx="120" cy="120" r="104" fill="none"
              stroke={timer.mode === 'study' ? '#34e0a1' : '#9b7bff'}
              strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - ratio)}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="timer-digits text-5xl font-black text-white">{mmss(timer.remainingSec)}</div>
            <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
              {timer.status === 'running' ? 'focus kar raha hai...' : timer.status === 'done' ? 'complete 🎉' : 'ready when you are'}
            </div>
          </div>
        </div>

        <div className="mt-5 flex rounded-xl border border-white/10 bg-white/5 p-1">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setTimerMode(mode.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                timer.mode === mode.id ? 'bg-mint/15 text-mint' : 'text-slate-400 hover:text-white'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {timer.mode === 'study' && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Subject</label>
            <select
              className="input"
              value={timer.subjectId ?? ''}
              onChange={(e) => setTimerSelection(e.target.value || null, null)}
            >
              <option value="">General study</option>
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Topic</label>
            <select
              className="input"
              value={timer.topicId ?? ''}
              onChange={(e) => setTimerSelection(timer.subjectId, e.target.value || null)}
            >
              <option value="">Koi specific topic nahi</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  L1 {t.level1 === 'done' ? '✓' : '·'} · {t.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {timer.status === 'running' ? (
          <button className="btn-ghost flex-1" onClick={pauseTimer}>
            <Pause size={16} /> Pause
          </button>
        ) : (
          <button className="btn-primary flex-1" onClick={() => (timer.status === 'paused' ? resumeTimer() : startTimer(timer.mode))}>
            <Play size={16} /> {timer.status === 'paused' ? 'Resume' : 'Start timer'}
          </button>
        )}
        <button className="btn-ghost" onClick={() => { resetTimer(); setFocusActive(false); }} title="Reset">
          <RotateCcw size={16} />
        </button>
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">
        Timer complete hone par session + XP automatically save ho jayega • focus lock tab se band hoga
      </p>
    </section>
  );
}
