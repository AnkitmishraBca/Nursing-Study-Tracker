import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import {
  alarms,
  calendarMarks,
  healthLogs,
  mockTests,
  notes,
  studySessions,
  subjects,
  topics,
  userSettings,
  userStats,
  wasteSessions,
} from '@/db/schema';
import { DEFAULT_SETTINGS } from '@/lib/seed';
import type { AppState } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';
const iso = (value: string | Date | null) => (value ? new Date(value).toISOString() : null);

export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const [s, st, sub, top, study, waste, marks, alarmsRows, noteRows, health, mocks] = await Promise.all([
      db.select().from(userSettings).where(eq(userSettings.userId, ME)).limit(1),
      db.select().from(userStats).where(eq(userStats.userId, ME)).limit(1),
      db.select().from(subjects),
      db.select().from(topics),
      db.select().from(studySessions),
      db.select().from(wasteSessions),
      db.select().from(calendarMarks),
      db.select().from(alarms),
      db.select().from(notes),
      db.select().from(healthLogs),
      db.select().from(mockTests),
    ]);

    const state: AppState = {
      settings: {
        ...DEFAULT_SETTINGS,
        examName: s[0]?.examName ?? DEFAULT_SETTINGS.examName,
        examDate: s[0]?.examDate ?? null,
        studyTime: s[0]?.studyTime ?? DEFAULT_SETTINGS.studyTime,
        alarmEnabled: s[0]?.alarmEnabled ?? true,
        alarmDays: s[0]?.alarmDays ?? DEFAULT_SETTINGS.alarmDays,
        snoozeMinutes: s[0]?.snoozeMinutes ?? 5,
        focusMode: s[0]?.focusMode ?? true,
        pomodoroMin: s[0]?.pomodoroMin ?? 25,
        shortBreakMin: s[0]?.shortBreakMin ?? 5,
        longBreakMin: s[0]?.longBreakMin ?? 15,
        streakFreezes: s[0]?.streakFreezes ?? 2,
        frozenDates: s[0]?.frozenDates ?? [],
      },
      stats: {
        xp: st[0]?.xp ?? 0,
        streak: st[0]?.streak ?? 0,
        longest_streak: st[0]?.longestStreak ?? 0,
        total_minutes: st[0]?.totalMinutes ?? 0,
        last_study_date: st[0]?.lastStudyDate ?? null,
      },
      subjects: sub.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        group: r.group as AppState['subjects'][number]['group'],
        semester: r.semester,
        icon: r.icon,
        color: r.color,
      })),
      topics: top.map((r) => ({
        id: r.id,
        subject_id: r.subjectId,
        title: r.title,
        level1: r.level1 as AppState['topics'][number]['level1'],
        level2: r.level2 as AppState['topics'][number]['level2'],
        level3: r.level3 as AppState['topics'][number]['level3'],
        revision_count: r.revisionCount,
        last_studied_at: iso(r.lastStudiedAt),
      })),
      study_sessions: study.map((r) => ({
        id: r.id,
        subject_id: r.subjectId,
        topic_id: r.topicId,
        minutes: r.minutes,
        mode: r.mode,
        ended_at: iso(r.endedAt)!,
      })),
      waste_sessions: waste.map((r) => ({ id: r.id, category: r.category, minutes: r.minutes, ended_at: iso(r.endedAt)! })),
      calendar_marks: marks.map((r) => ({
        date: r.date,
        status: r.status as AppState['calendar_marks'][number]['status'],
        note: r.note,
      })),
      alarms: alarmsRows.map((r) => ({
        id: r.id,
        scheduled_at: iso(r.scheduledAt)!,
        fired_at: iso(r.firedAt),
        snoozed_to: iso(r.snoozedTo),
        status: r.status as AppState['alarms'][number]['status'],
        note: r.note,
      })),
      notes: noteRows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        created_at: iso(r.createdAt)!,
        updated_at: iso(r.updatedAt)!,
      })),
      health_logs: health.map((r) => ({
        id: r.id,
        date: r.date,
        water: r.water,
        diet: r.diet as AppState['health_logs'][number]['diet'],
        sleep_hours: r.sleepHours,
        mood: r.mood,
        updated_at: iso(r.updatedAt)!,
      })),
      mock_tests: mocks.map((r) => ({
        id: r.id,
        title: r.title,
        score: r.score,
        total: r.total,
        taken_at: iso(r.takenAt)!,
      })),
    };

    // Drizzle serializes Date objects in row results; normalise to ISO strings for the client.
    return NextResponse.json(JSON.parse(JSON.stringify(state)));
  } catch (error) {
    console.error('[state:GET]', error);
    return NextResponse.json({ error: 'Could not read database. Check SQL setup and RLS policies.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: AppState;
  try {
    body = (await request.json()) as AppState;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body?.settings || !Array.isArray(body.subjects) || !Array.isArray(body.topics)) {
    return NextResponse.json({ error: 'State payload is missing required fields.' }, { status: 400 });
  }

  const settings = { ...DEFAULT_SETTINGS, ...body.settings };
  const stats = body.stats ?? { xp: 0, streak: 0, longest_streak: 0, total_minutes: 0, last_study_date: null };

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(userSettings)
        .values({
          userId: ME,
          examName: settings.examName,
          examDate: settings.examDate,
          studyTime: settings.studyTime,
          alarmEnabled: settings.alarmEnabled,
          alarmDays: settings.alarmDays,
          snoozeMinutes: settings.snoozeMinutes,
          focusMode: settings.focusMode,
          pomodoroMin: settings.pomodoroMin,
          shortBreakMin: settings.shortBreakMin,
          longBreakMin: settings.longBreakMin,
          streakFreezes: settings.streakFreezes,
          frozenDates: settings.frozenDates,
        })
        .onConflictDoUpdate({
          target: userSettings.userId,
          set: {
            examName: settings.examName,
            examDate: settings.examDate,
            studyTime: settings.studyTime,
            alarmEnabled: settings.alarmEnabled,
            alarmDays: settings.alarmDays,
            snoozeMinutes: settings.snoozeMinutes,
            focusMode: settings.focusMode,
            pomodoroMin: settings.pomodoroMin,
            shortBreakMin: settings.shortBreakMin,
            longBreakMin: settings.longBreakMin,
            streakFreezes: settings.streakFreezes,
            frozenDates: settings.frozenDates,
          },
        });

      await tx
        .insert(userStats)
        .values({
          userId: ME,
          xp: stats.xp,
          streak: stats.streak,
          longestStreak: stats.longest_streak,
          totalMinutes: stats.total_minutes,
          lastStudyDate: stats.last_study_date,
        })
        .onConflictDoUpdate({
          target: userStats.userId,
          set: {
            xp: stats.xp,
            streak: stats.streak,
            longestStreak: stats.longest_streak,
            totalMinutes: stats.total_minutes,
            lastStudyDate: stats.last_study_date,
          },
        });

      // Small single-user dataset: replace child rows as one atomic snapshot.
      await tx.delete(studySessions);
      await tx.delete(wasteSessions);
      await tx.delete(calendarMarks);
      await tx.delete(alarms);
      await tx.delete(notes);
      await tx.delete(healthLogs);
      await tx.delete(mockTests);
      await tx.delete(topics);
      await tx.delete(subjects);

      if (body.subjects.length)
        await tx.insert(subjects).values(
          body.subjects.map((r) => ({
            userId: ME,
            id: r.id,
            code: r.code,
            name: r.name,
            group: r.group,
            semester: r.semester,
            icon: r.icon,
            color: r.color,
          })),
        );
      if (body.topics.length)
        await tx.insert(topics).values(
          body.topics.map((r) => ({
            userId: ME,
            id: r.id,
            subjectId: r.subject_id,
            title: r.title,
            level1: r.level1,
            level2: r.level2,
            level3: r.level3,
            revisionCount: r.revision_count,
            lastStudiedAt: r.last_studied_at ? new Date(r.last_studied_at) : null,
          })),
        );
      if (body.study_sessions?.length)
        await tx.insert(studySessions).values(
          body.study_sessions.map((r) => ({
            id: r.id,
            userId: ME,
            subjectId: r.subject_id,
            topicId: r.topic_id,
            minutes: r.minutes,
            mode: r.mode,
            endedAt: new Date(r.ended_at),
          })),
        );
      if (body.waste_sessions?.length)
        await tx.insert(wasteSessions).values(
          body.waste_sessions.map((r) => ({
            id: r.id,
            userId: ME,
            category: r.category,
            minutes: r.minutes,
            endedAt: new Date(r.ended_at),
          })),
        );
      if (body.calendar_marks?.length)
        await tx.insert(calendarMarks).values(
          body.calendar_marks.map((r) => ({ userId: ME, date: r.date, status: r.status, note: r.note })),
        );
      if (body.alarms?.length)
        await tx.insert(alarms).values(
          body.alarms.map((r) => ({
            id: r.id,
            userId: ME,
            scheduledAt: new Date(r.scheduled_at),
            firedAt: r.fired_at ? new Date(r.fired_at) : null,
            snoozedTo: r.snoozed_to ? new Date(r.snoozed_to) : null,
            status: r.status,
            note: r.note,
          })),
        );
      if (body.notes?.length)
        await tx.insert(notes).values(
          body.notes.map((r) => ({
            id: r.id,
            userId: ME,
            title: r.title,
            body: r.body,
            createdAt: new Date(r.created_at),
            updatedAt: new Date(r.updated_at),
          })),
        );
      if (body.health_logs?.length)
        await tx.insert(healthLogs).values(
          body.health_logs.map((r) => ({
            id: r.id,
            userId: ME,
            date: r.date,
            water: r.water,
            diet: r.diet,
            sleepHours: r.sleep_hours,
            mood: r.mood,
            updatedAt: new Date(r.updated_at),
          })),
        );
      if (body.mock_tests?.length)
        await tx.insert(mockTests).values(
          body.mock_tests.map((r) => ({
            id: r.id,
            userId: ME,
            title: r.title,
            score: r.score,
            total: r.total,
            takenAt: new Date(r.taken_at),
          })),
        );
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[state:POST]', error);
    return NextResponse.json({ error: 'Could not save database snapshot.' }, { status: 500 });
  }
}
