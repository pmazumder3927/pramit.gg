// Fire-and-forget product analytics. posthog-js is loaded lazily by
// PostHogProvider (idle callback, up to ~3s after load), so callers must not
// assume it's ready: withPostHog resolves the same module instance from the
// import cache and retries briefly until init has run — a 404 landing or an
// immediate interaction still gets captured once analytics come up.

type PostHogLike = {
  __loaded: boolean;
  capture: (event: string, properties?: Record<string, unknown>) => void;
  setPersonProperties: (properties: Record<string, unknown>) => void;
};

const RETRY_MS = 500;
const MAX_ATTEMPTS = 20; // ~10s window, then give up quietly

export function withPostHog(fn: (posthog: PostHogLike) => void) {
  import("posthog-js")
    .then(({ default: posthog }) => {
      let attempts = 0;
      const run = () => {
        if (posthog.__loaded) {
          fn(posthog as unknown as PostHogLike);
          return;
        }
        if (attempts++ < MAX_ATTEMPTS) setTimeout(run, RETRY_MS);
      };
      run();
    })
    .catch(() => {});
}

export function track(event: string, properties?: Record<string, unknown>) {
  withPostHog((posthog) => posthog.capture(event, properties));
}
