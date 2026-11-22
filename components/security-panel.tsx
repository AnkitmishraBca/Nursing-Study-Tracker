'use client';

/**
 * Phase 5 · Security panel — Settings page me add karne ke liye.
 *
 * Purane settings page ko chhedne ki zaroorat nahi:
 *   import SecurityPanel from '@/components/security-panel';
 *   ... aur jahan chahe wahan: <SecurityPanel />
 *
 * Login hone ke baad hi ye panel data dikhata hai (API 401 deta hai warna).
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Info = {
  tokenSet: boolean;
  passwordSet: boolean;
  token: string | null;
  updatedAt: string | null;
};

export default function SecurityPanel() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [passBusy, setPassBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const load = useCallback(
    async (withReveal = false) => {
      try {
        const res = await fetch(`/api/auth/security-info${withReveal ? '?reveal=true' : ''}`, {
          cache: 'no-store',
        });
        if (res.status === 401) {
          router.replace('/login?next=/settings');
          return;
        }
        const data = await res.json().catch(() => null);
        if (data?.ok) setInfo(data);
      } finally {
        setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  async function toggleReveal() {
    const next = !reveal;
    setReveal(next);
    await load(next);
  }

  async function generateToken() {
    setGenBusy(true);
    setMsg(null);
    setCopied(false);
    try {
      const res = await fetch('/api/auth/generate-token', { method: 'POST' });
      if (res.status === 401) {
        router.replace('/login?next=/settings');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setMsg({ kind: 'err', text: data?.error || 'Token generate nahi hua.' });
        return;
      }
      setNewToken(data.token);
      setMsg({ kind: 'ok', text: 'Naya token ban gaya — purana token ab invalid hai. Isse safe jagah save kar.' });
      setReveal(true);
      await load(true);
    } catch {
      setMsg({ kind: 'err', text: 'Network error.' });
    } finally {
      setGenBusy(false);
    }
  }

  async function copyToken(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setMsg({ kind: 'err', text: 'Copy fail — manually select karke copy kar.' });
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (password.length < 8) {
      setMsg({ kind: 'err', text: 'Password kam se kam 8 characters.' });
      return;
    }
    if (password !== confirm) {
      setMsg({ kind: 'err', text: 'Confirm password match nahi kar raha.' });
      return;
    }
    setPassBusy(true);
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password, confirm, currentPassword: currentPassword || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        if (res.status === 401 && /unauthorized/i.test(data?.error || '')) {
          router.replace('/login?next=/settings');
          return;
        }
        setMsg({ kind: 'err', text: data?.error || 'Password save nahi hua.' });
        return;
      }
      setPassword('');
      setConfirm('');
      setCurrentPassword('');
      setMsg({ kind: 'ok', text: data.message || 'Password save ho gaya (bcrypt hash).' });
      await load(false);
    } catch {
      setMsg({ kind: 'err', text: 'Network error.' });
    } finally {
      setPassBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <section style={s.card}>
      <header style={s.head}>
        <div>
          <h2 style={s.h2}>🔐 Security (Phase 5)</h2>
          <p style={s.sub}>Login protection — dynamic token, bcrypt password, 24-hour session.</p>
        </div>
        <span style={s.pill}>{loading ? 'checking…' : info?.passwordSet ? 'protected' : 'token only'}</span>
      </header>

      {msg && (
        <div style={msg.kind === 'ok' ? s.ok : s.err} role="status">
          {msg.text}
        </div>
      )}

      {/* ---------------- token ---------------- */}
      <div style={s.block}>
        <div style={s.blockHead}>
          <h3 style={s.h3}>🎫 Dynamic Login Token</h3>
          <span style={info?.tokenSet ? s.tagOn : s.tagOff}>{info?.tokenSet ? 'token active' : 'no token yet'}</span>
        </div>
        <p style={s.note}>
          Naya token banate hi purana token turant invalid ho jaata hai. Token se login karne ke liye{' '}
          <code style={s.code}>/login</code> → “Token se Login” tab.
        </p>

        {(newToken || (reveal && info?.token)) && (
          <div style={s.tokenBox}>
            <code style={s.tokenText}>{newToken || info?.token}</code>
            <button type="button" style={s.smallBtn} onClick={() => copyToken(newToken || info?.token || '')}>
              {copied ? '✅ Copied' : 'Copy'}
            </button>
          </div>
        )}

        <div style={s.row}>
          <button type="button" style={s.primary} onClick={generateToken} disabled={genBusy}>
            {genBusy ? 'Generating…' : info?.tokenSet ? '🔄 Naya token generate karo' : '🎫 Token generate karo'}
          </button>
          {info?.tokenSet && (
            <button type="button" style={s.ghost} onClick={toggleReveal}>
              {reveal ? 'Hide token' : 'Show token'}
            </button>
          )}
        </div>
      </div>

      {/* ---------------- password ---------------- */}
      <div style={s.block}>
        <div style={s.blockHead}>
          <h3 style={s.h3}>🔒 Permanent Password</h3>
          <span style={info?.passwordSet ? s.tagOn : s.tagOff}>
            {info?.passwordSet ? 'password set' : 'not set'}
          </span>
        </div>
        <p style={s.note}>
          bcryptjs (cost 11) se hash hoke DB me jaata hai — plain password kahin store nahi hota.
        </p>

        <form onSubmit={savePassword} style={s.form}>
          <input
            style={s.input}
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={info?.passwordSet ? 'Naya password (min 8)' : 'Password set karo (min 8)'}
            autoComplete="new-password"
          />
          <input
            style={s.input}
            type={showPass ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            autoComplete="new-password"
          />
          {info?.passwordSet && (
            <input
              style={s.input}
              type={showPass ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Purana password (verify ke liye)"
              autoComplete="current-password"
            />
          )}
          <label style={s.checkRow}>
            <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} />
            Password dikhao
          </label>
          <button type="submit" style={s.primary} disabled={passBusy}>
            {passBusy ? 'Saving…' : info?.passwordSet ? 'Password update karo' : 'Password set karo'}
          </button>
        </form>
      </div>

      {/* ---------------- session ---------------- */}
      <div style={s.block}>
        <div style={s.blockHead}>
          <h3 style={s.h3}>⏱️ Session</h3>
          <span style={s.tagOn}>24 hours</span>
        </div>
        <p style={s.note}>
          HTTP-Only + Secure cookie. 24 ghante baad expire — phir se login karna padega. Password ya token
          badalne par baaki devices ke session bhi invalid ho jaate hain.
        </p>
        <div style={s.row}>
          <button type="button" style={s.danger} onClick={logout}>
            🚪 Logout
          </button>
          <span style={s.stamp}>
            {info?.updatedAt ? `last change: ${new Date(info.updatedAt).toLocaleString()}` : ''}
          </span>
        </div>
      </div>
    </section>
  );
}

