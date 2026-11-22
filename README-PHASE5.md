# Phase 5 — Advanced Security (Login Protection)

**Purana kuch bhi nahi chheda gaya.** Ye ek *additive* patch hai: nayi files + settings page me ek line.
Phase 1–4 ke components, store, data, pages — sab jaise hain waise chalenge.

```
middleware.ts                          ← NAYA (repo root me)
lib/security/session.ts                ← NAYA  (jose: Edge + Node dono)
lib/security/auth.ts                   ← NAYA  (bcryptjs, pg, rate limit, guards)
lib/security/db.ts                     ← NAYA  (alag pg pool, aapke lib/db.ts ko chhoota nahi)
app/login/page.tsx                     ← NAYA
app/api/auth/login/route.ts            ← NAYA
app/api/auth/logout/route.ts           ← NAYA
app/api/auth/session/route.ts          ← NAYA
app/api/auth/security-info/route.ts    ← NAYA
app/api/auth/generate-token/route.ts   ← NAYA
app/api/auth/set-password/route.ts     ← NAYA
app/api/auth/bootstrap/route.ts        ← NAYA (first-time password setup)
components/security-panel.tsx          ← NAYA (Settings me paste karne wala UI)
sql/06_phase5.sql                      ← NAYA
```

---

## 1. Install (2 commands)

```bash
npm i bcryptjs jose pg
npm i -D @types/bcryptjs @types/pg
```

> **`jsonwebtoken` kyun nahi?** `middleware.ts` **Edge Runtime** par chalta hai aur `jsonwebtoken`
> Node ke `crypto` module par depend karta hai — wahan crash ho jaata hai (`The edge runtime does not
> support Node.js 'crypto' module`). `jose` bilkul wahi **HS256 JWT** banata/verify karta hai aur Edge +
> Node dono par chalta hai. Isliye session code `jose` par hai. `pg` already hai to skip kar.

## 2. Env variables (Vercel → Settings → Environment Variables)

| Variable | Kya hai | Example |
|---|---|---|
| `DATABASE_URL` | Phase 1–4 wala hi Postgres URL | `postgresql://...` |
| `SESSION_SECRET` | 32+ random chars — session JWT sign karne ke liye | `openssl rand -hex 32` |
| `SETUP_KEY` | Sirf **pehli baar** password set karne ke liye one-time key | `openssl rand -hex 16` |

`SESSION_SECRET` badal dene par saare sessions turant invalid (sabko dobara login karna padega).

## 3. SQL chalao

Supabase → SQL Editor → `sql/06_phase5.sql` ka pura content paste → Run.
Ye `app_security` table banata hai (id, current_token, password_hash, updated_at) + single row seed karta hai.
Re-run safe hai.

## 4. Settings page me panel add karo

`app/settings/page.tsx` me **sirf 2 lines** (baaki kuch mat chhed):

```tsx
import SecurityPanel from '@/components/security-panel';
```

...aur jahan tu Security section dikhana chahta hai, wahan (jaise "Data" section ke upar):

```tsx
<SecurityPanel />
```

Bas. Panel khud hi login check karta hai — session nahi hai to `/login` par bhej deta hai.

## 5. Deploy + pehla login

1. Push → Vercel deploy.
2. Site khulte hi `/login` par redirect hoga (middleware).
3. **First time:** kyunki na token hai na password, login page "Pehla password 🔐" setup card dikhayega.
   `SETUP_KEY` + naya password daal → seedha andar. (Ye route ek baar ke baad khud band ho jaata hai.)
4. **Settings → Security (Phase 5):**
   - **🎫 Token generate karo** → token banega + copy button. Purana token turant invalid.
   - **🔒 Permanent Password** → bcrypt hash ban kar DB me jaata hai (purana password maangta hai).
   - **🚪 Logout** → cookie clear.
5. Setup ke baad `SETUP_KEY` env var Vercel se hata dena (optional — endpoint tab bhi dead hai).

---

## Kya kaam kaise karta hai

**Middleware (`middleware.ts`)**
- Har page + har `/api/*` route protect.
- Session cookie nahi/galat/expired → page par `307 → /login?next=<path>`, API par `401 JSON`.
- Public: `/login`, `/api/auth/{login,logout,session,bootstrap}`, static assets, PWA files.
- `next` param open-redirect safe hai (`safeNext()` — sirf internal `/` paths).

