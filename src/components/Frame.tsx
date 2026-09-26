import type { ReactNode } from 'react';
import type { Lang } from '../data/types.ts';
import type { Strings } from '../i18n/strings.ts';
import { Icon, Logo } from './common.tsx';

export type Mode = 'agency' | 'developer';

export interface HeaderProps {
  t: Strings;
  lang: Lang;
  mode: Mode;
  period: string;
  demo: boolean;
  onMode: (mode: Mode) => void;
  onLang: (lang: Lang) => void;
}

export function Header({ t, lang, mode, period, demo, onMode, onLang }: HeaderProps) {
  return (
    <div className="header">
      <Logo />
      <nav className="modetabs">
        <button className={`modetab ${mode === 'agency' ? 'active' : ''}`} onClick={() => onMode('agency')}>
          {t.agency}
        </button>
        <button className={`modetab ${mode === 'developer' ? 'active' : ''}`} onClick={() => onMode('developer')}>
          {t.developer}
        </button>
      </nav>
      <div className="header-right">
        <div className="period">{period}</div>
        {demo && (
          <>
            <div className="vsep" />
            <div className="demo">{t.demo}</div>
          </>
        )}
        <div className="lang">
          <button className={lang === 'ru' ? 'active' : ''} onClick={() => onLang('ru')}>
            RU
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => onLang('en')}>
            EN
          </button>
        </div>
      </div>
    </div>
  );
}

export interface FooterProps {
  t: Strings;
  screens: number;
  active: number;
  onScreen: (index: number) => void;
  paused: boolean;
  intervalSec: number;
  /** Changes on every step so the progress bar restarts. */
  stepKey: string;
  dataAt: string;
  loadedAt: string;
  problems: number;
}

export function Footer(p: FooterProps) {
  return (
    <div className="footer">
      <span>{p.t.legend}</span>
      <div className="dots">
        {Array.from({ length: p.screens }, (_, i) => (
          <button
            key={i}
            className={i === p.active ? 'on' : ''}
            aria-label={`${i + 1}`}
            onClick={() => p.onScreen(i)}
          />
        ))}
      </div>
      <div className="right">
        {p.problems > 0 && (
          <span className="warn">
            ⚠ {p.t.dataProblems}: {p.problems}
          </span>
        )}
        <span>
          {p.t.dataAt} {p.dataAt} · {p.t.loadedAt} {p.loadedAt}
        </span>
        <span className={`status-pill ${p.paused ? 'paused' : ''}`}>
          {p.paused ? p.t.paused : p.t.auto}
          <span className="bar">
            <i
              key={p.stepKey}
              style={{
                animation: `progress ${p.intervalSec}s linear forwards`,
                animationPlayState: p.paused ? 'paused' : 'running',
              }}
            />
          </span>
        </span>
      </div>
    </div>
  );
}

export function Drawer({
  open,
  title,
  onClose,
  closeLabel,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className={`overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`drawer ${open ? 'open' : ''}`} role="dialog" aria-hidden={!open} aria-label={title}>
        <div className="dhead">
          <div className="t">{title}</div>
          <button className="dclose" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" width={2.5} />
          </button>
        </div>
        <div className="dbody">{children}</div>
      </div>
    </>
  );
}
