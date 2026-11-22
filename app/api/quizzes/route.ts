import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { quizAttempts } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';

interface QuizPayload {
  id?: string;
  subject_name?: string;
  topic?: string | null;
  total?: number;
  score?: number;
  provider?: string | null;
  created_at?: string;
}

/** GET -> quiz attempt history (newest first). 503 when Supabase is not connected. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await db.select().from(quizAttempts).orderBy(desc(quizAttempts.createdAt)).limit(80);
    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            subject_name: r.subjectName,
            topic: r.topic,
            total: r.total,
            score: r.score,
            provider: r.provider,
            created_at: new Date(r.createdAt).toISOString(),
          })),
        ),
      ),
    );
  } catch (error) {
    console.error('[quizzes:GET]', error);
    return NextResponse.json({ error: 'Could not read quiz_attempts table.' }, { status: 500 });
  }
}

/** POST -> save one quiz attempt (upsert by id). */
export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: QuizPayload;
  try {
    body = (await request.json()) as QuizPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  const values = {
    userId: ME,
    id: body.id,
    subjectName: body.subject_name?.trim() || 'General',
    topic: body.topic ?? null,
    total: Math.max(0, Number(body.total ?? 0)),
    score: Math.max(0, Number(body.score ?? 0)),
    provider: body.provider ?? null,
  };

  try {
    await db
      .insert(quizAttempts)
      .values(values)
      .onConflictDoUpdate({
        target: quizAttempts.id,
        set: {
          subjectName: values.subjectName,
          topic: values.topic,
          total: values.total,
          score: values.score,
          provider: values.provider,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true, id: values.id });
  } catch (error) {
    console.error('[quizzes:POST]', error);
    return NextResponse.json({ error: 'Could not save quiz attempt.' }, { status: 500 });
  }
}

/** DELETE ?id=... -> remove one quiz attempt. */
export async function DELETE(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required.' }, { status: 400 });

  try {
    await db.delete(quizAttempts).where(eq(quizAttempts.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[quizzes:DELETE]', error);
    return NextResponse.json({ error: 'Could not delete quiz attempt.' }, { status: 500 });
  }
}
