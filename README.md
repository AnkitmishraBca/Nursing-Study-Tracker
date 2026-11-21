# BSc Nursing & NORCET Study Tracker — Phase 1

Pure **naya project**. Purane code ko touch nahi kiya gaya hai. Stack: **Next.js (App Router) + Tailwind CSS + Supabase (PostgreSQL) + Drizzle ORM** (`prepare: false` with the Supabase transaction pooler).

Bina kisi database ke bhi app chal jata hai (localStorage demo mode). Supabase connect karne par poora data cloud me sync hota hai.

---

## Contents

1. [Quick start (local mode)](#1-quick-start-local-mode)
2. [Supabase setup (cloud sync)](#2-supabase-setup-cloud-sync)
3. [Phase 1 features](#3-phase-1-features)
4. [Database tables](#4-database-tables)
5. [Project structure](#5-project-structure)
6. [Important notes](#6-important-notes)

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

## 5. Project structure

```text
nursing-study-tracker/
├── app/
│   ├── api/state/route.ts      # Supabase snapshot load/save
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
│   └── 02_seed.sql             # auto-generated
├── .env.example
├── drizzle.config.ts
└── tailwind.config.ts
```

## 6. Important notes

- AI features, adaptive planning etc. **Phase 2/3** ke liye intentionally nahi daale gaye.
- Mock tests Phase 1 me simple manual score tracker hain.
- Local mode me data sirf us browser me rehta hai. Cloud mode me same browser ka data Supabase par chala jata hai.
- Alarm Web Audio API se banta hai — koi mp3 file/download nahi chahiye.
- Footer font `public/fonts/DancingScript-latin.woff2` se local load hota hai, internet chale bina bhi dikhta hai.
- "Reset all data" Settings me hai (confirmation ke saath).
