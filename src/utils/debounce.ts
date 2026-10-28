export interface Debounced<TArgs extends unknown[]> {
  (...args: TArgs): void;
  /** Drops the pending call, if any. */
  cancel(): void;
}

/** Delays calls to `fn` until `waitMs` has passed without another call; only the latest arguments are used. */
export function debounce<TArgs extends unknown[]>(fn: (...args: TArgs) => void, waitMs: number): Debounced<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const debounced = (...args: TArgs): void => {
    cancel();
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, waitMs);
  };

  return Object.assign(debounced, {cancel});
}
