import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  CheckIcon,
  CornerDownLeftIcon,
  Loader2Icon,
  MessageSquareIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatListItem } from '@/components/features/ChatListItem';
import { MessageList } from '@/components/features/MessageList';
import { SummaryView } from '@/components/features/SummaryView';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { avatarTone, initials } from '@/lib/format';
import type {
  AppSettings,
  ChatFilter,
  ChatInfo,
  ChatMessage,
  ChatSummary,
  ReplyTone,
  SummaryMode,
  WhatsAppStatus,
} from '@/lib/types';
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
  wa?: WhatsAppStatus | null;
  onConnect?: () => void;
}

export function ChatsView({
  chats,
  chatsLoading,
  chatsError,
  onReloadChats,
  totalUnread,
  initialSelected,
  onSummarized,
  wa,
  onConnect,
}: ChatsViewProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selected, setSelected] = useState<ChatInfo | null>(null);
  const [detailTab, setDetailTab] = useState<'summary' | 'reply' | 'messages'>('summary');

  const isWaNotReady =
    !wa ||
    (wa.state !== 'READY' && wa.state !== 'AUTHENTICATED') ||
    Boolean(
      chatsError &&
        (chatsError.includes('QR_READY') ||
          chatsError.includes('not ready') ||
          chatsError.includes('scan the QR') ||
          chatsError.includes('INITIALIZING') ||
          chatsError.includes('DISCONNECTED')),
    );

  // Settings state
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Summary state
  const [summary, setSummary] = useState<ChatSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('brief');
  const [messageLimit, setMessageLimit] = useState(80);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // AI Reply state
  const [replyTone, setReplyTone] = useState<ReplyTone>('casual');
  const [replyInstruction, setReplyInstruction] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
  const [replyDrafting, setReplyDrafting] = useState(false);
  const [replyDraftError, setReplyDraftError] = useState<string | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [replySendError, setReplySendError] = useState<string | null>(null);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Load app settings
  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const res = await api.settings.get();
        if (mounted && res.data) {
          setAppSettings(res.data);
          setSummaryMode(res.data.summary.defaultDepth || 'brief');
          setMessageLimit(res.data.summary.defaultMessageLimit || 80);
          setReplyTone(res.data.aiReply.defaultTone || 'casual');
        }
      } catch {
        // Fall back to defaults
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (initialSelected) {
      setSelected(initialSelected);
      setSummary(null);
      setSummaryError(null);
      setMessages([]);
      setMessagesError(null);
      setReplyDraft('');
      setReplySuggestions([]);
      setReplySuccessMessage(null);
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
    setReplyDraft('');
    setReplySuggestions([]);
    setReplyDraftError(null);
    setReplySendError(null);
    setReplySuccessMessage(null);
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
      const res = await api.summarize({
        chatId: selected.id,
        messageLimit,
        mode: summaryMode,
      });
      if (!res.data) throw new Error('Empty summary response');
      setSummary(res.data);
      onSummarized(res.data);
      setDetailTab('summary');
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Summarization failed');
    } finally {
      setSummaryLoading(false);
    }
  };

  // Check if AI reply is allowed for this chat
  const isChatAllowedForReply = Boolean(
    appSettings?.aiReply.enabled &&
      (appSettings.aiReply.whitelistMode === 'all' ||
        appSettings.aiReply.allowedChatIds.includes(selected?.id || '')),
  );

  const generateDraft = async () => {
    if (!selected) return;
    setReplyDrafting(true);
    setReplyDraftError(null);
    setReplySuccessMessage(null);
    try {
      const res = await api.reply.draft({
        chatId: selected.id,
        tone: replyTone,
        instruction: replyInstruction.trim() || undefined,
        messageLimit: 30,
      });
      if (!res.data) throw new Error('Failed to generate draft reply');
      setReplyDraft(res.data.reply);
      setReplySuggestions(res.data.suggestions || []);
    } catch (err: any) {
      setReplyDraftError(err.message || 'Could not generate draft reply');
    } finally {
      setReplyDrafting(false);
    }
  };

  const executeSendReply = async () => {
    if (!selected || !replyDraft.trim()) return;
    setShowConfirmDialog(false);
    setReplySending(true);
    setReplySendError(null);
    try {
      const res = await api.reply.send({
        chatId: selected.id,
        message: replyDraft.trim(),
      });
      if (res.data?.delivered) {
        setReplySuccessMessage(
          `Reply successfully sent to ${selected.name} at ${new Date().toLocaleTimeString()}!`,
        );
        setReplyDraft('');
        setReplySuggestions([]);
        // Reload messages to display the new outgoing message
        void loadMessages(selected.id);
      } else {
        throw new Error('Message dispatch returned undelivered state');
      }
    } catch (err: any) {
      setReplySendError(err.message || 'Failed to dispatch reply to WhatsApp');
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
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
          ) : isWaNotReady ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                <QrCodeIcon className="size-5" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-sm font-semibold text-stone-900 dark:text-stone-100">
                  WhatsApp Not Connected
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Chats will appear here once you pair your phone. Scan the QR code in the Connect tab to link securely.
                </p>
              </div>
              <div className="mt-1 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button size="sm" onClick={onConnect} className="gap-2">
                  <QrCodeIcon className="size-3.5" />
                  Pair with QR Code
                </Button>
                <Button size="sm" variant="outline" onClick={onReloadChats}>
                  <RefreshCwIcon className="size-3.5" />
                  Retry
                </Button>
              </div>
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
      <div className={cn('min-w-0', !selected && 'hidden lg:block')}>
        {!selected ? (
          isWaNotReady ? (
            <Empty
              title="Pair WhatsApp to see conversations"
              description="Relay keeps your messages private on your server. Scan the QR code once to link your phone and enable one-click AI summaries."
              icon={<QrCodeIcon className="size-6 text-stone-700 dark:text-stone-300" />}
              action={
                <Button onClick={onConnect} size="lg" className="gap-2">
                  <QrCodeIcon className="size-4" />
                  Go to Connect
                  <ArrowRightIcon className="size-4" />
                </Button>
              }
              className="h-full min-h-[420px]"
            />
          ) : (
            <Empty
              title="Pick a chat to begin"
              description="Choose any conversation on the left — then generate structured summaries or context-aware AI replies."
              className="h-full min-h-[420px]"
            />
          )
        ) : (
          <div className="flex min-w-0 animate-fade-up flex-col gap-4">
            {/* Selected Chat Header Card */}
            <Card className="min-w-0 overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-5 min-w-0">
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
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-[15px] font-semibold">{selected.name}</p>
                      {isChatAllowedForReply && (
                        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-[10px] py-0 px-1.5 gap-1">
                          <CheckIcon className="size-3" /> AI Whitelisted
                        </Badge>
                      )}
                    </div>
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

                {/* Summarize Controls & Depth Switcher */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Summary Depth Pill Selector */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Summary Depth
                      </span>
                      <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
                        {(['compact', 'brief', 'detailed'] as SummaryMode[]).map((mode) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setSummaryMode(mode)}
                            className={cn(
                              'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-all',
                              summaryMode === mode
                                ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          >
                            {mode}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Message limit */}
                    <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Messages
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        value={messageLimit}
                        onChange={(e) =>
                          setMessageLimit(Math.max(10, Math.min(300, Number(e.target.value) || 80)))
                        }
                        className="h-8 w-20 text-xs"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selected && void loadMessages(selected.id)}
                      disabled={messagesLoading}
                    >
                      <RefreshCwIcon data-icon="inline-start" className="size-3.5" />
                      Messages
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailTab('reply')}
                      className="gap-1.5"
                    >
                      <MessageSquareIcon className="size-3.5 text-zinc-600" />
                      AI Reply
                    </Button>
                    <Button size="sm" onClick={() => void runSummary()} disabled={summaryLoading}>
                      {summaryLoading ? (
                        <Loader2Icon data-icon="inline-start" className="size-3.5 animate-spin" />
                      ) : (
                        <SparklesIcon data-icon="inline-start" className="size-3.5" />
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

            {/* Content Tabs */}
            <Tabs
              value={detailTab}
              onValueChange={(v) => setDetailTab(v as 'summary' | 'reply' | 'messages')}
              className="min-w-0"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="reply" className="gap-1.5">
                  <SparklesIcon className="size-3.5" />
                  AI Reply
                </TabsTrigger>
                <TabsTrigger value="messages">Messages</TabsTrigger>
              </TabsList>

              {/* Tab 1: Summary */}
              <TabsContent value="summary" className="min-w-0 mt-3">
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
                    description={`Tap Summarize to distill the last ${messageLimit} messages from ${selected.name} in ${summaryMode} mode.`}
                    action={
                      <Button onClick={() => void runSummary()}>
                        <SparklesIcon data-icon="inline-start" />
                        Generate summary
                      </Button>
                    }
                  />
                )}
              </TabsContent>

              {/* Tab 2: AI Reply */}
              <TabsContent value="reply" className="min-w-0 mt-3 flex flex-col gap-4">
                {/* Whitelist or feature status alerts */}
                {appSettings && !appSettings.aiReply.enabled ? (
                  <Alert variant="warning">
                    <AlertTriangleIcon className="size-4" />
                    <div>
                      <AlertTitle>AI Reply is Disabled</AlertTitle>
                      <AlertDescription>
                        AI replies are disabled in settings. You can re-enable this feature on the{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/settings')}
                          className="font-semibold underline hover:opacity-80"
                        >
                          Settings page
                        </button>
                        .
                      </AlertDescription>
                    </div>
                  </Alert>
                ) : appSettings && !isChatAllowedForReply ? (
                  <Alert variant="warning">
                    <ShieldAlertIcon className="size-4" />
                    <div>
                      <AlertTitle>Chat Not Whitelisted</AlertTitle>
                      <AlertDescription>
                        Admin settings restrict AI replies to approved chats only. &ldquo;{selected.name}&rdquo; is not
                        whitelisted. You can authorize this chat in{' '}
                        <button
                          type="button"
                          onClick={() => navigate('/settings')}
                          className="font-semibold underline hover:opacity-80"
                        >
                          Settings &rarr; Whitelist
                        </button>
                        .
                      </AlertDescription>
                    </div>
                  </Alert>
                ) : null}

                {replySuccessMessage && (
                  <Alert variant="success">
                    <CheckCircle2Icon className="size-4" />
                    <div>
                      <AlertTitle>Message Dispatched</AlertTitle>
                      <AlertDescription>{replySuccessMessage}</AlertDescription>
                    </div>
                  </Alert>
                )}

                {replyDraftError && (
                  <Alert variant="danger">
                    <AlertTriangleIcon className="size-4" />
                    <div>
                      <AlertTitle>Draft Generation Error</AlertTitle>
                      <AlertDescription>{replyDraftError}</AlertDescription>
                    </div>
                  </Alert>
                )}

                {replySendError && (
                  <Alert variant="danger">
                    <AlertTriangleIcon className="size-4" />
                    <div>
                      <AlertTitle>Send Failed</AlertTitle>
                      <AlertDescription>{replySendError}</AlertDescription>
                    </div>
                  </Alert>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <CardTitle>Context-Aware AI Reply</CardTitle>
                        <CardDescription>
                          Craft a natural, human-like response tailored to the latest messages in {selected.name}.
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <ShieldCheckIcon className="size-4 text-emerald-600" />
                        Single Message · Human Review Required
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {/* Tone Selection & Guidance */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Reply Tone
                        </label>
                        <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
                          {(['casual', 'friendly', 'professional', 'concise'] as ReplyTone[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setReplyTone(t)}
                              className={cn(
                                'flex-1 rounded-md py-1.5 text-xs font-medium capitalize transition-all',
                                replyTone === t
                                  ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Optional Custom Direction
                        </label>
                        <Input
                          value={replyInstruction}
                          onChange={(e) => setReplyInstruction(e.target.value)}
                          placeholder="e.g. Say I'm running 15 mins late / Agree to meeting"
                          className="text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void generateDraft();
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        onClick={() => void generateDraft()}
                        disabled={replyDrafting || !isChatAllowedForReply}
                        size="sm"
                        className="gap-2"
                      >
                        {replyDrafting ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <SparklesIcon className="size-3.5" />
                        )}
                        {replyDrafting ? 'Drafting…' : 'Generate AI Draft'}
                      </Button>
                    </div>

                    {/* Draft Editor Section */}
                    {replyDraft && (
                      <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4 animate-fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">
                            Draft Reply (Review & Edit before sending)
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {replyDraft.length} characters
                          </span>
                        </div>

                        <textarea
                          rows={3}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Type or edit your reply here..."
                          className="w-full rounded-xl border border-input bg-card p-3 text-sm leading-relaxed focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />

                        {/* Alternate Suggestion Chips */}
                        {replySuggestions.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Alternative quick variations (click to apply):
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {replySuggestions.map((sug, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setReplyDraft(sug)}
                                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs text-left text-muted-foreground hover:border-zinc-400 hover:text-foreground transition-colors"
                                >
                                  &ldquo;{sug}&rdquo;
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ShieldCheckIcon className="size-3.5 text-emerald-600" />
                            Target: <span className="font-semibold text-foreground">{selected.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyDraft('');
                                setReplySuggestions([]);
                              }}
                            >
                              Discard
                            </Button>
                            <Button
                              onClick={() => setShowConfirmDialog(true)}
                              disabled={replySending || !replyDraft.trim() || !isChatAllowedForReply}
                              size="sm"
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <SendIcon className="size-3.5" />
                              Send to WhatsApp
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Messages */}
              <TabsContent value="messages" className="min-w-0 mt-3">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent messages</CardTitle>
                    <CardDescription>Chronological context used for summaries and AI replies.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {messagesLoading ? (
                      <div className="flex flex-col gap-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="flex gap-3">
                            <Skeleton className="size-8 rounded-full" />
                            <div className="flex flex-1 flex-col gap-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-4 w-3/4" />
                            </div>
                          </div>
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

            {/* Anti-Bulk Send Confirmation Modal */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheckIcon className="size-5 text-emerald-600" />
                    Confirm Single WhatsApp Message
                  </DialogTitle>
                  <DialogDescription>
                    Please review your message before dispatching. Relay sends strictly one message at a time; no bulk sending is permitted.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-2 rounded-xl border border-border bg-muted/40 p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Recipient:</p>
                  <p className="text-sm font-semibold text-foreground">{selected?.name}</p>
                  <Separator className="my-2" />
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Message Text:</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                    {replyDraft}
                  </p>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfirmDialog(false)}
                    disabled={replySending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => void executeSendReply()}
                    disabled={replySending}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    {replySending ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <SendIcon className="size-4" />
                    )}
                    {replySending ? 'Sending…' : 'Send Now'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
}
