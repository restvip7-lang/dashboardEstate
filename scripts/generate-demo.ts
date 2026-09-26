/**
 * Generates public/data/demo.json: 24 months of consistent raw demo records
 * for the 22 real project names. Run with `npm run demo-data`.
 *
 * Only raw facts are generated (deals, payments, schedules, reports). Every KPI
 * on screen is computed from them, so totals, charts and breakdowns always
 * agree. The generator is seeded and produces the same file every run.
 */
import { writeFileSync } from 'node:fs';
import type {
  AgencyDeal,
  AgencyPlan,
  BuyerPayment,
  CommissionPayment,
  ConstructionReport,
  DashboardData,
  DeveloperPlan,
  DeveloperSale,
  Installment,
  Issue,
  Manager,
  ManagerPlan,
  Project,
  StageKey,
  StagePlan,
  Unit,
} from '../src/data/types.ts';

const AS_OF = '2026-09-26';
const WINDOW_START = '2024-10';
const SEED = 20260926;

// ------------------------------------------------------------- utilities ---

let state = SEED;
function rnd(): number {
  state |= 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + (b - a) * rnd();
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)];
function weighted<T>(items: [T, number][]): T {
  const total = items.reduce((a, [, w]) => a + w, 0);
  let x = rnd() * total;
  for (const [item, w] of items) {
    x -= w;
    if (x <= 0) return item;
  }
  return items[items.length - 1][0];
}
const round = (v: number, step: number) => Math.round(v / step) * step;

const DAY = 86_400_000;
const toMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY);
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);
const addMonths = (m: string, n: number) => new Date(Date.UTC(+m.slice(0, 4), +m.slice(5, 7) - 1 + n, 1)).toISOString().slice(0, 7);
const monthEnd = (m: string) => addDays(`${addMonths(m, 1)}-01`, -1);
const minDate = (a: string, b: string) => (a < b ? a : b);
const maxDate = (a: string, b: string) => (a > b ? a : b);
function randomDateIn(from: string, to: string): string {
  return addDays(from, int(0, Math.max(0, daysBetween(from, to))));
}

const MONTHS: string[] = [];
for (let m = WINDOW_START; m <= AS_OF.slice(0, 7); m = addMonths(m, 1)) MONTHS.push(m);
const CURRENT = AS_OF.slice(0, 7);
const PREVIOUS = addMonths(CURRENT, -1);

// -------------------------------------------------------------- managers ---

const managerSeed: [string, string, number, string?, string?][] = [
  ['m01', 'Анна Волкова', 1.9],
  ['m02', 'Денис Орлов', 1.7],
  ['m03', 'Игорь Ковалёв', 1.3],
  ['m04', 'Мария Белова', 1.2],
  ['m05', 'Сергей Дорошенко', 1.1],
  ['m06', 'Елена Соколова', 1.0],
  ['m07', 'Айше Демир', 0.9],
  ['m08', 'Мехмет Кая', 0.9],
  ['m09', 'Ольга Лебедева', 0.8],
  ['m10', 'Павел Никитин', 0.7],
  ['m11', 'Зейнеп Арслан', 0.5, '2026-07-01'],
  ['m12', 'Артём Гусев', 0.4, '2026-08-17'],
  ['m13', 'Олег Фомин', 0.9, '2023-02-01', '2025-06-30'],
];
const managers: Manager[] = managerSeed.map(([id, name, , start, end]) => ({
  id,
  name,
  department: 'sales',
  start: start ?? '2022-03-01',
  ...(end ? { end } : {}),
}));
const talent = new Map(managerSeed.map(([id, , w]) => [id, w]));
function managersOn(date: string): Manager[] {
  return managers.filter((m) => m.start <= date && (!m.end || m.end >= date));
}
function assignManagers(date: string) {
  const pool = managersOn(date);
  const main = weighted(pool.map((m) => [m, talent.get(m.id) ?? 1] as [Manager, number]));
  if (rnd() < 0.12) {
    const second = pick(pool.filter((m) => m.id !== main.id));
    return [
      { managerId: main.id, share: 0.5 },
      { managerId: second.id, share: 0.5 },
    ];
  }
  return [{ managerId: main.id, share: 1 }];
}

