import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { voiceNotes } from '@/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ME = 'me';

/** Keep rows small — audio is stored as a base64 data URL inside a text column. */
const MAX_AUDIO_CHARS = 4_000_000;

interface VoicePayload {
  id?: string;
  title?: string;
  duration_sec?: number;
  audio_data?: string | null;
  created_at?: string;
}

/** GET -> saved voice notes (newest first). 503 when Supabase is not connected. */
export async function GET() {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  try {
    const rows = await db.select().from(voiceNotes).orderBy(desc(voiceNotes.createdAt)).limit(50);
    return NextResponse.json(
      JSON.parse(
        JSON.stringify(
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            duration_sec: r.durationSec,
            audio_data: r.audioData,
            created_at: new Date(r.createdAt).toISOString(),
          })),
        ),
      ),
    );
  } catch (error) {
    console.error('[voice-notes:GET]', error);
    return NextResponse.json({ error: 'Could not read voice_notes table.' }, { status: 500 });
  }
}

/** POST -> save one voice note (upsert by id). */
export async function POST(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  let body: VoicePayload;
  try {
    body = (await request.json()) as VoicePayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body?.id) {
    return NextResponse.json({ error: 'id is required.' }, { status: 400 });
  }

  const audio = typeof body.audio_data === 'string' ? body.audio_data : null;
  if (audio && audio.length > MAX_AUDIO_CHARS) {
    return NextResponse.json({ error: 'Recording bahut badi hai (3 MB se chhoti rakho).' }, { status: 400 });
  }

  const values = {
    userId: ME,
    id: body.id,
    title: body.title?.trim() || 'Voice note',
    durationSec: Math.max(0, Number(body.duration_sec ?? 0)),
    audioData: audio,
  };

  try {
    await db
      .insert(voiceNotes)
      .values(values)
      .onConflictDoUpdate({
        target: voiceNotes.id,
        set: {
          title: values.title,
          durationSec: values.durationSec,
          audioData: values.audioData,
          updatedAt: new Date(),
        },
      });
    return NextResponse.json({ ok: true, id: values.id });
  } catch (error) {
    console.error('[voice-notes:POST]', error);
    return NextResponse.json({ error: 'Could not save voice note.' }, { status: 500 });
  }
}

/** DELETE ?id=... -> remove one voice note. */
export async function DELETE(request: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'DATABASE_URL is not configured.' }, { status: 503 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id query param required.' }, { status: 400 });

  try {
    await db.delete(voiceNotes).where(eq(voiceNotes.id, id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[voice-notes:DELETE]', error);
    return NextResponse.json({ error: 'Could not delete voice note.' }, { status: 500 });
  }
}
