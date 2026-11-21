import { addDays, localDate } from './dates';
import type { AppState, LevelStatus, Stats, Topic } from './types';

export function activeDates(state: AppState): Set<string> {
  const dates = new Set<string>();
  state.study_sessions.forEach((s) => dates.add(localDate(new Date(s.ended_at))));
  state.calendar_marks.filter((m) => m.status !== 'not').forEach((m) => dates.add(m.date));
  (state.settings.frozenDates ?? []).forEach((d) => dates.add(d));
  return dates;
}

export function computeStreak(state: AppState): number {
  const dates = activeDates(state);
  let cursor = new Date();
  if (!dates.has(localDate(cursor))) cursor = addDays(cursor, -1);
  let streak = 0;
  while (dates.has(localDate(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function computeLongestStreak(state: AppState): number {
  const sorted = [...activeDates(state)].sort();
  let best = 0;
  let current = 0;
  let previous: Date | null = null;
  for (const day of sorted) {
    const date = new Date(`${day}T00:00:00`);
    if (previous && Math.round((date.getTime() - previous.getTime()) / 86400000) === 1) current += 1;
    else current = 1;
    previous = date;
    best = Math.max(best, current);
  }
  return best;
}

export function recalcStats(state: AppState): Stats {
  const totalMinutes = state.study_sessions.reduce((sum, s) => sum + s.minutes, 0);
  const doneLevels = state.topics.reduce(
    (sum, t) => sum + [t.level1, t.level2, t.level3].filter((l) => l === 'done').length,
    0,
  );
  const fullDays = state.calendar_marks.filter((m) => m.status === 'full').length;
  const studyDates = state.study_sessions.map((s) => localDate(new Date(s.ended_at))).sort();
  return {
    xp: totalMinutes + doneLevels * 20 + fullDays * 10,
    streak: computeStreak(state),
    longest_streak: Math.max(computeLongestStreak(state), computeStreak(state)),
    total_minutes: totalMinutes,
    last_study_date: studyDates.at(-1) ?? null,
  };
}

const LEVEL_ORDER: Record<LevelStatus, number> = { todo: 0, in_progress: 1, done: 2 };

export function topicPercent(topic: Topic): number {
  const values = [topic.level1, topic.level2, topic.level3].map((l) => LEVEL_ORDER[l]);
  return Math.round((values.reduce((a, b) => a + b, 0) / 6) * 100);
}

export function subjectPercent(topics: Topic[], subjectId: string): number {
  const list = topics.filter((t) => t.subject_id === subjectId);
  if (!list.length) return 0;
  return Math.round(list.reduce((sum, t) => sum + topicPercent(t), 0) / list.length);
}
