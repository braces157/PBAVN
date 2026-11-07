import { AsyncLocalStorage } from "node:async_hooks";

const failures = new AsyncLocalStorage<string[]>();

/** Track failed upstream reads separately for each request. */
export function trackFailures<T>(fn: () => Promise<T>): Promise<T> {
  return failures.run([], fn);
}

export function recordFailure(url: string): void {
  failures.getStore()?.push(url);
}

export function getRequestFailures(): string[] {
  return failures.getStore() ?? [];
}