const COUNTRIES: [string, number][] = [
  ['TR', 34], ['RU', 26], ['DE', 14], ['KZ', 12], ['UA', 4], ['GB', 4], ['IR', 3], ['PL', 2], ['NL', 1],
];
const country = () => weighted(COUNTRIES);

// -------------------------------------------------------------- projects ---

const SERVET = 'Сервет Йылмаз';
const CEM = 'Джем Акташ';
const BURAK = 'Бурак Шахин';

interface ProjectSeed {
  id: string;
  name: string;
  city: string;
  district: string;
  lifecycle: 'construction' | 'completed';
  units: number;
  avgPrice: number;
  start: string;
  handover: string;
  responsible: string;
  /** Readiness deviation on the latest report, percentage points. */
  dev?: number;
  /** Forecast handover minus approved handover, days. */
  slip?: number;
  /** Age of the latest report, days. */
  reportAge?: number;
  soldShare: number;
  notReleasedShare?: number;
}

const projectSeeds: ProjectSeed[] = [
  { id: 'p01', name: 'Blue Sunlight 2 Residence', city: 'Аланья', district: 'Махмутлар', lifecycle: 'construction', units: 96, avgPrice: 175_000, start: '2025-01-10', handover: '2026-12-25', responsible: SERVET, dev: -2, soldShare: 0.72 },
  { id: 'p02', name: 'Riva Port Villas Side', city: 'Сиде', district: 'Сиде', lifecycle: 'construction', units: 24, avgPrice: 650_000, start: '2024-09-01', handover: '2026-10-31', responsible: SERVET, dev: -4, slip: 30, soldShare: 0.83 },
  { id: 'p03', name: 'Day One Residence (Villa)', city: 'Аланья', district: 'Тепе', lifecycle: 'construction', units: 12, avgPrice: 540_000, start: '2024-10-01', handover: '2026-10-20', responsible: SERVET, dev: 0, soldShare: 0.92 },
  { id: 'p04', name: 'Exodus Panorama Residence', city: 'Стамбул', district: 'Картал', lifecycle: 'construction', units: 180, avgPrice: 260_000, start: '2025-03-01', handover: '2027-06-30', responsible: BURAK, dev: -11, slip: 61, soldShare: 0.55 },
  { id: 'p05', name: 'Prime Stone Residence', city: 'Газипаша', district: 'Газипаша', lifecycle: 'construction', units: 72, avgPrice: 140_000, start: '2025-06-01', handover: '2027-03-31', responsible: CEM, dev: -2, soldShare: 0.6 },
  { id: 'p06', name: 'Prime Garden Residence', city: 'Аланья', district: 'Оба', lifecycle: 'construction', units: 110, avgPrice: 190_000, start: '2026-06-01', handover: '2027-12-31', responsible: CEM, dev: 0, soldShare: 0.3 },
  { id: 'p07', name: 'Prime Botanic Residence', city: 'Аланья', district: 'Махмутлар', lifecycle: 'construction', units: 88, avgPrice: 165_000, start: '2025-08-01', handover: '2027-05-31', responsible: SERVET, dev: -1, soldShare: 0.52 },
  { id: 'p08', name: 'Exodus Twins Residence', city: 'Аланья', district: 'Махмутлар', lifecycle: 'construction', units: 140, avgPrice: 185_000, start: '2025-01-01', handover: '2026-12-31', responsible: CEM, dev: -1, soldShare: 0.78 },
  { id: 'p09', name: 'Blue Dream Residence', city: 'Газипаша', district: 'Газипаша', lifecycle: 'completed', units: 64, avgPrice: 120_000, start: '2022-03-01', handover: '2023-11-30', responsible: CEM, soldShare: 1 },
  { id: 'p10', name: 'Exodus Riverside Residence', city: 'Аланья', district: 'Демирташ', lifecycle: 'construction', units: 76, avgPrice: 150_000, start: '2025-05-01', handover: '2027-02-28', responsible: SERVET, dev: -1, soldShare: 0.58 },
  { id: 'p11', name: 'Blue Sunlight', city: 'Аланья', district: 'Махмутлар', lifecycle: 'completed', units: 84, avgPrice: 140_000, start: '2021-10-01', handover: '2023-06-30', responsible: SERVET, soldShare: 1 },
  { id: 'p12', name: 'Hayat Heaven Residence', city: 'Аланья', district: 'Авсаллар', lifecycle: 'completed', units: 70, avgPrice: 135_000, start: '2022-01-15', handover: '2023-09-30', responsible: CEM, soldShare: 0.97 },
  { id: 'p13', name: 'Exodus Resort Comfort City', city: 'Аланья', district: 'Махмутлар', lifecycle: 'completed', units: 210, avgPrice: 160_000, start: '2022-06-01', handover: '2024-09-30', responsible: SERVET, soldShare: 0.95 },
  { id: 'p14', name: 'Exodus Green Hill Residence', city: 'Стамбул', district: 'Картал', lifecycle: 'construction', units: 150, avgPrice: 280_000, start: '2026-03-01', handover: '2027-08-31', responsible: BURAK, dev: -1, soldShare: 0.34, notReleasedShare: 0.35 },
  { id: 'p15', name: 'Prime Loft Residence', city: 'Аланья', district: 'Махмутлар', lifecycle: 'construction', units: 64, avgPrice: 160_000, start: '2024-12-01', handover: '2026-11-25', responsible: CEM, dev: -2, soldShare: 0.86 },
  { id: 'p16', name: 'Faralya Residence', city: 'Аланья', district: 'Паяллар', lifecycle: 'completed', units: 48, avgPrice: 150_000, start: '2022-09-01', handover: '2024-03-31', responsible: CEM, soldShare: 0.96 },
  { id: 'p17', name: 'Villa Rabbit Hill', city: 'Аланья', district: 'Бекташ', lifecycle: 'construction', units: 16, avgPrice: 720_000, start: '2025-01-15', handover: '2026-12-20', responsible: CEM, dev: -6, slip: 26, reportAge: 17, soldShare: 0.69 },
  { id: 'p18', name: 'Exodus Hill Residence', city: 'Аланья', district: 'Махмутлар', lifecycle: 'construction', units: 98, avgPrice: 170_000, start: '2025-06-15', handover: '2027-04-30', responsible: SERVET, dev: -1, soldShare: 0.57 },
  { id: 'p19', name: 'Exodus Nature Residence', city: 'Аланья', district: 'Оба', lifecycle: 'completed', units: 120, avgPrice: 155_000, start: '2022-11-01', handover: '2024-06-30', responsible: SERVET, soldShare: 0.96 },
  { id: 'p20', name: 'Exodus Premium Town', city: 'Аланья', district: 'Каргыджак', lifecycle: 'construction', units: 220, avgPrice: 210_000, start: '2026-06-15', handover: '2028-01-31', responsible: SERVET, dev: 0, soldShare: 0.22, notReleasedShare: 0.4 },
  { id: 'p21', name: 'Exodus Aqua Deluxe Konakli', city: 'Аланья', district: 'Конаклы', lifecycle: 'completed', units: 110, avgPrice: 175_000, start: '2023-01-15', handover: '2024-12-31', responsible: CEM, soldShare: 0.94 },
  { id: 'p22', name: 'Exodus Dreams Residence', city: 'Аланья', district: 'Паяллар', lifecycle: 'completed', units: 90, avgPrice: 165_000, start: '2023-03-01', handover: '2025-03-31', responsible: SERVET, soldShare: 0.93 },
];

