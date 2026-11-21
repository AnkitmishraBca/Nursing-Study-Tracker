'use client';

import { useStore } from '@/lib/store';

const FALLBACK_COLORS = ['#34e0a1', '#9b7bff', '#ff6b8a', '#ffc857', '#22d3ee', '#a78bfa'];

export default function TimePieChart() {
  const { state } = useStore();
  const totals = new Map<string, number>();
  state.study_sessions.forEach((s) => {
    const key = s.subject_id ?? 'general';
    totals.set(key, (totals.get(key) ?? 0) + s.minutes);
  });
  const entries = [...totals.entries()]
    .map(([id, minutes]) => {
      const subject = state.subjects.find((s) => s.id === id);
      return {
        id,
        label: subject ? `${subject.icon} ${subject.name}` : 'General study',
        color: subject?.color ?? FALLBACK_COLORS[Math.abs(id.length) % FALLBACK_COLORS.length],
        minutes,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
  const total = entries.reduce((sum, e) => sum + e.minutes, 0);

  let cursor = 0;
  const stops = entries.map((entry) => {
    const start = (cursor / Math.max(total, 1)) * 100;
    cursor += entry.minutes;
    const end = (cursor / Math.max(total, 1)) * 100;
    return `${entry.color} ${start}% ${end}%`;
  });
  const gradient = stops.length ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(rgba(255,255,255,0.08) 0% 100%)';

  return (
    <div className="card">
      <h2 className="section-title">Subject-wise study time</h2>
      <p className="muted mt-1 text-xs">Pomodoro sessions se automatic banne wala pie chart.</p>
      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
        <div
          className="relative h-[210px] w-[210px] shrink-0 rounded-full"
          style={{ background: gradient }}
          role="img"
          aria-label="Pie chart of study time by subject"
        >
          <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-[#101527] text-center">
            <div className="text-3xl font-black text-white">{Math.floor(total / 60)}h</div>
            <div className="text-xs text-slate-400">{total % 60} min total</div>
          </div>
        </div>
        <div className="w-full space-y-2">
          {entries.length === 0 && <p className="text-sm text-slate-500">Pehla pomodoro complete karte hi yahan chart dikh jayega.</p>}
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-300">{entry.label}</span>
              <span className="font-semibold text-white">{entry.minutes}m</span>
              <span className="w-10 text-right text-xs text-slate-500">{Math.round((entry.minutes / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
