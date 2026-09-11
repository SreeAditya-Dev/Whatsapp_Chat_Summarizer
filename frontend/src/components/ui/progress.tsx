import { cn } from '@/lib/utils';

function Progress({ value, className }: { value: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)}>
      <div
        className="h-full rounded-full bg-stone-900 transition-all duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