**Session (24 ghante)**
- Login success par HTTP-Only JWT cookie: `Max-Age=86400`, `Secure` (production), `SameSite=Lax`, `Path=/`.
- JWT payload: `{ sub: 'owner', ep: <epoch>, iat, exp: iat+24h }`.
- **`ep` = `app_security.updated_at`.** Token ya password rotate → epoch badla → purane saare cookies
  (dusre browser/phone) server-side reject. Jisne rotate kiya uska session response me refresh ho jaata
  hai, isliye wahi logout nahi hota.

**Dynamic token**
- Format `nst_` + 40 hex chars (20 random bytes, `crypto.randomBytes`).
- `POST /api/auth/generate-token` → naya token DB me overwrite (`current_token`), purana **automatically
  invalid** kyunki DB me sirf latest token rehta hai. Login compare **timing-safe** (`timingSafeEqual`).

**Password**
- `bcryptjs`, cost 11. Plain password kabhi store/log nahi hota.
- Badalne ke liye purana password verify hota hai (agar pehle se set hai).
- Token bhool jaye to: token se login → naya password set.

**Rate limiting**
- Login: 8 **galat** tries / 10 min / IP (sahi login par counter reset — tu apne aap ko lock nahi karega).
- Set-password: 10 tries / 10 min. Bootstrap: 5 tries / 10 min.
- In-memory hai (per serverless instance) — hobby app ke liye kaafi.

---

## Security notes (honest list)

1. **`current_token` plain text me store hota hai** — kyunki Settings me "Show token" se tu use dekh/copy
   sakta hai (single-user app). Chaho to ise `sha256(token)` me badal sakta hai (`lib/security/db.ts` +
   `lib/security/auth.ts` me 1 line), phir token sirf generate karte waqt dikhega.
2. DB access `DATABASE_URL` (postgres role) se hota hai aur `app_security` par **RLS on + koi policy nahi**
   → anon key se koi ise padh nahi sakta.
3. Middleware sirf signature + expiry check karta hai (Edge par DB driver nahi chalta). Epoch/rotation check
   API routes me hota hai (`requireSession`) — protected data waise bhi API se hi jaata hai.
4. Ye UI/route-level guard hai, database-level multi-user auth nahi. Single-user personal tracker ke liye
   exactly wahi jo chahiye.

## Troubleshooting

| Problem | Fix |
|---|---|
| `The edge runtime does not support Node.js 'crypto'` | middleware me `jsonwebtoken` ya `pg` import ho gaya hai — sirf `lib/security/session.ts` import karo |
| Login ke baad bhi `/login` par wapas | `SESSION_SECRET` set nahi / 32 chars se chhota, ya local http par `NODE_ENV=production` |
| `Database connect nahi hua` | `DATABASE_URL` + `06_phase5.sql` chala hai? Pooler URL use kar (Supabase port `6543`) |
| `setupRequired` par setup card nahi dikha | `/api/auth/session` ka response dekh — DB connect ho raha hai? |
| Sab kuch 401 | Cookie block ho raha hai (third-party cookie / private mode) — normal tab me try kar |
| Purana token kaam nahi kar raha | Ye **feature** hai — naya token generate hua to purana dead |

## Test checklist (jo maine khud chala kar verify kiya)

- [x] `/` bina cookie → `307 /login`; `/subjects?x=1` → `307 /login?next=%2Fsubjects%3Fx%3D1`
- [x] `/api/*` bina cookie → `401 JSON`
- [x] Bootstrap: galat key `401`, chhota password `400`, sahi `200` + cookie, dobara `410`
- [x] Cookie: `Max-Age=86400; Secure; HttpOnly; SameSite=lax`; JWT `exp = iat + 86400`
- [x] Password login `200`, galat password `401`
- [x] Token generate → naya token; purana token se login `401`
- [x] Token rotate → dusre device ka purana cookie `401`, current device refresh cookie `200`
- [x] Set password: purana password missing `400`, galat `401`, match fail `400`, sahi `200` → naya password login `200`, purana `401`
- [x] 10 correct logins → koi block nahi; 9 galat → 9th par `429`
- [x] Tampered cookie → `307 /login?next=%2Fprogress`
- [x] `tsc --noEmit` clean + `next build` clean (middleware Edge bundle OK)
