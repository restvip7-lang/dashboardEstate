import type { ISODate } from '../data/types.ts';
import { daysBetween } from './dates.ts';

export interface Due {
  due: ISODate;
  amountEur: number;
}

export interface OpenDue {
  due: ISODate;
  outstandingEur: number;
  daysLate: number;
}

/**
 * Applies money received (oldest dues first) to a schedule and returns what is
 * still open as of `asOf`. Used both for agency commission and buyer
 * installments, so partial payments are handled the same way everywhere.
 */
export function openDues(schedule: Due[], paidEur: number, asOf: ISODate): OpenDue[] {
  let remaining = paidEur;
  const result: OpenDue[] = [];
  for (const item of [...schedule].sort((a, b) => a.due.localeCompare(b.due))) {
    const covered = Math.min(Math.max(remaining, 0), item.amountEur);
    remaining -= covered;
    const outstanding = item.amountEur - covered;
    if (outstanding > 0.005) {
      result.push({ due: item.due, outstandingEur: outstanding, daysLate: daysBetween(item.due, asOf) });
    }
  }
  return result;
}
