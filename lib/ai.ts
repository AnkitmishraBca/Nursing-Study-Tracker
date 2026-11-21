/**
 * Phase 2 — AI layer (SERVER SIDE ONLY).
 *
 * Multi-AI fallback chain:
 *   1. Google Gemini   (primary, needs GEMINI_API_KEY)
 *   2. DeepSeek        (auto-enabled when DEEPSEEK_API_KEY is present)
 *   3. Groq            (auto-enabled when GROQ_API_KEY is present)
 *
 * Only Gemini is active out of the box. The other two are wired up but stay
 * dormant until their key shows up in the environment — so adding them later
 * is literally just "set the env var", no code change.
 *
 * NOTE: never import this file from a client component. It reads process.env
 * secrets and must stay inside the API route.
 */

export type AiMode = 'short-notes' | 'key-points' | 'one-liner' | 'mcq';
export type AiLanguage = 'en' | 'hinglish';

export const AI_MODES: AiMode[] = ['short-notes', 'key-points', 'one-liner', 'mcq'];

export interface AiNoteLine {
  type: 'heading' | 'bullet';
  text: string;
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
  run: (system: string, prompt: string) => Promise<ProviderRun>;
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

async function callGemini(apiKey: string, system: string, prompt: string): Promise<ProviderRun> {
  const models = [process.env.GEMINI_MODEL?.trim(), ...GEMINI_MODEL_FALLBACKS].filter(
    (m): m is string => Boolean(m),
  );
  let lastError = 'Gemini request failed';

  for (const model of models) {
    try {
      const response = await fetch(
        `${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
}): Promise<ProviderRun> {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.apiKey}` },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.prompt },
      ],
      temperature: 0.4,
      max_tokens: 1600,
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

function activeProviders(): Provider[] {
  const providers: Provider[] = [];

  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    providers.push({
      id: 'gemini',
      label: 'Google Gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
      run: (system, prompt) => callGemini(geminiKey, system, prompt),
    });
  }

  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    providers.push({
      id: 'deepseek',
      label: 'DeepSeek',
      model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
      run: (system, prompt) =>
        callOpenAiCompatible({
          url: `${DEEPSEEK_BASE}/chat/completions`,
          apiKey: deepseekKey,
          model: process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat',
          system,
          prompt,
        }),
    });
  }

  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    providers.push({
      id: 'groq',
      label: 'Groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      run: (system, prompt) =>
        callOpenAiCompatible({
          url: `${GROQ_BASE}/chat/completions`,
          apiKey: groqKey,
          model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
          system,
          prompt,
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

export function buildSystemPrompt(mode: AiMode, language: AiLanguage): string {
  const tone =
    language === 'hinglish'
      ? 'Write in simple Hinglish (Roman script) mixed with standard medical English terms — the way Indian nursing students actually revise.'
      : 'Write in clear, simple English using standard medical and nursing terminology.';

  const rules = [
    'You are a BSc Nursing & NORCET exam revision assistant.',
    tone,
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

export function buildUserPrompt(input: { text: string; mode: AiMode; topic?: string }): string {
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

/** Turns raw model output into heading / bullet lines the UI can render. */
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
    const text = (bullet ? bullet[1] : line).replace(/^[-*•]\s*/, '').trim();
    if (!text) continue;
    if (!bullet && PREAMBLE.test(text) && text.endsWith(':')) continue;

    lines.push({ type: 'bullet', text });
  }

  return lines;
}

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export async function generateWithFallback(input: {
  text: string;
  mode?: AiMode;
  language?: AiLanguage;
  topic?: string;
}): Promise<AiResult> {
  const text = input.text.trim();
  if (!text) throw new AiError('Text ya topic khaali hai.', 'bad_input');
  if (text.length > 12000) throw new AiError('Text 12000 characters se chhota karo.', 'bad_input');

  const providers = activeProviders();
  if (providers.length === 0) {
    throw new AiError(
      'Koi AI provider configured nahi hai. GEMINI_API_KEY set karo (.env.local / Vercel env) aur server restart karo.',
      'no_provider',
    );
  }

  const mode: AiMode = input.mode && AI_MODES.includes(input.mode) ? input.mode : 'short-notes';
  const language: AiLanguage = input.language === 'hinglish' ? 'hinglish' : 'en';
  const system = buildSystemPrompt(mode, language);
  const prompt = buildUserPrompt({ text, mode, topic: input.topic });

  const attempts: AiAttempt[] = [];

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    try {
      const result = await provider.run(system, prompt);
      attempts.push({ provider: provider.id, ok: true });
      const lines = parseNotes(result.text);
      return {
        lines,
        notes: lines.filter((l) => l.type === 'bullet').map((l) => l.text),
        raw: result.text,
        provider: provider.id,
        providerLabel: provider.label,
        model: result.model,
        attempts,
        usedFallback: index > 0,
      };
    } catch (error) {
      attempts.push({
        provider: provider.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = attempts
    .map((a) => `${a.provider}: ${a.error ?? 'failed'}`)
    .join(' | ');
  throw new AiError(`Sabhi AI providers fail ho gaye - ${summary}`, 'all_failed');
}
