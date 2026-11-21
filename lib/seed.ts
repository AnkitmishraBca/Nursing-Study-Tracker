import raw from './seed-data.json';
import type { AppState, Settings, Subject, Topic } from './types';

export const DEFAULT_SETTINGS: Settings = {
  examName: 'NORCET',
  examDate: null,
  studyTime: '19:00',
  alarmEnabled: true,
  alarmDays: [0, 1, 2, 3, 4, 5, 6],
  snoozeMinutes: 5,
  focusMode: true,
  pomodoroMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  streakFreezes: 2,
  frozenDates: [],
};

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeInitialState(): AppState {
  const subjects: Subject[] = raw.subjects.map((s) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    group: s.group as Subject['group'],
    semester: s.semester,
    icon: s.icon,
    color: s.color,
  }));

  const topics: Topic[] = raw.subjects.flatMap((s) =>
    s.topics.map((title, index) => ({
      id: `t-${s.id}-${index + 1}`,
      subject_id: s.id,
      title,
      level1: 'todo' as const,
      level2: 'todo' as const,
      level3: 'todo' as const,
      revision_count: 0,
      last_studied_at: null,
    })),
  );

  return {
    settings: { ...DEFAULT_SETTINGS },
    stats: { xp: 0, streak: 0, longest_streak: 0, total_minutes: 0, last_study_date: null },
    subjects,
    topics,
    study_sessions: [],
    waste_sessions: [],
    calendar_marks: [],
    alarms: [],
    notes: [],
    health_logs: [],
    mock_tests: [],
  };
}

/** Merges stored data with the latest seed so newly added topics appear automatically. */
export function mergeSeed(stored: AppState): AppState {
  const base = makeInitialState();
  const knownSubjects = new Set(stored.subjects.map((s) => s.id));
  const knownTopics = new Set(stored.topics.map((t) => t.id));
  return {
    ...stored,
    subjects: [...stored.subjects, ...base.subjects.filter((s) => !knownSubjects.has(s.id))],
    topics: [...stored.topics, ...base.topics.filter((t) => !knownTopics.has(t.id))],
    settings: { ...base.settings, ...stored.settings },
    stats: { ...base.stats, ...stored.stats },
  };
}
