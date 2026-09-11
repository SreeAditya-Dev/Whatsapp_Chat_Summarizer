import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CheckIcon,
  FileTextIcon,
  Loader2Icon,
  PhoneIcon,
  PlusIcon,
  SaveIcon,
  SearchIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCheckIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { getChatDisplayNumber, matchesChatQuery } from '@/lib/format';
import type { AppSettings, ChatInfo, ReplyTone, SummaryMode } from '@/lib/types';
import { cn } from '@/lib/utils';

interface SettingsViewProps {
  chats: ChatInfo[];
  onSettingsSaved?: (settings: AppSettings) => void;
}

export function SettingsView({ chats, onSettingsSaved }: SettingsViewProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chatSearch, setChatSearch] = useState('');
  const [whitelistFilter, setWhitelistFilter] = useState<'all' | 'whitelisted' | 'unwhitelisted'>('all');
  const [manualIdInput, setManualIdInput] = useState('');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        setLoading(true);
        const res = await api.settings.get();
        if (mounted && res.data) {
          setSettings(res.data);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Failed to load settings');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    try {
      setSaving(true);
      setError(null);
      const res = await api.settings.update(settings);
      if (res.data) {
        setSettings(res.data);
        onSettingsSaved?.(res.data);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const toggleChatAllowed = (chatId: string) => {
    if (!settings) return;
    const current = new Set(settings.aiReply.allowedChatIds);
    if (current.has(chatId)) {
      current.delete(chatId);
    } else {
      current.add(chatId);
    }
    setSettings({
      ...settings,
      aiReply: {
        ...settings.aiReply,
        allowedChatIds: Array.from(current),
      },
    });
  };

  const addAllowedId = (rawId: string) => {
    if (!settings || !rawId.trim()) return;
    const trimmed = rawId.trim();
    if (!settings.aiReply.allowedChatIds.includes(trimmed)) {
      setSettings({
        ...settings,
        aiReply: {
          ...settings.aiReply,
          allowedChatIds: [...settings.aiReply.allowedChatIds, trimmed],
        },
      });
    }
    setManualIdInput('');
  };

  const removeAllowedId = (rawId: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      aiReply: {
        ...settings.aiReply,
        allowedChatIds: settings.aiReply.allowedChatIds.filter((id) => id !== rawId),
      },
    });
  };

  const selectAllChats = () => {
    if (!settings) return;
    const allIds = Array.from(new Set([...settings.aiReply.allowedChatIds, ...chats.map((c) => c.id)]));
    setSettings({
      ...settings,
      aiReply: {
        ...settings.aiReply,
        allowedChatIds: allIds,
      },
    });
  };

  const clearAllChats = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      aiReply: {
        ...settings.aiReply,
        allowedChatIds: [],
      },
    });
  };

  const isChatWhitelisted = (chat: ChatInfo) => {
    if (!settings) return false;
    if (settings.aiReply.allowedChatIds.includes(chat.id)) return true;
    if (chat.phoneNumber && settings.aiReply.allowedChatIds.includes(chat.phoneNumber)) return true;
    const chatDigits = chat.id.replace(/\D/g, '');
    if (chatDigits.length >= 6) {
      return settings.aiReply.allowedChatIds.some((allowed) => {
        const allowedDigits = allowed.replace(/\D/g, '');
        return (
          allowedDigits.length >= 6 &&
          (allowedDigits === chatDigits || chatDigits.endsWith(allowedDigits) || allowedDigits.endsWith(chatDigits))
        );
      });
    }
    return false;
  };

  const [remoteSearchResults, setRemoteSearchResults] = useState<ChatInfo[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);

  useEffect(() => {
    const trimmed = chatSearch.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteSearchResults([]);
      setIsSearchingRemote(false);
      return;
    }

    let active = true;
    const searchRemote = async () => {
      setIsSearchingRemote(true);
      try {
        const res = await api.searchChats(trimmed, 20);
        if (active && res.data) {
          setRemoteSearchResults(res.data);
        }
      } catch {
        // Fallback
      } finally {
        if (active) setIsSearchingRemote(false);
      }
    };

    const timer = setTimeout(() => {
      void searchRemote();
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [chatSearch]);

  const combinedChats = useMemo(() => {
    if (!chatSearch.trim()) return chats;
    const map = new Map<string, ChatInfo>();
    for (const c of chats) map.set(c.id, c);

    for (const r of remoteSearchResults) {
      if (!map.has(r.id)) {
        map.set(r.id, r);
      } else {
        const existing = map.get(r.id)!;
        const isExistingPhone = existing.name.replace(/\D/g, '').length >= 7;
        const isRemotePhone = r.name.replace(/\D/g, '').length >= 7;
        if (isExistingPhone && !isRemotePhone) {
          map.set(r.id, { ...existing, name: r.name, phoneNumber: r.phoneNumber || existing.phoneNumber });
        }
      }
    }
    return Array.from(map.values());
  }, [chats, remoteSearchResults, chatSearch]);

  const filteredChats = combinedChats.filter((c) => {
    if (!matchesChatQuery(c, chatSearch)) return false;
    const allowed = isChatWhitelisted(c);
    if (whitelistFilter === 'whitelisted' && !allowed) return false;
    if (whitelistFilter === 'unwhitelisted' && allowed) return false;
    return true;
  });

  const customAllowedIds = (settings?.aiReply.allowedChatIds || []).filter(
    (id) => !chats.some((c) => c.id === id || c.phoneNumber === id),
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-14 w-1/3 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  if (!settings) {
    return (
      <Alert variant="danger">
        <AlertTriangleIcon className="size-4" />
        <div>
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>{error || 'Could not load configuration settings.'}</AlertDescription>
        </div>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Top Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure summary depth modes, message context length, and human-like AI reply access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2Icon className="size-4" /> Saved successfully
            </span>
          )}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger">
          <AlertTriangleIcon className="size-4" />
          <div>
            <AlertTitle>Error saving settings</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </div>
        </Alert>
      )}

      {/* Section 1: Summary Depth & Context */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <FileTextIcon className="size-4" />
            </span>
            <div>
              <CardTitle>Summarizer Settings</CardTitle>
              <CardDescription>
                Choose default summary depth and message context limits.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Default Summary Depth Mode
            </label>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  id: 'compact' as SummaryMode,
                  title: 'Compact TL;DR',
                  badge: 'Punchy',
                  desc: 'High-level 1-2 sentence overview with 2-3 key takeaways. Ideal for quick check-ins.',
                },
                {
                  id: 'brief' as SummaryMode,
                  title: 'Brief (Standard)',
                  badge: 'Balanced',
                  desc: 'Standard summary covering key decisions, important discussions, and direct action items.',
                },
                {
                  id: 'detailed' as SummaryMode,
                  title: 'Detailed (Expanded)',
                  badge: 'In-Depth',
                  desc: 'Expanded breakdown with comprehensive discussion context, full action tables, and questions.',
                },
              ].map((mode) => {
                const isSelected = settings.summary.defaultDepth === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        summary: { ...settings.summary, defaultDepth: mode.id },
                      })
                    }
                    className={cn(
                      'flex flex-col items-start rounded-xl border p-4 text-left transition-all',
                      isSelected
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm ring-2 ring-zinc-900/20 dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-border bg-card hover:border-zinc-300 dark:hover:border-zinc-700',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="font-display text-sm font-semibold">{mode.title}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase',
                          isSelected
                            ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        {mode.badge}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'mt-2 text-xs leading-relaxed',
                        isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-muted-foreground',
                      )}
                    >
                      {mode.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:max-w-xs">
            <label
              htmlFor="default-msg-limit"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Default Message History Limit
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="default-msg-limit"
                type="number"
                min={10}
                max={500}
                value={settings.summary.defaultMessageLimit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    summary: {
                      ...settings.summary,
                      defaultMessageLimit: Math.max(10, Math.min(500, Number(e.target.value) || 100)),
                    },
                  })
                }
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">messages (10–500)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: AI Reply & Guardrails */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-zinc-900 text-white">
              <SparklesIcon className="size-4" />
            </span>
            <div>
              <CardTitle>AI Reply & Agent Settings</CardTitle>
              <CardDescription>
                Configure context-aware, human-like replies and specify authorized chats.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Strict Single Send & Anti-Bulk Safeguard Banner */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="flex flex-col gap-1 text-xs leading-relaxed">
                <span className="font-semibold text-sm">Anti-Bulk & Human-in-the-Loop Safeguard</span>
                <p>
                  Relay strictly enforces <strong>single-message dispatch</strong> with required human
                  review. Bulk blasts and automated spam are prohibited at the API layer to protect your WhatsApp account against ban risks.
                </p>
              </div>
            </div>
          </div>

          {/* Toggle Enable AI Reply */}
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-display text-sm font-semibold">Enable AI Assistant Replies</span>
              <span className="text-xs text-muted-foreground">
                Allows drafting and sending contextual responses directly from chat views.
              </span>
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.aiReply.enabled}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    aiReply: { ...settings.aiReply, enabled: e.target.checked },
                  })
                }
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-zinc-300 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-zinc-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none dark:bg-zinc-700 dark:peer-checked:bg-zinc-200 dark:peer-checked:after:border-zinc-800"></div>
            </label>
          </div>

          {settings.aiReply.enabled && (
            <>
              {/* Default Tone */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Default Reply Tone
                </label>
                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    { id: 'casual' as ReplyTone, name: 'Casual', desc: 'Natural, easygoing phrasing' },
                    { id: 'friendly' as ReplyTone, name: 'Friendly', desc: 'Warm, positive, approachable' },
                    { id: 'professional' as ReplyTone, name: 'Professional', desc: 'Courteous, crisp, polite' },
                    { id: 'concise' as ReplyTone, name: 'Concise', desc: 'Punchy, straight to the point' },
                  ].map((t) => {
                    const active = settings.aiReply.defaultTone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            aiReply: { ...settings.aiReply, defaultTone: t.id },
                          })
                        }
                        className={cn(
                          'flex flex-col items-start rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                            : 'border-border bg-card hover:border-zinc-300',
                        )}
                      >
                        <span className="font-display text-sm font-semibold">{t.name}</span>
                        <span
                          className={cn(
                            'mt-1 text-[11px]',
                            active ? 'text-zinc-300 dark:text-zinc-600' : 'text-muted-foreground',
                          )}
                        >
                          {t.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Persona / Custom Prompt Instructions */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="persona-input"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Custom Persona & Tone Guidance (Optional)
                </label>
                <p className="text-xs text-muted-foreground">
                  Give the AI background about who you are or instructions on how you naturally speak (e.g.
                  &ldquo;I am a lead developer. Speak concisely, use lowercase abbreviations occasionally, keep under 2 sentences.&rdquo;).
                </p>
                <textarea
                  id="persona-input"
                  rows={3}
                  value={settings.aiReply.customPersona}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      aiReply: { ...settings.aiReply, customPersona: e.target.value },
                    })
                  }
                  placeholder="e.g. My name is Alex. Keep it relaxed and concise, never start with 'Hey there!'. Speak like a real colleague."
                  className="w-full rounded-xl border border-input bg-card p-3 text-sm placeholder:text-muted-foreground/60 focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              <Separator />

              {/* Whitelist / Access Control */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Admin Chat Whitelist (Who Can Be Replied To)
                  </label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Restrict AI replies to specific approved contacts or groups to prevent unintended sends.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        aiReply: { ...settings.aiReply, whitelistMode: 'selected' },
                      })
                    }
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                      settings.aiReply.whitelistMode === 'selected'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-border bg-card hover:border-zinc-300',
                    )}
                  >
                    <UserCheckIcon className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <span className="font-display text-sm font-semibold">
                        Permitted Chats Only (Recommended)
                      </span>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          settings.aiReply.whitelistMode === 'selected'
                            ? 'text-zinc-300 dark:text-zinc-600'
                            : 'text-muted-foreground',
                        )}
                      >
                        Only chats specifically selected in the whitelist below can receive AI drafts and replies.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSettings({
                        ...settings,
                        aiReply: { ...settings.aiReply, whitelistMode: 'all' },
                      })
                    }
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
                      settings.aiReply.whitelistMode === 'all'
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-border bg-card hover:border-zinc-300',
                    )}
                  >
                    <UsersIcon className="mt-0.5 size-5 shrink-0" />
                    <div>
                      <span className="font-display text-sm font-semibold">All Active Chats</span>
                      <p
                        className={cn(
                          'mt-1 text-xs',
                          settings.aiReply.whitelistMode === 'all'
                            ? 'text-zinc-300 dark:text-zinc-600'
                            : 'text-muted-foreground',
                        )}
                      >
                        Allows AI reply drafts in any conversation (still requires manual send review).
                      </p>
                    </div>
                  </button>
                </div>

                {/* Whitelist selection list */}
                {settings.aiReply.whitelistMode === 'selected' && (
                  <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-muted/40 p-4">
                    {/* Header & Stats */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold">Approved Whitelist:</span>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {settings.aiReply.allowedChatIds.length} approved
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={selectAllChats}>
                          Select All Active
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={clearAllChats}>
                          Clear Whitelist
                        </Button>
                      </div>
                    </div>

                    {/* Filter Tabs & Search Bar */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-2">
                        <button
                          type="button"
                          onClick={() => setWhitelistFilter('all')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            whitelistFilter === 'all'
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          All Chats ({chats.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWhitelistFilter('whitelisted')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            whitelistFilter === 'whitelisted'
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          Whitelisted ({chats.filter((c) => isChatWhitelisted(c)).length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setWhitelistFilter('unwhitelisted')}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            whitelistFilter === 'unwhitelisted'
                              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                          )}
                        >
                          Not Whitelisted ({chats.filter((c) => !isChatWhitelisted(c)).length})
                        </button>
                      </div>

                      <div className="relative">
                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={chatSearch}
                          onChange={(e) => setChatSearch(e.target.value)}
                          placeholder="Search chats by name, phone number, or WhatsApp ID…"
                          className="bg-card pl-9 pr-8 text-xs"
                        />
                        {chatSearch && (
                          <button
                            type="button"
                            onClick={() => setChatSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <XIcon className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Chat List */}
                    {filteredChats.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-6 text-center">
                        <p className="text-xs text-muted-foreground">
                          {chatSearch
                            ? `No active chats match "${chatSearch}".`
                            : 'No chats match the selected filter.'}
                        </p>
                        {chatSearch.trim() && (
                          <div className="mt-3 flex flex-col items-center gap-2">
                            <p className="text-[11px] text-muted-foreground">
                              Want to approve this number or ID directly?
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs text-emerald-700 border-emerald-500/30 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/20"
                              onClick={() => {
                                addAllowedId(chatSearch);
                                setChatSearch('');
                              }}
                            >
                              <PlusIcon className="size-3.5" />
                              Whitelist &ldquo;{chatSearch.trim()}&rdquo; Directly
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="nice-scroll flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                        {filteredChats.map((c) => {
                          const isAllowed = isChatWhitelisted(c);
                          const displayNumber = getChatDisplayNumber(c);

                          return (
                            <label
                              key={c.id}
                              className={cn(
                                'flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs transition-colors',
                                isAllowed
                                  ? 'border-emerald-500/40 bg-emerald-500/5 dark:bg-emerald-500/10'
                                  : 'border-border bg-card hover:bg-accent/70',
                              )}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={() => toggleChatAllowed(c.id)}
                                  className="size-4 rounded border-border text-zinc-900 focus:ring-zinc-900"
                                />
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate font-semibold text-foreground">{c.name}</span>
                                    <Badge variant="secondary" className="text-[10px] shrink-0">
                                      {c.isGroup ? 'Group' : 'Direct'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    {displayNumber && (
                                      <span className="flex items-center gap-1">
                                        <PhoneIcon className="size-2.5 shrink-0 opacity-70" />
                                        {displayNumber}
                                      </span>
                                    )}
                                    {c.isGroup && typeof c.participantCount === 'number' && (
                                      <span>{c.participantCount} members</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isAllowed && (
                                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  <CheckIcon className="size-3.5" /> Whitelisted
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct Add Form */}
                    <div className="mt-1 rounded-xl border border-border bg-card/60 p-3">
                      <div className="mb-2">
                        <span className="text-xs font-semibold text-foreground">
                          Add Approved Number or Chat ID Directly
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Pre-whitelist a contact phone number (e.g. +91 98765 43210 or 9876543210) or group ID.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={manualIdInput}
                          onChange={(e) => setManualIdInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addAllowedId(manualIdInput);
                            }
                          }}
                          placeholder="e.g. +91 98765 43210 or 12036302839@g.us"
                          className="bg-card text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          disabled={!manualIdInput.trim()}
                          onClick={() => addAllowedId(manualIdInput)}
                          className="gap-1.5 shrink-0 text-xs"
                        >
                          <PlusIcon className="size-3.5" /> Add
                        </Button>
                      </div>

                      {/* Custom Allowed IDs Pill List */}
                      {customAllowedIds.length > 0 && (
                        <div className="mt-3 border-t border-border/60 pt-2.5">
                          <span className="text-[11px] font-medium text-muted-foreground">
                            Custom Added Numbers & IDs ({customAllowedIds.length}):
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {customAllowedIds.map((id) => (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="flex items-center gap-1.5 py-1 px-2 text-xs font-mono"
                              >
                                <PhoneIcon className="size-3 text-muted-foreground" />
                                <span>{id}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAllowedId(id)}
                                  className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
                                  title="Remove from whitelist"
                                >
                                  <XIcon className="size-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bottom Save bar */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-soft">
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : <SaveIcon className="size-4" />}
          {saving ? 'Saving changes…' : 'Save Preferences'}
        </Button>
      </div>
    </div>
  );
}
