import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lang } from './data/types.ts';
import { buildModel } from './metrics/model.ts';
import { date, monthYearFull } from './i18n/format.ts';
import { STRINGS } from './i18n/strings.ts';
import { Footer, Header } from './components/Frame.tsx';
import type { Mode } from './components/Frame.tsx';
import { AgencyOverview, AgencyTeam } from './screens/agency.tsx';
import { DeveloperConstruction, DeveloperPortfolio, TABLE_ROWS_FULL } from './screens/developer.tsx';
import { Drawers } from './screens/drawers.tsx';
import type { DrawerState } from './screens/drawers.tsx';
import { useDashboardData } from './useDashboardData.ts';

type ScreenId = 'agency-overview' | 'agency-team' | 'developer-portfolio' | 'developer-construction';

interface Step {
  screen: ScreenId;
  mode: Mode;
  /** Page of the construction table. */
  page?: number;
}

const SCREENS: ScreenId[] = ['agency-overview', 'agency-team', 'developer-portfolio', 'developer-construction'];
const REFRESH_MS = 15 * 60 * 1000;
/** Detail panels close and rotation resumes after this long without input. */
const IDLE_RESUME_MS = 120 * 1000;
const CURSOR_HIDE_MS = 3000;

const params = new URLSearchParams(window.location.search);
const DATA_URL = params.get('data') ?? './data/demo.json';
const INTERVAL_SEC = Math.max(5, Number(params.get('interval') ?? 25));
/** Phones, tablets and narrow windows scroll instead of rotating. */
const COMPACT = window.matchMedia('(max-width: 1000px), (max-aspect-ratio: 5/4)').matches;
const START_PAUSED = params.get('autoplay') === '0' || (COMPACT && params.get('autoplay') !== '1');

function initialLang(): Lang {
  const fromUrl = params.get('lang');
  if (fromUrl === 'ru' || fromUrl === 'en') return fromUrl;
  try {
    const saved = window.localStorage.getItem('dashboard.lang');
    if (saved === 'ru' || saved === 'en') return saved;
  } catch {
    // Storage may be unavailable (private mode); fall back to Russian.
  }
  return 'ru';
}

