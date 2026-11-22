'use client';

import { useEffect, useMemo } from 'react';
import { Gift, Sparkles, X } from 'lucide-react';

export interface RewardPayload {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  kind: 'booster' | 'milestone';
}

/**
 * Phase 4 — reward animation overlay (confetti + reward card).
 * Pure CSS animation, koi extra package nahi.
 */
export default function RewardOverlay({
  reward,
  onClose,
}: {
  reward: RewardPayload | null;
  onClose: () => void;
}) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 42 }, (_, index) => ({
        id: index,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.2 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 220,
        color: ['#34e0a1', '#9b7bff', '#ff6b8a', '#ffc857', '#22d3ee'][index % 5],
        size: 5 + Math.random() * 7,
      })),
    [reward?.id],
  );

  useEffect(() => {
    if (!reward) return;
    const timer = setTimeout(onClose, 6000);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [reward, onClose]);

  if (!reward) return null;

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center overflow-hidden bg-[#05070f]/80 px-4 backdrop-blur-sm">
      <div className="pointer-events-none absolute inset-0">
        {pieces.map((piece) => (
          <span
            key={piece.id}
            className="confetti-piece absolute top-0 rounded-sm"
            style={{
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * 1.6,
              backgroundColor: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              ['--drift' as string]: `${piece.drift}px`,
            }}
          />
        ))}
      </div>

      <div className="reward-pop relative w-full max-w-sm rounded-3xl border border-mint/30 bg-[#0d1426] p-7 text-center shadow-[0_30px_80px_-30px_rgba(52,224,161,0.6)]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 hover:bg-white/10 hover:text-white"
          aria-label="Close reward"
        >
          <X size={16} />
        </button>

        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-mint to-violet text-4xl shadow-glow">
          {reward.emoji}
        </div>

        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.25em] text-mint">
          {reward.kind === 'milestone' ? <Sparkles size={11} /> : <Gift size={11} />}
          {reward.kind === 'milestone' ? 'Milestone unlocked' : 'Booster unlocked'}
        </div>

        <h2 className="mt-3 text-2xl font-black leading-tight text-white">{reward.title}</h2>
        <p className="muted mt-2 text-sm">{reward.detail}</p>

        <button className="btn-primary mt-6 w-full" onClick={onClose}>
          Thanks bhai! 💪
        </button>
      </div>
    </div>
  );
}
