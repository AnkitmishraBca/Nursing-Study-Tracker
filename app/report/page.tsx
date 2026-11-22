'use client';

import { useMemo, useRef, useState } from 'react';
import { Award, CalendarDays, Download, Flame, Loader2, Target, Timer, TrendingUp } from 'lucide-react';
import { useStore } from '@/lib/store';
import { addDays, localDate } from '@/lib/dates';

const FALLBACK_COLORS = ['#34e0a1', '#9b7bff', '#ff6b8a', '#ffc857', '#22d3ee', '#a78bfa'];

function startOfWeek(): Date {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday
  const diff = (day + 6) % 7; // Monday as week start
  return addDays(today, -diff);
}

export default function ReportPage() {
  const { state, showToast } = useStore();
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const weekStart = startOfWeek();
  const weekStartKey = localDate(weekStart);
  const weekEndKey = localDate(addDays(weekStart, 6));

  const stats = useMemo(() => {
    const inWeek = state.study_sessions.filter((s) => {
      const key = localDate(new Date(s.ended_at));
      return key >= weekStartKey && key <= weekEndKey;
    });

    const totalMinutes = inWeek.reduce((sum, s) => sum + s.minutes, 0);

    const perSubject = new Map<string, number>();
    inWeek.forEach((s) => {
      const key = s.subject_id ?? 'general';
      perSubject.set(key, (perSubject.get(key) ?? 0) + s.minutes);
    });

    const entries = [...perSubject.entries()]
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

    const fullDays = state.calendar_marks.filter(
      (m) => m.status === 'full' && m.date >= weekStartKey && m.date <= weekEndKey,
    ).length;

    // XP earned this week = study minutes + full-day bonus (same rules as stats.ts)
    const xp = totalMinutes + fullDays * 10;

    const topicsTouched = state.topics.filter((t) => {
      if (!t.last_studied_at) return false;
      const key = localDate(new Date(t.last_studied_at));
      return key >= weekStartKey && key <= weekEndKey;
    }).length;

    const tasksDone = inWeek.length + fullDays + topicsTouched;

    return {
      totalMinutes,
      entries,
      xp,
      fullDays,
      topicsTouched,
      tasksDone,
      sessions: inWeek.length,
      subjectsCovered: entries.filter((e) => e.id !== 'general').length,
      total: entries.reduce((sum, e) => sum + e.minutes, 0),
    };
  }, [state.study_sessions, state.calendar_marks, state.topics, state.subjects, weekStartKey, weekEndKey]);

  const chartEntries = stats.entries;
  let cursor = 0;
  const stops = chartEntries.map((entry) => {
    const start = (cursor / Math.max(stats.total, 1)) * 100;
    cursor += entry.minutes;
    const end = (cursor / Math.max(stats.total, 1)) * 100;
    return `${entry.color} ${start}% ${end}%`;
  });
  const gradient = stops.length
    ? `conic-gradient(${stops.join(', ')})`
    : 'conic-gradient(rgba(255,255,255,0.08) 0% 100%)';

  const downloadPdf = async () => {
    const node = reportRef.current;
    if (!node) return;
    setDownloading(true);
    try {
      // Lazy imports — jsPDF + html2canvas sirf download par load hote hain.
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
      ]);
      const canvas = await html2canvas(node, {
        backgroundColor: '#0a0d1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const image = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min((pageWidth - 16) / canvas.width, (pageHeight - 16) / canvas.height);
      const width = canvas.width * ratio;
      const height = canvas.height * ratio;
      pdf.addImage(image, 'PNG', (pageWidth - width) / 2, 8, width, height);
      pdf.save(`weekly-report-${weekStartKey}-to-${weekEndKey}.pdf`);
      showToast('PDF download ho gaya 📄');
    } catch {
      showToast('PDF ban nahi paya. Dobara try karo.');
    } finally {
      setDownloading(false);
    }
  };

  const cards = [
    { label: 'Study time', value: `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`, icon: Timer, color: 'text-mint' },
    { label: 'XP earned', value: `+${stats.xp}`, icon: TrendingUp, color: 'text-sun' },
    { label: 'Current streak', value: `${state.stats.streak} din`, icon: Flame, color: 'text-coral' },
    { label: 'Subjects covered', value: `${stats.subjectsCovered}`, icon: Target, color: 'text-violet' },
    { label: 'Tasks done', value: `${stats.tasksDone}`, icon: Award, color: 'text-cyan-300' },
    { label: 'Full study days', value: `${stats.fullDays}`, icon: CalendarDays, color: 'text-mint' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">phase 4 • report card</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Weekly Report Card</h1>
          <p className="muted mt-1 text-sm">
            {new Date(weekStart).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} →{' '}
            {new Date(addDays(weekStart, 6)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
        <button className="btn-primary" onClick={() => void downloadPdf()} disabled={downloading}>
          {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {downloading ? 'PDF ban raha hai…' : 'Download PDF'}
        </button>
      </div>

      <div ref={reportRef} className="space-y-5 rounded-2xl bg-[#0a0d1a] p-1">
        <section className="card">
          <h2 className="section-title">Is hafte ka summary</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-400">
                  <Icon size={13} className={color} /> {label}
                </div>
                <div className="mt-2 text-2xl font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Subject-wise time split</h2>
          <p className="muted mt-1 text-xs">Is hafte ka pie chart — kitna time kis subject me gaya.</p>
          <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
            <div
              className="relative h-[210px] w-[210px] shrink-0 rounded-full"
              style={{ background: gradient }}
              role="img"
              aria-label="Weekly pie chart of study time by subject"
            >
              <div className="absolute inset-[26px] flex flex-col items-center justify-center rounded-full bg-[#101527] text-center">
                <div className="text-3xl font-black text-white">{Math.floor(stats.total / 60)}h</div>
                <div className="text-xs text-slate-400">{stats.total % 60} min</div>
              </div>
            </div>
            <div className="w-full space-y-2">
              {chartEntries.length === 0 && (
                <p className="text-sm text-slate-500">Is hafte koi pomodoro complete nahi hua — data aayega.</p>
              )}
              {chartEntries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="min-w-0 flex-1 truncate text-slate-300">{entry.label}</span>
                  <span className="font-semibold text-white">{entry.minutes}m</span>
                  <span className="w-10 text-right text-xs text-slate-500">
                    {Math.round((entry.minutes / Math.max(stats.total, 1)) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Coach ka remarks</h2>
          <p className="muted mt-2 text-sm leading-relaxed">
            {stats.totalMinutes === 0
              ? 'Is hafte koi study time record nahi hua. Aaj se ek pomodoro start kar — 25 minute hi kaafi hai momentum banane ke liye.'
              : stats.totalMinutes < 150
                ? `${stats.totalMinutes} minutes padhai hui — thoda kam hai, bhai. Target 300+ minutes rakho, streak toot nahi paayega.`
                : `Solid! ${Math.floor(stats.totalMinutes / 60)} ghante ${stats.totalMinutes % 60} min ki padhai — ${stats.subjectsCovered} subjects cover hue. Bas consistency aur tight karo, exam pakka.`}
          </p>
        </section>
      </div>
    </div>
  );
}
