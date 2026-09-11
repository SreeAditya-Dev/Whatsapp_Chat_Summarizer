export function timeAgo(input?: number | string): string {
  if (input === undefined || input === null) return '—';
  const ms = typeof input === 'number' ? (input < 1e12 ? input * 1000 : input) : Date.parse(input);
  if (Number.isNaN(ms)) return '—';
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatClock(input?: number | string): string {
  if (!input) return '';
  const ms = typeof input === 'number' ? (input < 1e12 ? input * 1000 : input) : Date.parse(input);
  if (Number.isNaN(ms)) return '';
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatUptime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h < 1) return `${m}m`;
  if (h < 24) return `${h}h ${m}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

// Deterministic muted avatar tone (solid, warm — no neon)
const TONES = [
  'bg-stone-200 text-stone-700',
  'bg-orange-100 text-orange-900',
  'bg-emerald-100 text-emerald-900',
  'bg-amber-100 text-amber-900',
  'bg-neutral-200 text-neutral-700',
  'bg-lime-100 text-lime-900',
];

export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}