/** Stage windows as shares of the project duration, and weights. */
const STAGE_PLAN: [StageKey, number, number, number][] = [
  ['foundation', 15, 0.0, 0.18],
  ['frame', 30, 0.12, 0.45],
  ['mep', 20, 0.35, 0.7],
  ['facade', 15, 0.5, 0.8],
  ['finishing', 15, 0.6, 0.95],
  ['landscaping', 5, 0.85, 1.0],
];

function baselineFor(start: string, handover: string): StagePlan[] {
  const total = daysBetween(start, handover);
  return STAGE_PLAN.map(([stage, weight, a, b]) => ({
    stage,
    weight,
    start: addDays(start, Math.round(total * a)),
    end: addDays(start, Math.round(total * b)),
  }));
}

function plannedStagePct(baseline: StagePlan[], date: string): Record<StageKey, number> {
  const pct = {} as Record<StageKey, number>;
  for (const s of baseline) {
    const len = daysBetween(s.start, s.end);
    const done = len <= 0 ? (date >= s.end ? 1 : 0) : daysBetween(s.start, date) / len;
    pct[s.stage] = Math.min(100, Math.max(0, done * 100));
  }
  return pct;
}

/** Removes `lagPts` of overall readiness, starting from the latest stages. */
function applyLag(baseline: StagePlan[], pct: Record<StageKey, number>, lagPts: number): Record<StageKey, number> {
  const out = { ...pct };
  let left = lagPts;
  for (const s of [...baseline].reverse()) {
    if (left <= 0) break;
    const has = (s.weight * out[s.stage]) / 100;
    const take = Math.min(has, left);
    out[s.stage] -= (take / s.weight) * 100;
    left -= take;
  }
  for (const k of Object.keys(out) as StageKey[]) out[k] = Math.round(out[k]);
  return out;
}

