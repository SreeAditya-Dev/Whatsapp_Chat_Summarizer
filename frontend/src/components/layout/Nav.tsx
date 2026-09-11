import {
  ActivityIcon,
  LayoutDashboardIcon,
  MessagesSquareIcon,
  QrCodeIcon,
  SparklesIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { StatusPill } from '@/components/features/StatusPill';
import type { WhatsAppStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

export type ViewKey = 'overview' | 'chats' | 'connect' | 'system';

const NAV: { key: ViewKey; label: string; icon: typeof LayoutDashboardIcon; hint: string }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboardIcon, hint: 'Catch up' },
  { key: 'chats', label: 'Chats', icon: MessagesSquareIcon, hint: 'Summarize' },
  { key: 'connect', label: 'Connect', icon: QrCodeIcon, hint: 'Pair phone' },
  { key: 'system', label: 'System', icon: ActivityIcon, hint: 'Health + API' },
];

export function Sidebar({
  view,
  onNavigate,
  wa,
  unread,
  model,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  wa: WhatsAppStatus | null;
  unread: number;
  model?: string;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col gap-4 border-r border-border bg-card/70 p-4 backdrop-blur lg:flex">
      <button
        type="button"
        onClick={() => onNavigate('overview')}
        className="flex cursor-pointer items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-accent"
      >
        <span className="flex size-10 items-center justify-center rounded-2xl bg-stone-900 text-white">
          <SparklesIcon className="size-5" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-display text-[15px] font-semibold tracking-tight">Relay</span>
          <span className="truncate text-xs text-muted-foreground">WhatsApp summaries</span>
        </span>
      </button>

      <nav className="flex flex-col gap-1" aria-label="Primary">
        {NAV.map((n) => {
          const active = view === n.key;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => onNavigate(n.key)}
              className={cn(
                'flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                active ? 'bg-stone-900 text-white shadow-soft' : 'text-stone-700 hover:bg-accent',
              )}
            >
              <n.icon className="size-4 shrink-0" />
              <span className="flex-1 text-left">{n.label}</span>
              {n.key === 'chats' && unread > 0 ? (
                <Badge
                  variant={active ? 'secondary' : 'unread'}
                  className={cn(active && 'bg-white/15 text-white')}
                >
                  {unread > 99 ? '99+' : unread}
                </Badge>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-2xl border border-border bg-background p-3.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">WhatsApp</p>
            <StatusPill state={wa?.state} />
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {wa?.pushname ?? wa?.phoneNumber ?? 'Not linked yet'}
          </p>
          {model ? (
            <p className="mt-2 truncate rounded-lg bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
              {model}
            </p>
          ) : null}
        </div>
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          Private by design — summaries run on your own server.
        </p>
      </div>
    </aside>
  );
}

export function MobileNav({
  view,
  onNavigate,
  unread,
}: {
  view: ViewKey;
  onNavigate: (v: ViewKey) => void;
  unread: number;
}) {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-pop backdrop-blur lg:hidden"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {NAV.map((n) => {
        const active = view === n.key;
        return (
          <button
            key={n.key}
            type="button"
            onClick={() => onNavigate(n.key)}
            className={cn(
              'relative flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors duration-200',
              active ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-accent',
            )}
          >
            <n.icon className="size-5" />
            {n.label}
            {n.key === 'chats' && unread > 0 ? (
              <span className="absolute right-4 top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
