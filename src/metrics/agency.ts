import type {
  AgencyDeal,
  AgencyPlan,
  CommissionPayment,
  ISODate,
  Manager,
  ManagerPlan,
  Month,
} from '../data/types.ts';
import { openDues } from './allocate.ts';
import { elapsedWorkingShare, monthOf } from './dates.ts';

/** Days after the due date before unpaid commission counts as overdue. */
export const COMMISSION_GRACE_DAYS = 15;

/**
 * A deal contributes +1 in the month it closed and -1 in the month it was
 * cancelled. Closed months are never rewritten, so history stays stable and
 * every breakdown sums to the same totals.
 */
interface DealEvent {
  deal: AgencyDeal;
  sign: 1 | -1;
}

function eventsInMonth(deals: AgencyDeal[], month: Month, asOf: ISODate): DealEvent[] {
  const events: DealEvent[] = [];
  for (const deal of deals) {
    if (deal.closedAt <= asOf && monthOf(deal.closedAt) === month) events.push({ deal, sign: 1 });
    if (deal.cancelledAt && deal.cancelledAt <= asOf && monthOf(deal.cancelledAt) === month) {
      events.push({ deal, sign: -1 });
    }
  }
  return events;
}

export interface AgencyMonth {
  month: Month;
  accruedEur: number;
  receivedEur: number;
  volumeEur: number;
  deals: number;
  cancellations: number;
  planCommissionEur?: number;
  planDeals?: number;
}

export function agencyMonth(
  deals: AgencyDeal[],
  payments: CommissionPayment[],
  plans: AgencyPlan[],
  month: Month,
  asOf: ISODate,
): AgencyMonth {
  const events = eventsInMonth(deals, month, asOf);
  const plan = plans.find((p) => p.month === month);
  return {
    month,
    accruedEur: sum(events.map((e) => e.sign * e.deal.commissionEur)),
    volumeEur: sum(events.map((e) => e.sign * e.deal.priceEur)),
    deals: sum(events.map((e) => e.sign)),
    cancellations: events.filter((e) => e.sign === -1).length,
    receivedEur: sum(
      payments.filter((p) => p.date <= asOf && monthOf(p.date) === month).map((p) => p.amountEur),
    ),
    planCommissionEur: plan?.commissionEur,
    planDeals: plan?.deals,
  };
}

/** Commission contractually due within the month (non-cancelled deals). */
export function commissionDueInMonth(deals: AgencyDeal[], month: Month, asOf: ISODate): number {
  return sum(
    deals
      .filter((d) => d.closedAt <= asOf && !(d.cancelledAt && d.cancelledAt <= asOf))
      .flatMap((d) => d.commissionSchedule)
      .filter((c) => monthOf(c.due) === month)
      .map((c) => c.amountEur),
  );
}

export type PaceStatus = 'ok' | 'watch' | 'behind';

export interface Pace {
  planEur: number;
  factEur: number;
  /** Fact as a share of the full-month plan. */
  shareOfPlan: number;
  /** What the plan implies by today (plan × elapsed working days). */
  expectedEur: number;
  /** Fact as a share of the expected-by-today level. */
  shareOfExpected: number;
  status: PaceStatus;
}

export function pace(planEur: number, factEur: number, asOf: ISODate): Pace {
  const expectedEur = planEur * elapsedWorkingShare(asOf);
  const shareOfExpected = expectedEur > 0 ? factEur / expectedEur : 1;
  const status: PaceStatus = shareOfExpected >= 1 ? 'ok' : shareOfExpected >= 0.85 ? 'watch' : 'behind';
  return {
    planEur,
    factEur,
    shareOfPlan: planEur > 0 ? factEur / planEur : 0,
    expectedEur,
    shareOfExpected,
    status,
  };
}

export interface OverdueDeal {
  deal: AgencyDeal;
  overdueEur: number;
  daysLate: number;
}

export interface Receivables {
  totalEur: number;
  overdueEur: number;
  notYetDueEur: number;
  overdueDeals: OverdueDeal[];
}

