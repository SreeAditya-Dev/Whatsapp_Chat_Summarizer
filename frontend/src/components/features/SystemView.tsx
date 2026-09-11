import { useState } from 'react';
import { CheckIcon, CopyIcon, CpuIcon, DatabaseIcon, ServerIcon, ShieldCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/features/StatusPill';
import { formatUptime } from '@/lib/format';
import type { HealthData, WhatsAppStatus } from '@/lib/types';

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/health', desc: 'Service vitals, model, uptime' },
  { method: 'GET', path: '/api/v1/whatsapp/status', desc: 'Connection state + account' },
  { method: 'GET', path: '/api/v1/whatsapp/qr', desc: 'Pairing code payload' },
  { method: 'GET', path: '/api/v1/chats?filter=all', desc: 'Paginated chat discovery' },
  { method: 'GET', path: '/api/v1/chats/unread', desc: 'Only chats needing you' },
  { method: 'POST', path: '/api/v1/summarize', desc: '{ chatId, messageLimit?, model? }' },
];

export function SystemView({
  health,
  healthLoading,
  wa,
}: {
  health: HealthData | null;
  healthLoading: boolean;
  wa: WhatsAppStatus | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
              <ServerIcon className="size-5 text-stone-700" />
            </span>
            <div>
              <CardTitle>Service health</CardTitle>
              <CardDescription>Backend vitals, refreshed every 15s.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading && !health ? (
            <div className="flex flex-col gap-2.5">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !health ? (
            <p className="text-sm text-muted-foreground">Backend unreachable. Start it with `npm run dev` on :3000.</p>
          ) : (
            <dl className="flex flex-col gap-1 text-sm">
              {[
                ['Status', <Badge key="s" variant="success">{health.status}</Badge>],
                ['Version', health.version],
                ['Environment', <Badge key="e" variant="secondary">{health.environment}</Badge>],
                ['Uptime', formatUptime(health.uptimeSeconds)],
                ['Memory', `${health.memoryUsageMb} MB`],
                ['WhatsApp', <StatusPill key="w" state={health.services.whatsapp.state} />],
                ['Account', health.services.whatsapp.account ?? '—'],
                ['AI provider', health.services.ai.provider],
                ['AI model', <code key="m" className="rounded-lg bg-secondary px-2 py-0.5 text-[13px]">{health.services.ai.model}</code>],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 odd:bg-stone-50">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="truncate font-medium">{v as React.ReactNode}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                <DatabaseIcon className="size-5 text-stone-700" />
              </span>
              <div>
                <CardTitle>API reference</CardTitle>
                <CardDescription>Same envelope everywhere: success + data.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {ENDPOINTS.map((e) => (
              <div key={e.path} className="flex items-center gap-2.5 rounded-xl border border-border p-2.5">
                <Badge variant={e.method === 'GET' ? 'secondary' : 'default'} className="shrink-0">
                  {e.method}
                </Badge>
                <div className="min-w-0 flex-1">
                  <code className="block truncate text-[13px] font-medium">{e.path}</code>
                  <p className="truncate text-xs text-muted-foreground">{e.desc}</p>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => void copy(e.path)} aria-label={`Copy ${e.path}`}>
                  {copied === e.path ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary">
                <ShieldCheckIcon className="size-5 text-stone-700" />
              </span>
              <div>
                <CardTitle>Guardrails</CardTitle>
                <CardDescription>Calm by design.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2">
              <CpuIcon className="mt-0.5 size-4 shrink-0" />
              15 summaries / minute, 200 general requests / 15 min. Media skipped, text only.
            </p>
            <Separator />
            <p>
              Session state: <StatusPill state={wa?.state ?? '…'} className="ml-1 align-middle" />
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
