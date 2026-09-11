import { MenuIcon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/features/StatusPill';
import type { WhatsAppStatus } from '@/lib/types';
import type { ViewKey } from '@/components/layout/Nav';

const TITLES: Record<ViewKey, { title: string; sub: string }> = {
  overview: { title: 'Good day', sub: 'Here is what needs you most.' },
  chats: { title: 'Chats', sub: 'Pick a conversation, get the brief.' },
  connect: { title: 'Connect', sub: 'Pair WhatsApp once, stay linked.' },
  system: { title: 'System', sub: 'Health, model, and API surface.' },
};

export function TopBar({
  view,
  wa,
  onReload,
  refreshing,
  onOpenChats,
}: {
  view: ViewKey;
  wa: WhatsAppStatus | null;
  onReload: () => void;
  refreshing: boolean;
  onOpenChats: () => void;
}) {
  const meta = TITLES[view];
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex size-9 items-center justify-center rounded-xl bg-stone-900 text-white lg:hidden">
          <SparklesIcon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display truncate text-[15px] font-semibold tracking-tight sm:text-base">
            {meta.title}
          </h2>
          <p className="truncate text-xs text-muted-foreground sm:text-[13px]">{meta.sub}</p>
        </div>
        <StatusPill state={wa?.state} className="hidden sm:inline-flex" />
        <Button variant="outline" size="sm" onClick={onReload} disabled={refreshing}>
          <RefreshCwIcon data-icon="inline-start" className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
        <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={onOpenChats} aria-label="Open navigation">
          <MenuIcon data-icon="inline-start" />
        </Button>
      </div>
    </header>
  );
}
