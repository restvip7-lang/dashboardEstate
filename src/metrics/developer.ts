import type {
  BuyerPayment,
  ConstructionReport,
  DeveloperSale,
  ISODate,
  Installment,
  Month,
  Project,
  StageKey,
  Unit,
  UnitStatus,
} from '../data/types.ts';
import { STAGES } from '../data/types.ts';
import { sum } from './agency.ts';
import { openDues } from './allocate.ts';
import { addDays, daysBetween, isBetween, monthEnd, monthOf, monthStart } from './dates.ts';

/** Days after the due date before a buyer installment counts as overdue. */
export const BUYER_GRACE_DAYS = 7;
/** Construction reports are weekly; older than this is flagged as stale. */
export const STALE_REPORT_DAYS = 10;
/** Readiness lag in percentage points that turns a project into "risk" / "delay". */
export const RISK_LAG_PTS = 3;
export const DELAY_LAG_PTS = 7;
/** Forecast slip (days past the approved date) that turns "risk" into "delay". */
export const DELAY_SLIP_DAYS = 60;

// ------------------------------------------------------------------ units ---

export type UnitCounts = Record<UnitStatus, number> & { total: number; availableListEur: number };

export function unitCounts(units: Unit[]): UnitCounts {
  const c: UnitCounts = { sold: 0, reserved: 0, available: 0, notReleased: 0, total: 0, availableListEur: 0 };
  for (const u of units) {
    c[u.status] += 1;
    c.total += 1;
    if (u.status === 'available') c.availableListEur += u.listPriceEur;
  }
  return c;
}

// ------------------------------------------------------------------ sales ---

export interface DeveloperSalesMonth {
  month: Month;
  units: number;
  eur: number;
  viaAgency: number;
}

export function developerSalesMonth(sales: DeveloperSale[], month: Month, asOf: ISODate): DeveloperSalesMonth {
  const r: DeveloperSalesMonth = { month, units: 0, eur: 0, viaAgency: 0 };
  for (const s of sales) {
    if (s.contractDate <= asOf && monthOf(s.contractDate) === month) {
      r.units += 1;
      r.eur += s.priceEur;
      if (s.channel === 'agency') r.viaAgency += 1;
    }
    if (s.cancelledAt && s.cancelledAt <= asOf && monthOf(s.cancelledAt) === month) {
      r.units -= 1;
      r.eur -= s.priceEur;
      if (s.channel === 'agency') r.viaAgency -= 1;
    }
  }
  return r;
}

// ------------------------------------------------------------ collections ---

export function collectionsInMonth(payments: BuyerPayment[], month: Month, asOf: ISODate): number {
  return sum(payments.filter((p) => p.date <= asOf && monthOf(p.date) === month).map((p) => p.amountEur));
}

/**
 * Collections plan for a month: installments falling due in the month, taken
 * as a snapshot of the contracts that existed on the 1st, plus the planned
 * first payments from new sales. Fixing the snapshot stops the plan from being
 * "adjusted" as the month goes.
 */
export function collectionsPlan(
  installments: Installment[],
  sales: DeveloperSale[],
  month: Month,
  newSalesCollectionsEur = 0,
): number {
  const start = monthStart(month);
  const live = new Set(
    sales.filter((s) => s.contractDate < start && !(s.cancelledAt && s.cancelledAt < start)).map((s) => s.id),
  );
  return (
    newSalesCollectionsEur +
    sum(
      installments
        .filter((i) => live.has(i.saleId) && isBetween(i.due, start, monthEnd(month)))
        .map((i) => i.amountEur),
    )
  );
}

export interface BuyerDebt {
  overdueEur: number;
  overdueContracts: number;
  maxDaysLate: number;
  /** Not yet overdue, due within the next 30 days. */
  expected30Eur: number;
  overdueByProject: Map<string, number>;
}

export function buyerDebt(
  installments: Installment[],
  payments: BuyerPayment[],
  sales: DeveloperSale[],
  asOf: ISODate,
  graceDays = BUYER_GRACE_DAYS,
): BuyerDebt {
  const bySale = new Map<string, Installment[]>();
  for (const i of installments) bySale.set(i.saleId, [...(bySale.get(i.saleId) ?? []), i]);
  const paid = new Map<string, number>();
  for (const p of payments) if (p.date <= asOf) paid.set(p.saleId, (paid.get(p.saleId) ?? 0) + p.amountEur);

  const r: BuyerDebt = { overdueEur: 0, overdueContracts: 0, maxDaysLate: 0, expected30Eur: 0, overdueByProject: new Map() };
  const horizon = addDays(asOf, 30);
  for (const sale of sales) {
    if (sale.contractDate > asOf || (sale.cancelledAt && sale.cancelledAt <= asOf)) continue;
    const open = openDues(bySale.get(sale.id) ?? [], paid.get(sale.id) ?? 0, asOf);
    const late = open.filter((o) => o.daysLate > graceDays);
    const lateEur = sum(late.map((o) => o.outstandingEur));
    if (lateEur > 0) {
      r.overdueEur += lateEur;
      r.overdueContracts += 1;
      r.maxDaysLate = Math.max(r.maxDaysLate, ...late.map((o) => o.daysLate));
      r.overdueByProject.set(sale.projectId, (r.overdueByProject.get(sale.projectId) ?? 0) + lateEur);
    }
    r.expected30Eur += sum(open.filter((o) => o.daysLate <= graceDays && o.due <= horizon).map((o) => o.outstandingEur));
  }
  return r;
}

