import { Diagram } from '../board/Diagram';
import { TopBar } from '../components/ui';
import { DIAGRAMS } from '../game/fixtures';
import { useT } from '../i18n';

function Figure({ id }: { id: keyof typeof DIAGRAMS }) {
  const t = useT();
  const d = DIAGRAMS[id];
  const labels =
    d.labels && Object.fromEntries(Object.entries(d.labels).map(([k, key]) => [k, t(key)]));
  return (
    <figure className="k-figure" data-component="RuleFigure">
      <div>
        <Diagram d={labels ? { ...d, labels } : d} uid={`kd-${id}`} />
      </div>
      <figcaption className="k-figure__caption">{t(`rules.${id}Caption`)}</figcaption>
    </figure>
  );
}

const SECTIONS = [
  { id: 'board', figure: false },
  { id: 'sow', figure: true },
  { id: 'capture', figure: true },
  { id: 'tuzdyk', figure: true },
  { id: 'win', figure: false },
] as const;

export function RulesScreen() {
  const t = useT();
  return (
    <section className="k-screen" data-screen="rules" data-component="RulesScreen">
      <TopBar />
      <main className="k-page k-page--article">
        <h1 className="k-page__title">{t('rules.title')}</h1>
        <article className="k-article" data-component="Article">
          {SECTIONS.map((s) => (
            <section key={s.id} className="k-article__section">
              <h2 className="k-article__heading">{t(`rules.${s.id}Title`)}</h2>
              <p className="k-article__text">{t(`rules.${s.id}Text`)}</p>
              {s.figure && <Figure id={s.id as keyof typeof DIAGRAMS} />}
            </section>
          ))}
        </article>
      </main>
    </section>
  );
}
