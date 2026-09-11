import { useCallback, useEffect, useRef, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => void;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  opts: { intervalMs?: number; enabled?: boolean } = {},
): AsyncState<T> {
  const { intervalMs = 0, enabled = true } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else if (!data) setLoading(true);
      try {
        const result = await fetcherRef.current();
        setData(result);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    load(false);
    if (intervalMs > 0) {
      const id = setInterval(() => load(true), intervalMs);
      return () => clearInterval(id);
    }
  }, [enabled, intervalMs, load]);

  return { data, error, loading, refreshing, reload: () => load(true) };
}