const projects: Project[] = projectSeeds.map((p) => ({
  id: p.id,
  name: p.name,
  city: p.city,
  district: p.district,
  lifecycle: p.lifecycle,
  plannedHandover: p.handover,
  baseline: baselineFor(p.start, p.handover),
  responsible: p.responsible,
}));

const reports: ConstructionReport[] = [];
for (const seed of projectSeeds) {
  if (seed.lifecycle !== 'construction') continue;
  const project = projects.find((p) => p.id === seed.id)!;
  const latest = addDays(AS_OF, -(seed.reportAge ?? int(0, 3)));
  for (let w = 7; w >= 0; w--) {
    const date = addDays(latest, -7 * w);
    if (date < seed.start) continue;
    const share = (8 - w) / 8;
    const lag = -(seed.dev ?? 0) * share;
    reports.push({
      projectId: seed.id,
      date,
      stagePct: applyLag(project.baseline, plannedStagePct(project.baseline, date), lag),
      forecastHandover: addDays(seed.handover, Math.round((seed.slip ?? 0) * share)),
    });
  }
}

// ----------------------------------------------------------------- units ---

const units: Unit[] = [];
const unitsByProject = new Map<string, Unit[]>();
for (const p of projectSeeds) {
  const list: Unit[] = [];
  for (let i = 1; i <= p.units; i++) {
    const price = round(p.avgPrice * between(0.78, 1.25), 1000);
    list.push({
      id: `${p.id}-u${String(i).padStart(3, '0')}`,
      projectId: p.id,
      status: 'available',
      listPriceEur: price,
      areaM2: Math.round(price / between(1900, 3300)),
    });
  }
  unitsByProject.set(p.id, list);
  units.push(...list);
}

// ------------------------------------------------------ developer sales ---

const salesStart = (p: ProjectSeed) => addDays(p.start, -120);
const developerSales: DeveloperSale[] = [];
const saleMonth = new Map<string, string>();

interface PendingSale {
  project: ProjectSeed;
  unit: Unit;
  month?: string;
}
const pending: PendingSale[] = [];
for (const p of projectSeeds) {
  const list = unitsByProject.get(p.id)!;
  const sold = Math.round(list.length * p.soldShare);
  const inWindowShare =
    salesStart(p) >= `${WINDOW_START}-01` ? 1 : p.lifecycle === 'completed' ? (p.handover >= '2024-06-01' ? 0.15 : 0.04) : 0.3;
  list.slice(0, sold).forEach((unit, i) => {
    const inWindow = i >= sold - Math.round(sold * inWindowShare);
    pending.push({ project: p, unit, month: inWindow ? '' : undefined });
  });
}

