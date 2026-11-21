'use client';

import { useState } from 'react';
import { AlarmClock, BellRing, BookOpenCheck, Cloud, CloudOff, RotateCcw, Volume2 } from 'lucide-react';
import { localDate } from '@/lib/dates';
import { makeInitialState } from '@/lib/seed';
import { useStore } from '@/lib/store';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function SettingsPage() {
  const { state, update, syncStatus, cloud, testAlarm, showToast } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  const s = state.settings;

  const toggleDay = (day: number) => {
    update((draft) => {
      draft.settings.alarmDays = draft.settings.alarmDays.includes(day)
        ? draft.settings.alarmDays.filter((d) => d !== day)
        : [...draft.settings.alarmDays, day].sort();
    });
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      showToast('Ye browser notifications support nahi karta.');
      return;
    }
    const permission = await Notification.requestPermission();
    showToast(permission === 'granted' ? 'Browser notifications on ho gayi 🔔' : 'Notification permission deny ho gaya.');
  };

  const reset = () => {
    update((draft) => {
      Object.assign(draft, makeInitialState());
    });
    localStorage.removeItem('nst-timer-v1');
    localStorage.removeItem('nst-waste-v1');
    setConfirmReset(false);
    showToast('Data reset karke fresh seed daal diya.');
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">make it yours</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Settings</h1>
        <p className="muted mt-1 text-sm">Alarm, focus lock, exam date aur timer — sab yahan se control karega.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="section-title flex items-center gap-2"><AlarmClock size={18} className="text-coral" /> Padhne ka time & alarm</h2>
          <p className="muted mt-1 text-xs">Time aate hi screen par loud alarm aur popup aayega: &quot;Bhai, padhne ka time ho gaya!&quot;</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="study-time">Daily study time</label>
              <input id="study-time" type="time" className="input" value={s.studyTime} onChange={(e) => update((draft) => { draft.settings.studyTime = e.target.value; })} />
            </div>
            <div>
              <label className="label" htmlFor="snooze">Snooze (minutes)</label>
              <input id="snooze" type="number" min="1" max="60" className="input" value={s.snoozeMinutes} onChange={(e) => update((draft) => { draft.settings.snoozeMinutes = Math.max(1, Number(e.target.value)); })} />
            </div>
          </div>

          <div className="mt-5">
            <label className="label">Alarm din</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((label, index) => (
                <button
                  key={index}
                  onClick={() => toggleDay(index)}
                  title={index === 0 ? 'Sunday' : undefined}
                  className={`h-10 w-10 rounded-xl border text-sm font-bold transition ${
                    s.alarmDays.includes(index) ? 'border-mint/50 bg-mint/15 text-mint' : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className={`btn ${s.alarmEnabled ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => update((draft) => { draft.settings.alarmEnabled = !draft.settings.alarmEnabled; })}
            >
              <BellRing size={15} /> Alarm {s.alarmEnabled ? 'ON' : 'OFF'}
            </button>
            <button className="btn-ghost" onClick={testAlarm}><Volume2 size={15} /> Test alarm</button>
            <button className="btn-ghost" onClick={enableNotifications}>Browser notifications</button>
          </div>
          <p className="mt-3 text-[11px] text-slate-600">Alarm tab khula hona chahiye. Browser notification chahiye to permission do — warna popup + loud siren dikhega.</p>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent alarms</div>
            {state.alarms.length === 0 ? (
              <div className="mt-2 text-xs text-slate-600">Abhi tak koi alarm nahi baja.</div>
            ) : (
              <div className="mt-2 space-y-1.5">
                {state.alarms.slice(0, 4).map((alarm) => (
                  <div key={alarm.id} className="flex justify-between text-xs text-slate-400">
                    <span>{new Date(alarm.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    <span className={alarm.status === 'dismissed' ? 'text-slate-600' : 'text-mint'}>{alarm.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="card">
            <h2 className="section-title flex items-center gap-2"><BookOpenCheck size={18} className="text-mint" /> Exam & timer</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="exam-name">Exam name</label>
                <input id="exam-name" className="input" value={s.examName} onChange={(e) => update((draft) => { draft.settings.examName = e.target.value; })} />
              </div>
              <div>
                <label className="label" htmlFor="exam-date">Exam date</label>
                <input id="exam-date" type="date" className="input" value={s.examDate ?? ''} onChange={(e) => update((draft) => { draft.settings.examDate = e.target.value || null; })} />
              </div>
              <div>
                <label className="label" htmlFor="pomodoro">Pomodoro (min)</label>
                <input id="pomodoro" type="number" min="5" max="120" className="input" value={s.pomodoroMin} onChange={(e) => update((draft) => { draft.settings.pomodoroMin = Math.max(1, Number(e.target.value)); })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="short-break">Short break</label>
                  <input id="short-break" type="number" min="1" className="input" value={s.shortBreakMin} onChange={(e) => update((draft) => { draft.settings.shortBreakMin = Math.max(1, Number(e.target.value)); })} />
                </div>
                <div>
                  <label className="label" htmlFor="long-break">Long break</label>
                  <input id="long-break" type="number" min="1" className="input" value={s.longBreakMin} onChange={(e) => update((draft) => { draft.settings.longBreakMin = Math.max(1, Number(e.target.value)); })} />
                </div>
              </div>
            </div>
            <button
              className={`mt-5 flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                s.focusMode ? 'border-mint/40 bg-mint/10' : 'border-white/10 bg-white/[0.03]'
              }`}
              onClick={() => update((draft) => { draft.settings.focusMode = !draft.settings.focusMode; })}
            >
              <span>
                <span className="block text-sm font-semibold text-white">Focus Lock Mode</span>
                <span className="muted block text-xs">Timer start hote hi sirf timer + current topic dikhega.</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.focusMode ? 'bg-mint text-[#04231a]' : 'bg-white/10 text-slate-400'}`}>
                {s.focusMode ? 'ON' : 'OFF'}
              </span>
            </button>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-sm">
              <span className="text-slate-300">Streak freezes left</span>
              <span className="font-bold text-cyan-300">{s.streakFreezes} ❄️</span>
            </div>
          </section>

          <section className="card">
            <h2 className="section-title">Data</h2>
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              {cloud ? <Cloud size={16} className="text-mint" /> : <CloudOff size={16} className="text-slate-500" />}
              {cloud ? `Supabase sync • ${syncStatus}` : 'Local demo mode (no database connected)'}
            </div>
            <p className="muted mt-2 text-xs">Supabase chalne ke liye <code className="rounded bg-white/10 px-1">DATABASE_URL</code> aur <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_CLOUD_SYNC=true</code> set karein.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {!confirmReset ? (
                <button className="btn-ghost text-coral" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset all data</button>
              ) : (
                <>
                  <button className="btn bg-coral text-[#2a0711]" onClick={reset}>Haan, reset kar do</button>
                  <button className="btn-ghost" onClick={() => setConfirmReset(false)}>Cancel</button>
                </>
              )}
            </div>
            <p className="mt-3 text-[11px] text-slate-600">Reset sab sessions, notes, marks aur topics ke levels mita dega. Local date: {localDate()}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
