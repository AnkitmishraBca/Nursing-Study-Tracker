import { relations } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

const now = timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey().default('me'),
  examName: text('exam_name').notNull().default('NORCET'),
  examDate: date('exam_date'),
  studyTime: text('study_time').notNull().default('19:00'),
  alarmEnabled: boolean('alarm_enabled').notNull().default(true),
  alarmDays: jsonb('alarm_days').$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  snoozeMinutes: integer('snooze_minutes').notNull().default(5),
  focusMode: boolean('focus_mode').notNull().default(true),
  pomodoroMin: integer('pomodoro_min').notNull().default(25),
  shortBreakMin: integer('short_break_min').notNull().default(5),
  longBreakMin: integer('long_break_min').notNull().default(15),
  streakFreezes: integer('streak_freezes').notNull().default(2),
  frozenDates: jsonb('frozen_dates').$type<string[]>().notNull().default([]),
  updatedAt: now,
});

export const userStats = pgTable('user_stats', {
  userId: text('user_id').primaryKey().default('me'),
  xp: integer('xp').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  totalMinutes: integer('total_minutes').notNull().default(0),
  lastStudyDate: date('last_study_date'),
  updatedAt: now,
});

export const subjects = pgTable(
  'subjects',
  {
    userId: text('user_id').notNull().default('me'),
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    group: text('group').notNull(),
    semester: integer('semester').notNull().default(0),
    icon: text('icon').notNull().default('📘'),
    color: text('color').notNull().default('#60a5fa'),
  },
  (t) => [uniqueIndex('subjects_user_code_uq').on(t.userId, t.code)],
);

export const topics = pgTable(
  'topics',
  {
    userId: text('user_id').notNull().default('me'),
    id: text('id').primaryKey(),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    level1: text('level1').notNull().default('todo'),
    level2: text('level2').notNull().default('todo'),
    level3: text('level3').notNull().default('todo'),
    revisionCount: integer('revision_count').notNull().default(0),
    lastStudiedAt: timestamp('last_studied_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('topics_user_subject_title_uq').on(t.userId, t.subjectId, t.title),
    index('topics_subject_idx').on(t.subjectId),
  ],
);

export const studySessions = pgTable(
  'study_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    topicId: text('topic_id').references(() => topics.id, { onDelete: 'set null' }),
    minutes: integer('minutes').notNull(),
    mode: text('mode').notNull().default('study'),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('study_sessions_ended_idx').on(t.endedAt), index('study_sessions_subject_idx').on(t.subjectId)],
);

export const wasteSessions = pgTable(
  'waste_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    category: text('category').notNull(),
    minutes: integer('minutes').notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('waste_sessions_ended_idx').on(t.endedAt)],
);

export const calendarMarks = pgTable(
  'calendar_marks',
  {
    userId: text('user_id').notNull().default('me'),
    date: date('date').notNull(),
    status: text('status').notNull(),
    note: text('note'),
    updatedAt: now,
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

export const alarms = pgTable(
  'alarms',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    firedAt: timestamp('fired_at', { withTimezone: true }),
    snoozedTo: timestamp('snoozed_to', { withTimezone: true }),
    status: text('status').notNull().default('scheduled'),
    note: text('note'),
  },
  (t) => [index('alarms_scheduled_idx').on(t.scheduledAt)],
);

export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    title: text('title').notNull(),
    body: text('body').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('notes_updated_idx').on(t.updatedAt)],
);

export const healthLogs = pgTable(
  'health_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    date: date('date').notNull(),
    water: integer('water').notNull().default(0),
    diet: text('diet'),
    sleepHours: doublePrecision('sleep_hours').notNull().default(0),
    mood: text('mood'),
    updatedAt: now,
  },
  (t) => [uniqueIndex('health_user_date_uq').on(t.userId, t.date)],
);

export const mockTests = pgTable(
  'mock_tests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    title: text('title').notNull(),
    score: doublePrecision('score'),
    total: integer('total').notNull().default(100),
    takenAt: timestamp('taken_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('mock_tests_taken_idx').on(t.takenAt)],
);

/** Phase 2 — AI generated short notes library (saved history). */
export const aiNotes = pgTable(
  'ai_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    title: text('title').notNull(),
    sourceText: text('source_text').notNull().default(''),
    mode: text('mode').notNull().default('short-notes'),
    language: text('language').notNull().default('en'),
    provider: text('provider'),
    model: text('model'),
    content: text('content').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('ai_notes_created_idx').on(t.createdAt)],
);

/** Phase 3 — AI Doubt Solver chat history. */
export const aiDoubts = pgTable(
  'ai_doubts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    question: text('question').notNull(),
    answer: text('answer').notNull().default(''),
    provider: text('provider'),
    model: text('model'),
    language: text('language').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('ai_doubts_created_idx').on(t.createdAt)],
);

/** Phase 3 — 5-minute panic revision sheets. */
export const aiPanicSessions = pgTable(
  'ai_panic_sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    subjectId: text('subject_id'),
    subjectName: text('subject_name').notNull().default(''),
    content: text('content').notNull().default(''),
    provider: text('provider'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('ai_panic_created_idx').on(t.createdAt)],
);

/** Phase 4 — AI quiz attempts (score history). */
export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    subjectName: text('subject_name').notNull().default('General'),
    topic: text('topic'),
    total: integer('total').notNull().default(0),
    score: integer('score').notNull().default(0),
    provider: text('provider'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('quiz_attempts_created_idx').on(t.createdAt)],
);

/** Phase 4 — voice notes (audio stored as base64 data URL). */
export const voiceNotes = pgTable(
  'voice_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default('me'),
    title: text('title').notNull().default('Voice note'),
    durationSec: integer('duration_sec').notNull().default(0),
    /** base64 data URL — keep recordings short (< 3 MB) so the row stays small. */
    audioData: text('audio_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: now,
  },
  (t) => [index('voice_notes_created_idx').on(t.createdAt)],
);

export const subjectRelations = relations(subjects, ({ many }) => ({ topics: many(topics) }));
export const topicRelations = relations(topics, ({ one }) => ({ subject: one(subjects, { fields: [topics.subjectId], references: [subjects.id] }) }));
