import type { Issue, Lang, Manager } from '../data/types.ts';
import type { DashboardModel } from '../metrics/model.ts';
import { date, dayMonth, eur, eurFull, monthYearFull, place } from '../i18n/format.ts';
import type { Strings } from '../i18n/strings.ts';
import { Drawer } from '../components/Frame.tsx';

export type DrawerState =
  | { kind: 'receivables' }
  | { kind: 'debt' }
  | { kind: 'risks' }
  | { kind: 'project'; id: string }
  | null;

export function Drawers({
  state,
  model,
  issues,
  managers,
  t,
  lang,
  onClose,
  onOpen,
}: {
  state: DrawerState;
  model: DashboardModel;
  issues: Issue[];
  managers: Manager[];
  t: Strings;
  lang: Lang;
  onClose: () => void;
  onOpen: (d: DrawerState) => void;
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
          ps.report.note?.[lang] ?? '',
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
                {place(ps.project.city, ps.project.district)}
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

  const atRisk = model.developer.construction.filter((s) => s.status !== 'ok' || s.stale);
  const issueFor = (id: string) =>
    issues.find((i) => i.key === `project:${id}:schedule`) ?? issues.find((i) => i.key === `project:${id}:report`);
  const risks = (
    <Drawer open={state?.kind === 'risks'} title={t.risksTitle} onClose={onClose} closeLabel={t.close}>
      {atRisk.map((s) => {
        const cls = s.status === 'delay' ? 'danger' : 'warn';
        const is = issueFor(s.project.id);
        return (
          <div key={s.project.id} className={`riskcard ${cls}`}>
            <div className="rc-head">
              <span className="nm">{s.project.name}</span>
              <span className={`status ${s.status === 'ok' ? 'ok' : cls}`}>
                <span className="sdot" />
                {s.slipDays > 0 ? `+${t.days(s.slipDays)}` : s.status === 'ok' ? t.onTrack : `${Math.round(s.deviationPts)} ${t.pts}`}
              </span>
            </div>
            <div className="rc-meta">
              {place(s.project.city, s.project.district)} · {t.stages[s.stage]} ·{' '}
              {t.planVs(Math.round(s.factPct), Math.round(s.planPct), Math.round(s.deviationPts))}
            </div>
            <div className="rc-meta">
              {t.deadline(monthYearFull(s.project.plannedHandover, lang), monthYearFull(s.forecastHandover, lang))}
            </div>
            <div className="rc-cause">
              <b>{t.cause}:</b> {s.report.note?.[lang] ?? t.noCause}
            </div>
            {s.stale && <div className="rc-stale">{t.reportStaleNote(date(s.report.date), s.reportAgeDays)}</div>}
            <div className="rc-owner">
              <b>{is?.owner ?? s.project.responsible}</b> ·{' '}
              {is ? `${is.action[lang]} · ${t.until} ${dayMonth(is.due)}` : t.noAction}
            </div>
            <button className="rc-open" onClick={() => onOpen({ kind: 'project', id: s.project.id })}>
              {t.openCard}
            </button>
          </div>
        );
      })}
    </Drawer>
  );

  return (
    <>
      {receivables}
      {debtDrawer}
      {risks}
      {project}
    </>
  );
}
