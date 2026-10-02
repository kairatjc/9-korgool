import { MapPin, Pencil, Settings } from 'lucide-react';
import { AvatarContent, TopBar, useGo } from '../components/ui';
import type { HistoryEntry } from '../game/fixtures';
import { useT } from '../i18n';

export interface ProfileData {
  name: string;
  initial: string;
  place: string;
  stats: { wins: number; losses: number; draws: number; tuzdyks: number };
  history: readonly HistoryEntry[];
}

const RESULT_BADGE = {
  win: 'k-badge--success',
  loss: 'k-badge--danger',
  draw: 'k-badge--muted',
} as const;
const STATS = ['wins', 'losses', 'draws', 'tuzdyks'] as const;

export function ProfileScreen({ data }: { data: ProfileData }) {
  const t = useT();
  const go = useGo();
  return (
    <section className="k-screen" data-screen="profile" data-component="ProfileScreen">
      <TopBar
        end={
          <button className="k-icon-button" aria-label="Settings" onClick={go('settings')}>
            <Settings />
          </button>
        }
      />
      <main className="k-page k-page--wide k-profile">
        <div className="k-profile__head">
          <span className="k-avatar k-avatar--xl k-avatar--light">{data.initial}</span>
          <div className="k-profile__who">
            <h1 className="k-profile__name">{data.name}</h1>
            <div className="k-profile__place">
              <MapPin />
              <span>{data.place}</span>
            </div>
          </div>
          <button className="k-icon-button" aria-label="Edit">
            <Pencil />
          </button>
        </div>
        <div className="k-profile__block k-profile__block--stats">
          <h2 className="k-section-title">{t('profile.stats')}</h2>
          <div className="k-stats" data-component="Stats">
            {STATS.map((k) => (
              <div key={k} className="k-stats__item">
                <span className="k-stats__value">{data.stats[k]}</span>
                <span className="k-stats__label">{t(`profile.${k}`)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="k-profile__block k-profile__block--history">
          <h2 className="k-section-title">{t('profile.history')}</h2>
          <ul className="k-history" data-component="HistoryList">
            {data.history.map((h, i) => (
              <li key={i} className="k-history__item">
                <span className="k-avatar">
                  <AvatarContent person={h} />
                </span>
                <div className="k-history__main">
                  <span className="k-history__name">{h.name}</span>
                  <span className="k-history__date">{h.date}</span>
                </div>
                <div className="k-history__end">
                  <span className={`k-badge ${RESULT_BADGE[h.result]}`}>
                    {t(`result.${h.result}`)}
                  </span>
                  <span className="k-history__score">{h.score}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </section>
  );
}
