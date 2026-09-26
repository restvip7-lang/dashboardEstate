import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AgencyDeal, DashboardData, DeveloperSale, Installment, Project } from '../data/types.ts';
import { validateData } from '../data/validate.ts';
import { eur } from '../i18n/format.ts';
import { agencyMonth, commissionReceivables, managerResults, pace, salesStructure } from './agency.ts';
import { elapsedWorkingShare, sameDayIn } from './dates.ts';
import {
  buyerDebt,
  collectionsPlan,
  plannedReadiness,
  projectStatus,
  readiness,
  scheduleStatus,
  unitCounts,
} from './developer.ts';
import { buildModel } from './model.ts';

function deal(p: Partial<AgencyDeal> & { id: string; closedAt: string }): AgencyDeal {
  return {
    propertyType: 'resale',
    own: false,
    priceEur: 100_000,
    commissionEur: 4_000,
    managers: [{ managerId: 'm1', share: 1 }],
    buyerCountry: 'TR',
    commissionSchedule: [{ due: p.closedAt, amountEur: p.commissionEur ?? 4_000 }],
    ...p,
  };
}

describe('agency month', () => {
  const deals = [
    deal({ id: 'a', closedAt: '2026-08-10', cancelledAt: '2026-09-05' }),
    deal({ id: 'b', closedAt: '2026-09-02' }),
    deal({ id: 'c', closedAt: '2026-09-20' }),
  ];

  it('reverses a cancellation in the month it happens and keeps the closed month', () => {
    const aug = agencyMonth(deals, [], [], '2026-08', '2026-09-26');
    const sep = agencyMonth(deals, [], [], '2026-09', '2026-09-26');
    expect(aug.accruedEur).toBe(4_000);
    expect(aug.deals).toBe(1);
    expect(sep.accruedEur).toBe(4_000); // +4000 +4000 −4000
    expect(sep.deals).toBe(1);
    expect(sep.cancellations).toBe(1);
  });

  it('ignores deals after the as-of date', () => {
    expect(agencyMonth(deals, [], [], '2026-09', '2026-09-10').accruedEur).toBe(0);
  });

  it('keeps the 2×2 structure consistent with the month total', () => {
    const s = salesStructure(deals, '2026-09', '2026-09-26');
    expect(s.total.commissionEur).toBe(agencyMonth(deals, [], [], '2026-09', '2026-09-26').accruedEur);
  });
});

describe('commission receivables', () => {
  const d = deal({
    id: 'x',
    closedAt: '2026-06-01',
    commissionEur: 10_000,
    commissionSchedule: [
      { due: '2026-06-15', amountEur: 5_000 },
      { due: '2026-09-20', amountEur: 5_000 },
    ],
  });

  it('applies partial payments to the oldest dues and respects the grace period', () => {
    const r = commissionReceivables([d], [{ dealId: 'x', date: '2026-06-20', amountEur: 3_000 }], '2026-09-26');
    expect(r.totalEur).toBe(7_000);
    expect(r.overdueEur).toBe(2_000); // June tranche; September one is within 15 days
    expect(r.notYetDueEur).toBe(5_000);
    expect(r.overdueDeals[0].daysLate).toBe(103);
  });

  it('drops cancelled deals', () => {
    const cancelled = { ...d, cancelledAt: '2026-07-01' };
    expect(commissionReceivables([cancelled], [], '2026-09-26').totalEur).toBe(0);
  });
});

describe('plan pace', () => {
  it('uses working days elapsed', () => {
    // September 2026 has 22 working days; the 26th (Saturday) closes the 19th.
    expect(elapsedWorkingShare('2026-09-26')).toBeCloseTo(19 / 22, 5);
    const p = pace(220_000, 180_000, '2026-09-26');
    expect(p.expectedEur).toBeCloseTo(190_000, 0);
    expect(p.status).toBe('watch');
    expect(pace(220_000, 150_000, '2026-09-26').status).toBe('behind');
    expect(pace(220_000, 200_000, '2026-09-26').status).toBe('ok');
  });

  it('compares with the same days of the previous month', () => {
    expect(sameDayIn('2026-08', '2026-09-26')).toBe('2026-08-26');
    expect(sameDayIn('2026-02', '2026-03-31')).toBe('2026-02-28');
  });
});

describe('manager results', () => {
  it('splits joint deals so managers sum to the department total', () => {
    const deals = [
      deal({ id: 'j', closedAt: '2026-09-03', commissionEur: 6_000, managers: [{ managerId: 'm1', share: 0.5 }, { managerId: 'm2', share: 0.5 }] }),
      deal({ id: 'k', closedAt: '2026-09-04', commissionEur: 2_000 }),
    ];
    const managers = [
      { id: 'm1', name: 'A', department: 'sales' as const, start: '2020-01-01' },
      { id: 'm2', name: 'B', department: 'sales' as const, start: '2020-01-01' },
    ];
    const r = managerResults(deals, managers, [{ month: '2026-09', managerId: 'm1', commissionEur: 4_000 }], ['2026-09'], '2026-09-26');
    expect(r.map((x) => x.commissionEur)).toEqual([5_000, 3_000]);
    expect(r[0].shareOfPlan).toBe(1.25);
  });
});