// Spread window sales over months along a steady trend with seasonality; the
// current month is only 26 of 30 days old. Most constrained sales go first.
const SEASON = [0.8, 0.8, 1, 1.1, 1.2, 1.1, 1, 0.95, 1.1, 1.15, 1, 0.85];
const monthWeight = MONTHS.map((m, i) => (1 + 0.025 * i) * SEASON[+m.slice(5, 7) - 1] * (m === CURRENT ? 26 / 30 : 1));
const toAllocate = pending.filter((s) => s.month === '');
const weightSum = monthWeight.reduce((a, b) => a + b, 0);
const monthTarget = monthWeight.map((w) => (toAllocate.length * w) / weightSum);
const monthAssigned = MONTHS.map(() => 0);
const eligibleMonths = (s: PendingSale) =>
  MONTHS.map((m, i) => [m, i] as const).filter(([m]) => monthEnd(m) >= salesStart(s.project)).map(([, i]) => i);
toAllocate
  .map((s) => ({ s, n: eligibleMonths(s).length, r: rnd() }))
  .sort((a, b) => a.n - b.n || a.r - b.r)
  .forEach(({ s }) => {
    const best = eligibleMonths(s).reduce((a, b) => (monthTarget[b] - monthAssigned[b] > monthTarget[a] - monthAssigned[a] ? b : a));
    monthAssigned[best] += 1;
    s.month = MONTHS[best];
  });

pending.sort((a, b) => a.project.id.localeCompare(b.project.id) || a.unit.id.localeCompare(b.unit.id));
let saleNo = 0;
for (const s of pending) {
  const date = s.month
    ? randomDateIn(maxDate(`${s.month}-01`, salesStart(s.project)), minDate(monthEnd(s.month), AS_OF))
    : randomDateIn(maxDate('2021-06-01', salesStart(s.project)), addDays(`${WINDOW_START}-01`, -1));
  const sale: DeveloperSale = {
    id: `s${String(++saleNo).padStart(4, '0')}`,
    unitId: s.unit.id,
    projectId: s.project.id,
    contractDate: minDate(date, AS_OF),
    priceEur: round(s.unit.listPriceEur * between(0.94, 1.0), 500),
    channel: 'direct',
  };
  developerSales.push(sale);
  saleMonth.set(sale.id, sale.contractDate.slice(0, 7));
  s.unit.status = 'sold';
}

// Channels: our agency sells most of the company's own units.
const windowSales = developerSales.filter((s) => s.contractDate >= `${WINDOW_START}-01`);
for (const m of MONTHS) {
  const inMonth = windowSales.filter((s) => s.contractDate.startsWith(m)).map((s) => ({ s, r: rnd() }));
  inMonth.sort((a, b) => a.r - b.r);
  const agencyCount = Math.round(inMonth.length * 0.6);
  inMonth.forEach(({ s }, i) => (s.channel = i < agencyCount ? 'agency' : i % 2 === 0 ? 'partner' : 'direct'));
}
for (const s of developerSales) if (s.contractDate < `${WINDOW_START}-01`) s.channel = rnd() < 0.5 ? 'agency' : 'direct';

// A few cancellations, one of them in the current month.
const cancelCandidates = windowSales.filter((s) => s.contractDate < addDays(AS_OF, -75) && s.contractDate >= '2025-03-01');
const toCancel = [pick(cancelCandidates.filter((s) => s.channel === 'agency' && s.contractDate >= '2026-06-15' && s.contractDate < '2026-07-20'))];
while (toCancel.length < 5) {
  const c = pick(cancelCandidates);
  if (!toCancel.includes(c)) toCancel.push(c);
}
toCancel.forEach((s, i) => {
  s.cancelledAt = i === 0 ? '2026-09-11' : minDate(addDays(s.contractDate, int(30, 70)), addDays(AS_OF, -40));
  units.find((u) => u.id === s.unitId)!.status = 'available';
});

// Reservations and not-yet-released stock.
for (const p of projectSeeds) {
  const free = unitsByProject.get(p.id)!.filter((u) => u.status === 'available');
  const hold = Math.round(free.length * (p.notReleasedShare ?? 0));
  free.slice(free.length - hold).forEach((u) => (u.status = 'notReleased'));
  const open = free.slice(0, free.length - hold);
  const reserved = p.lifecycle === 'construction' ? Math.max(1, Math.round(open.length * 0.08)) : Math.round(open.length * 0.2);
  open.slice(0, reserved).forEach((u) => (u.status = 'reserved'));
}

