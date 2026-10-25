import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: boolean;
}

/**
 * Small loader hook: runs `loader` whenever `deps` change and exposes
 * loading / error / data plus a manual `reload`. Errors are surfaced as a flag
 * so screens can show a translated message and a retry button.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ data: prev.data, loading: true, error: false }));

    loader()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: false });
      })
      .catch((error: unknown) => {
        console.error('MaaSetu: data load failed', error);
        if (!cancelled) setState({ data: null, loading: false, error: true });
      });

    return () => {
      cancelled = true;
    };
    // `loader` is intentionally excluded: deps describe its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...state, reload };
}
