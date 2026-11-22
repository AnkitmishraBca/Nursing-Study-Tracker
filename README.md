# BSc Nursing & NORCET Study Tracker — Phase 1 + Phase 2 + Phase 3

Pure **naya project**. Purane code ko touch nahi kiya gaya hai. Stack: **Next.js (App Router) + Tailwind CSS + Supabase (PostgreSQL) + Drizzle ORM** (`prepare: false` with the Supabase transaction pooler).

Bina kisi database ke bhi app chal jata hai (localStorage demo mode). Supabase connect karne par poora data cloud me sync hota hai.

**Phase 2** — AI Short Note Maker (Gemini + multi-AI fallback chain).
**Phase 3** — AI Doubt Solver + 5-Minute Panic Revision + hardened fallback chain.
Phase 1 ka poora code as-is chal raha hai; har phase me sirf naye files add hue hain.

---

## Contents

1. [Quick start (local mode)](#1-quick-start-local-mode)
2. [Supabase setup (cloud sync)](#2-supabase-setup-cloud-sync)
3. [Phase 1 features](#3-phase-1-features)
4. [Database tables](#4-database-tables)
5. [Project structure](#5-project-structure)
6. [Important notes](#6-important-notes)
7. [Phase 2 — AI Short Note Maker](#7-phase-2--ai-short-note-maker)
8. [Phase 3 — Doubt Solver + Panic Revision](#8-phase-3--doubt-solver--panic-revision)

---

## 1. Quick start (local mode)

```bash
cd nursing-study-tracker
npm install
npm run dev
```

Open http://localhost:3000. `.env.local` banana zaroori nahi hai — 24 subjects / 155 topics seed se automatically aa jayenge aur data browser localStorage me save hoga.

Check karne ke liye:

```bash
npm run typecheck
npm run build
```

## 2. Supabase setup (cloud sync)

1. Supabase par naya project banao.
2. SQL Editor mein **pehle** `sql/01_schema.sql` run karo, phir `sql/02_seed.sql`.
3. Project Settings → Database → Connection strings → **Transaction pooler** URL copy karo (port `6543`).
4. `.env.local` banao:

```env
DATABASE_URL=postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres
NEXT_PUBLIC_CLOUD_SYNC=true
```

5. `npm run dev` restart karo. Ab app GET/POST `/api/state` ke through Supabase par poora snapshot save karega (debounced ~900ms). Sidebar mein `Supabase • cloud` dikhega.

`db/client.ts` me connection exactly is tarah bana hai:

```ts
postgres(url, { prepare: false, max: 1 });
```

> **Single-user security note:** ye app ek hi personal user ke liye hai. RLS policies `user_id = 'me'` check karti hain aur anon key ko access deti hain. Agar aap app ko public internet par dena chahte ho to Supabase Auth lagakar policies ko `auth.uid()::text` se replace karein. Multi-user support Phase 1 ka scope nahi hai.

### Seed topics badalna hai?

Ek hi source of truth hai: `lib/seed-data.json`.

```bash
# edit lib/seed-data.json
npm run seed:sql      # sql/02_seed.sql regenerate karega
```

Phir naya `sql/02_seed.sql` Supabase SQL Editor me dobara run karo (`ON CONFLICT` ke chalte duplicate nahi banenge). Browser localStorage me already maujood users ke liye `mergeSeed()` naye topics automatically add kar deta hai.

---

## 3. Phase 1 features

| Feature | Kahan hai | Kya karta hai |
|---|---|---|
| Study Timer (Pomodoro) | Dashboard | 25/5/15 min modes, subject + topic select, SVG ring, complete par session + XP auto-save |
| Waste Time Tracker | Dashboard | Category ke saath start/stop, live counter, today ka waste total |
| XP Points | Dashboard/Sidebar | 1 min study = 1 XP, level done = +20 XP, full day = +10 XP, 500 XP par next level |
| Study Streak | Dashboard | Study sessions + calendar marks + freeze dates se continuously calculate |
| Exam Countdown | Dashboard/Settings | `examDate` set karte hi din bache dikhte hain |
| Streak Freeze | Dashboard/Settings | Aaj ke liye freeze activate karke streak todne se bachata hai |
| Loud alarm + popup | Settings + global overlay | Set time par Web Audio siren, vibration, browser notification, exact popup: **"Bhai, padhne ka time ho gaya!"** + Start / Snooze / Dismiss |
| Focus Lock Mode | Timer + global overlay | Timer chalte waqt sirf timer aur current topic; Esc se exit |
| Backlog vs Current | Subjects | Tabs: Backlog (1–3 sem), Current (4th sem), NORCET; har topic ke L1 / L2 / L3 statuses |
| Visual Calendar | Calendar | Din par click → Green / Yellow / Red Cross mark + daily note + freeze icon |
| Pie chart + Notes | Progress / Brain Dump | CSS conic-gradient donut subject-wise time; quick notes CRUD + search |
| Health & Mood | Health | Water (0–12), Diet, Sleep slider, Mood emoji, date-wise history |
| Footer watermark | Har page (layout) | Google Fonts **Dancing Script** (local woff2 bundled): **Made by 💖 Ankit** |

> Alarm ke liye browser tab khula hona chahiye. Pehli baar test alarm dabao — isse browser audio unlock hota hai. Notification chahiye to Settings me "Browser notifications" button dabao.

## 4. Database tables

`sql/01_schema.sql` exactly ye 11 tables banata hai:

`user_settings`, `subjects`, `topics`, `study_sessions`, `waste_sessions`, `calendar_marks`, `alarms`, `user_stats`, `mock_tests`, `health_logs`, `notes`

Drizzle schema unhi ka mirror hai: `db/schema.ts`. Snapshot API: `app/api/state/route.ts` (GET load, POST atomic replace in a transaction).

**Phase 2** me ek naya table add hua hai: `ai_notes` (AI Short Note Maker ki saved library) — SQL `sql/03_ai_notes.sql`, Drizzle mirror `db/schema.ts` → `aiNotes`, API `app/api/ai-notes/route.ts`.

**Phase 3** me 2 naye tables: `ai_doubts` (doubt history) aur `ai_panic_sessions` (panic sheets) — SQL `sql/04_phase3.sql`, Drizzle mirror `db/schema.ts` → `aiDoubts`, `aiPanicSessions`, API `app/api/doubts/route.ts` aur `app/api/panic-sessions/route.ts`.

## 5. Project structure

```text
nursing-study-tracker/
├── app/
│   ├── api/state/route.ts      # Supabase snapshot load/save
│   ├── api/ai/route.ts         # Phase 2/3 — AI engine (Gemini -> DeepSeek -> Groq)
│   ├── api/ai-notes/route.ts   # Phase 2 — saved AI notes library (CRUD)
│   ├── api/doubts/route.ts     # Phase 3 — doubt history (CRUD)
│   ├── api/panic-sessions/route.ts  # Phase 3 — panic sheets (CRUD)
│   ├── ai-notes/page.tsx       # Phase 2 — AI Short Note Maker UI
│   ├── doubt-solver/page.tsx   # Phase 3 — AI Doubt Solver (chat)
│   ├── panic-revision/page.tsx # Phase 3 — 5-Min Panic Revision
│   ├── calendar/page.tsx
│   ├── health/page.tsx
│   ├── notes/page.tsx
│   ├── progress/page.tsx
│   ├── settings/page.tsx
│   ├── subjects/page.tsx
│   ├── globals.css
│   ├── layout.tsx              # StoreProvider + Shell + footer watermark
│   └── page.tsx                # Dashboard
├── components/
│   ├── Shell.tsx               # Nav + focus lock + alarm popup + toast + watermark
│   ├── StatsCards.tsx
│   ├── TimerWidget.tsx
│   ├── WasteWidget.tsx
│   └── TimePieChart.tsx
├── db/
│   ├── client.ts               # postgres(url, { prepare: false })
│   └── schema.ts               # Drizzle ORM schema
├── lib/
│   ├── ai.ts                   # Phase 2/3 — provider chain, prompts, output parser
│   ├── audio.ts                # Web Audio chime + loud siren
│   ├── dates.ts
│   ├── seed-data.json          # 24 subjects / 155 topics — single source of truth
│   ├── seed.ts
│   ├── stats.ts
│   ├── store.tsx               # Timer, alarm, focus lock, persistence, sync
│   └── types.ts
├── scripts/generate-seed.mjs
├── sql/
│   ├── 01_schema.sql
│   ├── 02_seed.sql             # auto-generated
│   ├── 03_ai_notes.sql         # Phase 2 — ai_notes table
│   └── 04_phase3.sql           # Phase 3 — ai_doubts + ai_panic_sessions
├── .env.example
├── drizzle.config.ts
└── tailwind.config.ts
```

## 6. Important notes

- AI features (Phase 2 + Phase 3) ab available hain — sections 7 aur 8 dekho.
- Mock tests Phase 1 me simple manual score tracker hain.
- Local mode me data sirf us browser me rehta hai. Cloud mode me same browser ka data Supabase par chala jata hai.
- Alarm Web Audio API se banta hai — koi mp3 file/download nahi chahiye.
- Footer font `public/fonts/DancingScript-latin.woff2` se local load hota hai, internet chale bina bhi dikhta hai.
- "Reset all data" Settings me hai (confirmation ke saath).

---

## 7. Phase 2 — AI Short Note Maker

Naya page **`/ai-notes`**: topic ya chapter ka text paste karo → AI usse exam-ready short bullet notes bana deta hai.

### 7.1 Setup (1 minute)

```bash
# 1. Google AI Studio se key lo -> https://aistudio.google.com/apikey
# 2. project root me .env.local banao / edit karo:
GEMINI_API_KEY=your_key_here
# 3. dev server restart karo
npm run dev
```

Koi naya npm package install karne ki zaroorat nahi — Gemini REST API native `fetch` se call hoti hai (bundle chhoti rehti hai, koi SDK version conflict nahi).

### 7.2 Environment variables

| Variable | Zaruri? | Kaam |
|---|---|---|
| `GEMINI_API_KEY` | ✅ haan | Primary AI provider (Google AI Studio key) |
| `GEMINI_MODEL` | optional | Model override, default `gemini-2.5-flash` |
| `DEEPSEEK_API_KEY` | optional | Fallback provider #2 — key milte hi auto-on |
| `GROQ_API_KEY` | optional | Fallback provider #3 — key milte hi auto-on |
| `GEMINI_API_BASE` / `DEEPSEEK_API_BASE` / `GROQ_API_BASE` | optional | Proxy / custom gateway ke liye base URL override |

Vercel par: Project → Settings → Environment Variables me `GEMINI_API_KEY` add karke redeploy karo.

### 7.3 Multi-AI fallback chain

`lib/ai.ts` me provider chain hai — **Gemini → DeepSeek → Groq**:

1. Gemini pe call hoti hai. Agar success → notes ready.
2. Gemini fail ho jaye (quota 429 / 500 / network) → **automatic** agla configured provider try hota hai.
3. `GET /api/ai` batata hai kaun sa provider configured hai (keys kabhi browser ko nahi jaati).

Response me `provider`, `model`, `attempts` aur `usedFallback` aata hai, to UI badge dikhata hai ki fallback use hua ya nahi.

### 7.4 Modes

`Short Notes` (exam-ready bullets) • `Key Points` (high-yield facts) • `One-Liners` (flashcard style) • `MCQ Style` (Q + options + answer).
Language toggle: **Simple English** / **Hinglish**.

Extra actions: **Copy all**, **.md download**, **Brain Dump me save** (Phase 1 ke notes table me chala jata hai), **AI library me save** (`ai_notes` table, cloud sync).

### 7.5 New database table (Phase 2)

Sirf **ek** naya table chahiye — `sql/03_ai_notes.sql` (Supabase SQL Editor me run karo):

```sql
create table if not exists ai_notes (
  id text primary key,
  user_id text not null default 'me',
  title text not null default 'AI Short Notes',
  source_text text not null default '',
  mode text not null default 'short-notes',
  language text not null default 'en',
  provider text,
  model text,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Poora SQL (index + RLS + grants + trigger) `sql/03_ai_notes.sql` me hai. Table na bani ho to app crash nahi hota — AI notes localStorage me save hoti hain.

---

## 8. Phase 3 — Doubt Solver + Panic Revision

### 8.1 AI Doubt Solver — `/doubt-solver`

Chat style doubt clearing. Har jawab is format me aata hai:

- **SHORT ANSWER** — seedha jawab, pehli line
- **EXPLANATION** — chhote bullets
- **MEMORY TRICK** — mnemonic/association
- **EXAM ANGLE** — NORCET me kaise puchte hain

Features: multi-turn chat (last 10 turns AI ko jate hain), English/Hinglish toggle, suggestion chips, answer copy, Brain Dump me save, doubt history (cloud + localStorage fallback), clear chat.

### 8.2 5-Minute Panic Revision — `/panic-revision`

Group → Subject select karo → AI ek **5-minute high-yield sheet** banata hai. Uske andar exactly 5 sections hote hain:

1. **TOP 10 MUST-KNOW FACTS**
2. **NORMAL VALUES CHEAT SHEET** (`Hemoglobin | 12-16 g/dL`)
3. **DRUG DOSES - RAPID FIRE** (`Adrenaline | 0.5 mL IM | anaphylaxis`)
4. **MNEMONICS & MEMORY TRICKS**
5. **EXAM TRAPS & FREQUENTLY ASKED**

Saath me built-in **5:00 countdown timer** (start/pause/reset), sheet ka `.md` download, copy all, saved-sheets history, aur "extra focus" textbox (e.g. "drug doses pe focus").

AI ko subject ke **actual syllabus topics + unka status** jata hai (store se), to high-yield selection app ke apne data se aata hai — hard-coded list nahi.

### 8.3 Hardened multi-AI fallback

`lib/ai.ts` me chain: **Gemini → DeepSeek → Groq**.

- Gemini fail (429 quota / 5xx / network) → **ek retry with backoff** → phir bhi fail → DeepSeek → Groq.
- Har provider ki apni 1 retry hai (transient errors ke liye), phir chain aage badhta hai.
- Response me `provider`, `model`, `attempts[]` (har try ka reason) aur `usedFallback` aata hai — UI par "fallback" badge dikhta hai.
- Missing key wala provider skip ho jata hai — chain sirf configured providers me chalti hai.

### 8.4 New database tables (Phase 3)

`sql/04_phase3.sql` — sirf **2 naye tables**, Phase 1/2 schema bilkul nahi chheda:

```sql
create table if not exists ai_doubts (
  id text primary key,
  user_id text not null default 'me',
  question text not null,
  answer text not null default '',
  provider text,
  model text,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ai_panic_sessions (
  id text primary key,
  user_id text not null default 'me',
  subject_id text,
  subject_name text not null default '',
  content text not null default '',
  provider text,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Index + `updated_at` trigger + RLS (`user_id = 'me'`) + grants poora SQL file me hai. Tables na bani ho to app crash nahi hota — history localStorage me chali jati hai.
