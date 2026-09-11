import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  CheckIcon,
  Loader2Icon,
  MessageSquareIcon,
  MessagesSquareIcon,
  QrCodeIcon,
  RefreshCwIcon,
  SearchIcon,
  SendIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { StatusPill } from '@/components/features/StatusPill';
import { SummaryView } from '@/components/features/SummaryView';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api } from '@/lib/api';
import { avatarTone, initials, matchesChatQuery } from '@/lib/format';
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
    if (debouncedQuery && !matchesChatQuery(c, debouncedQuery)) return false;
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
        appSettings.aiReply.allowedChatIds.includes(selected?.id || '') ||
        (selected?.phoneNumber && appSettings.aiReply.allowedChatIds.includes(selected.phoneNumber)) ||
        appSettings.aiReply.allowedChatIds.some((allowed) => {
          const selDigits = selected?.id ? selected.id.replace(/\D/g, '') : '';
          const allowedDigits = allowed.replace(/\D/g, '');
          return (
            selDigits.length >= 6 &&
            allowedDigits.length >= 6 &&
            (selDigits === allowedDigits || selDigits.endsWith(allowedDigits) || allowedDigits.endsWith(selDigits))
          );
        })),
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
    <div className="flex h-full min-h-0 w-full min-w-0 gap-4 overflow-hidden">
      {/* Left Column: Chats List Panel */}
      <div
        className={cn(
          'flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card lg:w-[380px] lg:shrink-0',
          selected && 'hidden lg:flex',
        )}
      >
        {/* Left Header */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/80 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-base font-bold tracking-tight">Chats</h2>
              {totalUnread > 0 ? (
                <Badge variant="unread" className="h-5 px-1.5 text-[11px] font-bold">
                  {totalUnread} new
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[11px]">
                  All clear
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              <StatusPill state={wa?.state} className="text-[11px] py-0.5" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onReloadChats}
                title="Refresh conversations"
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              >
                <RefreshCwIcon className={cn('size-3.5', chatsLoading && 'animate-spin')} />
              </Button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search contacts & groups…"
              className="h-9 rounded-xl pl-9 text-xs"
              aria-label="Search chats"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter Segmented Pills */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as ChatFilter)} className="w-full">
            <TabsList className="grid h-8 w-full grid-cols-4 rounded-xl bg-secondary/80 p-0.5 text-xs">
              <TabsTrigger value="all" className="rounded-lg text-[11px]">
                All
              </TabsTrigger>
              <TabsTrigger value="unread" className="rounded-lg text-[11px]">
                Unread
              </TabsTrigger>
              <TabsTrigger value="groups" className="rounded-lg text-[11px]">
                Groups
              </TabsTrigger>
              <TabsTrigger value="direct" className="rounded-lg text-[11px]">
                Direct
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Left Chat List Body */}
        <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2">
          {chatsLoading ? (
            <div className="flex flex-col gap-2 p-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                  <Skeleton className="size-10 rounded-full shrink-0" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : isWaNotReady ? (
            <div className="m-2 flex flex-col items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                <QrCodeIcon className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-sm font-semibold">WhatsApp Not Connected</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Pair your device to view chats and generate instant summaries.
                </p>
              </div>
              <Button size="sm" onClick={onConnect} className="gap-2 text-xs">
                <QrCodeIcon className="size-3.5" /> Scan QR Code
              </Button>
            </div>
          ) : chatsError ? (
            <div className="p-3">
              <Alert variant="danger">
                <AlertTitle>Couldn&apos;t load chats</AlertTitle>
                <AlertDescription>{chatsError}</AlertDescription>
              </Alert>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">
                {debouncedQuery ? 'No matching conversations' : 'No chats in this view'}
              </p>
              <p className="mt-1">
                {debouncedQuery
                  ? `No chats found matching "${debouncedQuery}"`
                  : 'Check another filter or refresh your chats.'}
              </p>
            </div>
          ) : (
            <div className="nice-scroll flex flex-1 min-h-0 flex-col gap-1 overflow-y-auto pr-0.5">
              {filtered.map((c) => (
                <ChatListItem
                  key={c.id}
                  chat={c}
                  selected={selected?.id === c.id}
                  isWhitelisted={
                    appSettings?.aiReply.enabled &&
                    (appSettings.aiReply.whitelistMode === 'all' ||
                      appSettings.aiReply.allowedChatIds.includes(c.id) ||
                      (c.phoneNumber ? appSettings.aiReply.allowedChatIds.includes(c.phoneNumber) : false))
                  }
                  onSelect={selectChat}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Active Conversation / Empty State Panel */}
      <div
        className={cn(
          'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card',
          !selected && 'hidden lg:flex',
        )}
      >
        {!selected ? (
          /* Empty State: Calm, uncluttered welcome canvas */
          <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-secondary/80 text-foreground shadow-soft mb-4">
              <MessagesSquareIcon className="size-7" />
            </div>
            <h3 className="font-display text-lg font-bold tracking-tight">Select a conversation</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Choose any chat from the left panel to review recent messages, generate structured summaries, or draft contextual AI replies.
            </p>

            {totalUnread > 0 && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilter('unread')}
                  className="gap-2 rounded-xl border-dashed hover:border-solid text-xs"
                >
                  <SparklesIcon className="size-3.5 text-amber-500" />
                  Filter to {totalUnread} unread conversations
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Active Conversation Panel */
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            {/* Unified Conversation Header */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="lg:hidden"
                  onClick={() => setSelected(null)}
                  aria-label="Back to chats"
                >
                  <ArrowLeftIcon className="size-4" />
                </Button>

                <Avatar className="size-10 shrink-0 ring-1 ring-border/50">
                  <AvatarFallback className={avatarTone(selected.name)}>
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display truncate text-sm font-semibold tracking-tight">
                      {selected.name}
                    </h2>
                    {isChatAllowedForReply && (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/40 px-1.5 py-0 text-[10px] text-emerald-700 dark:text-emerald-300"
                      >
                        <CheckIcon className="size-3" /> AI Whitelisted
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selected.isGroup ? 'Group' : 'Direct'}
                    {selected.unreadCount > 0
                      ? ` · ${selected.unreadCount} unread messages`
                      : ' · caught up'}
                  </p>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2.5">
                {/* Summary Depth Selector Pills */}
                <div className="hidden sm:flex items-center rounded-xl border border-border bg-secondary/60 p-0.5">
                  {(['compact', 'brief', 'detailed'] as SummaryMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setSummaryMode(mode)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition-all',
                        summaryMode === mode
                          ? 'bg-zinc-900 text-white shadow-xs dark:bg-white dark:text-zinc-900'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={() => void runSummary()}
                  disabled={summaryLoading}
                  className="gap-1.5 shadow-soft rounded-xl text-xs font-semibold"
                >
                  {summaryLoading ? (
                    <Loader2Icon className="size-3.5 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-3.5" />
                  )}
                  {summaryLoading ? 'Summarizing…' : 'Summarize'}
                </Button>
              </div>
            </div>

            {/* Sub-Header: Clean Underline Tab Navigation */}
            <div className="flex shrink-0 items-center justify-between border-b border-border/70 bg-secondary/20 px-5">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDetailTab('summary')}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors',
                    detailTab === 'summary'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <SparklesIcon className="size-3.5" />
                  Summary
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab('reply')}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors',
                    detailTab === 'reply'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <MessageSquareIcon className="size-3.5" />
                  AI Reply
                </button>

                <button
                  type="button"
                  onClick={() => setDetailTab('messages')}
                  className={cn(
                    'flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-semibold transition-colors',
                    detailTab === 'messages'
                      ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Messages
                  {messages.length > 0 && (
                    <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {messages.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Context Limit & Refresh */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">Context:</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={10}
                    max={300}
                    value={messageLimit}
                    onChange={(e) =>
                      setMessageLimit(Math.max(10, Math.min(300, Number(e.target.value) || 80)))
                    }
                    className="h-6 w-14 rounded-lg text-center text-xs py-0"
                  />
                  <span>msgs</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => selected && void loadMessages(selected.id)}
                  disabled={messagesLoading}
                  title="Reload messages"
                  className="size-7 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCwIcon className={cn('size-3', messagesLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>

            {/* Content Area: Independent Smooth Scrolling */}
            <div className="flex-1 min-h-0 overflow-y-auto nice-scroll p-5">
              {summaryError && (
                <Alert variant="danger" className="mb-4">
                  <AlertTitle>Summarization Error</AlertTitle>
                  <AlertDescription>{summaryError}</AlertDescription>
                </Alert>
              )}

              {/* TAB 1: SUMMARY */}
              {detailTab === 'summary' && (
                <div>
                  {summaryLoading ? (
                    <div className="flex flex-col gap-4">
                      <Skeleton className="h-32 w-full rounded-2xl" />
                      <Skeleton className="h-44 w-full rounded-2xl" />
                    </div>
                  ) : summary ? (
                    <SummaryView summary={summary} />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground mb-3">
                        <SparklesIcon className="size-6" />
                      </div>
                      <h4 className="font-display text-sm font-semibold">No summary generated yet</h4>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Click Summarize above to condense the last {messageLimit} messages from {selected.name} into a {summaryMode} briefing.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => void runSummary()}
                        className="mt-4 gap-2 text-xs"
                      >
                        <SparklesIcon className="size-3.5" />
                        Generate Briefing Now
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: AI REPLY */}
              {detailTab === 'reply' && (
                <div className="flex flex-col gap-4">
                  {/* Status Banners */}
                  {appSettings && !appSettings.aiReply.enabled ? (
                    <Alert variant="warning">
                      <AlertTriangleIcon className="size-4" />
                      <div>
                        <AlertTitle>AI Replies Disabled</AlertTitle>
                        <AlertDescription>
                          AI replies are disabled in settings.{' '}
                          <button
                            type="button"
                            onClick={() => navigate('/settings')}
                            className="font-semibold underline hover:opacity-80"
                          >
                            Enable in Settings
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
                        <AlertDescription className="space-y-2">
                          <p>
                            Admin settings restrict AI replies to approved chats only. &ldquo;{selected.name}&rdquo; is not currently on the approved whitelist.
                          </p>
                          <div className="flex flex-wrap items-center gap-2 pt-0.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs font-semibold text-emerald-700 bg-white border-emerald-500/40 hover:bg-emerald-50 dark:bg-zinc-950 dark:text-emerald-400 dark:hover:bg-emerald-950/30 shadow-xs"
                              onClick={async () => {
                                if (!appSettings) return;
                                const newIds = Array.from(
                                  new Set([
                                    ...appSettings.aiReply.allowedChatIds,
                                    selected.id,
                                    ...(selected.phoneNumber ? [selected.phoneNumber] : []),
                                  ]),
                                );
                                try {
                                  const res = await api.settings.update({
                                    aiReply: { ...appSettings.aiReply, allowedChatIds: newIds },
                                  });
                                  if (res.data) setAppSettings(res.data);
                                } catch {
                                  navigate('/settings');
                                }
                              }}
                            >
                              <CheckIcon className="size-3.5" />
                              Whitelist &ldquo;{selected.name}&rdquo; Now
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-xs"
                              onClick={() => navigate('/settings')}
                            >
                              Manage in Settings →
                            </Button>
                          </div>
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
                        <AlertTitle>Draft Error</AlertTitle>
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

                  {/* AI Reply Studio Card */}
                  <div className="rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-display text-sm font-semibold">Context-Aware AI Assistant</h4>
                        <p className="text-xs text-muted-foreground">
                          Generates a natural, realistic WhatsApp response tailored to recent messages.
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <ShieldCheckIcon className="size-3.5 text-emerald-600" />
                        Human Review Required
                      </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Tone
                        </label>
                        <div className="flex rounded-xl border border-border bg-secondary/50 p-0.5">
                          {(['casual', 'friendly', 'professional', 'concise'] as ReplyTone[]).map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setReplyTone(t)}
                              className={cn(
                                'flex-1 rounded-lg py-1.5 text-xs font-medium capitalize transition-all',
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
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Guidance (Optional)
                        </label>
                        <Input
                          value={replyInstruction}
                          onChange={(e) => setReplyInstruction(e.target.value)}
                          placeholder="e.g. Say I will follow up at 4 PM"
                          className="h-9 rounded-xl text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void generateDraft();
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <Button
                        onClick={() => void generateDraft()}
                        disabled={replyDrafting || !isChatAllowedForReply}
                        size="sm"
                        className="gap-2 text-xs font-semibold"
                      >
                        {replyDrafting ? (
                          <Loader2Icon className="size-3.5 animate-spin" />
                        ) : (
                          <SparklesIcon className="size-3.5" />
                        )}
                        {replyDrafting ? 'Drafting…' : 'Generate AI Draft'}
                      </Button>
                    </div>

                    {/* Draft Review Section */}
                    {replyDraft && (
                      <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">
                            Draft Reply (Review before dispatch)
                          </span>
                          <span className="text-muted-foreground">{replyDraft.length} characters</span>
                        </div>

                        <textarea
                          rows={3}
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value)}
                          placeholder="Type or edit reply..."
                          className="w-full rounded-xl border border-input bg-card p-3 text-sm leading-relaxed focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                        />

                        {replySuggestions.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground">
                              Quick alternate variations (click to adopt):
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

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-xs text-muted-foreground">
                            Recipient: <strong className="text-foreground">{selected.name}</strong>
                          </span>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyDraft('');
                                setReplySuggestions([]);
                              }}
                              className="text-xs"
                            >
                              Discard
                            </Button>
                            <Button
                              onClick={() => setShowConfirmDialog(true)}
                              disabled={replySending || !replyDraft.trim() || !isChatAllowedForReply}
                              size="sm"
                              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                            >
                              <SendIcon className="size-3.5" />
                              Send to WhatsApp
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: MESSAGES */}
              {detailTab === 'messages' && (
                <div className="h-full flex flex-col">
                  {messagesLoading ? (
                    <div className="flex flex-col gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-3">
                          <Skeleton className="size-8 rounded-full shrink-0" />
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
                </div>
              )}
            </div>

            {/* Anti-Bulk Confirmation Modal */}
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <ShieldCheckIcon className="size-5 text-emerald-600" />
                    Confirm WhatsApp Message
                  </DialogTitle>
                  <DialogDescription>
                    Review your reply before sending. Relay sends single messages only with no bulk sending allowed.
                  </DialogDescription>
                </DialogHeader>

                <div className="my-2 rounded-xl border border-border bg-muted/40 p-3.5">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">To:</p>
                  <p className="text-sm font-semibold text-foreground">{selected?.name}</p>
                  <div className="my-2 border-t border-border" />
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Message:</p>
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
                    {replySending ? 'Sending…' : 'Confirm & Send'}
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
