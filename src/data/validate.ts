import type { DashboardData } from './types.ts';

export interface DataProblem {
  level: 'error' | 'warning';
  message: string;
}

/**
 * Data-quality checks from the analysis (section 8): unique IDs, valid links
 * between records, consistent shares and schedules, no facts dated after the
 * "as of" date, and no suspicious duplicate payments (a file loaded twice).
 */
export function validateData(d: DashboardData): DataProblem[] {
  const problems: DataProblem[] = [];
  const err = (message: string) => problems.push({ level: 'error', message });
  const warn = (message: string) => problems.push({ level: 'warning', message });
  const asOf = d.meta.asOf;

  const uniq = (name: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) err(`${name}: duplicate id ${id}`);
      seen.add(id);
    }
    return seen;
  };
  const managerIds = uniq('managers', d.managers.map((m) => m.id));
  const dealIds = uniq('agencyDeals', d.agencyDeals.map((x) => x.id));
  const projectIds = uniq('projects', d.projects.map((x) => x.id));
  const unitIds = uniq('units', d.units.map((x) => x.id));
  const saleIds = uniq('developerSales', d.developerSales.map((x) => x.id));

  for (const deal of d.agencyDeals) {
    const shares = deal.managers.reduce((a, s) => a + s.share, 0);
    if (Math.abs(shares - 1) > 0.001) err(`deal ${deal.id}: manager shares sum to ${shares.toFixed(2)}`);
    for (const s of deal.managers) if (!managerIds.has(s.managerId)) err(`deal ${deal.id}: unknown manager ${s.managerId}`);
    const scheduled = deal.commissionSchedule.reduce((a, c) => a + c.amountEur, 0);
    if (Math.abs(scheduled - deal.commissionEur) > 1) err(`deal ${deal.id}: commission schedule ≠ commission`);
    if (deal.own && !deal.projectId) err(`deal ${deal.id}: own deal without project`);
    if (deal.projectId && !projectIds.has(deal.projectId)) err(`deal ${deal.id}: unknown project ${deal.projectId}`);
    if (deal.closedAt > asOf) err(`deal ${deal.id}: closed after the as-of date`);
  }

  const seenPayments = new Set<string>();
  for (const p of d.commissionPayments) {
    if (!dealIds.has(p.dealId)) err(`commission payment: unknown deal ${p.dealId}`);
    if (p.date > asOf) err(`commission payment for ${p.dealId}: dated after the as-of date`);
    const sig = `${p.dealId}|${p.date}|${p.amountEur}`;
    if (seenPayments.has(sig)) warn(`commission payment for ${p.dealId} on ${p.date} appears twice`);
    seenPayments.add(sig);
  }

  for (const project of d.projects) {
    const weights = project.baseline.reduce((a, s) => a + s.weight, 0);
    if (project.baseline.length > 0 && Math.abs(weights - 100) > 0.01) err(`project ${project.id}: stage weights sum to ${weights}`);
  }
  for (const r of d.reports) if (!projectIds.has(r.projectId)) err(`report: unknown project ${r.projectId}`);
  for (const u of d.units) if (!projectIds.has(u.projectId)) err(`unit ${u.id}: unknown project ${u.projectId}`);
  for (const s of d.developerSales) {
    if (!unitIds.has(s.unitId)) err(`sale ${s.id}: unknown unit ${s.unitId}`);
    if (s.agencyDealId && !dealIds.has(s.agencyDealId)) err(`sale ${s.id}: unknown agency deal ${s.agencyDealId}`);
  }
  for (const i of d.installments) if (!saleIds.has(i.saleId)) err(`installment: unknown sale ${i.saleId}`);
  const seenBuyer = new Set<string>();
  for (const p of d.buyerPayments) {
    if (!saleIds.has(p.saleId)) err(`buyer payment: unknown sale ${p.saleId}`);
    if (p.date > asOf) err(`buyer payment for ${p.saleId}: dated after the as-of date`);
    const sig = `${p.saleId}|${p.date}|${p.amountEur}`;
    if (seenBuyer.has(sig)) warn(`buyer payment for ${p.saleId} on ${p.date} appears twice`);
    seenBuyer.add(sig);
  }
  return problems;
}