/** Unpaid installments of a project due between two dates (e.g. tied to handover). */
export function unpaidDueBetween(
  projectId: string,
  installments: Installment[],
  payments: BuyerPayment[],
  sales: DeveloperSale[],
  from: ISODate,
  to: ISODate,
  asOf: ISODate,
): number {
  let total = 0;
  for (const sale of sales) {
    if (sale.projectId !== projectId || sale.contractDate > asOf) continue;
    if (sale.cancelledAt && sale.cancelledAt <= asOf) continue;
    const paid = sum(payments.filter((p) => p.saleId === sale.id && p.date <= asOf).map((p) => p.amountEur));
    const open = openDues(installments.filter((i) => i.saleId === sale.id), paid, asOf);
    total += sum(open.filter((o) => isBetween(o.due, from, to)).map((o) => o.outstandingEur));
  }
  return total;
}

// ----------------------------------------------------------- construction ---

export function readiness(project: Project, report: ConstructionReport): number {
  return sum(project.baseline.map((s) => (s.weight * (report.stagePct[s.stage] ?? 0)) / 100));
}

/** Readiness the approved baseline expects on `date` (linear within each stage). */
export function plannedReadiness(project: Project, date: ISODate): number {
  return sum(
    project.baseline.map((s) => {
      const length = daysBetween(s.start, s.end);
      const done = length <= 0 ? (date >= s.end ? 1 : 0) : daysBetween(s.start, date) / length;
      return s.weight * Math.min(1, Math.max(0, done));
    }),
  );
}

export function currentStage(project: Project, report: ConstructionReport): StageKey {
  const order = STAGES.filter((st) => project.baseline.some((b) => b.stage === st));
  return order.find((st) => (report.stagePct[st] ?? 0) < 100) ?? order[order.length - 1];
}

export type ScheduleStatus = 'ok' | 'risk' | 'delay';

export interface ProjectStatus {
  project: Project;
  report: ConstructionReport;
  factPct: number;
  planPct: number;
  /** fact − plan, percentage points (negative = behind). */
  deviationPts: number;
  /** Forecast handover minus approved handover, days. */
  slipDays: number;
  forecastHandover: ISODate;
  stage: StageKey;
  status: ScheduleStatus;
  reportAgeDays: number;
  stale: boolean;
}

export function scheduleStatus(deviationPts: number, slipDays: number): ScheduleStatus {
  const lag = -deviationPts;
  if (lag > DELAY_LAG_PTS || slipDays > DELAY_SLIP_DAYS) return 'delay';
  if (lag > RISK_LAG_PTS || slipDays > 0) return 'risk';
  return 'ok';
}

export function latestReport(reports: ConstructionReport[], projectId: string, asOf: ISODate): ConstructionReport | undefined {
  let best: ConstructionReport | undefined;
  for (const r of reports) {
    if (r.projectId !== projectId || r.date > asOf) continue;
    if (!best || r.date > best.date) best = r;
  }
  return best;
}

export function projectStatus(project: Project, reports: ConstructionReport[], asOf: ISODate): ProjectStatus | undefined {
  const report = latestReport(reports, project.id, asOf);
  if (!report) return undefined;
  const factPct = readiness(project, report);
  // Plan is taken on the report date: comparing an old report with today's plan
  // would exaggerate the lag. Staleness is shown separately.
  const planPct = plannedReadiness(project, report.date);
  const deviationPts = factPct - planPct;
  const slipDays = daysBetween(project.plannedHandover, report.forecastHandover);
  const reportAgeDays = daysBetween(report.date, asOf);
  return {
    project,
    report,
    factPct,
    planPct,
    deviationPts,
    slipDays,
    forecastHandover: report.forecastHandover,
    stage: currentStage(project, report),
    status: scheduleStatus(deviationPts, slipDays),
    reportAgeDays,
    stale: reportAgeDays > STALE_REPORT_DAYS,
  };
}

const SEVERITY: Record<ScheduleStatus, number> = { delay: 0, risk: 1, ok: 2 };

/** Projects under construction, problems first, then by handover date. */
export function constructionList(projects: Project[], reports: ConstructionReport[], asOf: ISODate): ProjectStatus[] {
  return projects
    .filter((p) => p.lifecycle === 'construction')
    .map((p) => projectStatus(p, reports, asOf))
    .filter((s): s is ProjectStatus => s !== undefined)
    .sort(
      (a, b) =>
        SEVERITY[a.status] - SEVERITY[b.status] ||
        Number(b.stale) - Number(a.stale) ||
        a.project.plannedHandover.localeCompare(b.project.plannedHandover),
    );
}

/** Handovers (approved or forecast) within the next `days` days, soonest first. */
export function upcomingHandovers(list: ProjectStatus[], asOf: ISODate, days = 90): ProjectStatus[] {
  const until = addDays(asOf, days);
  return list
    .filter((s) => s.project.plannedHandover <= until || s.forecastHandover <= until)
    .sort((a, b) => a.project.plannedHandover.localeCompare(b.project.plannedHandover));
}
