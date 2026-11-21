'use client';

import { useEffect, useState } from 'react';
import { Droplets, HeartPulse, Moon, Save, Smile, Utensils } from 'lucide-react';
import { localDate } from '@/lib/dates';
import { uid } from '@/lib/seed';
import { useStore } from '@/lib/store';
import type { Diet } from '@/lib/types';

const MOODS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '😊', label: 'Happy' },
  { emoji: '😐', label: 'Okay' },
  { emoji: '😴', label: 'Tired' },
  { emoji: '😫', label: 'Stressed' },
];
const DIETS: { id: Diet; label: string; emoji: string }[] = [
  { id: 'good', label: 'Good', emoji: '🥗' },
  { id: 'okay', label: 'Okay', emoji: '🍛' },
  { id: 'bad', label: 'Bad', emoji: '🍟' },
];

export default function HealthPage() {
  const { state, update, showToast } = useStore();
  const today = localDate();
  const [date, setDate] = useState(today);
  const existing = state.health_logs.find((log) => log.date === date);
  const [water, setWater] = useState(existing?.water ?? 0);
  const [diet, setDiet] = useState<Diet | null>(existing?.diet ?? null);
  const [sleep, setSleep] = useState(existing?.sleep_hours ?? 7);
  const [mood, setMood] = useState<string | null>(existing?.mood ?? null);

  useEffect(() => {
    const log = state.health_logs.find((l) => l.date === date);
    setWater(log?.water ?? 0);
    setDiet(log?.diet ?? null);
    setSleep(log?.sleep_hours ?? 7);
    setMood(log?.mood ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.updated_at]);

  const save = () => {
    update((draft) => {
      const log = draft.health_logs.find((l) => l.date === date);
      if (log) {
        log.water = water;
        log.diet = diet;
        log.sleep_hours = sleep;
        log.mood = mood;
        log.updated_at = new Date().toISOString();
      } else {
        draft.health_logs.unshift({
          id: uid(),
          date,
          water,
          diet,
          sleep_hours: sleep,
          mood,
          updated_at: new Date().toISOString(),
        });
      }
    });
    showToast('Health log save ho gaya 💚');
  };

  const history = [...state.health_logs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">body & mind</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Health & Mood Log</h1>
        <p className="muted mt-1 text-sm">Paani, khaana, neend aur mood — dimaag tabhi tez chalega jab body theek rahegi.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title flex items-center gap-2"><HeartPulse size={18} className="text-coral" /> Daily log</h2>
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value || localDate())} />
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1.5"><Droplets size={15} className="text-cyan-300" /> Water</label>
              <span className="text-xs text-slate-400">{water}/8 glasses</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 12 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setWater(i + 1)}
                  className={`h-8 w-8 rounded-lg border text-xs font-bold transition ${
                    i < water ? 'border-cyan-300/50 bg-cyan-300/20 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-500'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="progress-track mt-3">
              <div className="h-full rounded-full bg-cyan-300 transition-all" style={{ width: `${Math.min(100, (water / 8) * 100)}%` }} />
            </div>
          </div>

          <div className="mt-8">
            <label className="label flex items-center gap-1.5"><Utensils size={15} className="text-sun" /> Diet</label>
            <div className="grid grid-cols-3 gap-2">
              {DIETS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setDiet(option.id)}
                  className={`rounded-xl border py-3 text-sm font-semibold transition ${
                    diet === option.id ? 'border-sun/50 bg-sun/15 text-sun' : 'border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="mr-1">{option.emoji}</span>{option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <label className="label mb-0 flex items-center gap-1.5"><Moon size={15} className="text-violet" /> Sleep</label>
              <span className="text-sm font-bold text-white">{sleep} hrs</span>
            </div>
            <input type="range" min="0" max="12" step="0.5" value={sleep} onChange={(e) => setSleep(Number(e.target.value))} className="mt-3 w-full" />
            <div className="mt-1 flex justify-between text-[10px] text-slate-600"><span>0h</span><span>6h</span><span>12h</span></div>
          </div>

          <div className="mt-8">
            <label className="label flex items-center gap-1.5"><Smile size={15} className="text-mint" /> Mood</label>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((option) => (
                <button
                  key={option.label}
                  onClick={() => setMood(option.emoji)}
                  className={`rounded-xl border py-3 text-2xl transition ${
                    mood === option.emoji ? 'border-mint/50 bg-mint/15' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.07]'
                  }`}
                  title={option.label}
                >
                  {option.emoji}
                </button>
              ))}
            </div>
          </div>

          <button className="btn-primary mt-8 w-full" onClick={save}><Save size={16} /> Save log</button>
        </section>

        <div className="space-y-4">
          <section className="card">
            <h2 className="section-title">Recent logs</h2>
            <div className="mt-4 space-y-3">
              {history.length === 0 && <p className="text-sm text-slate-500">Abhi koi health log nahi hai.</p>}
              {history.map((log) => (
                <button key={log.id} onClick={() => setDate(log.date)} className="flex w-full items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-left hover:border-white/20">
                  <div>
                    <div className="text-sm font-semibold text-white">{new Date(`${log.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                    <div className="text-[11px] text-slate-500">{log.water} glasses • {log.sleep_hours}h sleep • {log.diet ?? 'diet nahi'}</div>
                  </div>
                  <span className="text-2xl">{log.mood ?? '—'}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="card border-mint/20 bg-mint/[0.05]">
            <div className="text-sm font-bold text-mint">Tiny reminder</div>
            <p className="muted mt-1 text-xs">8 glass paani, 7+ ghante neend aur thoda sa movement — NORCET prep ka silent superpower.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