// ----------------------------------------------------- installments etc. ---

const installments: Installment[] = [];
const buyerPayments: BuyerPayment[] = [];
const paymentKeys = new Set<string>();

/** Sales left unpaid on purpose: the overdue story, concentrated in one project. */
const debtorSales = new Set<string>();
const openForDebt = developerSales.filter(
  (s) => !s.cancelledAt && s.contractDate < '2026-07-01' && s.contractDate > '2025-03-01',
);
for (const pid of ['p04', 'p04', 'p04', 'p13', 'p08', 'p21', 'p01']) {
  const c = openForDebt.find((s) => s.projectId === pid && !debtorSales.has(s.id));
  if (c) debtorSales.add(c.id);
}

for (const sale of developerSales) {
  const project = projectSeeds.find((p) => p.id === sale.projectId)!;
  const plan: Installment[] = [];
  const P = sale.priceEur;
  const add = (due: string, amount: number) => plan.push({ saleId: sale.id, due, amountEur: Math.round(amount) });
  const cash = !debtorSales.has(sale.id) && rnd() < 0.3;
  if (cash) {
    add(addDays(sale.contractDate, 7), P);
  } else if (project.handover > addDays(sale.contractDate, 90)) {
    add(addDays(sale.contractDate, 3), P * 0.35);
    const months = Math.max(1, Math.floor(daysBetween(sale.contractDate, project.handover) / 30) - 1);
    for (let i = 1; i <= months; i++) add(addDays(sale.contractDate, 30 * i), (P * 0.35) / months);
    add(project.handover, P * 0.3);
  } else {
    add(addDays(sale.contractDate, 3), P * 0.5);
    for (let i = 1; i <= 6; i++) add(addDays(sale.contractDate, 30 * i), (P * 0.5) / 6);
  }
  const drift = P - plan.reduce((a, i) => a + i.amountEur, 0);
  plan[plan.length - 1].amountEur += drift;
  installments.push(...plan);

  const debtor = debtorSales.has(sale.id);
  const stopAt = debtor ? addDays(AS_OF, -int(35, 110)) : undefined;
  let paid = 0;
  for (const inst of plan) {
    if (inst.due > AS_OF) break;
    if (sale.cancelledAt && inst.due > sale.cancelledAt) break;
    if (stopAt && inst.due > stopAt) break;
    // Late payers exist in history; the open overdue story is the debtors above.
    const r = rnd();
    const recent = inst.due > addDays(AS_OF, -60);
    const lag = recent || r < 0.9 ? int(-3, 5) : r < 0.97 ? int(8, 30) : int(30, 55);
    let date = addDays(inst.due, lag);
    if (date > AS_OF) continue;
    if (inst.due > addDays(AS_OF, -7) && rnd() < 0.5) continue;
    while (paymentKeys.has(`${sale.id}|${date}|${inst.amountEur}`)) date = addDays(date, -1);
    paymentKeys.add(`${sale.id}|${date}|${inst.amountEur}`);
    buyerPayments.push({ saleId: sale.id, date, amountEur: inst.amountEur });
    paid += inst.amountEur;
  }
  if (sale.cancelledAt && paid > 0) {
    buyerPayments.push({ saleId: sale.id, date: addDays(sale.cancelledAt, int(5, 20)) > AS_OF ? AS_OF : addDays(sale.cancelledAt, int(5, 20)), amountEur: -Math.round(paid * 0.9) });
  }
}

// ---------------------------------------------------------- agency deals ---

const agencyDeals: AgencyDeal[] = [];
let dealNo = 0;
const nextDealId = () => `d${String(++dealNo).padStart(4, '0')}`;

for (const sale of developerSales.filter((s) => s.channel === 'agency' && s.contractDate >= '2024-01-01')) {
  const commission = Math.round(sale.priceEur * 0.05);
  const first = Math.round(commission / 2);
  const id = nextDealId();
  sale.agencyDealId = id;
  agencyDeals.push({
    id,
    closedAt: sale.contractDate,
    ...(sale.cancelledAt ? { cancelledAt: sale.cancelledAt } : {}),
    propertyType: 'newBuild',
    own: true,
    projectId: sale.projectId,
    priceEur: sale.priceEur,
    commissionEur: commission,
    managers: assignManagers(sale.contractDate),
    buyerCountry: country(),
    commissionSchedule: [
      { due: addDays(sale.contractDate, 14), amountEur: first },
      { due: addDays(sale.contractDate, 75), amountEur: commission - first },
    ],
  });
}

