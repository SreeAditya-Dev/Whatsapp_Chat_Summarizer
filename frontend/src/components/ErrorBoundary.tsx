import React from 'react';
import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface BoundaryState {
  hasError: boolean;
  message: string;
}

/**
 * Catches render crashes (e.g. malformed AI payloads) so one bad view
 * can never blank-screen the whole dashboard.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): BoundaryState {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : 'Something went wrong rendering this view.',
    };
  }

  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.error('Dashboard view crashed:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <AlertTriangleIcon className="size-5" />
            </span>
            <p className="font-display text-[15px] font-semibold">This view ran into a problem</p>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {this.state.message}
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => this.setState({ hasError: false, message: '' })}
              >
                Try again
              </Button>
              <Button onClick={() => window.location.reload()}>
                <RotateCcwIcon data-icon="inline-start" />
                Reload page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
