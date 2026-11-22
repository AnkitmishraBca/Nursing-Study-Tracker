/**
 * Phase 2 + Phase 3 — AI layer (SERVER SIDE ONLY).
 *
 * Multi-AI fallback chain (order fixed):
 *   1. Google Gemini   (primary, needs GEMINI_API_KEY)
 *   2. DeepSeek        (auto-enabled when DEEPSEEK_API_KEY is present)
 *   3. Groq            (auto-enabled when GROQ_API_KEY is present)
 *
 * If Gemini fails (429 / 5xx / network error) the chain automatically moves to
 * DeepSeek, and if that fails too it moves to Groq. Each provider also gets a
 * small retry with backoff for transient errors before the chain advances.
 *
 * Modes:
 *   short-notes | key-points | one-liner | mcq   -> Phase 2 note maker
 *   doubt-solver                                 -> Phase 3 chat (multi-turn)
 *   panic-revision                               -> Phase 3 5-minute revision sheet
 *
 * NOTE: never import this file from a client component. It reads process.env
 * secrets and must stay inside the API route.
 */

export type AiMode =
  | 'short-notes'
  | 'key-points'
  | 'one-liner'
  | 'mcq'
  | 'doubt-solver'
  | 'panic-revision';

export type AiLanguage = 'en' | 'hinglish';

export const AI_MODES: AiMode[] = [
  'short-notes',
  'key-points',
  'one-liner',
  'mcq',
  'doubt-solver',
  'panic-revision',
];

export interface AiNoteLine {
  type: 'heading' | 'bullet' | 'paragraph';
  text: string;
}

export interface AiSection {
  heading: string;
  bullets: string[];
}

export interface AiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiContext {
  subject?: string;
  topics?: { title: string; status?: string }[];
  extra?: string;
}

export interface AiProviderStatus {
  id: string;
  label: string;
  model: string;
  configured: boolean;
}

export interface AiAttempt {
  provider: string;
  ok: boolean;
  error?: string;
}

export interface AiResult {
  lines: AiNoteLine[];
  notes: string[];
  sections: AiSection[];
  raw: string;
  provider: string;
  providerLabel: string;
  model: string;
  attempts: AiAttempt[];
  usedFallback: boolean;
}

