import type { ISODate, Lang, Month } from '../data/types.ts';

function decimal(value: number, digits: number, lang: Lang): string {
  const s = value.toFixed(digits);
  return lang === 'ru' ? s.replace('.', ',') : s;
}

/**
 * Compact euro amount for the TV: €184k, €24,5k, €4,28M, €31,4M.
 * "k"/"M" are explained in the footer legend.
 */
export function eur(value: number, lang: Lang): string {
  const sign = value < 0 ? '−' : '';
  const v = Math.abs(value);
  let body: string;
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    body = `${decimal(m, m >= 10 ? 1 : 2, lang)}M`;
  } else if (v >= 1_000) {
    const k = v / 1_000;
    body = k < 100 && Math.round(k * 10) % 10 !== 0 ? `${decimal(k, 1, lang)}k` : `${Math.round(k)}k`;
  } else {
    body = `${Math.round(v)}`;
  }
  return `${sign}€${body}`;
}

/** Full amount with thousands separators: €11 200. */
export function eurFull(value: number, lang: Lang): string {
  const n = Math.round(value).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-GB').replace(/ /g, ' ');
  return `€${n}`;
}

export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

export function signedPct(share: number): string {
  const v = Math.round(share * 100);
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}%`;
}

const MONTHS: Record<Lang, string[]> = {
  ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

const MONTHS_FULL: Record<Lang, string[]> = {
  ru: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};

export function monthShort(month: Month, lang: Lang): string {
  return MONTHS[lang][Number(month.slice(5, 7)) - 1];
}

export function monthYear(dateOrMonth: string, lang: Lang): string {
  return `${MONTHS[lang][Number(dateOrMonth.slice(5, 7)) - 1]} ${dateOrMonth.slice(0, 4)}`;
}

export function monthYearFull(dateOrMonth: string, lang: Lang): string {
  return `${MONTHS_FULL[lang][Number(dateOrMonth.slice(5, 7)) - 1]} ${dateOrMonth.slice(0, 4)}`;
}

/** 26.09.2026 */
export function date(d: ISODate): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
}

/** 26.09 */
export function dayMonth(d: ISODate): string {
  return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
}

/** Russian plural: plural(3, ['сделка','сделки','сделок']). */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
