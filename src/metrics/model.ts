import type { DashboardData, DeveloperPlan, ISODate, Month } from '../data/types.ts';
import type { DataProblem } from '../data/validate.ts';
import { validateData } from '../data/validate.ts';
import type { AgencyMonth, CountryCount, ManagerResult, Pace, Receivables, SalesStructure } from './agency.ts';
import {
  activeManagers,
  agencyMonth,
  buyerCountries,
  commissionDueInMonth,
  commissionReceivables,
  managerResults,
  pace,
  salesStructure,
} from './agency.ts';
import type { Signal } from './attention.ts';
import { agencySignals, developerSignals } from './attention.ts';
import { addDays, addMonths, lastMonths, monthOf, sameDayIn } from './dates.ts';
import type { BuyerDebt, DeveloperSalesMonth, ProjectStatus, UnitCounts } from './developer.ts';
import {
  buyerDebt,
  collectionsInMonth,
  collectionsPlan,
  constructionList,
  developerSalesMonth,
  unitCounts,
  unpaidDueBetween,
  upcomingHandovers,
} from './developer.ts';

export interface AgencyModel {
  current: AgencyMonth;
  previous: AgencyMonth;
  /** Previous month up to the same day of month: a fair comparison for a month in progress. */
  previousToDate: AgencyMonth;
  /** Commission contractually due this month; basis for the collection rate. */
  dueThisMonthEur: number;
  history: AgencyMonth[];
  pace: Pace;
  receivables: Receivables;
  headcount: number;
  perManagerEur: number;
  effectiveRate: number;
  monthLeaders: ManagerResult[];
  yearLeaders: ManagerResult[];
  structure: SalesStructure;
  countries: CountryCount[];
  signals: Signal[];
}

export interface DeveloperModel {
  sales: DeveloperSalesMonth;
  salesPrevious: DeveloperSalesMonth;
  salesPreviousToDate: DeveloperSalesMonth;
  salesPlan?: DeveloperPlan;
  collectionsEur: number;
  collectionsPlanEur: number;
  units: UnitCounts;
  debt: BuyerDebt;
  construction: ProjectStatus[];
  upcoming: ProjectStatus[];
  counts: { construction: number; ok: number; risk: number; delay: number };
  signals: Signal[];
}

export interface DashboardModel {
  asOf: ISODate;
  month: Month;
  company: string;
  demo: boolean;
  generatedAt: string;
  agency: AgencyModel;
  developer: DeveloperModel;
  problems: DataProblem[];
}

export const HISTORY_MONTHS = 6;

export function buildModel(d: DashboardData): DashboardModel {
  const asOf = d.meta.asOf;
  const month = monthOf(asOf);
  const prevMonth = addMonths(month, -1);

  // ---- agency
  const monthOfAgency = (m: Month) => agencyMonth(d.agencyDeals, d.commissionPayments, d.agencyPlans, m, asOf);
  const history = lastMonths(asOf, HISTORY_MONTHS).map(monthOfAgency);
  const current = history[history.length - 1];
  const previous = monthOfAgency(prevMonth);
  const monthPace = pace(current.planCommissionEur ?? 0, current.accruedEur, asOf);
  const receivables = commissionReceivables(d.agencyDeals, d.commissionPayments, asOf);
  const active = activeManagers(d.managers, asOf);
  const activeIds = new Set(active.map((m) => m.id));
  const yearMonths = Array.from({ length: Number(month.slice(5, 7)) }, (_, i) => `${month.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);
  const onScreen = (r: ManagerResult[]) => r.filter((x) => activeIds.has(x.manager.id));

  const agency: AgencyModel = {
    current,
    previous,
    previousToDate: agencyMonth(d.agencyDeals, d.commissionPayments, d.agencyPlans, prevMonth, sameDayIn(prevMonth, asOf)),
    dueThisMonthEur: commissionDueInMonth(d.agencyDeals, month, asOf),
    history,
    pace: monthPace,
    receivables,
    headcount: active.length,
    perManagerEur: active.length > 0 ? current.accruedEur / active.length : 0,
    effectiveRate: current.volumeEur > 0 ? current.accruedEur / current.volumeEur : 0,
    monthLeaders: onScreen(managerResults(d.agencyDeals, d.managers, d.managerPlans, [month], asOf)),
    yearLeaders: onScreen(managerResults(d.agencyDeals, d.managers, d.managerPlans, yearMonths, asOf)),
    structure: salesStructure(d.agencyDeals, month, asOf),
    countries: buyerCountries(d.agencyDeals, month, asOf),
    signals: agencySignals(receivables, monthPace, d.issues),
  };

  // ---- developer
  const construction = constructionList(d.projects, d.reports, asOf);
  const debt = buyerDebt(d.installments, d.buyerPayments, d.developerSales, asOf);
  const impact = new Map<string, number>();
  for (const s of construction) {
    if (s.status === 'ok') continue;
    impact.set(
      s.project.id,
      unpaidDueBetween(
        s.project.id,
        d.installments,
        d.buyerPayments,
        d.developerSales,
        addDays(s.project.plannedHandover, -30),
        s.forecastHandover,
        asOf,
      ),
    );
  }
  const salesPlan = d.developerPlans.find((p) => p.month === month);
  const developer: DeveloperModel = {
    sales: developerSalesMonth(d.developerSales, month, asOf),
    salesPrevious: developerSalesMonth(d.developerSales, prevMonth, asOf),
    salesPreviousToDate: developerSalesMonth(d.developerSales, prevMonth, sameDayIn(prevMonth, asOf)),
    salesPlan,
    collectionsEur: collectionsInMonth(d.buyerPayments, month, asOf),
    collectionsPlanEur: collectionsPlan(d.installments, d.developerSales, month, salesPlan?.newSalesCollectionsEur),
    units: unitCounts(d.units),
    debt,
    construction,
    upcoming: upcomingHandovers(construction, asOf),
    counts: {
      construction: construction.length,
      ok: construction.filter((s) => s.status === 'ok').length,
      risk: construction.filter((s) => s.status === 'risk').length,
      delay: construction.filter((s) => s.status === 'delay').length,
    },
    signals: developerSignals(construction, debt, impact, d.issues),
  };

  return {
    asOf,
    month,
    company: d.meta.company,
    demo: d.meta.demo,
    generatedAt: d.meta.generatedAt,
    agency,
    developer,
    problems: validateData(d),
  };
}
