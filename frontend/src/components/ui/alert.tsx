import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative flex w-full items-start gap-3 rounded-2xl border p-4 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-foreground',
        info: 'border-stone-300 bg-stone-100 text-stone-900',
        success: 'border-emerald-800/20 bg-emerald-50 text-emerald-950',
        warning: 'border-amber-500/30 bg-amber-50 text-amber-950',
        danger: 'border-red-600/20 bg-red-50 text-red-950',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

const icons = {
  default: InfoIcon,
  info: InfoIcon,
  success: CheckCircle2Icon,
  warning: AlertCircleIcon,
  danger: AlertCircleIcon,
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

function Alert({ className, variant = 'default', children, ...props }: AlertProps) {
  const Icon = icons[variant ?? 'default'];
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1 leading-relaxed">{children}</div>
    </div>
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[13px] opacity-90', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
