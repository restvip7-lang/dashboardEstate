import type { ISODate, Issue, LocalText } from '../data/types.ts';
import type { Pace, Receivables } from './agency.ts';
import type { BuyerDebt, ProjectStatus } from './developer.ts';

export type Severity = 'danger' | 'warn';

/**
 * A deviation found by a rule. What to do about it and who owns it cannot be
 * computed; it comes from the issues register (see Issue). A signal without
 * an owner is shown as such — that is itself a finding for the director.
 */
export interface Signal {
  key: string;
  area: 'agency' | 'developer';
  severity: Severity;
  kind: 'commission-overdue' | 'plan-pace' | 'schedule' | 'buyer-overdue' | 'stale-report';
  /** Money at stake, used for ordering. */
  impactEur: number;
  projectName?: string;
  numbers: Record<string, number>;
  owner?: string;
  action?: LocalText;
  due?: ISODate;
}

const RANK: Record<Severity, number> = { danger: 0, warn: 1 };

function withIssue(signal: Signal, issues: Issue[], defaultOwner?: string): Signal {
  const issue = issues.find((i) => i.key === signal.key);
  return issue
    ? { ...signal, owner: issue.owner, action: issue.action, due: issue.due }
    : { ...signal, owner: defaultOwner };
}

export function agencySignals(receivables: Receivables, monthPace: Pace, issues: Issue[]): Signal[] {
  const signals: Signal[] = [];
  if (receivables.overdueEur > 0) {
    const maxDays = Math.max(...receivables.overdueDeals.map((d) => d.daysLate));
    signals.push(
      withIssue(
        {
          key: 'agency:commission-overdue',
          area: 'agency',
          kind: 'commission-overdue',
          severity: maxDays > 30 ? 'danger' : 'warn',
          impactEur: receivables.overdueEur,
          numbers: { eur: receivables.overdueEur, deals: receivables.overdueDeals.length, maxDays },
        },
        issues,
      ),
    );
  }
  if (monthPace.status !== 'ok') {
    signals.push(
      withIssue(
        {
          key: 'agency:plan-pace',
          area: 'agency',
          kind: 'plan-pace',
          severity: monthPace.status === 'behind' ? 'danger' : 'warn',
          impactEur: monthPace.expectedEur - monthPace.factEur,
          numbers: {
            pct: monthPace.shareOfExpected * 100,
            expectedEur: monthPace.expectedEur,
            factEur: monthPace.factEur,
          },
        },
        issues,
      ),
    );
  }
  return sortSignals(signals);
}

export function developerSignals(
  construction: ProjectStatus[],
  debt: BuyerDebt,
  impactByProject: Map<string, number>,
  issues: Issue[],
): Signal[] {
  const signals: Signal[] = [];
  for (const s of construction) {
    if (s.status !== 'ok') {
      signals.push(
        withIssue(
          {
            key: `project:${s.project.id}:schedule`,
            area: 'developer',
            kind: 'schedule',
            severity: s.status === 'delay' ? 'danger' : 'warn',
            impactEur: impactByProject.get(s.project.id) ?? 0,
            projectName: s.project.name,
            numbers: { slipDays: s.slipDays, deviationPts: s.deviationPts, impactEur: impactByProject.get(s.project.id) ?? 0 },
          },
          issues,
          s.project.responsible,
        ),
      );
    }
    if (s.stale) {
      signals.push(
        withIssue(
          {
            key: `project:${s.project.id}:report`,
            area: 'developer',
            kind: 'stale-report',
            severity: 'warn',
            impactEur: 0,
            projectName: s.project.name,
            numbers: { ageDays: s.reportAgeDays },
          },
          issues,
          s.project.responsible,
        ),
      );
    }
  }
  if (debt.overdueEur > 0) {
    signals.push(
      withIssue(
        {
          key: 'developer:buyer-overdue',
          area: 'developer',
          kind: 'buyer-overdue',
          severity: 'danger',
          impactEur: debt.overdueEur,
          numbers: { eur: debt.overdueEur, contracts: debt.overdueContracts, maxDays: debt.maxDaysLate },
        },
        issues,
      ),
    );
  }
  return sortSignals(signals);
}

function sortSignals(signals: Signal[]): Signal[] {
  return signals.sort((a, b) => RANK[a.severity] - RANK[b.severity] || b.impactEur - a.impactEur);
}
