import { ArrowLeft, ArrowRight } from 'lucide-react';
import { applyMove, indexToPit, type GameState } from '@korgool/engine';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useApp } from '../app';
import { BoardHost } from '../board/Board';
import { playMove, type Highlight, type MotionFrame } from '../board/motion';
import { useBoardLayout } from '../board/useLayout';
import { TopBar, useGo } from '../components/ui';
import { useT } from '../i18n';
import { STEPS, stepState } from '../tutorial/steps';

/** `initialStep` is 0-based; the design route opens step 2 («tap pit 7»), the one drawn in the handoff. */
export function TutorialScreen({ initialStep = 0 }: { initialStep?: number }) {
  const t = useT();
  const go = useGo();
  const { speed, isStatic } = useApp();
  const layout = useBoardLayout();
  const [n, setN] = useState(initialStep);
  const step = STEPS[n] ?? STEPS[0]!;
  const [st, setSt] = useState<GameState>(() => stepState(step));
  const [frame, setFrame] = useState<MotionFrame | null>(null);
  const [done, setDone] = useState<Highlight | null>(null);
  const fxRef = useRef<SVGSVGElement>(null);
  const alive = useRef(true);
  const run = useRef(0);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const open = (next: number) => {
    run.current++;
    setN(next);
    setSt(stepState(STEPS[next]!));
    setFrame(null);
    setDone(null);
  };

  const play = async (i: number) => {
    if (frame || done || i !== step.pit) return;
    const id = ++run.current;
    const live = () => alive.current && run.current === id;
    const mv = applyMove(st, indexToPit(i).pit);
    const res = await playMove(st, mv.events, {
      layout,
      me: 'white',
      speed: isStatic ? 'off' : speed,
      render: (f) => flushSync(() => setFrame(f)),
      fx: () => fxRef.current,
      cancelled: () => !live(),
    });
    if (!live()) return;
    setSt(mv.state);
    setDone(res.hl);
    setFrame(null);
  };

  const last = n === STEPS.length - 1;
  const finished = step.pit === null || done !== null;
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
      : step.pit === null
        ? { state: st, interactive: false }
        : { state: st, legalOnly: [step.pit], hint: step.pit };

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
        <aside className="k-coach" data-component="CoachMark" data-step={n + 1}>
          <span className="k-coach__step">
            {t('tutorial.step', { n: n + 1, total: STEPS.length })}
          </span>
          <div className="k-progress" data-component="Progress">
            {STEPS.map((_, k) => (
              <span
                key={k}
                className={
                  k < n
                    ? 'k-progress__seg k-progress__seg--done'
                    : k === n
                      ? 'k-progress__seg k-progress__seg--current'
                      : 'k-progress__seg'
                }
              ></span>
            ))}
          </div>
          <div className="k-coach__title">{t(step.title)}</div>
          <p className="k-coach__text">{t(done && step.done ? step.done : step.text)}</p>
          <div className="k-coach__actions">
            <button
              className="k-button k-button--ghost-inverse k-button--sm"
              onClick={n === 0 ? go('home') : () => open(n - 1)}
            >
              <ArrowLeft />
              <span>{t('common.back')}</span>
            </button>
            {finished && !last && (
              <button
                className="k-button k-button--primary k-button--sm"
                onClick={() => open(n + 1)}
              >
                <span>{t('tutorial.next')}</span>
                <ArrowRight />
              </button>
            )}
            {finished && last && (
              <>
                <button
                  className="k-button k-button--primary k-button--sm"
                  onClick={go('bot-setup')}
                >
                  <span>{t('tutorial.playBot')}</span>
                </button>
                <button
                  className="k-button k-button--ghost-inverse k-button--sm"
                  onClick={go('home')}
                >
                  <span>{t('over.home')}</span>
                </button>
              </>
            )}
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
