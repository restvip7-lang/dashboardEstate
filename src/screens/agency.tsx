import type { Lang, Manager } from '../data/types.ts';
import { daysBetween, monthOf } from '../metrics/dates.ts';
import type { DashboardModel } from '../metrics/model.ts';
import { eur, monthShort, pct } from '../i18n/format.ts';
import type { Strings } from '../i18n/strings.ts';
import { Icon, Money, Ring } from '../components/common.tsx';
import { AllClear, PlanFactChart, SignalItem } from '../components/widgets.tsx';
import type { DrawerState } from './drawers.tsx';

export interface ScreenProps {
  model: DashboardModel;
  t: Strings;
  lang: Lang;
  open: (d: DrawerState) => void;
}

/** "к 1–26 авг." / "vs Aug 1–26": the previous month over the same days. */
export function sameDaysLabel(asOf: string, lang: Lang, prevMonth: string): string {
  const day = Number(asOf.slice(8, 10));
  const m = monthShort(prevMonth, lang);
  return lang === 'ru' ? `к 1–${day} ${m.toLowerCase()}.` : `vs ${m} 1–${day}`;
}

export function Delta({ now, before }: { now: number; before: number }) {
  if (before <= 0) return null;
  const change = now / before - 1;
  const v = Math.round(change * 100);
  return (
    <span className="delta" style={{ color: v < 0 ? 'var(--red)' : 'var(--green)' }}>
      {v < 0 ? '▼' : '▲'} {v > 0 ? '+' : v < 0 ? '−' : '±'}
      {Math.abs(v)}%
    </span>
  );
}

function isNewcomer(m: Manager, asOf: string): boolean {
  return daysBetween(m.start, asOf) < 90;
}

