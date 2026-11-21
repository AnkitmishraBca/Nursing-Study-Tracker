'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Snowflake, X } from 'lucide-react';
import { daysInMonth, localDate, monthLabel } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { MarkStatus } from '@/lib/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MARKS: { status: MarkStatus; label: string; icon: React.ReactNode; active: string }[] = [
  { status: 'full', label: 'Fully studied', icon: <Check size={15} />, active: 'border-mint/50 bg-mint/15 text-mint' },
  { status: 'partial', label: 'Partially studied', icon: <span className="text-sm">◐</span>, active: 'border-sun/50 bg-sun/15 text-sun' },
  { status: 'not', label: 'Not studied', icon: <X size={15} />, active: 'border-coral/50 bg-coral/15 text-coral' },
];

export default function CalendarPage() {
  const { state, update, showToast } = useStore();
  const today = localDate();
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  const markMap = useMemo(
    () => new Map(state.calendar_marks.map((m) => [m.date, m])),
    [state.calendar_marks],
  );
  const selectedMark = markMap.get(selected);
  const totalDays = daysInMonth(view.year, view.month);
  const firstDay = new Date(view.year, view.month, 1).getDay();
  const monthPrefix = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;
  const monthMarks = state.calendar_marks.filter((m) => m.date.startsWith(monthPrefix));
  const counts = {
    full: monthMarks.filter((m) => m.status === 'full').length,
    partial: monthMarks.filter((m) => m.status === 'partial').length,
    not: monthMarks.filter((m) => m.status === 'not').length,
  };

  const setMark = (status: MarkStatus) => {
    update((draft) => {
      const existing = draft.calendar_marks.find((m) => m.date === selected);
      if (existing) {
        existing.status = status;
      } else {
        draft.calendar_marks.push({ date: selected, status, note: null });
      }
    });
    showToast(`${selected} ko ${status} mark kiya gaya.`);
  };

  const removeMark = () => {
    update((draft) => {
      draft.calendar_marks = draft.calendar_marks.filter((m) => m.date !== selected);
    });
  };

  const saveNote = (note: string) => {
    update((draft) => {
      const existing = draft.calendar_marks.find((m) => m.date === selected);
      if (existing) existing.note = note || null;
      else draft.calendar_marks.push({ date: selected, status: 'partial', note: note || null });
    });
  };

  const moveMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">visual discipline</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Study Calendar</h1>
        <p className="muted mt-1 text-sm">Din par click karke mark karein: green = poora, yellow = aadha, red cross = bilkul nahi.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-white">{monthLabel(view.year, view.month)}</h2>
            <div className="flex items-center gap-2">
              <button className="btn-ghost px-2.5 py-1.5" onClick={() => moveMonth(-1)}><ChevronLeft size={16} /></button>
              <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => {
                const d = new Date();
                setView({ year: d.getFullYear(), month: d.getMonth() });
                setSelected(localDate(d));
              }}>Today</button>
              <button className="btn-ghost px-2.5 py-1.5" onClick={() => moveMonth(1)}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 sm:gap-2">
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {Array.from({ length: firstDay }, (_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: totalDays }, (_, i) => {
              const day = i + 1;
              const date = `${monthPrefix}-${String(day).padStart(2, '0')}`;
              const mark = markMap.get(date);
              const isToday = date === today;
              const isSelected = date === selected;
              const hasSession = state.study_sessions.some((s) => localDate(new Date(s.ended_at)) === date);
              const frozen = state.settings.frozenDates.includes(date);
              return (
                <button
                  key={date}
                  onClick={() => setSelected(date)}
                  title={mark ? `${date}: ${mark.status}` : date}
                  className={`relative flex aspect-square min-h-[42px] items-center justify-center rounded-xl border text-sm font-semibold transition ${
                    isSelected ? 'border-mint/60 ring-2 ring-mint/20' : 'border-white/[0.07]'
                  } ${
                    mark?.status === 'full'
                      ? 'bg-mint/20 text-mint'
                      : mark?.status === 'partial'
                        ? 'bg-sun/20 text-sun'
                        : mark?.status === 'not'
                          ? 'bg-coral/20 text-coral'
                          : 'bg-white/[0.025] text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  {mark?.status === 'not' ? <X size={17} strokeWidth={3} /> : day}
                  {isToday && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-white" />}
                  {hasSession && !mark && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-mint" />}
                  {frozen && <Snowflake size={11} className="absolute right-1 top-1 text-cyan-300" />}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-mint/60" /> Fully studied <b className="text-mint">{counts.full}</b></span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-sun/60" /> Partial <b className="text-sun">{counts.partial}</b></span>
            <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-coral/60" /> Not studied <b className="text-coral">{counts.not}</b></span>
            <span className="flex items-center gap-1.5"><Snowflake size={12} className="text-cyan-300" /> Freeze</span>
          </div>
        </section>

        <div className="space-y-4">
          <section className="card">
            <div className="flex items-center gap-2 text-mint">
              <CalendarDays size={17} />
              <span className="text-xs font-bold uppercase tracking-widest">Selected day</span>
            </div>
            <div className="mt-2 text-xl font-black text-white">
              {new Date(`${selected}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="mt-4 space-y-2">
              {MARKS.map((m) => (
                <button
                  key={m.status}
                  onClick={() => setMark(m.status)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    selectedMark?.status === m.status ? m.active : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]'
                  }`}
                >
                  {m.icon} {m.label}
                  {selectedMark?.status === m.status && <Check size={14} className="ml-auto" />}
                </button>
              ))}
              {selectedMark && (
                <button onClick={removeMark} className="w-full rounded-lg py-1.5 text-xs text-slate-500 hover:text-coral">
                  Mark hata do
                </button>
              )}
            </div>
          </section>

          <section className="card">
            <label className="label" htmlFor="day-note">Din ka note</label>
            <textarea
              id="day-note"
              className="input min-h-[110px] resize-y"
              placeholder="Aaj kya padha? kya reh gaya?"
              defaultValue={selectedMark?.note ?? ''}
              key={selected}
              onBlur={(e) => saveNote(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-500">Note tab save hota hai jab aap text box se bahar click karein.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
