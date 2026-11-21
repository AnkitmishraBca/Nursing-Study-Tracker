'use client';

import { useEffect, useState } from 'react';
import { Ban, Play, Square } from 'lucide-react';
import { localDate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { WASTE_CATEGORIES } from '@/lib/types';

export default function WasteWidget() {
  const { waste, startWaste, stopWaste, state, showToast } = useStore();
  const [category, setCategory] = useState<string>(WASTE_CATEGORIES[0]);
  const [tick, setTick] = useState(0);

  const today = localDate();
  const todaySessions = state.waste_sessions.filter((s) => localDate(new Date(s.ended_at)) === today);
  const total = todaySessions.reduce((sum, s) => sum + s.minutes, 0);
  const elapsed = waste ? Math.max(0, Math.floor((Date.now() - waste.startedAt) / 1000)) : 0;

  // refresh the live counter once a second while tracking
  useEffect(() => {
    if (!waste) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [waste]);
  void tick;

  return (
    <section className="card">
      <div className="flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          <Ban size={18} className="text-coral" /> Waste Time Tracker
        </h2>
        <span className="chip border-coral/20 text-coral">Aaj: {total} min</span>
      </div>
      <p className="muted mt-1 text-xs">Reels/YouTube ka time pakad kar likh lo — awareness hi pehla kadam hai.</p>

      {waste ? (
        <div className="mt-5 rounded-xl border border-coral/30 bg-coral/[0.07] p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-coral">Tracking now</div>
              <div className="mt-1 font-semibold text-white">{waste.category}</div>
            </div>
            <div className="timer-digits text-3xl font-black text-coral">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </div>
          </div>
          <button className="btn mt-4 w-full bg-coral text-[#2a0711] hover:bg-[#ff88a1]" onClick={() => { stopWaste(); showToast('Waste time record ho gaya.'); }}>
            <Square size={15} /> Stop & log
          </button>
        </div>
      ) : (
        <div className="mt-5">
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {WASTE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="btn mt-3 w-full border border-coral/30 bg-coral/10 text-coral hover:bg-coral/20" onClick={() => startWaste(category)}>
            <Play size={15} /> Tracking shuru kar
          </button>
        </div>
      )}

      {todaySessions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {todaySessions.slice(0, 6).map((s) => (
            <span key={s.id} className="chip text-[10px]">
              {s.category} · {s.minutes}m
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
