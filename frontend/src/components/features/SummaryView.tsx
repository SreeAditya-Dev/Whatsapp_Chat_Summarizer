import {
  AlertTriangleIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
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
    <div className="flex flex-col gap-2.5">
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

export function SummaryView({ summary }: { summary: ChatSummary }) {
  // AI payloads are untrusted — normalize so a null array can never crash the view.
  const keyTopics = Array.isArray(summary.keyTopics) ? summary.keyTopics : [];
  const actionItems = Array.isArray(summary.actionItems) ? summary.actionItems : [];
  const decisions = Array.isArray(summary.decisions) ? summary.decisions : [];
  const linksAndDates = Array.isArray(summary.importantLinksAndDates)
    ? summary.importantLinksAndDates
    : [];

  return (
    <div className="flex animate-fade-up flex-col gap-4">
      {/* TL;DR — light premium card */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-secondary/50 pb-4">
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
          <CardTitle className="text-balance pt-1 text-[17px] font-bold leading-snug sm:text-lg">
            {summary.tldr}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
            {summary.timeRange?.start ? <span>From {summary.timeRange.start}</span> : null}
            {summary.timeRange?.end ? <span>To {summary.timeRange.end}</span> : null}
            <span>{summary.generatedAt ? new Date(summary.generatedAt).toLocaleString() : ''}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key topics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Section icon={MessagesSquareIcon} title="Discussion" count={keyTopics.length}>
            {keyTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No distinct topics detected.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {keyTopics.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-zinc-400" />
                    {t}
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
              <ul className="flex flex-col gap-2">
                {actionItems.map((a, i) => (
                  <li key={i} className="rounded-xl border border-border p-3.5">
                    <p className="text-sm font-medium leading-relaxed">{a.task}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {a.assignee ? <Badge variant="secondary">{a.assignee}</Badge> : null}
                      {a.dueDate ? (
                        <Badge variant="outline" className="gap-1">
                          <CalendarClockIcon data-icon="inline-start" className="size-3" />
                          {a.dueDate}
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Separator />
          <Section icon={CheckCircle2Icon} title="Decisions" count={decisions.length}>
            {decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No firm decisions recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                    {d}
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
              <ul className="flex flex-col gap-1.5">
                {linksAndDates.map((l, i) => (
                  <li key={i} className="truncate text-sm text-zinc-700" title={l}>
                    {l}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          {summary.unreadCount > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-950">
              <AlertTriangleIcon className="size-4 shrink-0" />
              Based on {summary.unreadCount} unread
              {summary.previousContextCount ? ` + ${summary.previousContextCount} context` : ''} messages.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
