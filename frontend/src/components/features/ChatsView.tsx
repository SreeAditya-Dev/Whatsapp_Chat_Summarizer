import { useEffect, useState } from 'react';
import { ArrowLeftIcon, Loader2Icon, RefreshCwIcon, SearchIcon, SparklesIcon } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ChatListItem } from '@/components/features/ChatListItem';
import { MessageList } from '@/components/features/MessageList';
import { SummaryView } from '@/components/features/SummaryView';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { avatarTone, initials } from '@/lib/format';
import type { ChatFilter, ChatInfo, ChatMessage, ChatSummary } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatsViewProps {
  chats: ChatInfo[];
  chatsLoading: boolean;
  chatsError: string | null;
  onReloadChats: () => void;
  totalUnread: number;
  recentSummaries: ChatSummary[];
  onSummarized: (s: ChatSummary) => void;
  initialSelected?: ChatInfo | null;
}

export function ChatsView({
  chats,
  chatsLoading,
  chatsError,
  onReloadChats,
  totalUnread,
  initialSelected,
  onSummarized,
}: ChatsViewProps) {
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selected, setSelected] = useState<ChatInfo | null>(null);
  const [detailTab, setDetailTab] = useState('summary');

  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [messageLimit, setMessageLimit] = useState(80);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSelected) {
      setSelected(initialSelected);
      setSummary(null);
      setSummaryError(null);
      setMessages([]);
      setMessagesError(null);
      setDetailTab('summary');
      void (async () => {
        setMessagesLoading(true);
        try {
          const res = await api.messages(initialSelected.id, 50);
          setMessages(res.data ?? []);
        } catch (e) {
          setMessagesError(e instanceof Error ? e.message : 'Could not load messages');
        } finally {
          setMessagesLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = chats.filter((c) => {
    if (filter === 'unread' && c.unreadCount === 0) return false;
    if (filter === 'groups' && !c.isGroup) return false;
    if (filter === 'direct' && c.isGroup) return false;
    if (debouncedQuery && !c.name.toLowerCase().includes(debouncedQuery.toLowerCase())) return false;
    return true;
  });

  const selectChat = (chat: ChatInfo) => {
    setSelected(chat);
    setSummary(null);
    setSummaryError(null);
    setMessages([]);
    setMessagesError(null);
    setDetailTab('summary');
    void loadMessages(chat.id);
  };

  const loadMessages = async (chatId: string) => {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await api.messages(chatId, 50);
      setMessages(res.data ?? []);
    } catch (e) {
      setMessagesError(e instanceof Error ? e.message : 'Could not load messages');
    } finally {
      setMessagesLoading(false);
    }
  };

  const runSummary = async () => {
    if (!selected) return;
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await api.summarize({ chatId: selected.id, messageLimit });
      if (!res.data) throw new Error('Empty summary response');
      setSummary(res.data);
      onSummarized(res.data);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Summarization failed');
    } finally {
      setSummaryLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      {/* Chat list column */}
      <Card className={cn(selected && 'hidden lg:block')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Chats</CardTitle>
              <CardDescription>
                {totalUnread > 0 ? `${totalUnread} unread to catch up on` : 'Everything is caught up'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={onReloadChats} aria-label="Refresh chats">
              <RefreshCwIcon data-icon="inline-start" />
            </Button>
          </div>
          <div className="relative mt-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats…"
              className="pl-9"
              aria-label="Search chats"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ChatFilter)} className="mt-1">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="groups">Groups</TabsTrigger>
              <TabsTrigger value="direct">Direct</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent>
          {chatsLoading ? (
            <div className="flex flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <Skeleton className="size-11 rounded-full" />
                  <div className="flex flex-1 flex-col gap-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : chatsError ? (
            <Alert variant="danger">
              <AlertTitle>Couldn&apos;t load chats</AlertTitle>
              <AlertDescription>{chatsError}</AlertDescription>
            </Alert>
          ) : filtered.length === 0 ? (
            <Empty
              title={debouncedQuery ? 'No matches' : 'All clear'}
              description={
                debouncedQuery
                  ? `Nothing matches “${debouncedQuery}”.`
                  : 'No chats in this view yet.'
              }
            />
          ) : (
            <div className="nice-scroll flex max-h-[62vh] flex-col gap-2 overflow-y-auto pr-0.5 lg:max-h-[68vh]">
              {filtered.map((c) => (
                <ChatListItem key={c.id} chat={c} selected={selected?.id === c.id} onSelect={selectChat} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail column */}
      <div className={cn(!selected && 'hidden lg:block')}>
        {!selected ? (
          <Empty
            title="Pick a chat to begin"
            description="Choose any conversation on the left — then generate a calm, structured summary in one tap."
            className="h-full min-h-[420px]"
          />
        ) : (
          <div className="flex animate-fade-up flex-col gap-4">
            <Card>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="lg:hidden"
                    onClick={() => setSelected(null)}
                    aria-label="Back to chats"
                  >
                    <ArrowLeftIcon data-icon="inline-start" />
                  </Button>
                  <Avatar className="size-11">
                    <AvatarFallback className={avatarTone(selected.name)}>
                      {initials(selected.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[15px] font-semibold">{selected.name}</p>
                    <p className="text-[13px] text-muted-foreground">
                      {selected.isGroup ? 'Group' : 'Direct'}
                      {selected.unreadCount > 0 ? ` · ${selected.unreadCount} unread` : ' · caught up'}
                    </p>
                  </div>
                  {selected.unreadCount > 0 ? (
                    <Badge variant="unread">{selected.unreadCount} new</Badge>
                  ) : (
                    <Badge variant="success">Clear</Badge>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex w-full max-w-[220px] flex-col gap-1.5 text-[13px] font-medium">
                    Messages to analyze
                    <span className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={10}
                        max={200}
                        value={messageLimit}
                        onChange={(e) =>
                          setMessageLimit(Math.max(10, Math.min(200, Number(e.target.value) || 80)))
                        }
                        className="w-24"
                      />
                      <span className="text-xs font-normal text-muted-foreground">10–200</span>
                    </span>
                  </label>
                  <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button
                      variant="outline"
                      onClick={() => selected && void loadMessages(selected.id)}
                      disabled={messagesLoading}
                    >
                      <RefreshCwIcon data-icon="inline-start" />
                      Messages
                    </Button>
                    <Button onClick={() => void runSummary()} disabled={summaryLoading}>
                      {summaryLoading ? (
                        <Loader2Icon data-icon="inline-start" className="animate-spin" />
                      ) : (
                        <SparklesIcon data-icon="inline-start" />
                      )}
                      {summaryLoading ? 'Summarizing…' : 'Summarize'}
                    </Button>
                  </div>
                </div>
                {summaryError ? (
                  <Alert variant="danger">
                    <AlertTitle>Summarization failed</AlertTitle>
                    <AlertDescription>{summaryError}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <Tabs value={detailTab} onValueChange={setDetailTab}>
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>
              <TabsContent value="summary">
                {summaryLoading ? (
                  <Card>
                    <CardContent className="flex flex-col gap-3 p-5">
                      <Skeleton className="h-28 rounded-2xl" />
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-4 w-3/4" />
                    </CardContent>
                  </Card>
                ) : summary ? (
                  <SummaryView summary={summary} />
                ) : (
                  <Empty
                    title="No summary yet"
                    description={`Tap Summarize to distill the last ${messageLimit} messages from ${selected.name}.`}
                    action={
                      <Button onClick={() => void runSummary()}>
                        <SparklesIcon data-icon="inline-start" />
                        Generate summary
                      </Button>
                    }
                  />
                )}
              </TabsContent>
              <TabsContent value="messages">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent messages</CardTitle>
                    <CardDescription>Chronological context used for summaries.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {messagesLoading ? (
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-16" />
                        ))}
                      </div>
                    ) : messagesError ? (
                      <Alert variant="danger">
                        <AlertTitle>Couldn&apos;t load messages</AlertTitle>
                        <AlertDescription>{messagesError}</AlertDescription>
                      </Alert>
                    ) : (
                      <MessageList messages={messages} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}
