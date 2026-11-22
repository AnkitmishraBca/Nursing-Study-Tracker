import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { aiPanicSessions } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';

interface PanicPayload {
  id?: string;
  subject_id?: string | null;
  subject_name?: string;
  content?: string;
  provider?: string | null;
  model?: string | null;
  created_at?: string;
}

/** GET -> saved panic revision sheets (newest first). 503 without Supabase. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await db
      .select()
      .from(aiPanicSessions)
      .orderBy(desc(aiPanicSessions.createdAt))
      .limit(40);
    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            subject_id: r.subjectId,
            subject_name: r.subjectName,
            content: r.content,
            provider: r.provider,
            model: r.model,
            created_at: new Date(r.createdAt).toISOString(),
            updated_at: new Date(r.updatedAt).toISOString(),
          })),
        ),
      ),
    );
  } catch (error) {
    console.error('[panic-sessions:GET]', error);
    return NextResponse.json({ error: 'Could not read ai_panic_sessions table.' }, { status: 500 });
  }
}

/** POST -> save one panic revision sheet (upsert by id). */
export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: PanicPayload;
  try {
    body = (await request.json()) as PanicPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.id || !body?.content) {
    return NextResponse.json({ error: 'id and content are required.' }, { status: 400 });
  }

  const values = {
    userId: ME,
    id: body.id,
    subjectId: body.subject_id ?? null,
    subjectName: body.subject_name?.trim() || 'General Nursing',
    content: body.content,
    provider: body.provider ?? null,
    model: body.model ?? null,
  };

  try {
    await db
      .insert(aiPanicSessions)
      .values(values)
      .onConflictDoUpdate({
        target: aiPanicSessions.id,
        set: {
          subjectId: values.subjectId,
          subjectName: values.subjectName,
          content: values.content,
          provider: values.provider,
          model: values.model,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true, id: values.id });
  } catch (error) {
    console.error('[panic-sessions:POST]', error);
    return NextResponse.json({ error: 'Could not save panic revision.' }, { status: 500 });
  }
}

/** DELETE ?id=... -> remove one saved panic revision. */
export async function DELETE(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required.' }, { status: 400 });

  try {
    await db.delete(aiPanicSessions).where(eq(aiPanicSessions.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[panic-sessions:DELETE]', error);
    return NextResponse.json({ error: 'Could not delete panic revision.' }, { status: 500 });
  }
}