describe('construction', () => {
  const project: Project = {
    id: 'p',
    name: 'P',
    city: 'Аланья',
    district: 'Оба',
    lifecycle: 'construction',
    plannedHandover: '2026-12-31',
    responsible: 'X',
    baseline: [
      { stage: 'foundation', weight: 40, start: '2026-01-01', end: '2026-01-31' },
      { stage: 'frame', weight: 60, start: '2026-02-01', end: '2026-03-03' },
    ],
  };

  it('interpolates planned readiness linearly within stages', () => {
    expect(plannedReadiness(project, '2026-02-16')).toBeCloseTo(40 + 60 * 0.5, 5);
    expect(plannedReadiness(project, '2027-01-01')).toBe(100);
  });

  it('weights stage completion', () => {
    const r = { projectId: 'p', date: '2026-02-16', forecastHandover: '2026-12-31', stagePct: { foundation: 100, frame: 25, mep: 0, facade: 0, finishing: 0, landscaping: 0 } };
    expect(readiness(project, r)).toBe(55);
    const s = projectStatus(project, [r], '2026-03-01')!;
    expect(s.deviationPts).toBeCloseTo(-15, 5);
    expect(s.status).toBe('delay');
    expect(s.stale).toBe(true); // 13 days old
  });

  it('classifies schedule status by lag and slip', () => {
    expect(scheduleStatus(-2, 0)).toBe('ok');
    expect(scheduleStatus(-4, 0)).toBe('risk');
    expect(scheduleStatus(-1, 20)).toBe('risk');
    expect(scheduleStatus(-8, 0)).toBe('delay');
    expect(scheduleStatus(0, 61)).toBe('delay');
  });
});

describe('developer money', () => {
  const sales: DeveloperSale[] = [
    { id: 's1', unitId: 'u1', projectId: 'p', contractDate: '2026-05-01', priceEur: 100_000, channel: 'agency' },
    { id: 's2', unitId: 'u2', projectId: 'p', contractDate: '2026-09-10', priceEur: 100_000, channel: 'direct' },
  ];
  const installments: Installment[] = [
    { saleId: 's1', due: '2026-08-01', amountEur: 10_000 },
    { saleId: 's1', due: '2026-09-22', amountEur: 10_000 },
    { saleId: 's1', due: '2026-10-10', amountEur: 10_000 },
    { saleId: 's2', due: '2026-09-15', amountEur: 30_000 },
  ];

  it('fixes the collections plan to contracts existing on the 1st, plus planned first payments', () => {
    expect(collectionsPlan(installments, sales, '2026-09')).toBe(10_000);
    expect(collectionsPlan(installments, sales, '2026-09', 25_000)).toBe(35_000);
  });

  it('separates overdue from expected within 30 days', () => {
    const d = buyerDebt(installments, [{ saleId: 's2', date: '2026-09-15', amountEur: 30_000 }], sales, '2026-09-26');
    expect(d.overdueEur).toBe(10_000);
    expect(d.overdueContracts).toBe(1);
    expect(d.expected30Eur).toBe(20_000); // 22.09 (within grace) + 10.10
  });
});

describe('validation', () => {
  it('finds broken shares, unknown links and duplicate payments', () => {
    const data = {
      meta: { company: 'X', asOf: '2026-09-26', generatedAt: '', demo: true },
      managers: [{ id: 'm1', name: 'A', department: 'sales', start: '2020-01-01' }],
      agencyDeals: [deal({ id: 'd1', closedAt: '2026-09-01', managers: [{ managerId: 'm1', share: 0.6 }] })],
      commissionPayments: [
        { dealId: 'd1', date: '2026-09-02', amountEur: 100 },
        { dealId: 'd1', date: '2026-09-02', amountEur: 100 },
        { dealId: 'nope', date: '2026-09-02', amountEur: 100 },
      ],
      agencyPlans: [],
      managerPlans: [],
      projects: [],
      reports: [],
      units: [],
      developerSales: [],
      installments: [],
      buyerPayments: [],
      developerPlans: [],
      issues: [],
    } as DashboardData;
    const messages = validateData(data).map((p) => p.message).join('\n');
    expect(messages).toContain('shares sum to 0.60');
    expect(messages).toContain('appears twice');
    expect(messages).toContain('unknown deal nope');
  });
});

describe('format', () => {
  it('prints compact euro amounts for the TV', () => {
    expect(eur(184_000, 'ru')).toBe('€184k');
    expect(eur(24_500, 'ru')).toBe('€24,5k');
    expect(eur(24_500, 'en')).toBe('€24.5k');
    expect(eur(4_280_000, 'ru')).toBe('€4,28M');
    expect(eur(31_400_000, 'en')).toBe('€31.4M');
  });
});

describe('demo data', () => {
  const data = JSON.parse(readFileSync(new URL('../../public/data/demo.json', import.meta.url), 'utf8')) as DashboardData;
  const model = buildModel(data);

  it('passes validation', () => {
    expect(model.problems).toEqual([]);
  });

  it('keeps breakdowns consistent with totals', () => {
    const a = model.agency;
    const byManagers = a.monthLeaders.reduce((s, r) => s + r.commissionEur, 0);
    expect(byManagers).toBeCloseTo(a.current.accruedEur, 0);
    expect(a.structure.total.commissionEur).toBeCloseTo(a.current.accruedEur, 0);
    expect(a.structure.total.deals).toBe(a.current.deals);
    expect(a.countries.reduce((s, c) => s + c.deals, 0)).toBe(a.current.deals);
    const u = unitCounts(data.units);
    expect(u.sold + u.reserved + u.available + u.notReleased).toBe(data.units.length);
  });

  it('tells the intended story', () => {
    const d = model.developer;
    expect(d.counts).toMatchObject({ construction: 14, risk: 2, delay: 1 });
    expect(d.construction[0].project.name).toBe('Exodus Panorama Residence');
    expect(d.construction.find((s) => s.project.name === 'Villa Rabbit Hill')?.stale).toBe(true);
    expect(model.agency.pace.status).toBe('watch');
    expect(model.agency.receivables.overdueDeals.length).toBe(3);
  });
});