/** Commission accrued and not yet received, split by due date. */
export function commissionReceivables(
  deals: AgencyDeal[],
  payments: CommissionPayment[],
  asOf: ISODate,
  graceDays = COMMISSION_GRACE_DAYS,
): Receivables {
  const paidByDeal = new Map<string, number>();
  for (const p of payments) {
    if (p.date <= asOf) paidByDeal.set(p.dealId, (paidByDeal.get(p.dealId) ?? 0) + p.amountEur);
  }
  let totalEur = 0;
  let overdueEur = 0;
  const overdueDeals: OverdueDeal[] = [];
  for (const deal of deals) {
    if (deal.closedAt > asOf) continue;
    if (deal.cancelledAt && deal.cancelledAt <= asOf) continue;
    const open = openDues(deal.commissionSchedule, paidByDeal.get(deal.id) ?? 0, asOf);
    const late = open.filter((o) => o.daysLate > graceDays);
    totalEur += sum(open.map((o) => o.outstandingEur));
    const dealOverdue = sum(late.map((o) => o.outstandingEur));
    if (dealOverdue > 0) {
      overdueEur += dealOverdue;
      overdueDeals.push({ deal, overdueEur: dealOverdue, daysLate: Math.max(...late.map((o) => o.daysLate)) });
    }
  }
  overdueDeals.sort((a, b) => b.overdueEur - a.overdueEur);
  return { totalEur, overdueEur, notYetDueEur: totalEur - overdueEur, overdueDeals };
}

export function activeManagers(managers: Manager[], date: ISODate): Manager[] {
  return managers.filter((m) => m.start <= date && (!m.end || m.end >= date));
}

export interface ManagerResult {
  manager: Manager;
  commissionEur: number;
  deals: number;
  planEur?: number;
  shareOfPlan?: number;
}

/**
 * Accrued commission per manager over [from, to], split by each deal's shares,
 * so the sum over managers equals the department total.
 */
export function managerResults(
  deals: AgencyDeal[],
  managers: Manager[],
  plans: ManagerPlan[],
  months: Month[],
  asOf: ISODate,
): ManagerResult[] {
  const byId = new Map<string, ManagerResult>();
  for (const m of managers) byId.set(m.id, { manager: m, commissionEur: 0, deals: 0 });
  for (const month of months) {
    for (const { deal, sign } of eventsInMonth(deals, month, asOf)) {
      for (const s of deal.managers) {
        const r = byId.get(s.managerId);
        if (!r) continue;
        r.commissionEur += sign * s.share * deal.commissionEur;
        r.deals += sign * s.share;
      }
    }
  }
  for (const r of byId.values()) {
    const planned = plans.filter((p) => p.managerId === r.manager.id && months.includes(p.month));
    if (planned.length > 0) {
      r.planEur = sum(planned.map((p) => p.commissionEur));
      r.shareOfPlan = r.planEur > 0 ? r.commissionEur / r.planEur : undefined;
    }
  }
  return [...byId.values()].sort((a, b) => b.commissionEur - a.commissionEur);
}

export interface StructureCell {
  deals: number;
  volumeEur: number;
  commissionEur: number;
}

export interface SalesStructure {
  newBuildOwn: StructureCell;
  newBuildThirdParty: StructureCell;
  resaleOwn: StructureCell;
  resaleThirdParty: StructureCell;
  total: StructureCell;
}

function emptyCell(): StructureCell {
  return { deals: 0, volumeEur: 0, commissionEur: 0 };
}

/** Property type × ownership. The two cuts are independent, hence a 2×2. */
export function salesStructure(deals: AgencyDeal[], month: Month, asOf: ISODate): SalesStructure {
  const s: SalesStructure = {
    newBuildOwn: emptyCell(),
    newBuildThirdParty: emptyCell(),
    resaleOwn: emptyCell(),
    resaleThirdParty: emptyCell(),
    total: emptyCell(),
  };
  for (const { deal, sign } of eventsInMonth(deals, month, asOf)) {
    const key: keyof SalesStructure =
      deal.propertyType === 'newBuild'
        ? deal.own
          ? 'newBuildOwn'
          : 'newBuildThirdParty'
        : deal.own
          ? 'resaleOwn'
          : 'resaleThirdParty';
    for (const cell of [s[key], s.total]) {
      cell.deals += sign;
      cell.volumeEur += sign * deal.priceEur;
      cell.commissionEur += sign * deal.commissionEur;
    }
  }
  return s;
}

export interface CountryCount {
  country: string;
  deals: number;
}

/** Top countries by net number of deals in the month, the rest as 'other'. */
export function buyerCountries(deals: AgencyDeal[], month: Month, asOf: ISODate, top = 4): CountryCount[] {
  const counts = new Map<string, number>();
  for (const { deal, sign } of eventsInMonth(deals, month, asOf)) {
    counts.set(deal.buyerCountry, (counts.get(deal.buyerCountry) ?? 0) + sign);
  }
  const sorted = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = sorted.slice(0, top).map(([country, n]) => ({ country, deals: n }));
  const rest = sum(sorted.slice(top).map(([, n]) => n));
  return rest > 0 ? [...head, { country: 'other', deals: rest }] : head;
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
