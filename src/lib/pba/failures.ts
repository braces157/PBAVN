/**
 * Records which upstream feeds failed during the current render.
 *
 * Callers turn a failed call into `[]`, so without this "the association is
 * unreachable" renders exactly like "there is no data" and the UI prints a
 * confident, wrong empty state.
 *
 * Two constraints shape this module:
 *
 *  - It must be importable from a component that webpack also bundles for the
 *    client (a shared `PageHeader`), so it cannot statically import a Node
 *    built-in. `node:async_hooks` is resolved lazily, and the store degrades to a
 *    no-op wherever `AsyncLocalStorage` is unavailable.
 *  - `cache()` cannot be used: the transport also runs outside a React render
 *    (route handlers), where `cache()` hands back a fresh value on every call and
 *    the record would never accumulate.
 */

interface Store {
  run<T>(value: string[], fn: () => T): T;
  getStore(): string[] | undefined;
}

let store: Store | null = null;
let resolved = false;

function getStore(): Store | null {
  if (resolved) return store;
  resolved = true;
  try {
    // Evaluated indirectly so the bundler never tries to resolve the built-in.
    const loader = new Function("m", "return import(m)") as (m: string) => Promise<never>;
    void loader;
    const mod = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process
      ?.getBuiltinModule?.("node:async_hooks") as { AsyncLocalStorage?: new () => Store } | undefined;
    store = mod?.AsyncLocalStorage ? new mod.AsyncLocalStorage() : null;
  } catch {
    store = null;
  }
  return store;
}

/** Run a unit of work with its own failure record. The store follows awaited work. */
export function trackFailures<T>(fn: () => Promise<T>): Promise<T> {
  const active = getStore();
  if (!active) return fn();
  return active.run([], fn);
}

export function recordFailure(url: string): void {
  const active = getStore();
  if (!active) return;
  active.getStore()?.push(url);
}

export function getRequestFailures(): string[] {
  const active = getStore();
  if (!active) return [];
  return active.getStore() ?? [];
}
