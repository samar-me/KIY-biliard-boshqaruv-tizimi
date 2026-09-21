export function formatSom(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  return `${new Intl.NumberFormat("uz-UZ").format(v)}\u00a0so'm`;
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((x) => String(x).padStart(2, "0")).join(":");
}

export function elapsedMs(startedAt: string, now: number): number {
  const t = Date.parse(startedAt);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, now - t);
}

/** First 15s free so a mis-tap can be cancelled. Then per-minute ceiling. */
export function timeCharge(
  hourlyRate: number,
  startedAt: string,
  now: number,
): number {
  const ms = elapsedMs(startedAt, now);
  if (ms < 15_000) return 0;
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return Math.round((minutes * hourlyRate) / 60);
}

export function tashkentDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function tashkentClock(date = new Date()): string {
  return new Intl.DateTimeFormat("uz-UZ", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function dayBounds(day: string): { start: string; end: string } {
  const start = new Date(`${day}T00:00:00+05:00`);
  const end = new Date(`${day}T24:00:00+05:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

const UZ_MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export function formatDayLabel(day: string): string {
  const parts = day.split("-").map(Number);
  const month = parts[1];
  const date = parts[2];
  if (!month || !date) return day;
  return `${date}-${UZ_MONTHS[month - 1]}`;
}
