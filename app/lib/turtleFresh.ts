// /api/turtles is edge-cached (s-maxage=300). After a visitor submits a
// doodle, their own turtle must still show up immediately — in the /connect
// gallery AND in the site-wide inked backdrop — so submissions open a short
// window during which turtle fetches cache-bust past the edge.

const KEY = "turtles-fresh-until";
const WINDOW_MS = 5 * 60_000; // matches the route's s-maxage

export function markTurtlesFresh() {
  try {
    sessionStorage.setItem(KEY, String(Date.now() + WINDOW_MS));
  } catch {
    /* storage unavailable — the turtle:new listeners still refetch */
  }
}

/** The turtles endpoint URL, cache-busted while a fresh window is open. */
export function turtlesUrl(base: string): string {
  try {
    const until = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() < until) {
      return `${base}${base.includes("?") ? "&" : "?"}fresh=${Date.now()}`;
    }
  } catch {}
  return base;
}
