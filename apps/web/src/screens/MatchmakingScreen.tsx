import { Bot } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../app';
import { Ornament } from '../board/Sprite';
import { TopBar, useGo } from '../components/ui';
import { useT } from '../i18n';

/** After this many seconds of searching the bot is offered. */
export const OFFER_BOT_AFTER = 30;

export function MatchmakingScreen({ startSeconds = 0 }: { startSeconds?: number }) {
  const t = useT();
  const go = useGo();
  const { isStatic } = useApp();
  const [sec, setSec] = useState(startSeconds);
  const [keep, setKeep] = useState(false);
  useEffect(() => {
    if (isStatic) return;
    const id = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isStatic]);
  const timer = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  return (
    <section className="k-screen" data-screen="matchmaking" data-component="MatchmakingScreen">
      <TopBar />
      <main className="k-page k-page--center">
        <div className="k-search" data-component="SearchPulse">
          <span className="k-search__ring"></span>
          <span className="k-search__ring k-search__ring--2"></span>
          <span className="k-search__ring k-search__ring--3"></span>
          <span className="k-search__core">
            <Ornament />
          </span>
        </div>
        <div className="k-search__meta">
          <div className="k-search__title">{t('mm.searching')}</div>
          <div className="k-search__timer">{timer}</div>
          <span className="k-badge k-badge--muted">{t('mm.queue')}</span>
        </div>
        {sec >= OFFER_BOT_AFTER && !keep && (
          <div className="k-card" data-component="OfferCard">
            <div className="k-card__title">{t('mm.offerTitle')}</div>
            <p className="k-card__text">{t('mm.offerText')}</p>
            <div className="k-card__actions">
              <button
                className="k-button k-button--ink k-button--block"
                onClick={go('game', { mode: 'bot', fixture: 'start' })}
              >
                <Bot />
                <span>{t('mm.offerAccept')}</span>
              </button>
              <button
                className="k-button k-button--ghost k-button--block"
                onClick={() => setKeep(true)}
              >
                <span>{t('mm.offerKeep')}</span>
              </button>
            </div>
          </div>
        )}
        <div className="k-page__footer">
          <button className="k-button k-button--block" onClick={go('home')}>
            <span>{t('common.cancel')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}
