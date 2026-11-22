'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import RewardOverlay, { type RewardPayload } from '@/components/RewardOverlay';
import { milestoneFor, randomBooster } from '@/lib/quotes';
import { useStore } from '@/lib/store';

const MILESTONE_KEY = 'nst-milestones-seen-v1';

/**
 * Phase 4 — watches XP + streak and fires:
 *   1. a random "Booster" reward every time XP goes up,
 *   2. a special milestone reward on 7 / 30 / 100 / 365 day streaks.
 */
export default function RewardManager() {
  const { state, ready } = useStore();
  const [reward, setReward] = useState<RewardPayload | null>(null);

  const prevXpRef = useRef<number | null>(null);
  const prevStreakRef = useRef<number | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const loadedRef = useRef(false);

  const close = useCallback(() => setReward(null), []);

  // Load already-seen milestones once.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MILESTONE_KEY);
      if (raw) seenRef.current = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    if (!ready) return;

    const xp = state.stats.xp;
    const streak = state.stats.streak;

    if (prevXpRef.current === null) {
      prevXpRef.current = xp;
      prevStreakRef.current = streak;
      return;
    }

    // --- milestone check (7 / 30 / 100 / 365) ---
    if (streak > (prevStreakRef.current ?? 0)) {
      const milestone = milestoneFor(streak);
      if (milestone && loadedRef.current && !seenRef.current.has(String(streak))) {
        seenRef.current.add(String(streak));
        try {
          localStorage.setItem(MILESTONE_KEY, JSON.stringify([...seenRef.current]));
        } catch {
          /* ignore */
        }
        setReward({
          id: `milestone-${streak}-${Date.now()}`,
          emoji: milestone.emoji,
          title: milestone.title,
          detail: milestone.detail,
          kind: 'milestone',
        });
      }
    }

    // --- booster on XP gain ---
    if (xp > (prevXpRef.current ?? 0)) {
      const gain = xp - (prevXpRef.current ?? 0);
      const booster = randomBooster();
      setReward({
        id: `booster-${Date.now()}-${gain}`,
        emoji: booster.emoji,
        title: booster.title,
        detail: `${booster.detail} (+${gain} XP)`,
        kind: 'booster',
      });
    }

    prevXpRef.current = xp;
    prevStreakRef.current = streak;
  }, [state.stats.xp, state.stats.streak, ready]);

  return <RewardOverlay reward={reward} onClose={close} />;
}
