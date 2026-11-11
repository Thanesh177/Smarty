// Give the opening screen a chance to paint and start its own requests before
// downloading resources for other pages. Explicit actions do not use this.
export function scheduleStartupIdle(run, { delay = 1200, timeout = 1200, host = window } = {}) {
  let cancelled = false;
  let idle = null;
  const timer = host.setTimeout(() => {
    if (cancelled) return;
    const invoke = () => { if (!cancelled) run(); };
    if (typeof host.requestIdleCallback === 'function') {
      idle = host.requestIdleCallback(invoke, { timeout });
    } else {
      invoke();
    }
  }, delay);
  return () => {
    cancelled = true;
    host.clearTimeout(timer);
    if (idle !== null) host.cancelIdleCallback?.(idle);
  };
}