export function AgencyOverview({ model, t, lang, open }: ScreenProps) {
  const a = model.agency;
  const c = a.current;
  const plan = c.planCommissionEur ?? 0;
  const s = a.structure;
  const newBuild = s.newBuildOwn.deals + s.newBuildThirdParty.deals;
  const resale = s.resaleOwn.deals + s.resaleThirdParty.deals;
  const splitTotal = Math.max(1, newBuild + resale);
  const own = s.newBuildOwn.deals + s.resaleOwn.deals;
  const maxCountry = Math.max(1, ...a.countries.map((x) => x.deals));
  const leaders = a.monthLeaders.slice(0, 3);
  const yearLeader = a.yearLeaders[0];
  const received = a.dueThisMonthEur > 0 ? c.receivedEur / a.dueThisMonthEur : 0;

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label">{t.commissionMonth}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(c.accruedEur, lang)} />
            </div>
            <div className="kpi-side">
              <Delta now={c.accruedEur} before={a.previousToDate.accruedEur} />
              <span>{sameDaysLabel(model.asOf, lang, a.previous.month)}</span>
            </div>
          </div>
          <div className="kpi-sub">
            <b>{pct(a.pace.shareOfPlan)}</b> {t.ofPlan} · {t.plan} {eur(plan, lang)}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">{t.received}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(c.receivedEur, lang)} />
            </div>
            <Ring share={received}>{pct(received)}</Ring>
          </div>
          <div className="kpi-sub">{t.receivedSub}</div>
        </div>

        <div className="kpi">
          <div className="kpi-label">{t.propertySales}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(c.volumeEur, lang)} />
            </div>
          </div>
          <div className="kpi-sub">
            {c.deals} {t.deals(c.deals)} · {t.plan} {c.planDeals ?? '—'}
          </div>
        </div>

        <button className="kpi click" onClick={() => open({ kind: 'receivables' })}>
          <div className="kpi-label">
            {t.receivable}
            <Icon name="chevronRight" width={2.5} style={{ width: 26, height: 26, marginLeft: 'auto', color: 'var(--cyan)' }} />
          </div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(a.receivables.totalEur, lang)} />
            </div>
          </div>
          <div className="kpi-sub">
            {t.overdue}{' '}
            <span className="r">
              {eur(a.receivables.overdueEur, lang)} · {a.receivables.overdueDeals.length} {t.deals(a.receivables.overdueDeals.length)}
            </span>
          </div>
        </button>
      </div>

      <div className="row" style={{ flex: '1.18 1 0' }}>
        <div className="panel" style={{ flex: '1.62 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.chartTitle}</div>
            <div className="legend">
              <span>
                <i className="lg-fact" />
                {t.fact}
              </span>
              <span>
                <i className="lg-plan" />
                {t.planLegend}
              </span>
              <span>
                <i className="lg-exp" />
                {t.expectedToday}
              </span>
            </div>
          </div>
          <PlanFactChart months={a.history} expectedEur={a.pace.expectedEur} lang={lang} />
        </div>

        <div className="panel" style={{ flex: '1 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.teamTitle}</div>
          </div>
          <div className="chip">
            <Icon name="users" />
            <span>
              <b>{t.salesDept}</b> · {a.headcount} {t.managers(a.headcount)}
            </span>
          </div>
          <div className="ltable">
            {leaders.map((r, i) => (
              <div className="lrow" key={r.manager.id}>
                <div className="k">{t.place(i + 1)}</div>
                <div className="n">
                  {r.manager.name}
                  {isNewcomer(r.manager, model.asOf) && <small>{t.newcomer}</small>}
                </div>
                <div className="v">{eur(r.commissionEur, lang)}</div>
              </div>
            ))}
            {yearLeader && (
              <div className="lrow year">
                <div className="k">{t.yearLeader}</div>
                <div className="n">{yearLeader.manager.name}</div>
                <div className="v">{eur(yearLeader.commissionEur, lang)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="row" style={{ flex: '1 1 0' }}>
        <div className="panel compact" style={{ flex: '0.92 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.structure}</div>
          </div>
          <div className="split-labels">
            <span>{t.newBuild}</span>
            <span>{t.resale}</span>
          </div>
          <div className="split">
            <span className="num">{newBuild}</span>
            <div className="split-bar">
              <div className="a" style={{ width: `${(newBuild / splitTotal) * 100}%` }}>
                {pct(newBuild / splitTotal)}
              </div>
              <div className="b" style={{ width: `${(resale / splitTotal) * 100}%` }}>
                {pct(resale / splitTotal)}
              </div>
            </div>
            <span className="num">{resale}</span>
          </div>
          <div className="hr" />
          <div className="own">
            <span className="lbl">{t.ownObjects}</span>
            <span className="big">{pct(own / splitTotal)}</span>
            <span className="t">{t.ofDeals(own, newBuild + resale)}</span>
          </div>
        </div>

        <div className="panel compact" style={{ flex: '0.88 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.countries}</div>
          </div>
          <div className="hbars">
            {a.countries.map((x) => (
              <div className="hb" key={x.country}>
                <span className="l">{t.countryNames[x.country] ?? x.country}</span>
                <div className="t">
                  <div className="f" style={{ width: `${(x.deals / maxCountry) * 100}%` }} />
                </div>
                <span className="v">{x.deals}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel compact" style={{ flex: '1.35 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.attention}</div>
          </div>
          <div className="alerts">
            {a.signals.length === 0 && <AllClear t={t} />}
            {a.signals.slice(0, 2).map((sig) => (
              <SignalItem
                key={sig.key}
                signal={sig}
                t={t}
                lang={lang}
                onClick={sig.kind === 'commission-overdue' ? () => open({ kind: 'receivables' }) : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export function AgencyTeam({ model, t, lang }: ScreenProps) {
  const a = model.agency;
  const s = a.structure;
  const cell = (c: { deals: number; volumeEur: number; commissionEur: number }) =>
    c.deals === 0 ? '—' : `${eur(c.volumeEur, lang)} · ${eur(c.commissionEur, lang)}`;
  const total = Math.max(1, s.total.deals);
  const nb = {
    deals: s.newBuildOwn.deals + s.newBuildThirdParty.deals,
    volumeEur: s.newBuildOwn.volumeEur + s.newBuildThirdParty.volumeEur,
    commissionEur: s.newBuildOwn.commissionEur + s.newBuildThirdParty.commissionEur,
  };
  const rs = {
    deals: s.resaleOwn.deals + s.resaleThirdParty.deals,
    volumeEur: s.resaleOwn.volumeEur + s.resaleThirdParty.volumeEur,
    commissionEur: s.resaleOwn.commissionEur + s.resaleThirdParty.commissionEur,
  };
  const ownDeals = s.newBuildOwn.deals + s.resaleOwn.deals;
  const thirdDeals = s.newBuildThirdParty.deals + s.resaleThirdParty.deals;
  const yearLeader = a.yearLeaders[0];
  const monthName = monthShort(monthOf(model.asOf), lang);

  return (
    <>
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="kpi">
          <div className="kpi-label">{t.headcount}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              {a.headcount}
              <span className="u">{t.managers(a.headcount)}</span>
            </div>
          </div>
          <div className="kpi-sub">{t.headcountSub}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.perManager}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(a.perManagerEur, lang)} />
            </div>
          </div>
          <div className="kpi-sub">{t.perManagerSub}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">{t.rate}</div>
          <div className="kpi-main">
            <div className="kpi-value">
              {(a.effectiveRate * 100).toFixed(1).replace('.', lang === 'ru' ? ',' : '.')}%
            </div>
          </div>
          <div className="kpi-sub">{t.rateSub}</div>
        </div>
      </div>

      <div className="row" style={{ flex: '1 1 0' }}>
        <div className="panel" style={{ flex: '1.2 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">
              {t.matrixTitle} · {monthName}
            </div>
            <div className="panel-note">{t.matrixNote}</div>
          </div>
          <div className="matrix">
            <div />
            <div className="mx-h">{t.ownObjects}</div>
            <div className="mx-h">{t.thirdParty}</div>
            <div className="mx-h">{t.total}</div>

            <div className="mx-v">{t.newBuild}</div>
            <MatrixCell n={s.newBuildOwn.deals} text={cell(s.newBuildOwn)} />
            <MatrixCell n={s.newBuildThirdParty.deals} text={cell(s.newBuildThirdParty)} />
            <MatrixCell n={nb.deals} text={cell(nb)} cls="tot" />

            <div className="mx-v">{t.resale}</div>
            <MatrixCell n={s.resaleOwn.deals} text={cell(s.resaleOwn)} />
            <MatrixCell n={s.resaleThirdParty.deals} text={cell(s.resaleThirdParty)} />
            <MatrixCell n={rs.deals} text={cell(rs)} cls="tot" />

            <div className="mx-v">{t.total}</div>
            <MatrixCell n={ownDeals} text={`${pct(ownDeals / total)} ${t.shareOfDeals}`} cls="tot" />
            <MatrixCell n={thirdDeals} text={`${pct(thirdDeals / total)} ${t.shareOfDeals}`} cls="tot" />
            <MatrixCell n={s.total.deals} text={cell(s.total)} cls="all" />
          </div>
        </div>

        <div className="panel" style={{ flex: '1 1 0' }}>
          <div className="panel-head">
            <div className="panel-title">{t.rankingTitle}</div>
            <div className="panel-note">{t.rankingNote}</div>
          </div>
          <div className="rank">
            <div className="rk h">
              <div>#</div>
              <div>{t.manager}</div>
              <div>{t.personalPlan}</div>
              <div style={{ textAlign: 'right' }}>{t.commission}</div>
            </div>
            {a.monthLeaders.slice(0, 5).map((r, i) => (
              <div className="rk" key={r.manager.id}>
                <div className={`p ${i < 3 ? 'top' : ''}`}>{i + 1}</div>
                <div className="n">
                  {r.manager.name}
                  {isNewcomer(r.manager, model.asOf) && <small>{t.newcomer}</small>}
                </div>
                <div className={`pl ${(r.shareOfPlan ?? 1) < 1 ? 'lo' : ''}`}>
                  {r.shareOfPlan !== undefined ? pct(r.shareOfPlan) : '—'}
                </div>
                <div className="v">{eur(r.commissionEur, lang)}</div>
              </div>
            ))}
            {yearLeader && (
              <div className="rk" style={{ background: 'rgba(34,211,238,.06)' }}>
                <div className="p top">★</div>
                <div className="n">
                  {yearLeader.manager.name}{' '}
                  <span style={{ fontSize: 18, color: 'var(--text-dim)', fontWeight: 600 }}>· {t.yearLeader}</span>
                </div>
                <div className={`pl ${(yearLeader.shareOfPlan ?? 1) < 1 ? 'lo' : ''}`}>
                  {yearLeader.shareOfPlan !== undefined ? pct(yearLeader.shareOfPlan) : '—'}
                </div>
                <div className="v" style={{ color: 'var(--cyan)' }}>
                  {eur(yearLeader.commissionEur, lang)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function MatrixCell({ n, text, cls = '' }: { n: number; text: string; cls?: string }) {
  return (
    <div className={`mx ${cls} ${n === 0 && !cls ? 'dim' : ''}`}>
      <div className="n">{n}</div>
      <div className="s">{text}</div>
    </div>
  );
}
