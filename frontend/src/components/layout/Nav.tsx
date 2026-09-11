import { useLocation, useNavigate } from 'react-router-dom';
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

export const NAV_ITEMS = [
  { path: '/', label: 'Overview', icon: LayoutDashboardIcon, hint: 'Catch up' },
  { path: '/chats', label: 'Chats', icon: MessagesSquareIcon, hint: 'Summarize' },
  { path: '/connect', label: 'Connect', icon: QrCodeIcon, hint: 'Pair phone' },
  { path: '/system', label: 'System', icon: ActivityIcon, hint: 'Health + API' },
];

export function Sidebar({
  wa,
  unread,
  model,
}: {
  wa: WhatsAppStatus | null;
  unread: number;
  model?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col justify-between rounded-2xl border border-border bg-card p-3 shadow-card lg:flex">
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex cursor-pointer items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
            <SparklesIcon className="size-4" />
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-sm font-bold tracking-tight">Relay</span>
            <span className="truncate text-xs text-muted-foreground">WhatsApp summaries</span>
          </span>
        </button>

        <p className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Workspace
        </p>
        <nav className="-mt-1 flex flex-col gap-0.5" aria-label="Primary">
          {NAV_ITEMS.map((n) => {
            const active =
              n.path === '/'
                ? location.pathname === '/' || location.pathname === '/overview'
                : location.pathname.startsWith(n.path);
            return (
              <button
                key={n.path}
                type="button"
                onClick={() => navigate(n.path)}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-colors duration-200',
                  active ? 'bg-zinc-900 text-white shadow-soft' : 'text-zinc-600 hover:bg-accent hover:text-foreground',
                )}
              >
                <n.icon className="size-4 shrink-0" />
                <span className="flex-1 text-left">{n.label}</span>
                {n.path === '/chats' && unread > 0 ? (
                  <Badge
                    variant={active ? 'secondary' : 'unread'}
                    className={cn('px-1.5 text-[11px]', active && 'bg-white/15 text-white')}
                  >
                    {unread > 99 ? '99+' : unread}
                  </Badge>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex flex-col gap-2.5 pt-2">
        <div className="flex flex-col items-stretch gap-2 rounded-xl border border-border bg-secondary/50 p-3">
          <p className="text-[13px] font-semibold">WhatsApp</p>
          <StatusPill state={wa?.state} className="justify-center" />
          <p className="truncate text-center text-xs text-muted-foreground">
            {wa?.pushname ?? wa?.phoneNumber ?? 'Not linked yet'}
          </p>
          {model ? (
            <p className="truncate rounded-md bg-card px-2 py-1 text-center text-[11px] text-muted-foreground">
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
  unread,
}: {
  unread: number;
}) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 gap-1 rounded-2xl border border-border bg-card/95 p-1.5 shadow-pop backdrop-blur lg:hidden"
      style={{ paddingBottom: 'calc(0.375rem + env(safe-area-inset-bottom))' }}
    >
      {NAV_ITEMS.map((n) => {
        const active =
          n.path === '/'
            ? location.pathname === '/' || location.pathname === '/overview'
            : location.pathname.startsWith(n.path);
        return (
          <button
            key={n.path}
            type="button"
            onClick={() => navigate(n.path)}
            className={cn(
              'relative flex cursor-pointer flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors duration-200',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:bg-accent',
            )}
          >
            <n.icon className="size-5" />
            {n.label}
            {n.path === '/chats' && unread > 0 ? (
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
