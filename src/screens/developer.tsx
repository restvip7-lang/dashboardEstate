import { eur, monthYearFull, pct, place } from '../i18n/format.ts';
import { Icon, Money, Ring } from '../components/common.tsx';
import { AllClear, ConstructionTable, SignalItem } from '../components/widgets.tsx';
import type { ScreenProps } from './agency.tsx';
import { Delta, sameDaysLabel } from './agency.tsx';

export const TABLE_ROWS_PORTFOLIO = 6;

/** Project name without the generic suffix, for tight spaces. */
export function shortName(name: string): string {
  return name.replace(/\s*\((Villa|Вилла)\)$/, '').replace(/\s+Residence$/, '');
}
export const TABLE_ROWS_FULL = 7;

export function DeveloperPortfolio({ model, t, lang, open, onAllProjects }: ScreenProps & { onAllProjects: () => void }) {
  const d = model.developer;
  const u = d.units;
  const collectedShare = d.collectionsPlanEur > 0 ? d.collectionsEur / d.collectionsPlanEur : 0;
  const soldShare = u.total > 0 ? u.sold / u.total : 0;
  const atRisk = d.counts.risk + d.counts.delay;
  const atRiskList = d.construction.filter((s) => s.status !== 'ok');
  const next = d.upcoming[0];
  const after = d.upcoming[1];
  const topSignal = d.signals[0];

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="kpi-label ic">
            <span className="kicon c">
              <Icon name="euro" width={2.4} />
            </span>
            {t.collections}
          </div>
          <div className="kpi-main">
            <div className="kpi-value">
              <Money text={eur(d.collectionsEur, lang)} />
            </div>
            <Ring share={collectedShare}>
              {pct(collectedShare)}
              <small>{t.ofPlan}</small>
            </Ring>
          </div>
          <div className="kpi-sub">
            {t.monthPlan} <b>{eur(d.collectionsPlanEur, lang)}</b>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label ic">
            <span className="kicon b">
              <Icon name="doc" />
            </span>
            {t.salesMonth}
          </div>
          <div className="kpi-main">
            <div className="kpi-value">
              {d.sales.units}
              <span className="u">{t.units(d.sales.units)}</span>
            </div>
            <div className="kpi-side">
              <Delta now={d.sales.units} before={d.salesPreviousToDate.units} />
              <span>{sameDaysLabel(model.asOf, lang, d.salesPrevious.month)}</span>
            </div>
          </div>
          <div className="kpi-sub">
            <b>{eur(d.sales.eur, lang)}</b> · {d.sales.viaAgency} {t.viaAgency}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label ic">
            <span className="kicon b">
              <Icon name="home" />
            </span>
            {t.availableForSale}
          </div>
          <div className="kpi-main">
            <div className="kpi-value">
              {u.available}
              <span className="u">{t.units(u.available)}</span>
            </div>
            <Ring share={soldShare}>
              {pct(soldShare)}
              <small>{t.sold}</small>
            </Ring>
          </div>
          <div className="kpi-sub">
            {t.atListPrice} <b>{eur(u.availableListEur, lang)}</b>
          </div>
        </div>

        <button className="kpi click" onClick={() => open({ kind: 'risks' })}>
          <div className="kpi-label ic">
            <span className="kicon a">
              <Icon name="alert" width={2.2} />
            </span>
            {t.delayRisk}
            <Icon name="chevronRight" width={2.5} style={{ width: '1.625rem', height: '1.625rem', marginLeft: 'auto', color: 'var(--cyan)' }} />
          </div>
          <div className="kpi-main">
            <div className="kpi-value">{atRisk}</div>
            <div className="risk-list">
              {atRiskList.slice(0, 3).map((s) => (
                <div key={s.project.id} className={s.status === 'delay' ? 'r' : 'a'}>
                  <span className="dot" />
                  <span className="nm">{shortName(s.project.name)}</span>
                  <span className="dd">{s.slipDays > 0 ? `+${s.slipDays} ${t.daysShort}` : `${Math.round(s.deviationPts)} ${t.pts}`}</span>
                </div>
              ))}
              {atRiskList.length > 3 && <div className="more">+{atRiskList.length - 3}</div>}
            </div>
          </div>
          <div className="kpi-sub">
            {t.inConstructionLong(d.counts.construction)} · <span className="c">{t.showCauses}</span>
          </div>
        </button>
      </div>

      <div className="row" style={{ flex: '1 1 0' }}>
        <div className="panel" style={{ flex: '1.78 1 0' }}>
          <div className="panel-head">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.125rem', flexWrap: 'wrap' }}>
              <div className="panel-title" style={{ fontSize: '2rem' }}>
                {t.constructionTitle}
              </div>
              <div className="panel-note">
                {t.shownOf(Math.min(TABLE_ROWS_PORTFOLIO, d.construction.length), d.construction.length)} · {t.problemsFirst}
              </div>
            </div>
            <div className="pager">
              <button onClick={onAllProjects} aria-label={t.allProjects}>
                <Icon name="chevronRight" width={2.5} />
              </button>
            </div>
          </div>
          <ConstructionTable
            rows={d.construction.slice(0, TABLE_ROWS_PORTFOLIO)}
            t={t}
            lang={lang}
            onOpen={(id) => open({ kind: 'project', id })}
          />
        </div>

        <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: '0.875rem', minWidth: 0, minHeight: 0 }}>
          <div className="panel compact" style={{ flex: '1.3 1 0' }}>
            <div className="panel-head">
              <div className="panel-title">{t.nextHandover}</div>
            </div>
            {next && (
              <button className="hcard" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'project', id: next.project.id })}>
                <div className="nm">{next.project.name}</div>
                <div className="mid">
                  <Icon name="calendar" width={1.8} style={{ width: '2.75rem', height: '2.75rem', color: '#8fb3de', flex: '0 0 auto' }} />
                  <div>
                    <div className="dt">{monthYearFull(next.forecastHandover, lang)}</div>
                    <div className="dts">
                      {place(next.project.city, next.project.district)} · {next.slipDays > 0 ? t.handoverShift : t.handoverOnTrack}
                    </div>
                  </div>
                  <Ring share={next.factPct / 100} size={4.5}>
                    {Math.round(next.factPct)}%
                  </Ring>
                </div>
                {after && (
                  <div className="nx">
                    {t.next}: {after.project.name} · {monthYearFull(after.forecastHandover, lang)}
                    {after.slipDays > 0 && <b> · +{t.days(after.slipDays)}</b>}
                  </div>
                )}
              </button>
            )}
          </div>

          <div className="panel compact" style={{ flex: '1.2 1 0' }}>
            <div className="panel-head">
              <div className="panel-title">{t.attention}</div>
            </div>
            <div className="alerts">
              {topSignal ? (
                <SignalItem
                  signal={topSignal}
                  t={t}
                  lang={lang}
                  tall
                  onClick={() =>
                    topSignal.kind === 'buyer-overdue'
                      ? open({ kind: 'debt' })
                      : open({ kind: 'project', id: topSignal.key.split(':')[1] })
                  }
                />
              ) : (
                <AllClear t={t} />
              )}
            </div>
          </div>

          <div className="panel compact" style={{ flex: '0.9 1 0' }}>
            <div className="panel-head">
              <div className="panel-title">{t.overduePayments}</div>
            </div>
            <button className="money" style={{ textAlign: 'left' }} onClick={() => open({ kind: 'debt' })}>
              <span className="ic">
                <Icon name="coins" />
              </span>
              <div>
                <div className="v">{eur(d.debt.overdueEur, lang)}</div>
                <div className="s">
                  {d.debt.overdueContracts} {t.contracts(d.debt.overdueContracts)}
                </div>
              </div>
              <div className="exp">
                <div className="l">{t.expected30}</div>
                <div className="n">{eur(d.debt.expected30Eur, lang)}</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function DeveloperConstruction({
  model,
  t,
  lang,
  open,
  page,
  pages,
  onPage,
}: ScreenProps & { page: number; pages: number; onPage: (page: number) => void }) {
  const list = model.developer.construction;
  const rows = list.slice(page * TABLE_ROWS_FULL, (page + 1) * TABLE_ROWS_FULL);
  return (
    <div className="panel" style={{ flex: '1 1 0' }}>
      <div className="panel-head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.125rem', flexWrap: 'wrap' }}>
          <div className="panel-title" style={{ fontSize: '2rem' }}>
            {t.constructionTitle}
          </div>
          <div className="panel-note">
            {t.shownOf(rows.length, list.length)} · {t.problemsFirst} · {t.clickForCard}
          </div>
        </div>
        <div className="pager">
          <button onClick={() => onPage((page - 1 + pages) % pages)} aria-label="prev">
            <Icon name="chevronLeft" width={2.5} />
          </button>
          <span className="pg">
            {page + 1}/{pages}
          </span>
          <button onClick={() => onPage((page + 1) % pages)} aria-label="next">
            <Icon name="chevronRight" width={2.5} />
          </button>
        </div>
      </div>
      <ConstructionTable rows={rows} t={t} lang={lang} onOpen={(id) => open({ kind: 'project', id })} />
    </div>
  );
}
