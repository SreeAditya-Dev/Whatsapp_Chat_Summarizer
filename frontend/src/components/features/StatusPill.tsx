import { cn } from '@/lib/utils';
import type { WhatsAppState } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const STATE_META: Record<string, { label: string; variant: 'success' | 'warning' | 'muted' | 'danger'; dot: string }> = {
  READY: { label: 'Connected', variant: 'success', dot: 'bg-emerald-500' },
  AUTHENTICATED: { label: 'Connected', variant: 'success', dot: 'bg-emerald-500' },
  QR_READY: { label: 'Scan to connect', variant: 'warning', dot: 'bg-amber-500' },
  INITIALIZING: { label: 'Starting', variant: 'muted', dot: 'bg-stone-400' },
  DISCONNECTED: { label: 'Offline', variant: 'muted', dot: 'bg-stone-400' },
};

export function StatusPill({ state, className }: { state?: WhatsAppState | string; className?: string }) {
  const meta = STATE_META[String(state ?? '').toUpperCase()] ?? {
    label: String(state ?? 'Unknown'),
    variant: 'muted' as const,
    dot: 'bg-stone-400',
  };
  return (
    <Badge variant={meta.variant === 'success' ? 'success' : meta.variant === 'warning' ? 'warning' : 'muted'} className={cn('gap-1.5 py-1 pl-2 pr-2.5', className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
