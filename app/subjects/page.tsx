'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, PauseCircle, Play, Search, CheckCircle2 } from 'lucide-react';
import { subjectPercent, topicPercent } from '@/lib/stats';
import { useStore } from '@/lib/store';
import type { Group, LevelStatus } from '@/lib/types';

type LevelKey = 'level1' | 'level2' | 'level3';
const LEVELS: { key: LevelKey; short: string; label: string }[] = [
  { key: 'level1', short: 'L1', label: 'Level 1 • Basic' },
  { key: 'level2', short: 'L2', label: 'Level 2 • Revision' },
  { key: 'level3', short: 'L3', label: 'Level 3 • NORCET' },
];
const GROUPS: { id: Group; label: string; sub: string }[] = [
  { id: 'backlog', label: 'Backlog', sub: '1st – 3rd sem' },
  { id: 'current', label: 'Current', sub: '4th sem' },
  { id: 'norcet', label: 'NORCET', sub: 'exam boost' },
];
const NEXT: Record<LevelStatus, LevelStatus> = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

const LEVEL_STYLE: Record<LevelStatus, string> = {
  todo: 'border-white/10 bg-white/5 text-slate-500 hover:text-slate-200',
  in_progress: 'border-sun/40 bg-sun/15 text-sun',
  done: 'border-mint/40 bg-mint/15 text-mint',
};

export default function SubjectsPage() {
  const { state, update, startTimer, setTimerSelection } = useStore();
  const [group, setGroup] = useState<Group>('backlog');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const subjects = useMemo(
    () =>
      state.subjects.filter((subject) => {
        if (subject.group !== group) return false;
        if (!query.trim()) return true;
        const q = query.toLowerCase();
        return (
          subject.name.toLowerCase().includes(q) ||
          subject.code.toLowerCase().includes(q) ||
          state.topics.some((t) => t.subject_id === subject.id && t.title.toLowerCase().includes(q))
        );
      }),
    [state.subjects, state.topics, group, query],
  );

  const groupTopics = state.topics.filter((t) => state.subjects.some((s) => s.id === t.subject_id && s.group === group));
  const doneLevels = groupTopics.reduce((sum, t) => sum + [t.level1, t.level2, t.level3].filter((l) => l === 'done').length, 0);

  const cycle = (topicId: string, key: LevelKey) => {
    update((draft) => {
      const topic = draft.topics.find((t) => t.id === topicId);
      if (!topic) return;
      topic[key] = NEXT[topic[key]];
      if (topic[key] === 'done') topic.last_studied_at = new Date().toISOString();
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">backlog vs current</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Subjects & Topics</h1>
        <p className="muted mt-1 text-sm">Har topic ke 3 level: basic → revision → NORCET. Button dabao, status cycle karega: grey → yellow → green.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {GROUPS.map((g) => {
          const count = state.subjects.filter((s) => s.group === g.id).length;
          return (
            <button
              key={g.id}
              onClick={() => { setGroup(g.id); setOpen(null); }}
              className={`rounded-2xl border p-4 text-left transition ${
                group === g.id ? 'border-mint/50 bg-mint/10 shadow-glow' : 'border-white/10 bg-white/[0.035] hover:border-white/25'
              }`}
            >
              <div className={`text-sm font-bold ${group === g.id ? 'text-mint' : 'text-white'}`}>{g.label}</div>
              <div className="muted mt-0.5 text-xs">{g.sub}</div>
              <div className="mt-3 text-2xl font-black text-white">{count} <span className="text-xs font-normal text-slate-500">subjects</span></div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" placeholder="Subject ya topic search karein..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="chip">{doneLevels}/{groupTopics.length * 3} levels done</div>
      </div>

      <div className="space-y-3">
        {subjects.length === 0 && (
          <div className="card text-center text-sm text-slate-500">Koi subject nahi mila. Search badal kar dekho.</div>
        )}
        {subjects.map((subject) => {
          const topics = state.topics.filter(
            (t) => t.subject_id === subject.id && (!query || t.title.toLowerCase().includes(query.toLowerCase()) || subject.name.toLowerCase().includes(query.toLowerCase())),
          );
          const percent = subjectPercent(state.topics, subject.id);
          const isOpen = open === subject.id;
          return (
            <div key={subject.id} className="card-tight overflow-hidden">
              <button className="flex w-full items-center gap-3 p-4 text-left transition hover:bg-white/[0.03]" onClick={() => setOpen(isOpen ? null : subject.id)}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ backgroundColor: `${subject.color}22` }}>
                  {subject.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-white">{subject.name}</span>
                    <span className="chip text-[10px]">{subject.code}</span>
                    {subject.group !== 'norcet' && <span className="chip text-[10px]">Sem {subject.semester}</span>}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="progress-track max-w-md flex-1"><div className="progress-fill" style={{ width: `${percent}%`, background: `linear-gradient(90deg, ${subject.color}, #34e0a1)` }} /></div>
                    <span className="text-xs font-bold" style={{ color: subject.color }}>{percent}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">{topics.length} topics</div>
                  <ChevronDown size={18} className={`ml-auto mt-1 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/[0.07] px-4 py-3">
                  <div className="mb-2 grid grid-cols-[1fr_auto] gap-2 px-2 text-[10px] uppercase tracking-widest text-slate-600 sm:grid-cols-[1fr_230px_90px]">
                    <span>Topic</span><span className="hidden sm:block">Levels</span><span className="text-right">Progress</span>
                  </div>
                  {topics.map((topic) => (
                    <div key={topic.id} className="grid gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3 sm:grid-cols-[1fr_230px_90px] sm:items-center">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-100">{topic.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{topicPercent(topic)}%</span>
                          {topic.revision_count > 0 && <span>• {topic.revision_count} revisions</span>}
                          {topic.last_studied_at && <span>• studied {new Date(topic.last_studied_at).toLocaleDateString('en-IN')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        {LEVELS.map((level) => (
                          <button
                            key={level.key}
                            onClick={() => cycle(topic.id, level.key)}
                            title={`${level.label}: ${topic[level.key]}`}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] font-bold transition ${LEVEL_STYLE[topic[level.key]]}`}
                          >
                            {topic[level.key] === 'done' ? <CheckCircle2 size={13} className="mx-auto" /> : level.short}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <div className="progress-track hidden w-14 sm:block"><div className="progress-fill" style={{ width: `${topicPercent(topic)}%` }} /></div>
                        <button
                          className="rounded-lg border border-mint/30 bg-mint/10 p-1.5 text-mint transition hover:bg-mint/20"
                          title="Is topic ke saath 25 min timer shuru kar"
                          onClick={() => { setTimerSelection(subject.id, topic.id); startTimer('study', subject.id, topic.id); }}
                        >
                          <Play size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {topics.length === 0 && <div className="p-4 text-center text-xs text-slate-500">Is subject mein koi topic nahi mila.</div>}
                  <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-slate-600">
                    <PauseCircle size={12} /> Circle = done, L1/L2/L3 = click karke progress badhao
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
