# Vercel deployment (quick)

1. Is folder ko ZIP se nikaalo aur GitHub par naya repo bana kar push karo (ya Vercel CLI use karo).
2. Vercel → **Add New → Project** → repo select karo. Framework auto-detect: **Next.js**. Build command `npm run build`, output default. Koi custom command nahi.
3. Environment variables (Project Settings → Environment Variables):
   - `DATABASE_URL` = Supabase **Transaction pooler** URL (port `6543`). Yahi `prepare: false` wala connection hai.
   - `NEXT_PUBLIC_CLOUD_SYNC` = `true`
   - `GEMINI_API_KEY` = Google AI Studio key (Phase 2 — AI Short Note Maker ke liye)
   - Dono **Production + Preview** ke liye apply karo. Agar abhi DB nahi connect karna: `DATABASE_URL` / `NEXT_PUBLIC_CLOUD_SYNC` chhod do — app localStorage demo mode me chalega.
4. Supabase SQL Editor me **order me** ye run karo:
   1. `sql/01_schema.sql` (11 Phase 1 tables)
   2. `sql/02_seed.sql` (24 subjects / 155 topics)
   3. `sql/03_ai_notes.sql` (Phase 2 — `ai_notes` table)
5. Deploy. Build locally bhi verified hai (`npm run typecheck && npm run build`).

Notes:
- `.env.local` ZIP me nahi hai (sirf `.env.example`) — secrets kabhi commit mat karna.
- Custom domain dena ho to Vercel dashboard se add karo; koi extra config nahi chahiye.
- Local font `public/fonts/DancingScript-latin.woff2` included hai, isliye external font fetch nahi hota.
- Localstorage se Supabase par pehli baar data migrate karne ka logic already app me hai.
- `GEMINI_API_KEY` bina app poora chalta hai — sirf `/ai-notes` page error dikhata hai. Phase 2 ke liye ye ek variable hi kaafi hai; fallback providers (`DEEPSEEK_API_KEY`, `GROQ_API_KEY`) optional hain aur key milte hi chain me aa jate hain.
- Naya koi npm package add nahi hua — Gemini REST API native `fetch` se call hoti hai, isliye `package.json` unchanged hai.
