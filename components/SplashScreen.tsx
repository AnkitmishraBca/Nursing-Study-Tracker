'use client';

import { useEffect, useState } from 'react';
import Logo from '@/components/Logo';

const SPLASH_MS = 2600;

/**
 * Phase 4 — splash screen. Shows the logo + "Welcome To The World Of Ankit"
 * for ~2.6 seconds when the app loads, then fades out.
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const fade = setTimeout(() => setLeaving(true), SPLASH_MS - 600);
    const hide = setTimeout(() => setVisible(false), SPLASH_MS);
    return () => {
      clearTimeout(fade);
      clearTimeout(hide);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#070a14] transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(52,224,161,0.16),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_85%,rgba(155,123,255,0.14),transparent_50%)]" />

      <div className="splash-logo relative flex flex-col items-center px-6 text-center">
        <div className="splash-ring relative">
          <Logo size={124} rounded="rounded-[32px]" className="shadow-[0_20px_60px_-20px_rgba(52,224,161,0.65)]" />
        </div>

        <h1 className="splash-title mt-8 text-4xl font-bold leading-tight sm:text-5xl">
          Welcome To The World Of Ankit
        </h1>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
          BSc Nursing &amp; NORCET Study Tracker
        </p>

        <div className="mt-8 h-1 w-44 overflow-hidden rounded-full bg-white/10">
          <div className="splash-bar h-full rounded-full bg-gradient-to-r from-mint to-violet" />
        </div>
      </div>
    </div>
  );
}
