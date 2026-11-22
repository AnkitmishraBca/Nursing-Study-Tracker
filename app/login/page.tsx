'use client';

/**
 * Phase 5 · /login
 * 2 tabs: "Token se Login" | "Password se Login"
 * Success par middleware ka `next` param ya "/" par redirect.
 */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'token' | 'password';

export default function LoginPage() {
  return (
    <Suspense fallback={<Shell><p style={s.muted}>Loading…</p></Shell>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get('next') || '/';

  const [mode, setMode] = useState<Mode>('token');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  // already logged in? seedha andar bhej do. First run? setup card dikhao.
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d?.authenticated) {
          setAlready(true);
          router.replace(nextPath);
          return;
        }
        if (d?.setupRequired) setSetupRequired(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router, nextPath]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'token' ? { mode, token, next: nextPath } : { mode, password, next: nextPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Login fail (HTTP ${res.status}).`);
        return;
      }
      router.replace(data.redirect || nextPath);
      router.refresh();
    } catch {
      setError('Network error. Dobara try kar.');
    } finally {
      setBusy(false);
    }
  }

  if (setupRequired) {
    return (
      <Shell>
        <SetupForm nextPath={nextPath} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={s.badgeRow}>
        <span style={s.badge}>Phase 5 · Login Protection</span>
      </div>

      <h1 style={s.h1}>Ruk ja bhai 🛑</h1>
      <p style={s.sub}>
        Pehle login kar. Session 24 ghante chalega — uske baad dobara yahi screen aayegi.
      </p>

      {/* tabs */}
      <div style={s.tabs} role="tablist" aria-label="Login mode">
        <Tab active={mode === 'token'} onClick={() => { setMode('token'); setError(null); }} icon="🔑">
          Token se Login
        </Tab>
        <Tab active={mode === 'password'} onClick={() => { setMode('password'); setError(null); }} icon="🔒">
          Password se Login
        </Tab>
      </div>

      <form onSubmit={submit} style={s.form}>
        {mode === 'token' ? (
          <>
            <label style={s.label} htmlFor="token">
              Dynamic token
            </label>
            <input
              id="token"
              style={{ ...s.input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0.5px' }}
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="nst_2f9a... (Settings se generate karo)"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <p style={s.hint}>
              Naya token banate hi purana wala automatically invalid ho jaata hai.
            </p>
          </>
        ) : (
          <>
            <label style={s.label} htmlFor="password">
              Password
            </label>
            <div style={s.passWrap}>
              <input
                id="password"
                style={{ ...s.input, paddingRight: 52 }}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Tera permanent password"
                autoComplete="current-password"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={s.eye}
                aria-label={showPass ? 'Password hide karo' : 'Password dikhao'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
            <p style={s.hint}>
              Password bhool gaya? Token se login kar, phir Settings me naya password set kar.
            </p>
          </>
        )}

        {error && (
          <div style={s.error} role="alert">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={busy || (mode === 'token' ? !token : !password)}
          style={{ ...s.button, opacity: busy || (mode === 'token' ? !token : !password) ? 0.55 : 1 }}
        >
          {busy ? 'Check kar raha hoon…' : mode === 'token' ? 'Token se andar jao →' : 'Password se andar jao →'}
        </button>
      </form>

      <p style={s.foot}>
        {already ? 'Session pehle se valid hai — redirect kar raha hoon…' : 'HTTP-Only cookie · 24 hour session · bcrypt hashed password'}
      </p>
    </Shell>
  );
}

/* --------------------------- first-run setup --------------------------- */

function SetupForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [setupKey, setSetupKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password kam se kam 8 characters ka rakho.');
    if (password !== confirm) return setError('Confirm password match nahi kar raha.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/bootstrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setupKey, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setError(data?.error || `Setup fail (HTTP ${res.status}).`);
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('Network error. Dobara try kar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={s.badgeRow}>
        <span style={{ ...s.badge, color: '#fcd34d', background: 'rgba(251,191,36,0.10)', borderColor: 'rgba(251,191,36,0.30)' }}>
          First-time setup
        </span>
      </div>
      <h1 style={s.h1}>Pehla password 🔐</h1>
      <p style={s.sub}>
        Abhi na token hai na password. Ek baar password set ho jaye, phir hamesha usi se (ya token se) login
        hoga. Setup ke liye <code style={s.codeInline}>SETUP_KEY</code> chahiye — wo Vercel env variable me hai.
      </p>
      <form onSubmit={submit} style={s.form}>
        <label style={s.label} htmlFor="setupKey">SETUP_KEY</label>
        <input
          id="setupKey"
          style={{ ...s.input, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
          value={setupKey}
          onChange={(e) => setSetupKey(e.target.value.trim())}
          placeholder="Vercel env var SETUP_KEY ki value"
          autoComplete="off"
          autoFocus
        />
        <label style={s.label} htmlFor="newPass">Naya permanent password</label>
        <input
          id="newPass"
          style={s.input}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min 8 characters"
          autoComplete="new-password"
        />
        <input
          style={s.input}
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          autoComplete="new-password"
        />
        {error && <div style={s.error} role="alert">{error}</div>}
        <button type="submit" style={{ ...s.button, opacity: busy ? 0.55 : 1 }} disabled={busy}>
          {busy ? 'Setting up…' : 'Password set karke andar jao →'}
        </button>
      </form>
      <p style={s.foot}>bcrypt hash · HTTP-Only cookie · 24 hour session</p>
    </>
  );
}

/* ------------------------------- UI bits ------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={s.page}>
      <div style={s.glowA} aria-hidden />
      <div style={s.glowB} aria-hidden />
      <section style={s.card}>{children}</section>
    </main>
  );
}

function Tab({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{ ...s.tab, ...(active ? s.tabActive : null) }}
    >
      <span style={{ fontSize: 15 }}>{icon}</span>
      {children}
    </button>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: '32px 18px',
    background: 'radial-gradient(1200px 600px at 20% -10%, #101a2e 0%, #07070c 55%, #050509 100%)',
    color: '#e8ecf6',
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  glowA: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(34,211,238,0.20), transparent 65%)',
    top: -120,
    left: -80,
    filter: 'blur(10px)',
  },
  glowB: {
    position: 'absolute',
    width: 460,
    height: 460,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168,85,247,0.20), transparent 65%)',
    bottom: -160,
    right: -120,
    filter: 'blur(10px)',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: 430,
    padding: '28px 24px 22px',
    borderRadius: 22,
    background: 'linear-gradient(180deg, rgba(20,24,38,0.92), rgba(11,13,22,0.94))',
    border: '1px solid rgba(120,140,180,0.20)',
    boxShadow: '0 30px 80px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(14px)',
  },
  badgeRow: { display: 'flex', marginBottom: 14 },
  badge: {
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '5px 10px',
    borderRadius: 999,
    color: '#7dd3fc',
    background: 'rgba(56,189,248,0.10)',
    border: '1px solid rgba(56,189,248,0.28)',
  },
  h1: { margin: '0 0 6px', fontSize: 26, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em' },
  sub: { margin: '0 0 20px', fontSize: 13.5, lineHeight: 1.55, color: '#94a3b8' },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    padding: 5,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(120,140,180,0.16)',
    marginBottom: 18,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    padding: '10px 8px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#94a3b8',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 10,
    cursor: 'pointer',
  },
  tabActive: {
    color: '#eaf6ff',
    background: 'linear-gradient(180deg, rgba(34,211,238,0.20), rgba(168,85,247,0.16))',
    border: '1px solid rgba(34,211,238,0.40)',
    boxShadow: '0 8px 24px -14px rgba(34,211,238,0.9)',
  },
  form: { display: 'grid', gap: 8 },
  label: { fontSize: 12, fontWeight: 600, color: '#cbd5e1', letterSpacing: '0.01em' },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '13px 14px',
    fontSize: 14,
    color: '#eef4ff',
    background: 'rgba(8,10,18,0.85)',
    border: '1px solid rgba(120,140,180,0.28)',
    borderRadius: 12,
    outline: 'none',
  },
  passWrap: { position: 'relative', display: 'flex' },
  eye: {
    position: 'absolute',
    right: 6,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 40,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 15,
    opacity: 0.8,
  },
  hint: { margin: '2px 0 6px', fontSize: 11.5, lineHeight: 1.5, color: '#7c889c' },
  error: {
    marginTop: 4,
    padding: '10px 12px',
    fontSize: 12.5,
    lineHeight: 1.5,
    color: '#fecdd3',
    background: 'rgba(244,63,94,0.10)',
    border: '1px solid rgba(244,63,94,0.32)',
    borderRadius: 11,
  },
  button: {
    marginTop: 10,
    padding: '13px 16px',
    fontSize: 14,
    fontWeight: 700,
    color: '#04121a',
    background: 'linear-gradient(135deg, #22d3ee, #a855f7)',
    border: 'none',
    borderRadius: 12,
    cursor: 'pointer',
    boxShadow: '0 18px 40px -20px rgba(34,211,238,0.9)',
  },
  foot: { margin: '16px 0 0', fontSize: 11, textAlign: 'center', color: '#64748b', lineHeight: 1.6 },
  codeInline: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11.5,
    padding: '1px 5px',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.07)',
  },
  muted: { color: '#94a3b8', fontSize: 13 },
};
