import { useState } from 'react';
import { SPEEDS, type Speed } from '../board/motion';
import { choiceClass, TopBar } from '../components/ui';
import { LANGS, useT, type Lang } from '../i18n';

const SPEED_KEY: Record<Speed, string> = {
  slow: 'settings.speedSlow',
  normal: 'settings.speedNormal',
  fast: 'settings.speedFast',
  off: 'settings.speedOff',
};

function Toggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      className={on ? 'k-toggle k-toggle--on' : 'k-toggle'}
      data-component="Toggle"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
    >
      <span className="k-toggle__knob"></span>
    </button>
  );
}

export interface Prefs {
  sound: boolean;
  vibration: boolean;
  flip: boolean;
}

export function SettingsScreen({
  lang,
  onLang,
  speed,
  onSpeed,
  prefs: initialPrefs = { sound: true, vibration: true, flip: false },
  onPrefs,
  onBack,
}: {
  lang: Lang;
  onLang: (lang: Lang) => void;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  prefs?: Prefs;
  onPrefs?: (prefs: Prefs) => void;
  /** Back button handler; by default it goes home. */
  onBack?: (() => void) | undefined;
}) {
  const t = useT();
  const [prefs, setPrefs] = useState(initialPrefs);
  const set = (k: keyof Prefs) => (v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    onPrefs?.(next);
  };
  return (
    <section className="k-screen" data-screen="settings" data-component="SettingsScreen">
      <TopBar onBack={onBack} />
      <main className="k-page">
        <h1 className="k-page__title">{t('settings.title')}</h1>
        <div className="k-list" data-component="SettingsList">
          <div className="k-list__item k-list__item--stack">
            <span className="k-list__title">{t('lang.label')}</span>
            <div className="k-segmented" data-component="Segmented">
              {LANGS.map((l) => (
                <button
                  key={l}
                  className={choiceClass('k-segmented__option', lang === l)}
                  onClick={() => onLang(l)}
                >
                  <span>{t(`lang.${l}`)}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="k-list__item">
            <div className="k-list__text">
              <span className="k-list__title">{t('settings.sound')}</span>
            </div>
            <Toggle on={prefs.sound} onChange={set('sound')} />
          </div>
          <div className="k-list__item">
            <div className="k-list__text">
              <span className="k-list__title">{t('settings.vibration')}</span>
              <span className="k-list__sub">{t('settings.vibrationSub')}</span>
            </div>
            <Toggle on={prefs.vibration} onChange={set('vibration')} />
          </div>
          <div className="k-list__item k-list__item--stack">
            <span className="k-list__title">{t('settings.speed')}</span>
            <div className="k-segmented" data-component="Segmented">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  className={choiceClass('k-segmented__option', speed === s)}
                  onClick={() => onSpeed(s)}
                >
                  <span>{t(SPEED_KEY[s])}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="k-list__item">
            <div className="k-list__text">
              <span className="k-list__title">{t('settings.flip')}</span>
              <span className="k-list__sub">{t('settings.flipSub')}</span>
            </div>
            <Toggle on={prefs.flip} onChange={set('flip')} />
          </div>
        </div>
      </main>
    </section>
  );
}