const thirdPartyCount: Record<string, number> = { [CURRENT]: 4, [PREVIOUS]: 5 };
const resaleCount: Record<string, number> = { [CURRENT]: 8, [PREVIOUS]: 9 };
for (const m of ['2024-01', '2024-04', '2024-07', ...MONTHS]) {
  const seasonal = [0.8, 0.8, 1, 1.1, 1.2, 1.1, 1, 1, 1.1, 1.2, 1, 0.85][+m.slice(5, 7) - 1];
  const nThird = thirdPartyCount[m] ?? Math.round(between(2, 6) * seasonal);
  const nResale = resaleCount[m] ?? Math.round(between(5, 10) * seasonal);
  const last = minDate(monthEnd(m), AS_OF);
  for (let i = 0; i < nThird; i++) {
    const closedAt = randomDateIn(`${m}-01`, last);
    const price = round(between(110_000, 380_000), 1000);
    const commission = Math.round(price * between(0.04, 0.06));
    agencyDeals.push({
      id: nextDealId(),
      closedAt,
      propertyType: 'newBuild',
      own: false,
      priceEur: price,
      commissionEur: commission,
      managers: assignManagers(closedAt),
      buyerCountry: country(),
      commissionSchedule: [{ due: addDays(closedAt, 30), amountEur: commission }],
    });
  }
  for (let i = 0; i < nResale; i++) {
    const closedAt = randomDateIn(`${m}-01`, last);
    const price = round(between(85_000, 320_000), 1000);
    const commission = Math.round(price * 0.04);
    agencyDeals.push({
      id: nextDealId(),
      closedAt,
      propertyType: 'resale',
      own: false,
      priceEur: price,
      commissionEur: commission,
      managers: assignManagers(closedAt),
      buyerCountry: country(),
      commissionSchedule: [{ due: addDays(closedAt, 5), amountEur: commission }],
    });
  }
}
// One resale deal falls through in September.
const resaleToCancel = agencyDeals.find((d) => d.propertyType === 'resale' && d.closedAt.startsWith(PREVIOUS));
if (resaleToCancel) resaleToCancel.cancelledAt = '2026-09-08';
agencyDeals.sort((a, b) => a.closedAt.localeCompare(b.closedAt));

// Commission payments: mostly on time; three developer tranches left overdue.
const commissionPayments: CommissionPayment[] = [];
const overdueCandidates = agencyDeals.filter(
  (d) => d.own && !d.cancelledAt && d.commissionSchedule.some((c) => daysBetween(c.due, AS_OF) >= 31 && daysBetween(c.due, AS_OF) <= 58),
);
const overdueDeals = new Set(overdueCandidates.slice(0, 3).map((d) => d.id));
for (const deal of agencyDeals) {
  for (const item of deal.commissionSchedule) {
    if (item.due > AS_OF) continue;
    if (deal.cancelledAt && item.due > deal.cancelledAt) continue;
    const late = daysBetween(item.due, AS_OF);
    if (overdueDeals.has(deal.id) && late >= 31 && late <= 58) continue;
    const r = rnd();
    const date = addDays(item.due, r < 0.88 ? int(-4, 6) : int(9, 14));
    if (date > AS_OF) continue;
    commissionPayments.push({ dealId: deal.id, date, amountEur: item.amountEur });
  }
}
commissionPayments.sort((a, b) => a.date.localeCompare(b.date));

// ----------------------------------------------------------------- plans ---

