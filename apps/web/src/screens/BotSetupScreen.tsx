import { useState } from 'react';
import { choiceClass, TopBar, useGo, type SideKind } from '../components/ui';
import { BOT_LEVELS, type BotLevel } from '../game/bot';
import { useT } from '../i18n';
import { FieldGroup, SideSegmented, TimeChips, type TimeControl } from './setup';

export function BotSetupScreen() {
  const t = useT();
  const go = useGo();
  const [level, setLevel] = useState<BotLevel>(2);
  const [side, setSide] = useState<SideKind>('white');
  const [time, setTime] = useState<TimeControl>('none');
  return (
    <section className="k-screen" data-screen="bot-setup" data-component="BotSetupScreen">
      <TopBar />
      <main className="k-page">
        <h1 className="k-page__title">{t('bot.title')}</h1>
        <FieldGroup label={t('bot.level')}>
          <div className="k-choice-grid">
            {BOT_LEVELS.map((n) => (
              <button
                key={n}
                className={choiceClass('k-choice', level === n)}
                data-component="Choice"
                onClick={() => setLevel(n)}
              >
                <span className="k-pips">
                  {BOT_LEVELS.map((p) => (
                    <span
                      key={p}
                      className={p <= n ? 'k-pips__pip k-pips__pip--on' : 'k-pips__pip'}
                    ></span>
                  ))}
                </span>
                <span className="k-choice__title">{t(`bot.level${n}`)}</span>
                <span className="k-choice__sub">{t(`bot.level${n}Sub`)}</span>
              </button>
            ))}
          </div>
        </FieldGroup>
        <FieldGroup label={t('common.color')}>
          <SideSegmented value={side} onChange={setSide} />
        </FieldGroup>
        <FieldGroup label={t('common.timeControl')}>
          <TimeChips value={time} onChange={setTime} />
        </FieldGroup>
        <div className="k-page__footer">
          <button
            className="k-button k-button--primary k-button--lg k-button--block"
            onClick={go('game', { mode: 'bot', fixture: 'start', level: String(level), side })}
          >
            <span>{t('bot.start')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}
