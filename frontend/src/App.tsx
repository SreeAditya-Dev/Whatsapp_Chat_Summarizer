import { useCallback, useMemo, useState } from 'react';
import { AlertTriangleIcon } from 'lucide-react';
import { MobileNav, Sidebar, type ViewKey } from '@/components/layout/Nav';
import { TopBar } from '@/components/layout/TopBar';
import { OverviewView } from '@/components/features/OverviewView';
import { ChatsView } from '@/components/features/ChatsView';
import { ConnectView } from '@/components/features/ConnectView';
import { SystemView } from '@/components/features/SystemView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePolling } from '@/hooks/usePolling';
import { api } from '@/lib/api';
import type { ChatInfo, ChatSummary } from '@/lib/types';

export default function App() {
  const [view, setView] = useState<ViewKey>('overview');
  const [selectedFromOverview, setSelectedFromOverview] = useState<ChatInfo | null>(null);
  const [recentSummaries, setRecentSummaries] = useState<ChatSummary[]>([]);
  const [chatsViewKey, setChatsViewKey] = useState(0);

  const healthPoll = usePolling(() => api.health().then((r) => r.data!), { intervalMs: 15000 });
  const waPoll = usePolling(() => api.waStatus().then((r) => r.data!), { intervalMs: 5000 });
  const qrPoll = usePolling(
    () =>
      api
        .waQr()
        .then((r) => r.data!)
        .catch(() => null),
    { intervalMs: 8000 },
  );
  const chatsPoll = usePolling(
    () =>
      api
        .chats({ page: 1, limit: 100, filter: 'all' })
        .then((r) => r.data ?? []),
    { intervalMs: 20000 },
  );
  const unreadPoll = usePolling(
    () =>
      api
        .unreadChats({ page: 1, limit: 100 })
        .then((r) => r.data ?? [])
        .catch(() => [] as ChatInfo[]),
    { intervalMs: 20000 },
  );

  const chats = useMemo(() => chatsPoll.data ?? [], [chatsPoll.data]);
  const unreadChats = useMemo(() => {
    const fromApi = unreadPoll.data ?? [];
    if (fromApi.length > 0) return [...fromApi].sort((a, b) => b.unreadCount - a.unreadCount);
    return [...chats].filter((c) => c.unreadCount > 0).sort((a, b) => b.unreadCount - a.unreadCount);
  }, [unreadPoll.data, chats]);
  const totalUnread = useMemo(
    () => unreadChats.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [unreadChats],
  );

  const qrDataUrl =
    qrPoll.data?.qrCodeDataUrl ?? waPoll.data?.qrCodeDataUrl ?? null;

  const reloadAll = useCallback(() => {
    healthPoll.reload();
    waPoll.reload();
    qrPoll.reload();
    chatsPoll.reload();
    unreadPoll.reload();
  }, [healthPoll, waPoll, qrPoll, chatsPoll, unreadPoll]);

  const goToChats = useCallback(() => {
    setChatsViewKey((k) => k + 1);
    setView('chats');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSelectChat = useCallback(
    (chat: ChatInfo) => {
      setSelectedFromOverview(chat);
      setChatsViewKey((k) => k + 1);
      setView('chats');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const backendDown =
    !healthPoll.loading && !healthPoll.data && !!healthPoll.error && !!chatsPoll.error;

  return (
    <div className="app-texture min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1440px] lg:gap-0">
        <Sidebar
          view={view}
          onNavigate={setView}
          wa={waPoll.data}
          unread={totalUnread}
          model={healthPoll.data?.services.ai.model}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            view={view}
            wa={waPoll.data}
            onReload={reloadAll}
            refreshing={chatsPoll.refreshing || waPoll.refreshing}
            onOpenChats={goToChats}
          />

          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-4 sm:px-6 sm:pt-6 lg:pb-12">
            {backendDown ? (
              <Alert variant="warning" className="mb-4">
                <AlertTriangleIcon className="size-4" />
                <div>
                  <AlertTitle>Backend isn&apos;t reachable</AlertTitle>
                  <AlertDescription>
                    Start it with <code className="rounded bg-stone-200 px-1">npm run dev</code> (port
                    3000). The dashboard will reconnect automatically — or run the frontend with{' '}
                    <code className="rounded bg-stone-200 px-1">VITE_API_URL</code> pointed at your
                    server.
                  </AlertDescription>
                </div>
              </Alert>
            ) : null}

            {view === 'overview' ? (
              <OverviewView
                health={healthPoll.data}
                healthLoading={healthPoll.loading}
                wa={waPoll.data}
                chats={chats}
                chatsLoading={chatsPoll.loading}
                totalUnread={totalUnread}
                unreadChats={unreadChats}
                recentSummaries={recentSummaries}
                onReviewUnread={goToChats}
                onBrowseChats={goToChats}
                onConnect={() => setView('connect')}
                onSelectChat={handleSelectChat}
                onReload={reloadAll}
              />
            ) : null}

            {view === 'chats' ? (
              <ChatsView
                key={chatsViewKey}
                chats={chats}
                chatsLoading={chatsPoll.loading}
                chatsError={chatsPoll.error}
                onReloadChats={() => {
                  chatsPoll.reload();
                  unreadPoll.reload();
                }}
                totalUnread={totalUnread}
                recentSummaries={recentSummaries}
                initialSelected={selectedFromOverview}
                onSummarized={(s) =>
                  setRecentSummaries((prev) =>
                    [s, ...prev.filter((p) => p.chatId !== s.chatId)].slice(0, 8),
                  )
                }
              />
            ) : null}

            {view === 'connect' ? (
              <ConnectView
                wa={waPoll.data}
                waLoading={waPoll.loading}
                waError={waPoll.error}
                qrDataUrl={qrDataUrl}
                qrLoading={qrPoll.loading && !qrDataUrl}
                onReload={reloadAll}
              />
            ) : null}

            {view === 'system' ? (
              <SystemView
                health={healthPoll.data}
                healthLoading={healthPoll.loading}
                wa={waPoll.data}
              />
            ) : null}

            <footer className="mt-8 flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
              <p>Relay · calm WhatsApp summaries · your data stays on your server</p>
              <p>
                {healthPoll.data
                  ? `v${healthPoll.data.version} · ${healthPoll.data.services.ai.model}`
                  : 'Connecting to backend…'}
              </p>
            </footer>
          </main>
        </div>
      </div>

      <MobileNav view={view} onNavigate={setView} unread={totalUnread} />
    </div>
  );
}
