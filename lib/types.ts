export type Group = 'backlog' | 'current' | 'norcet';
export type LevelStatus = 'todo' | 'in_progress' | 'done';
export type MarkStatus = 'full' | 'partial' | 'not';

export interface Subject {
  id: string;
  code: string;
  name: string;
  group: Group;
  semester: number;
  icon: string;
  color: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  title: string;
  level1: LevelStatus;
  level2: LevelStatus;
  level3: LevelStatus;
  revision_count: number;
  last_studied_at: string | null;
}

export interface StudySession {
  id: string;
  subject_id: string | null;
  topic_id: string | null;
  minutes: number;
  mode: string;
  ended_at: string;
}

export interface WasteSession {
  id: string;
  category: string;
  minutes: number;
  ended_at: string;
}

export interface CalendarMark {
  date: string;
  status: MarkStatus;
  note: string | null;
}

export type AlarmStatus = 'scheduled' | 'fired' | 'snoozed' | 'dismissed';

export interface Alarm {
  id: string;
  scheduled_at: string;
  fired_at: string | null;
  snoozed_to: string | null;
  status: AlarmStatus;
  note: string | null;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export type Diet = 'good' | 'okay' | 'bad';

export interface HealthLog {
  id: string;
  date: string;
  water: number;
  diet: Diet | null;
  sleep_hours: number;
  mood: string | null;
  updated_at: string;
}

export interface MockTest {
  id: string;
  title: string;
  score: number | null;
  total: number;
  taken_at: string;
}

export interface Settings {
  examName: string;
  examDate: string | null;
  studyTime: string;
  alarmEnabled: boolean;
  alarmDays: number[];
  snoozeMinutes: number;
  focusMode: boolean;
  pomodoroMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  streakFreezes: number;
  frozenDates: string[];
}

export interface Stats {
  xp: number;
  streak: number;
  longest_streak: number;
  total_minutes: number;
  last_study_date: string | null;
}

export interface AppState {
  settings: Settings;
  stats: Stats;
  subjects: Subject[];
  topics: Topic[];
  study_sessions: StudySession[];
  waste_sessions: WasteSession[];
  calendar_marks: CalendarMark[];
  alarms: Alarm[];
  notes: Note[];
  health_logs: HealthLog[];
  mock_tests: MockTest[];
}

export type TimerMode = 'study' | 'short' | 'long';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'done';

export interface TimerState {
  mode: TimerMode;
  status: TimerStatus;
  endAt: number | null;
  remainingSec: number;
  subjectId: string | null;
  topicId: string | null;
  sessionStartAt: number | null;
}

export const WASTE_CATEGORIES = ['Reels / Shorts', 'YouTube', 'Chatting', 'Games', 'Random scrolling'] as const;
