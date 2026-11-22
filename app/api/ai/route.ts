import { NextResponse } from 'next/server';
import {
  AI_MODES,
  AiError,
  type AiChatTurn,
  type AiContext,
  generateWithFallback,
  providerStatus,
} from '@/lib/ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET  -> provider status (safe to call from the browser, never leaks keys).
 * POST -> { text, mode, language, topic, history?, context? }
 *
 * modes:
 *   short-notes | key-points | one-liner | mcq  -> Phase 2 note maker
 *   doubt-solver                                -> Phase 3 chat (history = past turns)
 *   panic-revision                              -> Phase 3 sheet (context = subject + topics)
 */
export async function GET() {
  const providers = providerStatus();
  return NextResponse.json({
    configured: providers.some((p) => p.configured),
    providers,
  });
}

export async function POST(request: Request) {
  let body: {
    text?: string;
    mode?: string;
    language?: string;
    topic?: string;
    history?: AiChatTurn[];
    context?: AiContext;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const mode = AI_MODES.includes(body.mode as never)
    ? (body.mode as (typeof AI_MODES)[number])
    : 'short-notes';
  const language = body.language === 'hinglish' ? 'hinglish' : 'en';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  // Panic revision gets its content from the app (subject + syllabus topics),
  // doubt solver needs the question text — every other mode needs source text.
  if (mode === 'panic-revision') {
    if (!body.context?.subject?.trim()) {
      return NextResponse.json({ error: 'Subject chahiye — pehle subject select karo.' }, { status: 400 });
    }
  } else if (!text) {
    return NextResponse.json({ error: 'Text ya topic khaali hai — kuch to likho.' }, { status: 400 });
  }

  if (text.length > 12000) {
    return NextResponse.json({ error: 'Text 12000 characters se chhota karo.' }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (turn): turn is AiChatTurn =>
            Boolean(turn) &&
            (turn.role === 'user' || turn.role === 'assistant') &&
            typeof turn.content === 'string' &&
            turn.content.trim().length > 0,
        )
        .slice(-12)
    : [];

  try {
    const result = await generateWithFallback({
      text,
      mode,
      language,
      topic: typeof body.topic === 'string' ? body.topic : undefined,
      history,
      context: body.context,
    });

    return NextResponse.json({
      ok: true,
      mode,
      language,
      notes: result.notes,
      lines: result.lines,
      sections: result.sections,
      raw: result.raw,
      provider: result.provider,
      providerLabel: result.providerLabel,
      model: result.model,
      attempts: result.attempts,
      usedFallback: result.usedFallback,
    });
  } catch (error) {
    if (error instanceof AiError) {
      const status = error.code === 'bad_input' ? 400 : 502;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('[ai:POST]', error);
    return NextResponse.json(
      { error: 'AI request fail ho gayi. Baad me try karo.' },
      { status: 500 },
    );
  }
}
