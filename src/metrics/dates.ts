import type { ISODate, Month } from '../data/types.ts';

const DAY_MS = 86_400_000;

function toUtc(date: ISODate): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function monthOf(date: ISODate): Month {
  return date.slice(0, 7);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUtc(toUtc(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function addMonths(month: Month, n: number): Month {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthStart(month: Month): ISODate {
  return `${month}-01`;
}

export function monthEnd(month: Month): ISODate {
  return addDays(monthStart(addMonths(month, 1)), -1);
}

/** The last `n` months ending with the month of `asOf`, oldest first. */
export function lastMonths(asOf: ISODate, n: number): Month[] {
  const current = monthOf(asOf);
  return Array.from({ length: n }, (_, i) => addMonths(current, i - n + 1));
}

function isWorkingDay(ms: number): boolean {
  const wd = new Date(ms).getUTCDay();
  return wd !== 0 && wd !== 6;
}

function workingDays(from: ISODate, to: ISODate): number {
  let count = 0;
  for (let ms = toUtc(from); ms <= toUtc(to); ms += DAY_MS) {
    if (isWorkingDay(ms)) count += 1;
  }
  return count;
}

/**
 * Share of the month's working days (Mon–Fri) elapsed up to and including
 * `asOf`. Public holidays are not excluded yet.
 */
export function elapsedWorkingShare(asOf: ISODate): number {
  const month = monthOf(asOf);
  const total = workingDays(monthStart(month), monthEnd(month));
  return total === 0 ? 1 : workingDays(monthStart(month), asOf) / total;
}

export function isBetween(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to;
}

/** Same day of month in `month`, clamped to its last day (for "same days last month"). */
export function sameDayIn(month: Month, date: ISODate): ISODate {
  const end = monthEnd(month);
  const candidate = `${month}-${date.slice(8, 10)}`;
  return candidate > end ? end : candidate;
}
