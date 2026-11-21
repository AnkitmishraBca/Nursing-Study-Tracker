export function localDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function monthLabel(year: number, monthIndex: number): string {
  return new Date(year, monthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

export function compactDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'abhi';
  if (minutes < 60) return `${minutes} min pehle`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ghante pehle`;
  const days = Math.floor(hours / 24);
  return `${days} din pehle`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function daysUntil(dateString: string | null): number | null {
  if (!dateString) return null;
  const target = parseLocalDate(dateString);
  const today = parseLocalDate(localDate());
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}
