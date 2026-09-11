import React from 'react';
import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  FileTextIcon,
  Link2Icon,
  ListChecksIcon,
  MessagesSquareIcon,
  SparklesIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { ChatSummary, UrgencyLevel } from '@/lib/types';

function urgencyVariant(u: UrgencyLevel): 'muted' | 'secondary' | 'warning' | 'danger' | 'success' {
  switch (u) {
    case 'CRITICAL':
      return 'danger';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'secondary';
    default:
      return 'success';
  }
}

/**
 * Formats inline markdown (links [text](url), raw URLs, **bold**, `code`) into React elements
 * with word-break and overflow containment to prevent horizontal page blowout.
 */
function FormattedInlineText({ text }: { text: string }) {
  if (!text) return null;

  // Regex matches:
  // 1. Markdown link: [Label](https://url)
  // 2. Bare URL: https://... or http://...
  // 3. Bold: **text**
  // 4. Inline code: `text`
  const tokenRegex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<)]+)|(\*\*([^*]+)\*\*)|(`([^`]+)`))/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    if (match[2] && match[3]) {
      // [Label](url)
      const label = match[2];
      const url = match[3];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-80 break-all"
        >
          <span>{label}</span>
          <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
        </a>,
      );
    } else if (match[4]) {
      // Bare URL
      const url = match[4];
      parts.push(
        <a
          key={match.index}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-80 break-all"
        >
          <span className="break-all">{url}</span>
          <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
        </a>,
      );
    } else if (match[6]) {
      // **bold**
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {match[6]}
        </strong>,
      );
    } else if (match[8]) {
      // `code`
      parts.push(
        <code
          key={match.index}
          className="rounded bg-secondary/80 px-1 py-0.5 text-xs font-mono break-all"
        >
          {match[8]}
        </code>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <span className="break-words [overflow-wrap:anywhere]">{parts}</span>;
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof FileTextIcon;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-stone-700">
          <Icon className="size-4" />
        </span>
        <h4 className="text-sm font-semibold">{title}</h4>
        {typeof count === 'number' ? (
          <Badge variant="muted" className="ml-auto">
            {count}
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function renderTopic(item: unknown): React.ReactNode {
  if (typeof item === 'string' || typeof item === 'number') {
    return (
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-foreground">
        <FormattedInlineText text={String(item)} />
      </div>
    );
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const topic = obj.topic || obj.title || obj.name;
    const context = obj.context || obj.description || obj.details;

    if (topic) {
      return (
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground break-words [overflow-wrap:anywhere]">
            <FormattedInlineText text={String(topic)} />
          </span>
          {context ? (
            <span className="text-xs leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
              <FormattedInlineText text={String(context)} />
            </span>
          ) : null}
        </div>
      );
    }

    const entries = Object.entries(obj).filter(
      ([_, v]) => v !== null && v !== undefined && typeof v !== 'object',
    );
    if (entries.length > 0) {
      return (
        <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-foreground">
          <FormattedInlineText text={entries.map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        </div>
      );
    }
    return (
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-foreground">
        {JSON.stringify(item)}
      </div>
    );
  }
  return null;
}

function renderDecision(item: unknown): React.ReactNode {
  if (typeof item === 'string' || typeof item === 'number') {
    return (
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
        <FormattedInlineText text={String(item)} />
      </div>
    );
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const decision = obj.decision || obj.title || obj.outcome;
    const context = obj.context || obj.rationale || obj.reason;

    if (decision) {
      return (
        <div className="flex flex-col gap-0.5 min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          <span className="font-medium text-foreground break-words [overflow-wrap:anywhere]">
            <FormattedInlineText text={String(decision)} />
          </span>
          {context ? (
            <span className="text-xs leading-relaxed text-muted-foreground break-words [overflow-wrap:anywhere]">
              <FormattedInlineText text={String(context)} />
            </span>
          ) : null}
        </div>
      );
    }

    const entries = Object.entries(obj).filter(
      ([_, v]) => v !== null && v !== undefined && typeof v !== 'object',
    );
    if (entries.length > 0) {
      return (
        <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          <FormattedInlineText text={entries.map(([k, v]) => `${k}: ${v}`).join(' · ')} />
        </div>
      );
    }
    return (
      <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
        {JSON.stringify(item)}
      </div>
    );
  }
  return null;
}

function renderLinkOrDate(item: unknown): React.ReactNode {
  if (typeof item === 'string' || typeof item === 'number') {
    return (
      <div className="flex items-start gap-2.5 min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-zinc-700">
        <Link2Icon className="mt-0.5 size-4 shrink-0 text-stone-400" />
        <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          <FormattedInlineText text={String(item)} />
        </div>
      </div>
    );
  }
  if (item && typeof item === 'object') {
    const obj = item as Record<string, unknown>;
    const url = (obj.link || obj.url) as string | undefined;
    const label = (obj.title || obj.description || obj.date || url) as string | undefined;
    const date = obj.date as string | undefined;

    return (
      <div className="flex items-start gap-2.5 min-w-0 flex-1 break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-zinc-700">
        <Link2Icon className="mt-0.5 size-4 shrink-0 text-stone-400" />
        <div className="min-w-0 flex-1 break-words [overflow-wrap:anywhere]">
          {url ? (
            <div className="flex flex-wrap items-center gap-1.5 min-w-0 break-words [overflow-wrap:anywhere]">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 font-semibold text-primary underline underline-offset-2 hover:opacity-80 break-all"
                title={url}
              >
                <span>{label || url}</span>
                <ExternalLinkIcon className="size-3 shrink-0 opacity-70" />
              </a>
              {date && label !== date ? (
                <span className="shrink-0 text-xs text-muted-foreground">({String(date)})</span>
              ) : null}
            </div>
          ) : (
            <div>
              <span className="font-semibold text-foreground">{String(label || date)}</span>
              {date && label && label !== date ? ` · ${String(date)}` : ''}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

export function SummaryView({ summary }: { summary: ChatSummary }) {
  // AI payloads are untrusted — normalize so null or unexpected shapes can never crash the view.
  const keyTopics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];
  const actionItems = Array.isArray(summary.actionItems) ? summary.actionItems : [];
  const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
  const linksAndDates = Array.isArray(summary.importantLinksAndDates)
    ? summary.importantLinksAndDates
    : [];

  const tldrText: string =
    typeof summary.tldr === 'string'
      ? summary.tldr
      : typeof summary.tldr === 'object' && summary.tldr !== null
        ? String(
            (summary.tldr as Record<string, unknown>).summary ||
            (summary.tldr as Record<string, unknown>).tldr ||
            JSON.stringify(summary.tldr)
          )
        : String(summary.tldr || '');

  return (
    <div className="flex animate-fade-up flex-col gap-4 min-w-0 w-full overflow-hidden">
      {/* TL;DR — light premium card */}
      <Card className="overflow-hidden min-w-0">
        <CardHeader className="border-b border-border bg-secondary/50 pb-4 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
              <SparklesIcon className="size-3.5" />
              TL;DR
            </span>
            <Badge variant={urgencyVariant(summary.urgencyLevel)}>{summary.urgencyLevel}</Badge>
            <span className="ml-auto text-xs text-muted-foreground">
              {summary.totalMessagesAnalyzed} messages analyzed
            </span>
          </div>
          <CardTitle className="pt-1 text-[17px] font-bold leading-snug sm:text-lg break-words [overflow-wrap:anywhere]">
            <FormattedInlineText text={tldrText} />
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 min-w-0">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground break-words">
            {summary.timeRange?.start ? <span>From {summary.timeRange.start}</span> : null}
            {summary.timeRange?.end ? <span>To {summary.timeRange.end}</span> : null}
            <span>{summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : ''}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="min-w-0">
          <CardTitle>Key topics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 min-w-0">
          <Section icon={MessagesSquareIcon} title="Discussion" count={keyTopics.length}>
            {keyTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No distinct topics detected.</p>
            ) : (
              <ul className="flex flex-col gap-2 min-w-0">
                {keyTopics.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm leading-relaxed min-w-0 break-words"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-400" />
                    {renderTopic(t)}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Separator />
          <Section icon={ListChecksIcon} title="Action items" count={actionItems.length}>
            {actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing assigned — inbox zero energy.</p>
            ) : (
              <ul className="flex flex-col gap-2 min-w-0">
                {actionItems.map((a, i) => {
                  const isString = typeof a === 'string';
                  const taskText = isString
                    ? (a as string)
                    : typeof a.task === 'string'
                      ? a.task
                      : a.task && typeof a.task === 'object'
                        ? ((a.task as Record<string, unknown>).task ||
                           (a.task as Record<string, unknown>).title ||
                           JSON.stringify(a.task))
                        : ((a as Record<string, unknown>).action ||
                           (a as Record<string, unknown>).description ||
                           JSON.stringify(a));

                  const assignee = !isString ? a.assignee || (a as Record<string, unknown>).owner : undefined;
                  const dueDate = !isString
                    ? a.dueDate ||
                      (a as Record<string, unknown>).deadline ||
                      (a as Record<string, unknown>).due
                    : undefined;

                  return (
                    <li key={i} className="rounded-xl border border-border p-3.5 min-w-0 break-words">
                      <p className="text-sm font-medium leading-relaxed break-words [overflow-wrap:anywhere]">
                        <FormattedInlineText text={String(taskText)} />
                      </p>
                      {assignee || dueDate ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 min-w-0">
                          {assignee ? (
                            <Badge variant="secondary" className="max-w-full truncate">
                              {String(assignee)}
                            </Badge>
                          ) : null}
                          {dueDate ? (
                            <Badge variant="outline" className="gap-1 max-w-full truncate">
                              <CalendarClockIcon data-icon="inline-start" className="size-3 shrink-0" />
                              <span className="truncate">{String(dueDate)}</span>
                            </Badge>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
          <Separator />
          <Section icon={CheckCircle2Icon} title="Decisions" count={decisions.length}>
            {decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No firm decisions recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2 min-w-0">
                {decisions.map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm leading-relaxed min-w-0 break-words"
                  >
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {renderDecision(d)}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Separator />
          <Section
            icon={Link2Icon}
            title="Links & dates"
            count={linksAndDates.length}
          >
            {linksAndDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links or dates flagged.</p>
            ) : (
              <ul className="flex flex-col gap-2 min-w-0">
                {linksAndDates.map((l, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-border/80 bg-secondary/30 p-3 min-w-0 break-words"
                  >
                    {renderLinkOrDate(l)}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {summary.unreadCount > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950 min-w-0 break-words">
              <AlertTriangleIcon className="size-4 shrink-0" />
              <span>
                Based on {summary.unreadCount} unread
                {summary.previousContextCount ? ` + ${summary.previousContextCount} context` : ''} messages.
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
