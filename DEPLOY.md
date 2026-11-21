# Vercel deployment (quick)

1. Is folder ko ZIP se nikaalo aur GitHub par naya repo bana kar push karo (ya Vercel CLI use karo).
2. Vercel → **Add New → Project** → repo select karo. Framework auto-detect: **Next.js**. Build command `npm run build`, output default. Koi custom command nahi.
3. Environment variables (Project Settings → Environment Variables):
   - `DATABASE_URL` = Supabase **Transaction pooler** URL (port `6543`). Yahi `prepare: false` wala connection hai.
   - `NEXT_PUBLIC_CLOUD_SYNC` = `true`
   - Dono **Production + Preview** ke liye apply karo. Agar abhi DB nahi connect karna: dono chhod do — app localStorage demo mode me chalega.
4. Supabase SQL Editor me pehle `sql/01_schema.sql`, phir `sql/02_seed.sql` run kar chuke ho.
5. Deploy. Build locally bhi verified hai (`npm run typecheck && npm run build`).

Notes:
- `.env.local` ZIP me nahi hai (sirf `.env.example`) — secrets kabhi commit mat karna.
- Custom domain dena ho to Vercel dashboard se add karo; koi extra config nahi chahiye.
- Local font `public/fonts/DancingScript-latin.woff2` included hai, isliye external font fetch nahi hota.
- Localstorage se Supabase par pehli baar data migrate karne ka logic already app me hai.