export class AiError extends Error {
  code: 'no_provider' | 'all_failed' | 'bad_input';
  constructor(message: string, code: AiError['code']) {
    super(message);
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*  Providers                                                                  */
/* -------------------------------------------------------------------------- */

interface ProviderRun {
  text: string;
  model: string;
}

interface Provider {
  id: string;
  label: string;
  model: string;
  /** How many extra tries this provider gets before the chain moves on. */
  retries: number;
  run: (system: string, prompt: string, history?: AiChatTurn[]) => Promise<ProviderRun>;
}

/** Known Gemini model names — tried in order if the configured one is retired. */
const GEMINI_MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];

const trimSlash = (value: string) => value.replace(/\/+$/, '');

/** Base URLs are overridable so proxies / self-hosted gateways also work. */
const GEMINI_BASE = trimSlash(
  process.env.GEMINI_API_BASE?.trim() || 'https://generativelanguage.googleapis.com',
);
const DEEPSEEK_BASE = trimSlash(process.env.DEEPSEEK_API_BASE?.trim() || 'https://api.deepseek.com');
const GROQ_BASE = trimSlash(process.env.GROQ_API_BASE?.trim() || 'https://api.groq.com/openai/v1');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 429 / 5xx / network hiccups are worth one more try before falling back. */
const RETRYABLE =
  /429|500|502|503|504|rate limit|quota|resource exhausted|timeout|timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|network|socket hang up|overloaded/i;

function isRetryable(message: string): boolean {
  return RETRYABLE.test(message);
}

async function callGemini(
  apiKey: string,
  system: string,
  prompt: string,
  history: AiChatTurn[] = [],
): Promise<ProviderRun> {
  const models = [process.env.GEMINI_MODEL?.trim(), ...GEMINI_MODEL_FALLBACKS].filter(
    (m): m is string => Boolean(m),
  );
  let lastError = 'Gemini request failed';

  const contents = [
    ...history.map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'model',
      parts: [{ text: turn.content }],
    })),
    { role: 'user', parts: [{ text: prompt }] },
  ];

  for (const model of models) {
    try {
      const response = await fetch(
        `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: { temperature: 0.4, topP: 0.9, maxOutputTokens: 2048 },
          }),
          cache: 'no-store',
        },
      );

      const data = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };

      if (!response.ok) {
        const message = data?.error?.message ?? `HTTP ${response.status}`;
        lastError = message;
        // 404 = model name retired/not found → try the next known model.
        if (response.status === 404) continue;
        throw new Error(message);
      }

      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((p) => p?.text ?? '').join('').trim();
      if (!text) {
        const reason =
          data?.promptFeedback?.blockReason ?? data?.candidates?.[0]?.finishReason ?? 'empty response';
        throw new Error(`Gemini ne text nahi diya (${reason})`);
      }
      return { text, model };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      // Only a "model not found" style failure should jump to the next model.
      if (!/not found|404|not supported/i.test(lastError)) break;
    }
  }
  throw new Error(lastError);
}

/** DeepSeek + Groq both speak the OpenAI "chat/completions" dialect. */
async function callOpenAiCompatible(options: {
  url: string;
  apiKey: string;
  model: string;
  system: string;
  prompt: string;
  history?: AiChatTurn[];
}): Promise<ProviderRun> {
  const messages = [
    { role: 'system', content: options.system },
    ...(options.history ?? []).map((turn) => ({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.content,
    })),
    { role: 'user', content: options.prompt },
  ];

  const response = await fetch(options.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: options.model,
      messages,
      temperature: 0.4,
      max_tokens: 2000,
    }),
    cache: 'no-store',
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: { message?: { content?: string } }[];
  };
  if (!response.ok) throw new Error(data?.error?.message ?? `HTTP ${response.status}`);

  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from provider');
  return { text, model: options.model };
}

/**
 * Provider chain — Gemini first, then DeepSeek, then Groq.
 * A provider is only skipped when its API key is missing.
 */
function activeProviders(): Provider[] {
  const providers: Provider[] = [];

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    providers.push({
      id: 'gemini',
      label: 'Google Gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
      retries: 1,
      run: (system, prompt, history) => callGemini(geminiKey, system, prompt, history),
    });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    providers.push({
      id: 'deepseek',
      label: 'DeepSeek',
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      retries: 1,
      run: (system, prompt, history) =>
        callOpenAiCompatible({
          url: `${DEEPSEEK_BASE}/chat/completions`,
          apiKey: deepseekKey,
          model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
          system,
          prompt,
          history,
        }),
    });
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      id: 'groq',
      label: 'Groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      retries: 1,
      run: (system, prompt, history) =>
        callOpenAiCompatible({
          url: `${GROQ_BASE}/chat/completions`,
          apiKey: groqKey,
          model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
          system,
          prompt,
          history,
        }),
    });
  }

  return providers;
}

export function providerStatus(): AiProviderStatus[] {
  return [
    {
      id: 'gemini',
      label: 'Google Gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
      configured: Boolean(process.env.GEMINI_API_KEY?.trim()),
    },
    {
      id: 'deepseek',
      label: 'DeepSeek',
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      configured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    },
    {
      id: 'groq',
      label: 'Groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      configured: Boolean(process.env.GROQ_API_KEY?.trim()),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/*  Prompts                                                                    */
/* -------------------------------------------------------------------------- */

function toneRule(language: AiLanguage): string {
  return language === 'hinglish'
    ? 'Write in simple Hinglish (Roman script) mixed with standard medical English terms — the way Indian nursing students actually revise.'
    : 'Write in clear, simple English using standard medical and nursing terminology.';
}

export function buildSystemPrompt(mode: AiMode, language: AiLanguage): string {
  if (mode === 'doubt-solver') {
    return [
      'You are a BSc Nursing & NORCET doubt solver — a strict senior nursing tutor.',
      toneRule(language),
      'Answer the doubt in the FIRST line, then explain.',
      'Structure every answer exactly like this:',
      '**SHORT ANSWER** - one or two lines',
      '**EXPLANATION** - bullets, max 12 words each',
      '**MEMORY TRICK** - a mnemonic or association that sticks',
      '**EXAM ANGLE** - how this topic is usually asked in NORCET / semester exams',
      'Keep the whole answer under 220 words.',
      'Never invent facts. If you are not sure, write (gap - add note) and name what to verify from a textbook.',
      'If the question is ambiguous, state your assumption in one line and still answer.',
      'Do not ask clarifying questions — answer with the most likely interpretation.',
      'No preamble like "Sure!" - go straight to **SHORT ANSWER**.',
    ].join('\n');
  }

  if (mode === 'panic-revision') {
    return [
      'You are a BSc Nursing & NORCET exam revision assistant writing a 5-MINUTE PANIC REVISION SHEET.',
      toneRule(language),
      'The whole sheet must be readable in 5 minutes (roughly 450-650 words total).',
      'Use exactly these five bold headings, in this order:',
      '**TOP 10 MUST-KNOW FACTS**',
      '**NORMAL VALUES CHEAT SHEET**',
      '**DRUG DOSES - RAPID FIRE**',
      '**MNEMONICS & MEMORY TRICKS**',
      '**EXAM TRAPS & FREQUENTLY ASKED**',
      'Each section: 4 to 8 bullets, max 14 words per bullet.',
      'In normal-value bullets separate value with "|" e.g. "Hemoglobin | 12-16 g/dL (M), 13-15 g/dL (F)".',
      'In drug-dose bullets use "Drug | dose | route" e.g. "Adrenaline (1:1000) | 0.5 mL IM | anaphylaxis".',
      'Only high-yield, exam-likely content. If a section has nothing reliable for this subject, write exactly one bullet: (gap - add note).',
      'Never invent facts. No preamble.',
    ].join('\n');
  }

  const rules = [
    'You are a BSc Nursing & NORCET exam revision assistant.',
    toneRule(language),
    'Never invent facts. Stay close to the given source text; if something is missing, mark it as (gap - add note).',
    'Reply with bullet points only. One idea per bullet, maximum 18 words per bullet.',
    'No preamble, no closing remarks, no "Sure!" - straight to the notes.',
  ];

  switch (mode) {
    case 'key-points':
      rules.push('Pick only high-yield exam facts: normal values, doses, steps, complications, mnemonics.');
      break;
    case 'one-liner':
      rules.push('Every bullet must be one tight flashcard line (max 12 words).');
      break;
    case 'mcq':
      rules.push(
        'Create exam-style questions. Format each item exactly as: "Q. <question> | A. <opt> | B. <opt> | C. <opt> | D. <opt> | Ans: <letter> - <one line why>"',
      );
      break;
    default:
      rules.push('Group the notes under short bold headings such as "**Structure**" followed by bullets.');
      break;
  }

  return rules.join('\n');
}

export function buildUserPrompt(input: {
  text: string;
  mode: AiMode;
  topic?: string;
  context?: AiContext;
}): string {
  if (input.mode === 'panic-revision') {
    const context = input.context ?? {};
    const subject = context.subject?.trim() || 'General Nursing';
    const topicLines = (context.topics ?? [])
      .slice(0, 60)
      .map((t) => `- ${t.title}${t.status ? ` [${t.status}]` : ''}`)
      .join('\n');

    return [
      `Subject: ${subject}`,
      '',
      'Syllabus topics of this subject (use these to decide what is high-yield for the exam):',
      topicLines || '- (topic list not provided)',
      context.extra?.trim() ? `\nExtra focus requested by the student:\n${context.extra.trim()}` : '',
      '',
      'Create the 5-minute panic revision sheet for this subject now.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (input.mode === 'doubt-solver') {
    const topic = input.topic?.trim();
    const header = topic ? `Topic hint: ${topic}\n\n` : '';
    return `${header}Student's doubt:\n"""
${input.text.trim()}
"""

Answer this doubt following your instructions.`;
  }

  const topic = input.topic?.trim();
  const header = topic ? `Topic: ${topic}\n\n` : '';
  return `${header}Source text / topic:
"""
${input.text.trim()}
"""

Convert the source above into short revision notes, following your instructions.`;
}

/* -------------------------------------------------------------------------- */
/*  Output parsing                                                             */
/* -------------------------------------------------------------------------- */

const PREAMBLE = /^(sure|okay|ok|here (are|is)|here's|below (are|is)|these (are|is))\b/i;

/** Turns raw model output into heading / bullet / paragraph lines. */
export function parseNotes(raw: string): AiNoteLine[] {
  const lines: AiNoteLine[] = [];

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^[-*_]{3,}$/.test(line)) continue;

    const heading = line.match(/^#{1,6}\s+(.*)$/) ?? line.match(/^\*\*(.+)\*\*$/);
    if (heading) {
      const text = heading[1].replace(/\*\*/g, '').trim();
      if (text) lines.push({ type: 'heading', text });
      continue;
    }

    const bullet = line.match(/^[-*•]\s+(.*)$/) ?? line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (text) lines.push({ type: 'bullet', text });
      continue;
    }

    const text = line.trim();
    if (!text) continue;
    if (PREAMBLE.test(text) && text.endsWith(':')) continue;
    lines.push({ type: 'paragraph', text });
  }

  return lines;
}

/** Groups parsed lines into heading + bullets sections (used by panic revision). */
export function groupIntoSections(lines: AiNoteLine[]): AiSection[] {
  const sections: AiSection[] = [];
  let current: AiSection | null = null;

  for (const line of lines) {
    if (line.type === 'heading') {
      current = { heading: line.text, bullets: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { heading: 'Key Points', bullets: [] };
      sections.push(current);
    }
    current.bullets.push(line.text);
  }

  return sections.filter((section) => section.bullets.length > 0 || section.heading);
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export async function generateWithFallback(input: {
  text: string;
  mode?: AiMode;
  language?: AiLanguage;
  topic?: string;
  history?: AiChatTurn[];
  context?: AiContext;
}): Promise<AiResult> {
  const mode: AiMode = input.mode && AI_MODES.includes(input.mode) ? input.mode : 'short-notes';
  const language: AiLanguage = input.language === 'hinglish' ? 'hinglish' : 'en';
  const text = (input.text ?? '').trim();
  const history = (input.history ?? []).slice(-12);

  if (mode === 'panic-revision') {
    if (!input.context?.subject?.trim()) {
      throw new AiError('Panic revision ke liye subject chahiye.', 'bad_input');
    }
  } else if (!text) {
    throw new AiError('Text ya topic khaali hai.', 'bad_input');
  }

  if (text.length > 12000) throw new AiError('Text 12000 characters se chhota karo.', 'bad_input');

  const providers = activeProviders();
  if (providers.length === 0) {
    throw new AiError(
      'Koi AI provider configured nahi hai. GEMINI_API_KEY set karo (.env.local / Vercel env) aur server restart karo.',
      'no_provider',
    );
  }

  const system = buildSystemPrompt(mode, language);
  const prompt = buildUserPrompt({ text, mode, topic: input.topic, context: input.context });

  const attempts: AiAttempt[] = [];

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    const maxTries = provider.retries + 1;

    for (let tryIndex = 0; tryIndex < maxTries; tryIndex += 1) {
      try {
        const result = await provider.run(system, prompt, history);
        attempts.push({ provider: provider.id, ok: true });
        const lines = parseNotes(result.text);
        return {
          lines,
          notes: lines.filter((l) => l.type !== 'heading').map((l) => l.text),
          sections: groupIntoSections(lines),
          raw: result.text,
          provider: provider.id,
          providerLabel: provider.label,
          model: result.model,
          attempts,
          usedFallback: index > 0,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({ provider: provider.id, ok: false, error: message });

        const canRetry = tryIndex < maxTries - 1 && isRetryable(message);
        if (!canRetry) break;
        // Small backoff before trying the same provider once more.
        await sleep(900);
      }
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}: ${a.error ?? 'failed'}`)
    .join(' | ');
  throw new AiError(`Sabhi AI providers fail ho gaye - ${summary}`, 'all_failed');
}
