import { ArrowLeft } from 'lucide-react';
import { applyMove, initialState, type GameState } from '@korgool/engine';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../app';
import { BoardHost } from '../board/Board';
import { playMove, type Highlight, type MotionFrame } from '../board/motion';
import { useBoardLayout } from '../board/useLayout';
import { TopBar, useGo } from '../components/ui';
import { useT } from '../i18n';

/** Step 2 of 6 — «tap pit 7» (index 6). Only this step is designed so far. */
const STEP_PIT = 6;

export function TutorialScreen() {
  const t = useT();
  const go = useGo();
  const { speed, isStatic } = useApp();
  const layout = useBoardLayout();
  const [st, setSt] = useState<GameState>(initialState);
  const [frame, setFrame] = useState<MotionFrame | null>(null);
  const [done, setDone] = useState<Highlight | null>(null);
  const fxRef = useRef<SVGSVGElement>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const play = async (i: number) => {
    if (frame || done) return;
    const mv = applyMove(st, (i % 9) + 1);
    const res = await playMove(st, mv.events, {
      layout,
      me: 'white',
      speed: isStatic ? 'off' : speed,
      render: (f) => flushSync(() => setFrame(f)),
      fx: () => fxRef.current,
      cancelled: () => !alive.current,
    });
    if (!alive.current) return;
    setSt(mv.state);
    setDone(res.hl);
    setFrame(null);
  };

  const board = frame
    ? {
        state: frame.state,
        interactive: false,
        lastFrom: frame.hl.lastFrom,
        lastTo: frame.hl.lastTo,
        pitClass: frame.pitClass ?? {},
        kazanClass: frame.kazanClass ?? {},
        capture: frame.capture ?? null,
      }
    : done
      ? { state: st, interactive: false, lastFrom: done.lastFrom, lastTo: done.lastTo }
      : { state: st, legalOnly: [STEP_PIT], hint: STEP_PIT };

  return (
    <section className="k-screen k-tutorial" data-screen="tutorial" data-component="TutorialScreen">
      <TopBar
        title={t('tutorial.title')}
        end={
          <button className="k-button k-button--ghost k-button--sm" onClick={go('home')}>
            <span>{t('tutorial.skip')}</span>
          </button>
        }
      />
      <div className="k-tutorial__body">
        <aside className="k-coach" data-component="CoachMark">
          <span className="k-coach__step">{t('tutorial.step', { n: 2, total: 6 })}</span>
          <div className="k-progress" data-component="Progress">
            <span className="k-progress__seg k-progress__seg--done"></span>
            <span className="k-progress__seg k-progress__seg--current"></span>
            <span className="k-progress__seg"></span>
            <span className="k-progress__seg"></span>
            <span className="k-progress__seg"></span>
            <span className="k-progress__seg"></span>
          </div>
          <div className="k-coach__title">{t('tutorial.tapPit')}</div>
          <p className="k-coach__text">{t('tutorial.tapPitSub')}</p>
          <div className="k-coach__actions">
            <button className="k-button k-button--ghost-inverse k-button--sm" onClick={go('home')}>
              <ArrowLeft />
              <span>{t('common.back')}</span>
            </button>
          </div>
        </aside>
        <div className="k-tutorial__board">
          <div className="k-board-host" data-board-host="tutorial">
            <BoardHost
              {...board}
              layout={layout}
              uid="tut"
              onPit={(i) => void play(i)}
              fxRef={fxRef}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
