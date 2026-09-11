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
  return (
    <div className="flex animate-fade-up flex-col gap-5">
      {/* TL;DR hero — solid ink, no gradient */}
      <Card className="overflow-hidden border-stone-900 bg-stone-900 text-stone-50">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-white/10 text-white">
              <SparklesIcon data-icon="inline-start" className="size-3.5" />
              TL;DR
            </Badge>
            <Badge variant={urgencyVariant(summary.urgencyLevel)}>{summary.urgencyLevel}</Badge>
            <span className="ml-auto text-xs text-stone-400">
              {summary.totalMessagesAnalyzed} messages analyzed
            </span>
          </div>
          <CardTitle className="text-balance text-lg font-semibold leading-snug sm:text-xl">
            {summary.tldr}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-stone-300">
            {summary.timeRange?.start ? <span>From {summary.timeRange.start}</span> : null}
            {summary.timeRange?.end ? <span>To {summary.timeRange.end}</span> : null}
            <span>{new Date(summary.generatedAt).toLocaleString()}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key topics</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Section icon={MessagesSquareIcon} title="Discussion" count={summary.keyTopics.length}>
            {summary.keyTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground">No distinct topics detected.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.keyTopics.map((t, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm leading-relaxed"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-stone-400" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Separator />
          <Section icon={ListChecksIcon} title="Action items" count={summary.actionItems.length}>
            {summary.actionItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing assigned — inbox zero energy.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.actionItems.map((a, i) => (
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
          <Section icon={CheckCircle2Icon} title="Decisions" count={summary.decisions.length}>
            {summary.decisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No firm decisions recorded.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {summary.decisions.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-800" />
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
            count={summary.importantLinksAndDates.length}
          >
            {summary.importantLinksAndDates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No links or dates flagged.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {summary.importantLinksAndDates.map((l, i) => (
                  <li key={i} className="truncate text-sm text-stone-700" title={l}>
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
