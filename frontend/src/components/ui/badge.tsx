import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-foreground',
        success: 'border-transparent bg-emerald-800 text-white',
        warning: 'border-transparent bg-amber-400 text-stone-900',
        danger: 'border-transparent bg-red-600 text-white',
        muted: 'border-transparent bg-stone-200/80 text-stone-700',
        unread: 'border-transparent bg-stone-900 text-white',
      },
    },
    defaultVariants: { variant: 'secondary' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
