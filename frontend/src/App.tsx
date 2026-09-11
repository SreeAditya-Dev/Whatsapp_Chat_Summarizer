import { useCallback, useMemo, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangleIcon } from 'lucide-react';
import { MobileNav, Sidebar } from '@/components/layout/Nav';
import { TopBar } from '@/components/layout/TopBar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OverviewView } from '@/components/features/OverviewView';
import { ChatsView } from '@/components/features/ChatsView';
import { ConnectView } from '@/components/features/ConnectView';
import { SettingsView } from '@/components/features/SettingsView';
import { SystemView } from '@/components/features/SystemView';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePolling } from '@/hooks/usePolling';
import { api } from '@/lib/api';
import type { ChatInfo, ChatSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const isChatsPage = location.pathname === '/chats';
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
    navigate('/chats');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);

  const goToConnect = useCallback(() => {
    navigate('/connect');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [navigate]);

  const handleSelectChat = useCallback(
    (chat: ChatInfo) => {
      setSelectedFromOverview(chat);
      setChatsViewKey((k) => k + 1);
      navigate('/chats');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate],
  );

  const backendDown =
    !healthPoll.loading && !healthPoll.data && !!healthPoll.error && !!chatsPoll.error;

  return (
    <div className="app-texture min-h-screen bg-background text-foreground overflow-x-clip">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] min-w-0 gap-4 px-4 py-4 lg:px-5">
      <Sidebar
        wa={waPoll.data}
        unread={totalUnread}
        model={healthPoll.data?.services.ai.model}
      />

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-4',
          isChatsPage && 'lg:h-[calc(100vh-2rem)] lg:max-h-[calc(100vh-2rem)] lg:overflow-hidden',
        )}
      >
        <TopBar
          wa={waPoll.data}
          onReload={reloadAll}
          refreshing={chatsPoll.refreshing || waPoll.refreshing}
          onOpenChats={goToChats}
        />

        <main
          className={cn(
            'mx-auto w-full max-w-7xl min-w-0 flex-1 px-1',
            isChatsPage
              ? 'flex flex-col min-h-0 pb-24 sm:px-2 lg:overflow-hidden lg:pb-0'
              : 'pb-28 sm:px-2 lg:pb-10',
          )}
        >
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

          <ErrorBoundary>
          <Routes>
            <Route
              path="/"
              element={
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
                  onConnect={goToConnect}
                  onSelectChat={handleSelectChat}
                  onReload={reloadAll}
                />
              }
            />
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route
              path="/chats"
              element={
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
                  wa={waPoll.data}
                  onConnect={goToConnect}
                  onSummarized={(s) =>
                    setRecentSummaries((prev) =>
                      [s, ...prev.filter((p) => p.chatId !== s.chatId)].slice(0, 8),
                    )
                  }
                />
              }
            />
            <Route
              path="/settings"
              element={<SettingsView chats={chats} />}
            />
            <Route
              path="/connect"
              element={
                <ConnectView
                  wa={waPoll.data}
                  waLoading={waPoll.loading}
                  waError={waPoll.error}
                  qrDataUrl={qrDataUrl}
                  qrLoading={qrPoll.loading && !qrDataUrl}
                  onReload={reloadAll}
                />
              }
            />
            <Route
              path="/system"
              element={
                <SystemView
                  health={healthPoll.data}
                  healthLoading={healthPoll.loading}
                  wa={waPoll.data}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </ErrorBoundary>

          <footer
            className={cn(
              'mt-8 flex flex-col gap-1 border-t border-border pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
              isChatsPage && 'lg:hidden',
            )}
          >
            <p>Relay · calm WhatsApp summaries · your data stays on your server</p>
            <p>
              {healthPoll.data
                ? `v${healthPoll.data.version} · ${healthPoll.data.services.ai.model}`
                : 'Connecting to backend…'}
            </p>
          </footer>
        </main>
      </div>

      <MobileNav unread={totalUnread} />
      </div>
    </div>
  );
}
