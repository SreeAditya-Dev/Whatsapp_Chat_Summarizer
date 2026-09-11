import { ArrowRightIcon, InboxIcon, Loader2Icon, RefreshCwIcon, SparklesIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/features/StatCard';
import { ChatListItem } from '@/components/features/ChatListItem';
import type { ChatInfo, ChatSummary, HealthData, WhatsAppStatus } from '@/lib/types';
import { formatUptime } from '@/lib/format';
import { BellRingIcon, MessagesSquareIcon, UsersIcon, ActivityIcon } from 'lucide-react';

interface Props {
  health: HealthData | null;
  healthLoading: boolean;
  wa: WhatsAppStatus | null;
  chats: ChatInfo[];
  chatsLoading: boolean;
  totalUnread: number;
  unreadChats: ChatInfo[];
  recentSummaries: ChatSummary[];
  onReviewUnread: () => void;
  onBrowseChats: () => void;
  onConnect: () => void;
  onSelectChat: (chat: ChatInfo) => void;
  onReload: () => void;
}

export function OverviewView({
  health,
  healthLoading,
  wa,
  chats,
  chatsLoading,
  totalUnread,
  unreadChats,
  recentSummaries,
  onReviewUnread,
  onBrowseChats,
  onConnect,
  onSelectChat,
  onReload,
}: Props) {
  const connected = wa?.state === 'READY' || wa?.state === 'AUTHENTICATED';
  const groupCount = chats.filter((c) => c.isGroup).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Hero — solid ink card, no gradients */}
      <Card className="overflow-hidden border-stone-900 bg-stone-900 text-stone-50">
        <CardContent className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-white/10 text-white">
                <SparklesIcon data-icon="inline-start" className="size-3.5" />
                WhatsApp intelligence
              </Badge>
              <Badge variant={connected ? 'success' : 'warning'}>
                {connected ? 'WhatsApp connected' : 'Connect WhatsApp'}
              </Badge>
            </div>
            <h1 className="font-display text-balance text-2xl font-semibold leading-tight tracking-tight sm:text-[32px] sm:leading-[1.15]">
              {totalUnread > 0
                ? `Catch up on ${totalUnread} messages in seconds.`
                : 'Your inbox is calm. Stay that way.'}
            </h1>
            <p className="max-w-xl text-balance text-sm leading-relaxed text-stone-300 sm:text-[15px]">
              Relay reads the noise, keeps who-said-what straight, and hands you decisions, owners,
              and next steps — private, on your own server.
            </p>
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              {connected ? (
                <>
                  <Button
                    size="lg"
                    className="bg-white text-stone-900 hover:bg-stone-200"
                    onClick={onReviewUnread}
                  >
                    Review unread
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white/10 text-white hover:bg-white/20"
                    onClick={onBrowseChats}
                  >
                    Browse all chats
                  </Button>
                </>
              ) : (
                <Button size="lg" className="bg-white text-stone-900 hover:bg-stone-200" onClick={onConnect}>
                  Connect WhatsApp
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-3 gap-2.5 lg:w-[320px] lg:grid-cols-1">
            {[
              { k: 'Unread', v: String(totalUnread) },
              { k: 'Chats tracked', v: String(chats.length) },
              { k: 'AI model', v: health?.services.ai.model ?? '…' },
            ].map((s) => (
              <div key={s.k} className="rounded-2xl bg-white/[0.07] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-400">{s.k}</p>
                <p className="truncate font-display text-lg font-semibold">{s.v}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {healthLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <StatCard label="Unread messages" value={String(totalUnread)} hint={`${unreadChats.length} chats need you`} icon={BellRingIcon} />
            <StatCard label="Total chats" value={String(chats.length)} hint={`${groupCount} groups`} icon={MessagesSquareIcon} />
            <StatCard label="Groups" value={String(groupCount)} hint="communities tracked" icon={UsersIcon} />
            <StatCard
              label="Uptime"
              value={health ? formatUptime(health.uptimeSeconds) : '—'}
              hint={`${health?.memoryUsageMb ?? '—'} MB · ${health?.environment ?? ''}`}
              icon={ActivityIcon}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Unread preview */}
        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-3">
            <div>
              <CardTitle>Needs your attention</CardTitle>
              <CardDescription>Highest unread counts first.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onReload}>
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {chatsLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[72px]" />
                ))}
              </div>
            ) : unreadChats.length === 0 ? (
              <Empty
                title="Inbox zero"
                description="No unread chats right now. Enjoy the quiet — we'll flag the next pile-up."
                icon={<InboxIcon className="size-5" />}
              />
            ) : (
              <div className="flex flex-col gap-2">
                {unreadChats.slice(0, 5).map((c) => (
                  <ChatListItem key={c.id} chat={c} onSelect={onSelectChat} />
                ))}
                {unreadChats.length > 5 ? (
                  <Button variant="outline" onClick={onReviewUnread} className="mt-1">
                    View all {unreadChats.length} unread
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent summaries + how it works */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Recent summaries</CardTitle>
              <CardDescription>This session&apos;s distilled briefs.</CardDescription>
            </CardHeader>
            <CardContent>
              {recentSummaries.length === 0 ? (
                <Empty
                  title="No briefs yet"
                  description="Summarize any chat and it will land here for quick reference."
                  icon={<SparklesIcon className="size-5" />}
                />
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {recentSummaries.slice(0, 4).map((s) => (
                    <li key={`${s.chatId}-${s.generatedAt}`} className="rounded-2xl border border-border p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{s.chatName}</p>
                        <Badge
                          variant={
                            s.urgencyLevel === 'CRITICAL'
                              ? 'danger'
                              : s.urgencyLevel === 'HIGH'
                                ? 'warning'
                                : s.urgencyLevel === 'MEDIUM'
                                  ? 'secondary'
                                  : 'success'
                          }
                        >
                          {s.urgencyLevel}
                        </Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
                        {s.tldr}
                      </p>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {s.totalMessagesAnalyzed} msgs · {new Date(s.generatedAt).toLocaleTimeString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>How it works</CardTitle>
              <CardDescription>Three calm steps, no overload.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {[
                  { n: '1', t: 'Connect once', d: 'Scan the QR — session stays saved on your server.' },
                  { n: '2', t: 'Pick a chat', d: 'Unread, groups, or search by name. One tap.' },
                  { n: '3', t: 'Get the brief', d: 'TL;DR, owners, decisions, links — in seconds.' },
                ].map((s) => (
                  <li key={s.n} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-sm font-semibold text-white">
                      {s.n}
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{s.t}</p>
                      <p className="text-[13px] text-muted-foreground">{s.d}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export function LoaderFallback() {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2Icon className="size-4 animate-spin" /> Loading…
    </div>
  );
}
