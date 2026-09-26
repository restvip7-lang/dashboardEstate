/**
 * Raw data contract of the dashboard.
 *
 * The dashboard never stores ready-made KPIs: every number on screen is computed
 * from these records by src/metrics. A real source (Bitrix24 export, bank
 * statements, Google Sheets of the construction team) only has to produce a
 * DashboardData object of this shape.
 *
 * Conventions:
 * - Dates are ISO strings: 'YYYY-MM-DD'. Months are 'YYYY-MM'.
 * - Money is in EUR. Amounts converted from another currency keep the original
 *   in `original` so the conversion can be audited.
 * - Commission amounts are net of VAT (KDV) and of partner agencies' share.
 */

export type Lang = 'ru' | 'en';
export type ISODate = string;
export type Month = string;

/** Localised free text written by people (actions, notes). */
export interface LocalText {
  ru: string;
  en: string;
}

export interface OriginalAmount {
  currency: string;
  amount: number;
  /** EUR per 1 unit of `currency` on `rateDate`. */
  rate: number;
  rateDate: ISODate;
}

export interface Meta {
  company: string;
  /** Date the facts are valid for ("данные на"). */
  asOf: ISODate;
  /** When the data file was produced (ISO date-time). */
  generatedAt: string;
  demo: boolean;
}

// ---------------------------------------------------------------- agency ---

export interface Manager {
  id: string;
  name: string;
  department: 'sales';
  start: ISODate;
  end?: ISODate;
}

export interface ManagerShare {
  managerId: string;
  /** Share of the deal result, 0..1. Shares of one deal sum to 1. */
  share: number;
}

export interface CommissionDue {
  due: ISODate;
  amountEur: number;
}

export interface AgencyDeal {
  id: string;
  /** Contract signed and first payment beyond the deposit received. */
  closedAt: ISODate;
  /** A cancellation is reversed in the month it happens; closed months stay. */
  cancelledAt?: ISODate;
  propertyType: 'newBuild' | 'resale';
  /** Unit of one of the company's own projects. */
  own: boolean;
  projectId?: string;
  priceEur: number;
  /** Agency commission, net of VAT and partner share. */
  commissionEur: number;
  managers: ManagerShare[];
  /** ISO 3166 alpha-2 citizenship of the main buyer. */
  buyerCountry: string;
  /** When the commission is contractually due (developers often pay in parts). */
  commissionSchedule: CommissionDue[];
  original?: OriginalAmount;
}

export interface CommissionPayment {
  dealId: string;
  date: ISODate;
  /** Negative for a refund. */
  amountEur: number;
}

export interface AgencyPlan {
  month: Month;
  commissionEur: number;
  deals: number;
}

export interface ManagerPlan {
  month: Month;
  managerId: string;
  commissionEur: number;
}

// ------------------------------------------------------------- developer ---

export type StageKey = 'foundation' | 'frame' | 'mep' | 'facade' | 'finishing' | 'landscaping';

export const STAGES: StageKey[] = ['foundation', 'frame', 'mep', 'facade', 'finishing', 'landscaping'];

export interface StagePlan {
  stage: StageKey;
  /** Weight in overall readiness, all weights of a project sum to 100. */
  weight: number;
  start: ISODate;
  end: ISODate;
}

export type Lifecycle = 'presale' | 'construction' | 'completed';

export interface Project {
  id: string;
  name: string;
  city: string;
  district: string;
  lifecycle: Lifecycle;
  /** Approved handover date. Never overwritten by forecasts. */
  plannedHandover: ISODate;
  /** Baseline schedule used for "planned readiness today". */
  baseline: StagePlan[];
  /** Person responsible for construction. */
  responsible: string;
}

export interface ConstructionReport {
  projectId: string;
  date: ISODate;
  /** Completion of each stage, 0..100. */
  stagePct: Record<StageKey, number>;
  forecastHandover: ISODate;
  note?: LocalText;
}

export type UnitStatus = 'sold' | 'reserved' | 'available' | 'notReleased';

export interface Unit {
  id: string;
  projectId: string;
  status: UnitStatus;
  listPriceEur: number;
  areaM2: number;
}

export interface DeveloperSale {
  id: string;
  unitId: string;
  projectId: string;
  contractDate: ISODate;
  cancelledAt?: ISODate;
  priceEur: number;
  channel: 'agency' | 'partner' | 'direct';
  /** Link to the agency deal when our agency sold the unit. */
  agencyDealId?: string;
}

export interface Installment {
  saleId: string;
  due: ISODate;
  amountEur: number;
}

export interface BuyerPayment {
  saleId: string;
  date: ISODate;
  /** Negative for a refund. */
  amountEur: number;
}

export interface DeveloperPlan {
  month: Month;
  salesUnits: number;
  salesEur: number;
  /** First payments expected from the month's new sales (part of the collections plan). */
  newSalesCollectionsEur?: number;
}

// ------------------------------------------------------------ attention ---

/**
 * Owner and next action for a signal found by the rules in
 * src/metrics/attention.ts. `key` matches the signal key, e.g.
 * 'project:p04:schedule' or 'agency:commission-overdue'.
 */
export interface Issue {
  key: string;
  owner: string;
  action: LocalText;
  due: ISODate;
}

export interface DashboardData {
  meta: Meta;
  managers: Manager[];
  agencyDeals: AgencyDeal[];
  commissionPayments: CommissionPayment[];
  agencyPlans: AgencyPlan[];
  managerPlans: ManagerPlan[];
  projects: Project[];
  reports: ConstructionReport[];
  units: Unit[];
  developerSales: DeveloperSale[];
  installments: Installment[];
  buyerPayments: BuyerPayment[];
  developerPlans: DeveloperPlan[];
  issues: Issue[];
}
