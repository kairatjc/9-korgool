import type { ReactNode } from 'react';
import { KazanSample, PitSample } from '../board/Diagram';
import { TopBar } from '../components/ui';
import { useT } from '../i18n';

type State = [name: string, cls: string[], count: number, side?: 'opponent', label?: string];

const STATES: State[] = [
  ['default', [], 9],
  ['hover', ['k-pit--legal', 'k-pit--hover'], 9],
  ['pressed', ['k-pit--legal', 'k-pit--pressed'], 9],
  ['legal', ['k-pit--legal'], 9],
  ['disabled', ['k-pit--disabled'], 9],
  ['last-move-from', ['k-pit--last-move-from'], 0],
  ['last-move-to', ['k-pit--last-move-to'], 5],
  ['capture', ['k-pit--capture'], 10],
  ['tuzdyk-mine', ['k-pit--tuzdyk-mine'], 0, 'opponent'],
  ['tuzdyk-opponent', ['k-pit--tuzdyk-opponent'], 0],
  ['hint', ['k-pit--hint', 'k-pit--legal'], 9],
  ['preview-target', ['k-pit--preview-target'], 9, 'opponent', '+10'],
];
const BALLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 23, 40];
const KAZAN = [0, 9, 40, 100, 162];

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="k-spec__cell">
      <div className="k-spec__art">{children}</div>
      <span className="k-spec__label">{label}</span>
    </div>
  );
}

export function SpecScreen() {
  const t = useT();
  return (
    <section className="k-screen" data-screen="spec" data-component="SpecScreen">
      <TopBar logo={false} title={t('spec.title')} end={null} />
      <main className="k-page k-page--wide k-spec">
        <section className="k-profile__block">
          <h2 className="k-section-title">{t('spec.states')}</h2>
          <div className="k-spec__grid">
            {STATES.map(([name, cls, count, side, label]) => (
              <Cell key={name} label={name}>
                <PitSample count={count} cls={cls} side={side} label={label} />
              </Cell>
            ))}
          </div>
        </section>
        <section className="k-profile__block">
          <h2 className="k-section-title">{t('spec.balls')}</h2>
          <div className="k-spec__grid">
            {BALLS.map((n) => (
              <Cell key={n} label={String(n)}>
                <PitSample count={n} />
              </Cell>
            ))}
          </div>
        </section>
        <section className="k-profile__block">
          <h2 className="k-section-title">{t('spec.kazan')}</h2>
          <div className="k-spec__grid k-spec__grid--wide">
            {KAZAN.map((n) => (
              <Cell key={n} label={String(n)}>
                <KazanSample count={n} />
              </Cell>
            ))}
          </div>
        </section>
        <section className="k-profile__block">
          <h2 className="k-section-title">{t('spec.clock')}</h2>
          <div className="k-spec__row">
            <span className="k-clock">4:12</span>
            <span className="k-clock k-clock--running">3:47</span>
            <span className="k-clock k-clock--running k-clock--low">0:14</span>
            <span className="k-clock k-clock--flag">0:00</span>
          </div>
        </section>
      </main>
    </section>
  );
}
