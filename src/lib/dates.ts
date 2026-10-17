// Calendar dates as 'YYYY-MM-DD' strings. "Today" is in APP_TIMEZONE (OQ-19).

export function todayISO(timeZone = process.env.APP_TIMEZONE || "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** First day of the month after `isoDate`. */
export function firstOfNextMonth(isoDate: string): string {
  const { y, m } = parts(isoDate);
  return iso(new Date(Date.UTC(y, m, 1)));
}

/** The day before the same date a year later: a one-year lease from `start`. */
export function oneYearLeaseEnd(start: string): string {
  const { y, m, d } = parts(start);
  return iso(new Date(Date.UTC(y + 1, m - 1, d - 1)));
}

/** '2026-11-01' → '2026-11', the period label used across the app. */
export function periodLabel(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** '2026-11' or '2026-11-01' → 'November 2026'. */
export function monthName(isoDate: string): string {
  const { y, m } = parts(isoDate.length === 7 ? `${isoDate}-01` : isoDate);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** A timestamp as 'YYYY-MM-DD HH:mm' in APP_TIMEZONE (NFR-05: when a row was recorded). */
export function formatTimestamp(ts: string, timeZone = process.env.APP_TIMEZONE || "UTC"): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ts))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}
