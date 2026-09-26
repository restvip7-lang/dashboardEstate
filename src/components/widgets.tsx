import type { Lang } from '../data/types.ts';
import type { Signal } from '../metrics/attention.ts';
import type { AgencyMonth } from '../metrics/agency.ts';
import type { ProjectStatus } from '../metrics/developer.ts';
import { dayMonth, eur, monthShort, monthYear, pct } from '../i18n/format.ts';
import type { Strings } from '../i18n/strings.ts';
import { Icon } from './common.tsx';

// ------------------------------------------------------------ plan / fact ---

const STEPS = [10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000, 2_000_000, 2_500_000, 5_000_000];

/** Axis maximum with five even gridlines. */
export function niceAxis(max: number): { top: number; step: number } {
  const step = STEPS.find((s) => s * 5 >= max) ?? Math.ceil(max / 5);
  return { top: step * 5, step };
}

export function PlanFactChart({
  months,
  expectedEur,
  lang,
}: {
  months: AgencyMonth[];
  expectedEur: number;
  lang: Lang;
}) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.accruedEur, m.planCommissionEur ?? 0)));
  const { top, step } = niceAxis(max);
  const h = (v: number) => `${Math.max(0, (v / top) * 100)}%`;
  const last = months.length - 1;
  return (
    <div className="chart">
      <div className="plot">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="gl" style={{ bottom: `${i * 20}%` }}>
            <span>{i === 0 ? '0' : eur(step * i, lang).replace('€', '')}</span>
          </div>
        ))}
        <div className="cols">
          {months.map((m, i) => (
            <div className="col" key={m.month}>
              <div className="bar fact" style={{ height: h(m.accruedEur) }}>
                <b>{eur(m.accruedEur, lang).replace('€', '')}</b>
              </div>
              {m.planCommissionEur !== undefined && (
                <div className="bar plan" style={{ height: h(m.planCommissionEur) }}>
                  <b>{eur(m.planCommissionEur, lang).replace('€', '')}</b>
                </div>
              )}
              {i === last && expectedEur > 0 && <div className="exp" style={{ bottom: h(expectedEur) }} />}
            </div>
          ))}
        </div>
      </div>
      <div className="months">
        {months.map((m, i) => (
          <span key={m.month} className={i === last ? 'cur' : ''}>
            {monthShort(m.month, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- attention ---

export function signalText(s: Signal, t: Strings, lang: Lang): { value: string; text: string } {
  const n = s.numbers;
  switch (s.kind) {
    case 'commission-overdue':
      return { value: eur(n.eur, lang), text: t.sigCommissionOverdue(n.deals, n.maxDays) };
    case 'plan-pace':
      return { value: `${Math.round(n.pct)}%`, text: t.sigPlanPace(eur(n.expectedEur, lang), eur(n.factEur, lang)) };
    case 'schedule': {
      const value = n.slipDays > 0 ? `+${t.days(n.slipDays)}` : `${Math.round(n.deviationPts)} ${t.pts}`;
      const tail = n.impactEur > 0 ? t.sigSchedule(eur(n.impactEur, lang)) : t.sigScheduleNoImpact;
      return { value, text: `${s.projectName} · ${tail}` };
    }
    case 'buyer-overdue':
      return { value: eur(n.eur, lang), text: t.sigBuyerOverdue(n.contracts) };
    case 'stale-report':
      return { value: t.days(n.ageDays), text: `${s.projectName} · ${t.sigStaleReport}` };
  }
}

export function SignalItem({
  signal,
  t,
  lang,
  onClick,
  tall = false,
}: {
  signal: Signal;
  t: Strings;
  lang: Lang;
  onClick?: () => void;
  /** Value, text and owner on separate lines, for narrow columns. */
  tall?: boolean;
}) {
  const { value, text } = signalText(signal, t, lang);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`alert ${signal.severity === 'danger' ? 'red' : ''} ${onClick ? 'click' : ''} ${tall ? 'tall' : ''}`}
      onClick={onClick}
    >
      <Icon name="alert" />
      <div className="body">
        <div className="top">
          <span className="v">{value}</span>
          <span className="d">{text}</span>
        </div>
        <div className="o">
          <b>{signal.owner ?? t.noOwner}</b> · {signal.action ? signal.action[lang] : t.noAction}
          {signal.due ? ` ${t.until} ${dayMonth(signal.due)}` : ''}
        </div>
      </div>
    </Tag>
  );
}

export function AllClear({ t }: { t: Strings }) {
  return (
    <div className="alert none">
      <Icon name="check" style={{ color: 'var(--green)' }} />
      <div className="body">
        <span className="v">{t.allClear}</span>
      </div>
    </div>
  );
}

// ------------------------------------------------------ construction table ---

export function ConstructionTable({
  rows,
  t,
  lang,
  onOpen,
}: {
  rows: ProjectStatus[];
  t: Strings;
  lang: Lang;
  onOpen: (projectId: string) => void;
}) {
  return (
    <div className="tbl">
      <div className="tr th">
        <div>{t.project}</div>
        <div>{t.stage}</div>
        <div>{t.factPlan}</div>
        <div>{t.planDate}</div>
        <div>{t.forecast}</div>
        <div>{t.status}</div>
      </div>
      {rows.map((s) => {
        const statusCls = s.status === 'delay' ? 'danger' : s.status === 'risk' ? 'warn' : 'ok';
        const dateCls = s.slipDays > 60 ? 'big' : s.slipDays > 0 ? 'shift' : '';
        return (
          <button className="tr" key={s.project.id} onClick={() => onOpen(s.project.id)}>
            <div className="pcell">
              <span className="pthumb">
                <Icon name="building" width={1.8} />
              </span>
              <div className="ptext">
                <div className="pname">{s.project.name}</div>
                <div className="ploc">
                  {s.project.city}
                  {s.project.district !== s.project.city ? `, ${s.project.district}` : ''}
                </div>
              </div>
            </div>
            <div className="stage">{t.stages[s.stage]}</div>
            <div>
              <div className="pnums">
                <b>{Math.round(s.factPct)}%</b> · {Math.round(s.planPct)}%
              </div>
              <div className="ptrack">
                <div className="pfill" style={{ width: `${s.factPct}%` }} />
                <div className="pmark" style={{ left: `${s.planPct}%` }} />
              </div>
            </div>
            <div className="date">{monthYear(s.project.plannedHandover, lang)}</div>
            <div className={`date ${dateCls}`}>{monthYear(s.forecastHandover, lang)}</div>
            <div>
              <div className={`status ${statusCls}`}>
                <span className="sdot" />
                {s.status === 'ok' ? t.onTrack : s.slipDays > 0 ? `+${t.days(s.slipDays)}` : `${Math.round(s.deviationPts)} ${t.pts}`}
              </div>
              <div className={`rep ${s.stale ? 'stale' : ''}`}>
                {t.report} {dayMonth(s.report.date)}
                {s.stale ? ` · ${t.stale}` : ''}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

export function shareLabel(v: number | undefined): string {
  return v === undefined ? '—' : pct(v);
}
