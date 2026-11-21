'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Brain, Plus, Save, Search, Sparkles, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/dates';
import { uid } from '@/lib/seed';
import { useStore } from '@/lib/store';

export default function NotesPage() {
  const { state, update, showToast } = useStore();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const notes = useMemo(
    () =>
      [...state.notes]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(query.toLowerCase())),
    [state.notes, query],
  );

  const selected = state.notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    setTitle(selected?.title ?? '');
    setBody(selected?.body ?? '');
  }, [selectedId, selected?.title, selected?.body]);

  const createNote = () => {
    const id = uid();
    const now = new Date().toISOString();
    update((draft) => {
      draft.notes.unshift({ id, title: 'Untitled note', body: '', created_at: now, updated_at: now });
    });
    setSelectedId(id);
    setTitle('Untitled note');
    setBody('');
  };

  const saveNote = () => {
    if (!selectedId) return;
    update((draft) => {
      const note = draft.notes.find((n) => n.id === selectedId);
      if (note) {
        note.title = title.trim() || 'Untitled note';
        note.body = body;
        note.updated_at = new Date().toISOString();
      }
    });
    showToast('Note save ho gaya 🧠');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">brain dump</div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Quick Notes</h1>
          <p className="muted mt-1 text-sm">Jo bhi yaad aaye — formula, PYQ, ya &quot;kal ye padhna hai&quot; — turant yahan likh do.</p>
        </div>
        <Link href="/ai-notes" className="btn-violet">
          <Sparkles size={15} /> AI se short notes
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <section className="card">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><Brain size={18} className="text-violet" /> All notes</h2>
            <button className="rounded-lg border border-mint/30 bg-mint/10 p-2 text-mint hover:bg-mint/20" onClick={createNote} title="New note">
              <Plus size={16} />
            </button>
          </div>
          <div className="relative mt-4">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input pl-9" placeholder="Search notes..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="scroll-thin mt-3 max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {notes.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Koi note nahi. + dabao aur likhna shuru karo.</p>}
            {notes.map((note) => (
              <button
                key={note.id}
                onClick={() => setSelectedId(note.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedId === note.id ? 'border-violet/50 bg-violet/10' : 'border-white/[0.07] bg-white/[0.025] hover:border-white/20'
                }`}
              >
                <div className="truncate text-sm font-semibold text-white">{note.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500">{note.body || 'Empty note'}</div>
                <div className="mt-1.5 text-[10px] text-slate-600">{timeAgo(note.updated_at)}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          {selected ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <input className="input text-lg font-bold" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
                <button
                  className="rounded-lg p-2 text-slate-500 hover:bg-coral/10 hover:text-coral"
                  title="Delete note"
                  onClick={() => {
                    update((draft) => { draft.notes = draft.notes.filter((n) => n.id !== selected.id); });
                    setSelectedId(null);
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <textarea
                className="input mt-3 min-h-[380px] resize-y leading-relaxed"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Likhna shuru kar...\n\n• Short notes\n• Important formulas\n• PYQ tricks\n• Kal ka plan"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Last saved: {timeAgo(selected.updated_at)}</span>
                <button className="btn-primary" onClick={saveNote}><Save size={15} /> Save note</button>
              </div>
            </>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
              <Brain size={42} className="text-violet/60" />
              <h2 className="mt-4 text-xl font-bold text-white">Brain dump kholo</h2>
              <p className="muted mt-2 max-w-sm text-sm">Left se koi note select karo ya naya banao. Padhai ke beech mein aayi har idea yahin daal do.</p>
              <button className="btn-violet mt-5" onClick={createNote}><Plus size={15} /> Naya note</button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
