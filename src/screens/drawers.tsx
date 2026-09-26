import type { Issue, Lang, Manager } from '../data/types.ts';
import type { DashboardModel } from '../metrics/model.ts';
import { date, dayMonth, eur, eurFull, monthYearFull } from '../i18n/format.ts';
import type { Strings } from '../i18n/strings.ts';
import { Drawer } from '../components/Frame.tsx';

export type DrawerState = { kind: 'receivables' } | { kind: 'debt' } | { kind: 'project'; id: string } | null;

export function Drawers({
  state,
  model,
  issues,
  managers,
  t,
  lang,
  onClose,
}: {
  state: DrawerState;
  model: DashboardModel;
  issues: Issue[];
  managers: Manager[];
  t: Strings;
  lang: Lang;
  onClose: () => void;
}) {
  const managerName = (id: string) => managers.find((m) => m.id === id)?.name ?? id;
  const projectName = (id?: string) => model.developer.construction.find((s) => s.project.id === id)?.project.name;

  const r = model.agency.receivables;
  const receivables = (
    <Drawer open={state?.kind === 'receivables'} title={t.receivableTitle} onClose={onClose} closeLabel={t.close}>
      <div className="dstats">
        <div className="dstat">
          <div className="l">{t.receivable}</div>
          <div className="v">{eur(r.totalEur, lang)}</div>
        </div>
        <div className="dstat">
          <div className="l">{t.overdue}</div>
          <div className="v red">{eur(r.overdueEur, lang)}</div>
        </div>
      </div>
      {r.overdueDeals.length > 0 && (
        <div className="dnote red">
          <b>{t.overdueNote(r.overdueDeals.length, Math.max(...r.overdueDeals.map((x) => x.daysLate)))}</b>
          {t.notYetDue(eur(r.notYetDueEur, lang))}
        </div>
      )}
      <div className="dh">{t.overdueDeals}</div>
      <div className="dlist">
        {r.overdueDeals.map((x) => (
          <div className="dl" key={x.deal.id}>
            <span className="l">
              {projectName(x.deal.projectId) ?? (x.deal.propertyType === 'resale' ? t.resale : t.newBuild)} ·{' '}
              {x.deal.managers.map((m) => managerName(m.managerId)).join(', ')}
              <small>
                {x.deal.id} · {date(x.deal.closedAt)} · {t.days(x.daysLate)}
              </small>
            </span>
            <span className="v red">{eurFull(x.overdueEur, lang)}</span>
          </div>
        ))}
      </div>
    </Drawer>
  );

  const debt = model.developer.debt;
  const allProjects = new Map(model.developer.construction.map((s) => [s.project.id, s.project.name]));
  const debtDrawer = (
    <Drawer open={state?.kind === 'debt'} title={t.debtTitle} onClose={onClose} closeLabel={t.close}>
      <div className="dstats">
        <div className="dstat">
          <div className="l">{t.overduePayments}</div>
          <div className="v red">{eur(debt.overdueEur, lang)}</div>
        </div>
        <div className="dstat">
          <div className="l">{t.expected30}</div>
          <div className="v">{eur(debt.expected30Eur, lang)}</div>
        </div>
      </div>
      <div className="dh">{t.byProject}</div>
      <div className="dlist">
        {[...debt.overdueByProject.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([pid, v]) => (
            <div className="dl" key={pid}>
              <span className="l">{allProjects.get(pid) ?? pid}</span>
              <span className="v red">{eurFull(v, lang)}</span>
            </div>
          ))}
      </div>
    </Drawer>
  );

  const ps = state?.kind === 'project' ? model.developer.construction.find((s) => s.project.id === state.id) : undefined;
  const issue = ps
    ? (issues.find((i) => i.key === `project:${ps.project.id}:schedule`) ?? issues.find((i) => i.key === `project:${ps.project.id}:report`))
    : undefined;
  const milestone = ps ? (ps.factPct >= 95 ? 1 : 0) : 0;
  const riskText = ps
    ? ps.status === 'ok' && !ps.stale
      ? t.noRisk
      : [
          ps.deviationPts < -0.5 ? `${Math.round(ps.deviationPts)} ${t.pts}` : '',
          ps.slipDays > 0 ? `${t.forecast}: +${t.days(ps.slipDays)}` : '',
          ps.stale ? `${t.lastReport}: ${t.days(ps.reportAgeDays)}` : '',
        ]
          .filter(Boolean)
          .join(' · ')
    : '';
  const project = (
    <Drawer open={Boolean(ps)} title={ps?.project.name ?? ''} onClose={onClose} closeLabel={t.close}>
      {ps && (
        <>
          <div className="dstats">
            <div className="dstat">
              <div className="l">{t.readiness}</div>
              <div className="v">{Math.round(ps.factPct)}%</div>
            </div>
            <div className="dstat">
              <div className="l">{t.planToday}</div>
              <div className="v">{Math.round(ps.planPct)}%</div>
            </div>
          </div>
          <div className="dh">{t.milestones}</div>
          <div className="miles">
            {[t.msConstruction, t.msPermit, t.msHandover, t.msTitle].map((label, i) => (
              <div key={label} className={`mile ${i < milestone ? 'done' : i === milestone ? 'now' : ''}`}>
                <span className="ln" />
                <span className="dt" />
                <span className="lb">{label}</span>
              </div>
            ))}
          </div>
          <div className="dlist">
            <div className="dl">
              <span className="l">{t.location}</span>
              <span className="v">
                {ps.project.city}, {ps.project.district}
              </span>
            </div>
            <div className="dl">
              <span className="l">{t.currentWorks}</span>
              <span className="v">{t.stages[ps.stage]}</span>
            </div>
            <div className="dl">
              <span className="l">{t.approvedDate}</span>
              <span className="v">{monthYearFull(ps.project.plannedHandover, lang)}</span>
            </div>
            <div className="dl">
              <span className="l">{t.forecast}</span>
              <span className="v" style={{ color: ps.slipDays > 0 ? 'var(--amber)' : undefined }}>
                {monthYearFull(ps.forecastHandover, lang)}
              </span>
            </div>
            <div className="dl">
              <span className="l">{t.lastReport}</span>
              <span className="v" style={{ color: ps.stale ? 'var(--amber)' : undefined }}>
                {date(ps.report.date)}
              </span>
            </div>
          </div>
          <div className={`dnote ${ps.status === 'delay' ? 'red' : ps.status === 'ok' && !ps.stale ? 'ok' : ''}`}>
            <b>{t.mainRisk}</b>
            {riskText}
          </div>
          <div className="dlist">
            <div className="dl">
              <span className="l">{t.owner}</span>
              <span className="v">{issue?.owner ?? ps.project.responsible}</span>
            </div>
            <div className="dl">
              <span className="l">{t.action}</span>
              <span className="v">
                {issue ? `${issue.action[lang]} · ${t.until} ${dayMonth(issue.due)}` : t.noAction}
              </span>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );

  return (
    <>
      {receivables}
      {debtDrawer}
      {project}
    </>
  );
}
