import { useCallback, useState } from 'react';

/**
 * useMutation — standardises async form submission across the app.
 *
 * Handles the busy / error / result lifecycle that every action page wired up
 * by hand (and surfaced inconsistently). Server "problem+json" errors expose
 * `.detail`; we prefer that over the generic message, matching the existing
 * behaviour in api/client.js.
 *
 * @param {(vars: any) => Promise<any>} fn — the async operation to run.
 * @returns {{ run, busy, error, result, reset }}
 */
export function useMutation(fn) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  const run = useCallback(
    async (vars) => {
      setBusy(true);
      setError(null);
      setResult(null);
      try {
        const r = await fn(vars);
        setResult(r);
        return r;
      } catch (err) {
        setError(err?.detail || err?.message || 'Request failed');
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [fn],
  );

  return { run, busy, error, result, reset };
}
