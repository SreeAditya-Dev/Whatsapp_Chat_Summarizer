import { useLocation } from 'react-router-dom';
import { MenuIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/features/StatusPill';
import type { WhatsAppStatus } from '@/lib/types';

const TITLES: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Good day', sub: 'Here is what needs you most.' },
  '/overview': { title: 'Good day', sub: 'Here is what needs you most.' },
  '/chats': { title: 'Chats', sub: 'Pick a conversation, get the brief.' },
  '/connect': { title: 'Connect', sub: 'Pair WhatsApp once, stay linked.' },
  '/system': { title: 'System', sub: 'Health, model, and API surface.' },
};

export function TopBar({
  wa,
  onReload,
  refreshing,
  onOpenChats,
}: {
  wa: WhatsAppStatus | null;
  onReload: () => void;
  refreshing: boolean;
  onOpenChats: () => void;
}) {
  const location = useLocation();
  const meta = TITLES[location.pathname] ?? TITLES['/'];
  return (
    <header className="sticky top-4 z-30">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 rounded-xl border border-border bg-card/90 px-4 py-2.5 shadow-soft backdrop-blur">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-zinc-900 text-white lg:hidden">
            <SparklesIcon className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display truncate text-[15px] font-semibold tracking-tight sm:text-base">
              {meta.title}
            </h2>
            <p className="truncate text-xs text-muted-foreground sm:text-[13px]">{meta.sub}</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <StatusPill state={wa?.state} className="hidden sm:inline-flex" />
          <Button variant="outline" size="sm" onClick={onReload} disabled={refreshing}>
            <RefreshCwIcon data-icon="inline-start" className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="lg:hidden"
            onClick={onOpenChats}
            aria-label="Open navigation"
          >
            <MenuIcon data-icon="inline-start" />
          </Button>
        </div>
      </div>
    </header>
  );
}
