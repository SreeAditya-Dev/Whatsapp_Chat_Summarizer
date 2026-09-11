import * as React from 'react';
import { InboxIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

function Empty({ title, description, icon, action, className, ...props }: EmptyProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center',
        className,
      )}
      {...props}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        {icon ?? <InboxIcon className="size-5" />}
      </div>
      <p className="font-display text-[15px] font-semibold">{title}</p>
      {description ? (
        <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      ) : null}
      {action}
    </div>
  );
}

export { Empty };
