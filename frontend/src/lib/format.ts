import type { ChatInfo } from './types';

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

/**
 * Robust matching for chat search queries:
 * - Case-insensitive substring match on name
 * - Substring match on chat ID (e.g. 919876543210@c.us)
 * - Substring match on phone number
 * - Stripped digits-only match for formatted phone numbers (e.g. "+91 98765 43210", "9876543210", etc.)
 */
export function matchesChatQuery(chat: ChatInfo, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.trim().toLowerCase();

  // 1. Direct name match
  if (chat.name && chat.name.toLowerCase().includes(q)) return true;

  // 2. Direct ID match
  if (chat.id && chat.id.toLowerCase().includes(q)) return true;

  // 3. Direct phone number match
  if (chat.phoneNumber && chat.phoneNumber.toLowerCase().includes(q)) return true;

  // 4. Digits-only normalized matching
  const queryDigits = q.replace(/\D/g, '');
  if (queryDigits.length >= 3) {
    if (chat.phoneNumber) {
      const phoneDigits = chat.phoneNumber.replace(/\D/g, '');
      if (phoneDigits.includes(queryDigits)) return true;
    }

    const idDigits = chat.id.replace(/\D/g, '');
    if (idDigits.includes(queryDigits)) return true;

    if (chat.name) {
      const nameDigits = chat.name.replace(/\D/g, '');
      if (nameDigits.includes(queryDigits)) return true;
    }
  }

  return false;
}

/**
 * Returns formatted phone number if available and distinct from chat name
 */
export function getChatDisplayNumber(chat: ChatInfo): string | null {
  if (chat.isGroup) return null;
  const raw =
    chat.phoneNumber ||
    (chat.id && chat.id.includes('@c.us') ? chat.id.replace('@c.us', '') : null);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits || digits.length < 5) return null;
  // If the chat name is already this phone number, avoid duplicate display
  const nameDigits = chat.name ? chat.name.replace(/\D/g, '') : '';
  if (nameDigits === digits) return null;
  return `+${digits}`;
}

