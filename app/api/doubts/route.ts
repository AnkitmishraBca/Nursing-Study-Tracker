import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { aiDoubts } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';

interface DoubtPayload {
  id?: string;
  question?: string;
  answer?: string;
  provider?: string | null;
  model?: string | null;
  language?: string;
  created_at?: string;
}

/** GET -> saved doubt history (newest first). 503 when Supabase is not connected. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await db.select().from(aiDoubts).orderBy(desc(aiDoubts.createdAt)).limit(60);
    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            question: r.question,
            answer: r.answer,
            provider: r.provider,
            model: r.model,
            language: r.language,
            created_at: new Date(r.createdAt).toISOString(),
            updated_at: new Date(r.updatedAt).toISOString(),
          })),
        ),
      ),
    );
  } catch (error) {
    console.error('[doubts:GET]', error);
    return NextResponse.json({ error: 'Could not read ai_doubts table.' }, { status: 500 });
  }
}

/** POST -> save one doubt + its answer (upsert by id). */
export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: DoubtPayload;
  try {
    body = (await request.json()) as DoubtPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.id || !body?.question?.trim()) {
    return NextResponse.json({ error: 'id and question are required.' }, { status: 400 });
  }

  const values = {
    userId: ME,
    id: body.id,
    question: body.question.trim(),
    answer: body.answer ?? '',
    provider: body.provider ?? null,
    model: body.model ?? null,
    language: body.language ?? 'en',
  };

  try {
    await db
      .insert(aiDoubts)
      .values(values)
      .onConflictDoUpdate({
        target: aiDoubts.id,
        set: {
          question: values.question,
          answer: values.answer,
          provider: values.provider,
          model: values.model,
          language: values.language,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true, id: values.id });
  } catch (error) {
    console.error('[doubts:POST]', error);
    return NextResponse.json({ error: 'Could not save doubt.' }, { status: 500 });
  }
}

/** DELETE ?id=... -> remove one saved doubt. */
export async function DELETE(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required.' }, { status: 400 });

  try {
    await db.delete(aiDoubts).where(eq(aiDoubts.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[doubts:DELETE]', error);
    return NextResponse.json({ error: 'Could not delete doubt.' }, { status: 500 });
  }
}
