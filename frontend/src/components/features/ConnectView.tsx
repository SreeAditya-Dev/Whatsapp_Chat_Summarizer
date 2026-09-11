import { CheckCircle2Icon, Loader2Icon, QrCodeIcon, RefreshCwIcon, SmartphoneIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusPill } from '@/components/features/StatusPill';
import type { WhatsAppStatus } from '@/lib/types';

interface Props {
  wa: WhatsAppStatus | null;
  waLoading: boolean;
  waError: string | null;
  qrDataUrl: string | null;
  qrLoading: boolean;
  onReload: () => void;
}

export function ConnectView({ wa, waLoading, waError, qrDataUrl, qrLoading, onReload }: Props) {
  const connected = wa?.state === 'READY' || wa?.state === 'AUTHENTICATED';

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle>Link WhatsApp</CardTitle>
              <CardDescription>Scan once — the session persists on your server.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={onReload}>
              <RefreshCwIcon data-icon="inline-start" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {waLoading || qrLoading ? (
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="size-60 rounded-2xl" />
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" /> Preparing secure code…
              </p>
            </div>
          ) : waError ? (
            <Alert variant="danger" className="w-full">
              <AlertTitle>Connection check failed</AlertTitle>
              <AlertDescription>{waError}. Is the backend running on :3000?</AlertDescription>
            </Alert>
          ) : connected ? (
            <div className="flex w-full animate-scale-in flex-col items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-50/90 px-6 py-10 text-center dark:border-emerald-500/20 dark:bg-emerald-950/20">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-sm dark:bg-emerald-600">
                <CheckCircle2Icon className="size-7" />
              </span>
              <div className="space-y-1">
                <p className="font-display text-lg font-bold text-emerald-950 dark:text-emerald-100">
                  WhatsApp is connected
                </p>
                <p className="max-w-md text-sm font-medium text-emerald-900/90 dark:text-emerald-200/90">
                  {wa?.pushname || wa?.phoneNumber ? (
                    <>
                      Linked as <strong className="font-semibold text-emerald-950 dark:text-emerald-50">{wa?.pushname ?? ''}</strong>
                      {wa?.phoneNumber ? ` (${wa.phoneNumber})` : ''}. Summaries are ready.
                    </>
                  ) : (
                    'Linked and ready. Summaries are ready.'
                  )}
                </p>
              </div>
              <StatusPill
                state={wa?.state}
                className="border-emerald-600/30 bg-white font-semibold text-emerald-800 shadow-xs dark:border-emerald-500/30 dark:bg-zinc-900 dark:text-emerald-300"
              />
            </div>
          ) : qrDataUrl ? (
            <div className="flex animate-scale-in flex-col items-center gap-3">
              <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
                <img
                  src={qrDataUrl}
                  alt="WhatsApp pairing QR code"
                  className="size-60 rounded-xl object-contain sm:size-72"
                />
              </div>
              <div className="flex items-center gap-2">
                <StatusPill state={wa?.state} />
                <span className="text-[13px] text-muted-foreground">Code refreshes automatically</span>
              </div>
            </div>
          ) : (
            <Alert className="w-full">
              <AlertTitle>Waiting for QR code</AlertTitle>
              <AlertDescription>
                The phone link code is generating. It usually appears within a few seconds — hit
                refresh if it takes longer.
              </AlertDescription>
            </Alert>
          )}

          {!connected && !waLoading ? (
            <ol className="grid w-full gap-2.5 sm:grid-cols-3">
              {[
                { icon: SmartphoneIcon, t: 'Open WhatsApp', d: 'On your phone' },
                { icon: QrCodeIcon, t: 'Linked devices', d: 'Tap “Link a device”' },
                { icon: CheckCircle2Icon, t: 'Scan the code', d: 'You’re done' },
              ].map((s) => (
                <li key={s.t} className="flex flex-col gap-1.5 rounded-2xl bg-stone-50 p-4">
                  <s.icon className="size-5 text-stone-700" />
                  <p className="text-sm font-semibold">{s.t}</p>
                  <p className="text-[13px] text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Connection</CardTitle>
            <CardDescription>Live state from your server.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">State</span>
              <StatusPill state={wa?.state ?? '…'} />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Account</span>
              <span className="truncate font-medium">{wa?.pushname ?? wa?.phoneNumber ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{wa?.phoneNumber ?? '—'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Good to know</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted-foreground">
            <p>Keep your phone online for the first pairing. Afterwards the session file persists.</p>
            <p>Only chats with readable text are summarized — media is skipped by design.</p>
            <p>Summaries are rate-limited to protect your AI budget (15/min).</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
