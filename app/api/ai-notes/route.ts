import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { aiNotes } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';

interface AiNotePayload {
  id?: string;
  title?: string;
  source_text?: string;
  mode?: string;
  language?: string;
  provider?: string | null;
  model?: string | null;
  content?: string;
  created_at?: string;
}

/** GET -> saved AI notes history (newest first). 503 when Supabase is not connected. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await db.select().from(aiNotes).orderBy(desc(aiNotes.createdAt)).limit(60);
    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            source_text: r.sourceText,
            mode: r.mode,
            language: r.language,
            provider: r.provider,
            model: r.model,
            content: r.content,
            created_at: new Date(r.createdAt).toISOString(),
            updated_at: new Date(r.updatedAt).toISOString(),
          })),
        ),
      ),
    );
  } catch (error) {
    console.error('[ai-notes:GET]', error);
    return NextResponse.json({ error: 'Could not read ai_notes table.' }, { status: 500 });
  }
}

/** POST -> save one AI note (upsert by id). */
export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: AiNotePayload;
  try {
    body = (await request.json()) as AiNotePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.id || !body?.content) {
    return NextResponse.json({ error: 'id and content are required.' }, { status: 400 });
  }

  const values = {
    userId: ME,
    id: body.id,
    title: body.title?.trim() || 'AI Short Notes',
    sourceText: body.source_text ?? '',
    mode: body.mode ?? 'short-notes',
    language: body.language ?? 'en',
    provider: body.provider ?? null,
    model: body.model ?? null,
    content: body.content,
  };

  try {
    await db
      .insert(aiNotes)
      .values(values)
      .onConflictDoUpdate({
        target: aiNotes.id,
        set: {
          title: values.title,
          sourceText: values.sourceText,
          mode: values.mode,
          language: values.language,
          provider: values.provider,
          model: values.model,
          content: values.content,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true, id: values.id });
  } catch (error) {
    console.error('[ai-notes:POST]', error);
    return NextResponse.json({ error: 'Could not save AI note.' }, { status: 500 });
  }
}

/** DELETE ?id=... -> remove one saved AI note. */
export async function DELETE(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required.' }, { status: 400 });

  try {
    await db.delete(aiNotes).where(eq(aiNotes.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ai-notes:DELETE]', error);
    return NextResponse.json({ error: 'Could not delete AI note.' }, { status: 500 });
  }
}