export function App() {
  const { data, loadedAt, offline, error } = useDashboardData(DATA_URL, REFRESH_MS);
  const model = useMemo(() => (data ? buildModel(data) : undefined), [data]);
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [stepIndex, setStepIndex] = useState(() => {
    const n = Number(params.get('screen'));
    return n >= 1 && n <= 4 ? n - 1 : 0;
  });
  const [paused, setPaused] = useState(START_PAUSED);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [cursorHidden, setCursorHidden] = useState(false);
  const lastInput = useRef(Date.now());
  const t = STRINGS[lang];

  const pages = model ? Math.max(1, Math.ceil(model.developer.construction.length / TABLE_ROWS_FULL)) : 1;
  const steps: Step[] = useMemo(
    () => [
      { screen: 'agency-overview', mode: 'agency' },
      { screen: 'agency-team', mode: 'agency' },
      { screen: 'developer-portfolio', mode: 'developer' },
      ...Array.from({ length: pages }, (_, page) => ({ screen: 'developer-construction' as const, mode: 'developer' as const, page })),
    ],
    [pages],
  );
  const step = steps[stepIndex % steps.length];

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem('dashboard.lang', l);
    } catch {
      // Not critical: the language just won't be remembered.
    }
  }, []);

  const go = useCallback((index: number) => setStepIndex(((index % steps.length) + steps.length) % steps.length), [steps.length]);
  const goScreen = useCallback((screen: ScreenId) => go(steps.findIndex((s) => s.screen === screen)), [go, steps]);
  const goMode = useCallback((mode: Mode) => goScreen(mode === 'agency' ? 'agency-overview' : 'developer-portfolio'), [goScreen]);

  // Rotation: one step per interval, stopped while paused or a detail panel is open.
  useEffect(() => {
    if (paused || drawer) return;
    const timer = window.setTimeout(() => go(stepIndex + 1), INTERVAL_SEC * 1000);
    return () => window.clearTimeout(timer);
  }, [paused, drawer, stepIndex, go]);

  useEffect(() => {
    if (COMPACT) window.scrollTo(0, 0);
  }, [stepIndex]);

  // Idle: close detail panels, hide the cursor.
  useEffect(() => {
    const markInput = () => {
      lastInput.current = Date.now();
      setCursorHidden(false);
    };
    const timer = window.setInterval(() => {
      const idle = Date.now() - lastInput.current;
      if (idle > CURSOR_HIDE_MS) setCursorHidden(true);
      if (idle > IDLE_RESUME_MS) setDrawer(null);
    }, 1000);
    window.addEventListener('mousemove', markInput);
    window.addEventListener('mousedown', markInput);
    window.addEventListener('keydown', markInput);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('mousemove', markInput);
      window.removeEventListener('mousedown', markInput);
      window.removeEventListener('keydown', markInput);
    };
  }, []);

  // Keyboard and presentation clickers (they send PageUp/PageDown, arrows, B or ".").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === 'ArrowDown') go(stepIndex + 1);
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'ArrowUp') go(stepIndex - 1);
      else if (k === ' ' || k === 'b' || k === 'B' || k === '.' || k === 'p' || k === 'P') setPaused((p) => !p);
      else if (k === 'l' || k === 'L') setLang(lang === 'ru' ? 'en' : 'ru');
      else if (k === 'm' || k === 'M') goMode(step.mode === 'agency' ? 'developer' : 'agency');
      else if (k === 'Escape') setDrawer(null);
      else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => undefined);
      } else if (k >= '1' && k <= '4') goScreen(SCREENS[Number(k) - 1]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, goMode, goScreen, stepIndex, lang, setLang, step.mode]);

  if (!model || !data) {
    return (
      <div className="viewport">
        <div className="center-msg">{error ? `${t.loadError}: ${error}` : t.loading}</div>
      </div>
    );
  }

  const screenProps = { model, t, lang, open: setDrawer };
  const titles: Record<ScreenId, string> = {
    'agency-overview': t.agencyTitle,
    'agency-team': t.teamScreenTitle,
    'developer-portfolio': t.developerTitle,
    'developer-construction': t.allProjects,
  };

  return (
    <div className={`viewport ${cursorHidden && !COMPACT ? 'hidden-cursor' : ''}`}>
      <div className="screen">
        <Header
          t={t}
          lang={lang}
          mode={step.mode}
          period={monthYearFull(model.asOf, lang)}
          demo={model.demo}
          onMode={goMode}
          onLang={setLang}
        />
        <h1 className="page-title">{titles[step.screen]}</h1>

        {step.screen === 'agency-overview' && <AgencyOverview {...screenProps} />}
        {step.screen === 'agency-team' && <AgencyTeam {...screenProps} />}
        {step.screen === 'developer-portfolio' && (
          <DeveloperPortfolio {...screenProps} onAllProjects={() => goScreen('developer-construction')} />
        )}
        {step.screen === 'developer-construction' && (
          <DeveloperConstruction
            {...screenProps}
            page={step.page ?? 0}
            pages={pages}
            onPage={(page) => go(steps.findIndex((s) => s.screen === 'developer-construction' && s.page === page))}
          />
        )}

        <Footer
          t={t}
          screens={SCREENS.length}
          active={SCREENS.indexOf(step.screen)}
          onScreen={(i) => goScreen(SCREENS[i])}
          paused={paused || drawer !== null}
          intervalSec={INTERVAL_SEC}
          stepKey={`${stepIndex}-${paused}-${drawer ? 1 : 0}`}
          dataAt={date(model.asOf)}
          loadedAt={loadedAt ? loadedAt.toTimeString().slice(0, 5) : '—'}
          problems={model.problems.length}
        />

        {offline && (
          <div className="banner">
            {t.offline} {date(model.asOf)}
          </div>
        )}

        <Drawers
          state={drawer}
          model={model}
          issues={data.issues}
          managers={data.managers}
          t={t}
          lang={lang}
          onClose={() => setDrawer(null)}
          onOpen={setDrawer}
        />
      </div>
    </div>
  );
}
