/**
 * Phase 4 — motivational quotes + rewards.
 * Pure data + tiny helpers, no React. Safe to import from client components.
 */

export interface Quote {
  text: string;
  author: string;
}

/** 15 quotes — ek din me ek hi rotate hota hai (date ke basis par). */
export const QUOTES: Quote[] = [
  { text: 'Sapne wo nahi jo hum sote waqt dekhte, sapne wo hai jo hume sone nahi dete.', author: 'Dr. A.P.J. Abdul Kalam' },
  { text: 'Padhai ka koi shortcut nahi hota — bas consistency hoti hai.', author: 'Ankit' },
  { text: 'Discipline is choosing between what you want now and what you want most.', author: 'Abraham Lincoln' },
  { text: 'Aaj ka 1 hour, aage ka 1 year bana sakta hai.', author: 'Ankit' },
  { text: 'Chhote chhote steps hi asli mushkil hote hain — ek din 25 minute.', author: 'Ankit' },
  { text: 'Success is the sum of small efforts repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Tum wahi banoge jise tum roz padhte ho — AI nahi, TU.', author: 'Ankit' },
  { text: 'Streak mat todo, bhai. Ek din chhootega to chain tutegi.', author: 'Ankit' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  { text: 'Notes banao, revise karo, dobara padho — bas yahi exam jeetne ka formula hai.', author: 'Ankit' },
  { text: 'Nursing ka core hai: patient ko dekhna, sunna, sambhalna.', author: 'Ankit' },
  { text: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius' },
  { text: 'Exam 3 mahine door hai — aaj se 1 din ka kaam karo.', author: 'Ankit' },
  { text: 'Your future is created by what you do today, not tomorrow.', author: 'Robert Kiyosaki' },
  { text: 'Doubt poochne me koi weakness nahi, ruk jaane me hai.', author: 'Ankit' },
];

export interface Booster {
  title: string;
  detail: string;
  emoji: string;
}

/** Random boosters — XP badhne par ek dikhta hai. */
export const BOOSTERS: Booster[] = [
  { title: '2x XP Window', detail: 'Next 25 min me har minute ke 2 XP milenge.', emoji: '⚡' },
  { title: 'Focus Shield', detail: 'Next pomodoro me distraction list khaali — full focus.', emoji: '🛡️' },
  { title: 'Brain Boost', detail: 'Next 10 min me AI doubt solver unlimited.', emoji: '🧠' },
  { title: 'Quick Recall', detail: 'Next 5 min me saare high-yield points ek shot me revise.', emoji: '⚡' },
  { title: 'Calm Starter', detail: 'Next break 3 min lamba — thoda relax bhi karo.', emoji: '🌿' },
  { title: 'Streak Shield', detail: 'Aaj ka streak freeze token mil gaya.', emoji: '🧊' },
  { title: 'Lucky Draw', detail: 'Next pomodoro me +15 bonus XP.', emoji: '🎁' },
  { title: 'Peer Check', detail: 'Ek doubt AI se solve karo aur +10 XP.', emoji: '🤝' },
];

/** Streak milestones jahan special reward chalta hai. */
export const STREAK_MILESTONES = [7, 30, 100, 365];

export interface Milestone {
  days: number;
  title: string;
  detail: string;
  emoji: string;
}

export const MILESTONE_REWARDS: Record<number, Milestone> = {
  7: {
    days: 7,
    title: '7-Day Warrior',
    detail: 'Ek poora week consistent. Yahan se aadat ban jaayegi.',
    emoji: '🔥',
  },
  30: {
    days: 30,
    title: '30-Day Streak Legend',
    detail: 'Ek mahina nonstop. Ab tu exam ready hai.',
    emoji: '🏆',
  },
  100: {
    days: 100,
    title: '100-Day Machine',
    detail: '100 din ka streak. Discipline ka level unlocked.',
    emoji: '💎',
  },
  365: {
    days: 365,
    title: 'One Full Year',
    detail: 'Ek saal ka dedication. Legend status.',
    emoji: '👑',
  },
};

/** Deterministic daily quote — din bhar same, agle din naya. */
export function quoteForDate(date: Date = new Date()): Quote {
  const key = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return QUOTES[key % QUOTES.length];
}

/** Random booster (crypto-safe random). */
export function randomBooster(): Booster {
  const index = Math.floor(Math.random() * BOOSTERS.length);
  return BOOSTERS[index];
}

/** Milestone definition for a streak length (null if not a milestone day). */
export function milestoneFor(streak: number): Milestone | null {
  if (!STREAK_MILESTONES.includes(streak)) return null;
  return MILESTONE_REWARDS[streak] ?? null;
}
