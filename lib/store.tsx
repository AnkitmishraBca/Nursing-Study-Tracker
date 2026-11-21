'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { playChime, startSiren, stopSiren } from './audio';
import { localDate } from './dates';
import { makeInitialState, mergeSeed, uid } from './seed';
import { recalcStats } from './stats';
import type { Alarm, AppState, TimerMode, TimerState } from './types';

const STATE_KEY = 'nst-state-v1';
const TIMER_KEY = 'nst-timer-v1';
const WASTE_KEY = 'nst-waste-v1';
const MIGRATED_KEY = 'nst-cloud-migrated-v1';
export const CLOUD_SYNC = process.env.NEXT_PUBLIC_CLOUD_SYNC === 'true';

type SyncStatus = 'local' | 'cloud' | 'saving' | 'error';
interface WasteRunning {
  category: string;
  startedAt: number;
}
interface ActiveAlarm {
  id: string;
  message: string;
}

const IDLE_TIMER: TimerState = {
  mode: 'study',
  status: 'idle',
  endAt: null,
  remainingSec: 25 * 60,
  subjectId: null,
  topicId: null,
  sessionStartAt: null,
};

interface StoreValue {
  state: AppState;
  update: (recipe: (draft: AppState) => void) => void;
  ready: boolean;
  syncStatus: SyncStatus;
  cloud: boolean;
  timer: TimerState;
  startTimer: (mode?: TimerMode, subjectId?: string | null, topicId?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  setTimerSelection: (subjectId: string | null, topicId: string | null) => void;
  setTimerMode: (mode: TimerMode) => void;
  focusActive: boolean;
  setFocusActive: (value: boolean) => void;
  waste: WasteRunning | null;
  startWaste: (category: string) => void;
  stopWaste: () => void;
  activeAlarm: ActiveAlarm | null;
  dismissAlarm: () => void;
  snoozeAlarm: () => void;
  alarmToStudy: () => void;
  testAlarm: () => void;
  toast: string | null;
  showToast: (message: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => makeInitialState());
  const [ready, setReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(CLOUD_SYNC ? 'cloud' : 'local');
  // Keep the very first render identical on server and client (no hydration mismatch).
  const [timer, setTimer] = useState<TimerState>(IDLE_TIMER);
  const [focusActive, setFocusActive] = useState(false);
  const [waste, setWaste] = useState<WasteRunning | null>(null);
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarm | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const stateRef = useRef(state);
  const timerRef = useRef(timer);
  const alarmRef = useRef<ActiveAlarm | null>(null);
  const dirtyRef = useRef(false);
  const skipSyncRef = useRef(false);
  const snoozeUntilRef = useRef<number | null>(null);
  const firedMinuteRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    alarmRef.current = activeAlarm;
  }, [activeAlarm]);
  useEffect(() => {
    timerRef.current = timer;
    if (!ready) return;
    try {
      localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
    } catch {
      /* private browsing */
    }
  }, [timer, ready]);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(WASTE_KEY, JSON.stringify(waste));
    } catch {
      /* private browsing */
    }
  }, [waste, ready]);

  // ---------- load: Supabase snapshot when configured, localStorage otherwise ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let local: AppState | null = null;
      const stored = readJson<AppState>(STATE_KEY);
      if (stored?.settings && Array.isArray(stored.subjects)) local = mergeSeed(stored);

      const storedTimer = readJson<Partial<TimerState>>(TIMER_KEY);
      if (storedTimer?.mode) setTimer({ ...IDLE_TIMER, ...storedTimer });
      const storedWaste = readJson<WasteRunning>(WASTE_KEY);
      if (storedWaste?.category) setWaste(storedWaste);

      if (CLOUD_SYNC) {
        try {
          const response = await fetch('/api/state', { cache: 'no-store' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const remote = (await response.json()) as AppState;
          if (remote?.settings && Array.isArray(remote.subjects)) {
            if (!cancelled) {
              const migrated = localStorage.getItem(MIGRATED_KEY) === '1';
              const localHasData = Boolean(
                local &&
                  (local.study_sessions.length || local.waste_sessions.length || local.notes.length ||
                    local.calendar_marks.length || local.health_logs.length || local.mock_tests.length),
              );
              if (!migrated && localHasData && local) {
                // First time connecting Supabase: carry the existing local history up.
                dirtyRef.current = true;
                setState(local);
              } else {
                skipSyncRef.current = true;
                setState(mergeSeed(remote));
              }
              localStorage.setItem(MIGRATED_KEY, '1');
            }
          } else if (local && !cancelled) {
            dirtyRef.current = true;
            setState(local);
          }
        } catch {
          setSyncStatus('error');
          if (local && !cancelled) {
            dirtyRef.current = true;
            setState(local);
          }
        }
      } else if (local) {
        setState(local);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- persist + debounced cloud snapshot ----------
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or disabled */
    }
    if (!CLOUD_SYNC || !dirtyRef.current) return;
    if (skipSyncRef.current) {
      skipSyncRef.current = false;
      return;
    }
    setSyncStatus('saving');
    const handle = setTimeout(async () => {
      try {
        const response = await fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        dirtyRef.current = false;
        setSyncStatus('cloud');
      } catch {
        setSyncStatus('error');
      }
    }, 900);
    return () => clearTimeout(handle);
  }, [state, ready]);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }, []);

  const update = useCallback((recipe: (draft: AppState) => void) => {
    dirtyRef.current = true;
    if (CLOUD_SYNC) setSyncStatus('saving');
    setState((prev) => {
      const next = structuredClone(prev) as AppState;
      recipe(next);
      next.stats = recalcStats(next);
      return next;
    });
  }, []);

  // ---------- timer ----------
  const durationFor = useCallback(
    (mode: TimerMode) => {
      const s = stateRef.current.settings;
      return (mode === 'study' ? s.pomodoroMin : mode === 'short' ? s.shortBreakMin : s.longBreakMin) * 60;
    },
    [],
  );

  const startTimer = useCallback(
    (mode: TimerMode = 'study', subjectId?: string | null, topicId?: string | null) => {
      const seconds = durationFor(mode);
      setTimer((prev) => ({
        mode,
        status: 'running',
        endAt: Date.now() + seconds * 1000,
        remainingSec: seconds,
        subjectId: subjectId === undefined ? prev.subjectId : subjectId,
        topicId: topicId === undefined ? prev.topicId : topicId,
        sessionStartAt: Date.now(),
      }));
      if (mode === 'study' && stateRef.current.settings.focusMode) setFocusActive(true);
    },
    [durationFor],
  );

  const pauseTimer = useCallback(() => {
    setTimer((prev) => {
      if (prev.status !== 'running' || !prev.endAt) return prev;
      return { ...prev, status: 'paused', remainingSec: Math.max(1, Math.ceil((prev.endAt - Date.now()) / 1000)), endAt: null };
    });
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((prev) => {
      if (prev.status !== 'paused') return prev;
      return { ...prev, status: 'running', endAt: Date.now() + prev.remainingSec * 1000 };
    });
    if (stateRef.current.settings.focusMode && timerRef.current.mode === 'study') setFocusActive(true);
  }, []);

  const resetTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, status: 'idle', endAt: null, remainingSec: durationFor(prev.mode), sessionStartAt: null }));
  }, [durationFor]);

  const setTimerSelection = useCallback((subjectId: string | null, topicId: string | null) => {
    setTimer((prev) => ({ ...prev, subjectId, topicId }));
  }, []);

  const setTimerMode = useCallback(
    (mode: TimerMode) => {
      setTimer((prev) =>
        prev.status === 'running'
          ? prev
          : { ...prev, mode, status: 'idle', endAt: null, remainingSec: durationFor(mode), sessionStartAt: null },
      );
    },
    [durationFor],
  );

  useEffect(() => {
    const id = setInterval(() => {
      const current = timerRef.current;
      if (current.status !== 'running' || !current.endAt) return;
      const remaining = Math.max(0, Math.ceil((current.endAt - Date.now()) / 1000));
      if (remaining === current.remainingSec) return;
      if (remaining > 0) {
        setTimer((prev) => ({ ...prev, remainingSec: remaining }));
        return;
      }
      if (current.mode === 'study') {
        const minutes = Math.max(1, stateRef.current.settings.pomodoroMin);
        const nowIso = new Date().toISOString();
        update((draft) => {
          draft.study_sessions.unshift({
            id: uid(),
            subject_id: current.subjectId,
            topic_id: current.topicId,
            minutes,
            mode: 'focus',
            ended_at: nowIso,
          });
          const topic = draft.topics.find((t) => t.id === current.topicId);
          if (topic) {
            topic.revision_count += 1;
            topic.last_studied_at = nowIso;
          }
        });
        playChime();
        showToast(`Pomodoro complete! +${minutes} XP ⚡`);
      } else {
        playChime();
        showToast('Break khatam — wapas aa ja bhai! 💪');
      }
      setTimer((prev) => ({ ...prev, status: 'done', endAt: null, remainingSec: 0 }));
    }, 300);
    return () => clearInterval(id);
  }, [update, showToast]);

  // ---------- waste time tracker ----------
  const startWaste = useCallback((category: string) => setWaste({ category, startedAt: Date.now() }), []);
  const stopWaste = useCallback(() => {
    setWaste((current) => {
      if (!current) return null;
      const minutes = Math.max(1, Math.round((Date.now() - current.startedAt) / 60000));
      update((draft) => {
        draft.waste_sessions.unshift({ id: uid(), category: current.category, minutes, ended_at: new Date().toISOString() });
      });
      showToast(`${minutes} min "${current.category}" record ho gaya. Ab wapas padhai! 🎯`);
      return null;
    });
  }, [update, showToast]);

  // ---------- loud alarm ----------
  const fireAlarm = useCallback(
    (note: string) => {
      const now = new Date();
      const id = uid();
      update((draft) => {
        const alarm: Alarm = {
          id,
          scheduled_at: now.toISOString(),
          fired_at: now.toISOString(),
          snoozed_to: null,
          status: 'fired',
          note,
        };
        draft.alarms.unshift(alarm);
      });
      setActiveAlarm({ id, message: 'Bhai, padhne ka time ho gaya!' });
      firedMinuteRef.current = `${localDate(now)}-${now.getHours()}:${now.getMinutes()}`;
      startSiren();
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('Bhai, padhne ka time ho gaya!', {
            body: 'Timer shuru kar aur focus lock laga le.',
            tag: 'nst-study-alarm',
            requireInteraction: true,
          });
        }
      } catch {
        /* notifications blocked */
      }
    },
    [update],
  );

  const clearAlarm = useCallback(
    (status: Alarm['status']) => {
      stopSiren();
      snoozeUntilRef.current = null;
      const id = alarmRef.current?.id;
      if (id) {
        update((draft) => {
          const alarm = draft.alarms.find((a) => a.id === id);
          if (alarm) alarm.status = status;
        });
      }
      alarmRef.current = null;
      setActiveAlarm(null);
    },
    [update],
  );

  const dismissAlarm = useCallback(() => clearAlarm('dismissed'), [clearAlarm]);
  const snoozeAlarm = useCallback(() => {
    const minutes = stateRef.current.settings.snoozeMinutes;
    const until = Date.now() + minutes * 60000;
    snoozeUntilRef.current = until;
    stopSiren();
    const id = alarmRef.current?.id;
    if (id) {
      update((draft) => {
        const alarm = draft.alarms.find((a) => a.id === id);
        if (alarm) {
          alarm.status = 'snoozed';
          alarm.snoozed_to = new Date(until).toISOString();
        }
      });
    }
    alarmRef.current = null;
    setActiveAlarm(null);
    showToast(`Alarm ${minutes} min ke liye snooze ho gaya.`);
  }, [update, showToast]);

  const alarmToStudy = useCallback(() => {
    clearAlarm('dismissed');
    startTimer('study');
  }, [clearAlarm, startTimer]);

  const testAlarm = useCallback(() => {
    if (activeAlarm) return;
    fireAlarm('Manual test alarm');
  }, [activeAlarm, fireAlarm]);

  useEffect(() => {
    const id = setInterval(() => {
      const settings = stateRef.current.settings;
      const now = new Date();

      if (activeAlarm && snoozeUntilRef.current && Date.now() >= snoozeUntilRef.current) {
        snoozeUntilRef.current = null;
        startSiren();
        const id = alarmRef.current?.id;
        if (id) {
          update((draft) => {
            const alarm = draft.alarms.find((a) => a.id === id);
            if (alarm) {
              alarm.status = 'fired';
              alarm.fired_at = new Date().toISOString();
            }
          });
        }
        setActiveAlarm((current) => (current ? { ...current } : null));
        return;
      }

      if (!settings.alarmEnabled || activeAlarm) return;
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm !== settings.studyTime) {
        firedMinuteRef.current = null;
        return;
      }
      if (!settings.alarmDays.includes(now.getDay())) return;
      const minuteKey = `${localDate(now)}-${hhmm}`;
      if (firedMinuteRef.current === minuteKey) return;
      const alreadyToday = stateRef.current.alarms.some(
        (a) => localDate(new Date(a.scheduled_at)) === localDate(now) && a.note !== 'Manual test alarm',
      );
      if (alreadyToday) return;
      fireAlarm('Daily study reminder');
    }, 5000);
    return () => clearInterval(id);
  }, [activeAlarm, fireAlarm, update]);

  useEffect(() => () => stopSiren(), []);

  const value = useMemo<StoreValue>(
    () => ({
      state,
      update,
      ready,
      syncStatus,
      cloud: CLOUD_SYNC,
      timer,
      startTimer,
      pauseTimer,
      resumeTimer,
      resetTimer,
      setTimerSelection,
      setTimerMode,
      focusActive,
      setFocusActive,
      waste,
      startWaste,
      stopWaste,
      activeAlarm,
      dismissAlarm,
      snoozeAlarm,
      alarmToStudy,
      testAlarm,
      toast,
      showToast,
    }),
    [
      state, update, ready, syncStatus, timer, startTimer, pauseTimer, resumeTimer, resetTimer, setTimerSelection, setTimerMode,
      focusActive, waste, startWaste, stopWaste, activeAlarm, dismissAlarm, snoozeAlarm,
      alarmToStudy, testAlarm, toast, showToast,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used inside StoreProvider');
  return context;
}