const DAYMS = (d: string) => new Date(toMs(d)).getUTCDay();
function workingShare(asOf: string): number {
  const m = asOf.slice(0, 7);
  let all = 0;
  let done = 0;
  for (let d = `${m}-01`; d <= monthEnd(m); d = addDays(d, 1)) {
    if (DAYMS(d) === 0 || DAYMS(d) === 6) continue;
    all += 1;
    if (d <= asOf) done += 1;
  }
  return done / all;
}
function accruedIn(m: string): { eur: number; deals: number } {
  let eur = 0;
  let deals = 0;
  for (const d of agencyDeals) {
    if (d.closedAt.startsWith(m) && d.closedAt <= AS_OF) {
      eur += d.commissionEur;
      deals += 1;
    }
    if (d.cancelledAt?.startsWith(m)) {
      eur -= d.commissionEur;
      deals -= 1;
    }
  }
  return { eur, deals };
}

const agencyPlans: AgencyPlan[] = [];
const managerPlans: ManagerPlan[] = [];
for (const m of MONTHS) {
  const a = accruedIn(m);
  // History: plans a bit above results; now: 92% of the pace expected by today.
  const ratio = m === CURRENT ? 0.92 * workingShare(AS_OF) : between(0.8, 1.05);
  const commissionEur = round(a.eur / ratio, 5000);
  agencyPlans.push({ month: m, commissionEur, deals: Math.round(a.deals / (m === CURRENT ? workingShare(AS_OF) : ratio)) });
  const team = managersOn(monthEnd(m) > AS_OF ? AS_OF : monthEnd(m));
  const weightSum = team.reduce((s, x) => s + (talent.get(x.id) ?? 1), 0);
  for (const mgr of team) {
    managerPlans.push({ month: m, managerId: mgr.id, commissionEur: round((commissionEur * (talent.get(mgr.id) ?? 1)) / weightSum, 500) });
  }
}

// Sales plan and the first payments expected from new sales (down payments).
const developerPlans: DeveloperPlan[] = MONTHS.map((m) => ({
  month: m,
  salesUnits: m === CURRENT ? 30 : 26,
  salesEur: m === CURRENT ? 6_000_000 : 5_200_000,
  newSalesCollectionsEur: m === CURRENT ? 2_600_000 : 2_000_000,
}));

// ---------------------------------------------------------------- issues ---

const issues: Issue[] = [
  {
    key: 'agency:commission-overdue',
    owner: 'Денис Орлов',
    action: { ru: 'согласовать график оплаты', en: 'agree a payment schedule' },
    due: '2026-09-30',
  },
  {
    key: 'agency:plan-pace',
    owner: 'Игорь Ковалёв',
    action: { ru: 'усилить показы по зависшим лотам', en: 'push viewings on stalled listings' },
    due: '2026-10-02',
  },
  {
    key: 'project:p04:schedule',
    owner: BURAK,
    action: { ru: 'усилить график подрядчика', en: 'reinforce the contractor schedule' },
    due: '2026-10-05',
  },
  {
    key: 'project:p02:schedule',
    owner: SERVET,
    action: { ru: 'подтвердить покупателям новую дату', en: 'confirm the new date to buyers' },
    due: '2026-10-01',
  },
  {
    key: 'project:p17:report',
    owner: CEM,
    action: { ru: 'запросить отчёт и фото площадки', en: 'request a report and site photos' },
    due: '2026-09-28',
  },
  {
    key: 'developer:buyer-overdue',
    owner: 'Елена Швец',
    action: { ru: 'уведомления и звонки должникам', en: 'notices and calls to debtors' },
    due: '2026-10-02',
  },
];

// ---------------------------------------------------------------- output ---

const data: DashboardData = {
  meta: { company: 'STAYPROPERTY', asOf: AS_OF, generatedAt: `${AS_OF}T10:30:00+03:00`, demo: true },
  managers,
  agencyDeals,
  commissionPayments,
  agencyPlans,
  managerPlans,
  projects,
  reports,
  units,
  developerSales,
  installments,
  buyerPayments: buyerPayments.sort((a, b) => a.date.localeCompare(b.date)),
  developerPlans,
  issues,
};

const out = new URL('../public/data/demo.json', import.meta.url);
writeFileSync(out, JSON.stringify(data));
console.log(
  `demo.json: ${agencyDeals.length} agency deals, ${developerSales.length} developer sales, ` +
    `${installments.length} installments, ${reports.length} reports, ${units.length} units`,
);
