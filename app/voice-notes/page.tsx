'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Play,
  Save,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import { useStore } from '@/lib/store';

interface VoiceNote {
  id: string;
  title: string;
  duration_sec: number;
  audio_data: string | null;
  created_at: string;
}

const HISTORY_KEY = 'nst-voice-notes-v1';
const MAX_BASE64_CHARS = 4_000_000; // ~3 MB of audio — Postgres text column limit ke andar

function uid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readLocalHistory(): VoiceNote[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as VoiceNote[]) : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: VoiceNote[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 30)));
  } catch {
    /* storage full */
  }
}

function mmss(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VoiceNotesPage() {
  const { showToast } = useStore();

  const [title, setTitle] = useState('');
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/voice-notes', { cache: 'no-store' });
        if (response.ok) {
          const data = (await response.json()) as VoiceNote[];
          if (!cancelled && Array.isArray(data)) {
            setNotes(data);
            writeLocalHistory(data);
            return;
          }
        }
      } catch {
        /* fall back to localStorage */
      }
      if (!cancelled) setNotes(readLocalHistory());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    if (typeof MediaRecorder === 'undefined') {
      setError('Ye browser MediaRecorder support nahi karta. Chrome/Edge use karo.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setPaused(false);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } catch {
      setError('Mic access nahi mila. Browser me microphone permission allow karo.');
    }
  };

  const pauseRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (paused) {
      recorder.resume();
      setPaused(false);
    } else {
      recorder.pause();
      setPaused(true);
    }
  };

  const stopRecording = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const blob = await new Promise<Blob | null>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      recorder.stop();
    });

    setRecording(false);
    setPaused(false);
    recorderRef.current = null;
    if (!blob || blob.size === 0) {
      setError('Recording empty aayi. Dobara try karo.');
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('read failed'));
      reader.readAsDataURL(blob);
    });

    if (base64.length > MAX_BASE64_CHARS) {
      setError('Recording bahut lambi hai (3 MB se chhoti rakho).');
      return;
    }

    const note: VoiceNote = {
      id: uid(),
      title: title.trim() || `Voice note ${new Date().toLocaleTimeString('en-IN')}`,
      duration_sec: seconds,
      audio_data: base64,
      created_at: new Date().toISOString(),
    };

    setSaving(true);
    const next = [note, ...notes].slice(0, 30);
    setNotes(next);
    writeLocalHistory(next);

    try {
      await fetch('/api/voice-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      showToast('Voice note save ho gaya 🎙️');
    } catch {
      showToast('Note locally save ho gaya (cloud sync nahi hua).');
    } finally {
      setSaving(false);
      setTitle('');
      setSeconds(0);
    }
  };

  const play = (note: VoiceNote) => {
    if (!note.audio_data) {
      setError('Is note ka audio nahi hai (sirf metadata bacha hai).');
      return;
    }
    if (playingId === note.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(note.audio_data);
    audio.onended = () => setPlayingId(null);
    void audio.play();
    audioRef.current = audio;
    setPlayingId(note.id);
  };

  const remove = async (id: string) => {
    const next = notes.filter((note) => note.id !== id);
    setNotes(next);
    writeLocalHistory(next);
    if (playingId === id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
    }
    try {
      await fetch(`/api/voice-notes?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      /* local copy already removed */
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-bold uppercase tracking-[0.25em] text-mint">phase 4 • voice</div>
        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Voice Notes Recorder</h1>
        <p className="muted mt-1 text-sm">
          Class ka concept, teacher ka explanation ya apna revision — bolke record karo aur notes me save karo.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* ---------------- recorder ---------------- */}
        <section className="card space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Mic size={18} className="text-coral" /> New recording
          </h2>

          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fluid balance - osmosis recap"
              disabled={recording}
            />
          </div>

          <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-6">
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full border-2 transition ${
                recording
                  ? paused
                    ? 'border-sun bg-sun/10 text-sun'
                    : 'recording-pulse border-coral bg-coral/10 text-coral'
                  : 'border-white/10 bg-white/5 text-slate-400'
              }`}
            >
              {recording ? (paused ? <Pause size={30} /> : <Mic size={30} />) : <MicOff size={30} />}
            </div>

            <div className="text-3xl font-black tabular-nums text-white">{mmss(seconds)}</div>
            <p className="text-[11px] text-slate-500">
              {recording ? (paused ? 'Paused' : 'Recording…') : 'Ready to record'}
            </p>

            <div className="flex flex-wrap justify-center gap-2">
              {!recording ? (
                <button className="btn-primary" onClick={() => void startRecording()}>
                  <Mic size={15} /> Start recording
                </button>
              ) : (
                <>
                  <button className="btn-ghost" onClick={pauseRecording}>
                    {paused ? <Play size={15} /> : <Pause size={15} />} {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button className="btn bg-coral text-[#2a0710] hover:bg-[#ff87a1]" onClick={() => void stopRecording()}>
                    <Square size={15} /> Stop &amp; save
                  </button>
                </>
              )}
            </div>

            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <Loader2 size={13} className="animate-spin" /> Saving…
              </span>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Recording browser me hoti hai (MediaRecorder). Audio Supabase me save hota hai — agar
            <code className="mx-1 rounded bg-black/30 px-1 text-[10px] text-mint">DATABASE_URL</code> set nahi hai
            to sirf is session me playable rahega.
          </p>
        </section>

        {/* ---------------- list ---------------- */}
        <section className="card">
          <h2 className="section-title flex items-center gap-2">
            <Volume2 size={18} className="text-mint" /> Recorded notes
            <span className="text-xs font-normal text-slate-500">({notes.length})</span>
          </h2>

          {notes.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <MicOff size={38} className="text-slate-600" />
              <h3 className="mt-3 text-lg font-bold text-white">Abhi koi recording nahi</h3>
              <p className="muted mt-1 max-w-sm text-sm">
                Left side se record karo — notes yahan play/delete kar sakte ho.
              </p>
            </div>
          ) : (
            <div className="scroll-thin mt-4 max-h-[560px] space-y-2 overflow-y-auto pr-1">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3"
                >
                  <button
                    onClick={() => play(note)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition ${
                      playingId === note.id ? 'bg-mint text-[#04231a]' : 'bg-white/10 text-slate-300 hover:bg-mint/20'
                    }`}
                    aria-label="Play recording"
                  >
                    {playingId === note.id ? <Pause size={16} /> : <Play size={16} />}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{note.title}</div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {mmss(note.duration_sec)} • {new Date(note.created_at).toLocaleString('en-IN')} •{' '}
                      {note.audio_data ? 'saved' : 'session only'}
                    </div>
                  </div>

                  {note.audio_data && (
                    <span className="chip shrink-0 text-mint">
                      <Save size={11} /> saved
                    </span>
                  )}

                  <button
                    onClick={() => void remove(note.id)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-coral/10 hover:text-coral"
                    title="Delete recording"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