const s: Record<string, React.CSSProperties> = {
  card: {
    border: '1px solid rgba(120,140,180,0.20)',
    borderRadius: 18,
    padding: '18px 16px',
    background: 'linear-gradient(180deg, rgba(20,24,38,0.72), rgba(11,13,22,0.82))',
    color: '#e8ecf6',
    display: 'grid',
    gap: 14,
  },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  h2: { margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: '-0.01em' },
  h3: { margin: 0, fontSize: 13.5, fontWeight: 700 },
  sub: { margin: '4px 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 },
  pill: {
    fontSize: 10.5,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding: '4px 9px',
    borderRadius: 999,
    color: '#7dd3fc',
    background: 'rgba(56,189,248,0.10)',
    border: '1px solid rgba(56,189,248,0.28)',
    whiteSpace: 'nowrap',
  },
  block: {
    display: 'grid',
    gap: 8,
    padding: '13px 12px',
    borderRadius: 14,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(120,140,180,0.14)',
  },
  blockHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tagOn: {
    fontSize: 10,
    padding: '3px 8px',
    borderRadius: 999,
    color: '#86efac',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
  },
  tagOff: {
    fontSize: 10,
    padding: '3px 8px',
    borderRadius: 999,
    color: '#fca5a5',
    background: 'rgba(244,63,94,0.10)',
    border: '1px solid rgba(244,63,94,0.28)',
  },
  note: { margin: 0, fontSize: 11.5, lineHeight: 1.6, color: '#8b97ab' },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11,
    padding: '1px 5px',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.07)',
  },
  tokenBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 10px',
    borderRadius: 11,
    background: 'rgba(8,10,18,0.9)',
    border: '1px dashed rgba(34,211,238,0.35)',
  },
  tokenText: {
    flex: 1,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 11.5,
    color: '#a5f3fc',
    wordBreak: 'break-all',
  },
  row: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  form: { display: 'grid', gap: 8 },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 13,
    color: '#eef4ff',
    background: 'rgba(8,10,18,0.85)',
    border: '1px solid rgba(120,140,180,0.26)',
    borderRadius: 10,
    outline: 'none',
  },
  checkRow: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#94a3b8' },
  primary: {
    padding: '10px 14px',
    fontSize: 12.5,
    fontWeight: 700,
    color: '#04121a',
    background: 'linear-gradient(135deg, #22d3ee, #a855f7)',
    border: 'none',
    borderRadius: 10,
    cursor: 'pointer',
  },
  ghost: {
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#cbd5e1',
    background: 'transparent',
    border: '1px solid rgba(120,140,180,0.30)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  smallBtn: {
    padding: '6px 10px',
    fontSize: 11,
    fontWeight: 600,
    color: '#a5f3fc',
    background: 'rgba(34,211,238,0.10)',
    border: '1px solid rgba(34,211,238,0.30)',
    borderRadius: 8,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  danger: {
    padding: '9px 13px',
    fontSize: 12,
    fontWeight: 700,
    color: '#fecdd3',
    background: 'rgba(244,63,94,0.10)',
    border: '1px solid rgba(244,63,94,0.30)',
    borderRadius: 10,
    cursor: 'pointer',
  },
  stamp: { fontSize: 10.5, color: '#64748b' },
  ok: {
    padding: '9px 11px',
    fontSize: 12,
    color: '#bbf7d0',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: 10,
  },
  err: {
    padding: '9px 11px',
    fontSize: 12,
    color: '#fecdd3',
    background: 'rgba(244,63,94,0.10)',
    border: '1px solid rgba(244,63,94,0.30)',
    borderRadius: 10,
  },
};
