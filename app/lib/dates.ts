// Tiny date formatters for the reader-facing pages. These reproduce the
// date-fns output the site used to render (SketchbookHome's fmtDate started
// this pattern) — importing date-fns' format/formatDistanceToNow put ~30kB gz
// on every post page for two strings. The writing room and dashboard are
// owner-only and still use date-fns freely.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "16 Jul '26" — what date-fns' format(d, "dd MMM ''yy") gave. */
export function stampDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} '${String(
    d.getFullYear() % 100,
  ).padStart(2, "0")}`;
}

/** "3 days ago" / "about 1 hour ago" — date-fns' formatDistanceToNow(d,
 *  { addSuffix: true }), same wording and thresholds. */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  const minutes = Math.round(seconds / 60);

  let phrase: string;
  if (minutes < 1) phrase = "less than a minute";
  else if (minutes < 45) phrase = minutes === 1 ? "1 minute" : `${minutes} minutes`;
  else if (minutes < 90) phrase = "about 1 hour";
  else if (minutes < 24 * 60) {
    const hours = Math.round(minutes / 60);
    phrase = `about ${hours} ${hours === 1 ? "hour" : "hours"}`;
  } else if (minutes < 42 * 60) phrase = "1 day";
  else if (minutes < 30 * 24 * 60) phrase = `${Math.round(minutes / (24 * 60))} days`;
  else if (minutes < 45 * 24 * 60) phrase = "about 1 month";
  else if (minutes < 60 * 24 * 60) phrase = "about 2 months";
  else {
    // past two months date-fns switches to full calendar months
    const months = calendarMonthsAgo(new Date(then));
    if (months < 12) phrase = `${Math.round(minutes / (30 * 24 * 60))} months`;
    else {
      const years = Math.floor(months / 12);
      const rem = months % 12;
      if (rem < 3) phrase = `about ${years} ${years === 1 ? "year" : "years"}`;
      else if (rem < 9) phrase = `over ${years} ${years === 1 ? "year" : "years"}`;
      else phrase = `almost ${years + 1} years`;
    }
  }
  return `${phrase} ago`;
}

/** Whole calendar months elapsed since `then` (date-fns differenceInMonths). */
function calendarMonthsAgo(then: Date): number {
  const now = new Date();
  let months =
    (now.getFullYear() - then.getFullYear()) * 12 +
    (now.getMonth() - then.getMonth());
  const edge = new Date(then);
  edge.setMonth(then.getMonth() + months);
  if (edge.getTime() > now.getTime()) months -= 1;
  return Math.max(0, months);
}
