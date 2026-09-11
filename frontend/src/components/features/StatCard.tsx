import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  className?: string;
}

export function StatCard({ label, value, hint, icon: Icon, className }: StatCardProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="font-display truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="truncate text-[13px] text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-stone-700">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}
