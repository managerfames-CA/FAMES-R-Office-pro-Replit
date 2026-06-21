import { useCallback, useEffect, useState } from 'react';

export function useAsyncData<T>(loader: () => Promise<T>, dependencies: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await loader());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => { void load(); }, [load]);
  return { data, loading, error, reload: load };
}
