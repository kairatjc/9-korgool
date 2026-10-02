import {
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Globe,
  GraduationCap,
  LogIn,
  Smartphone,
  Users,
} from 'lucide-react';
import { useApp } from '../app';
import { BoardHost } from '../board/Board';
import { useGo, Logo } from '../components/ui';
import { fixture } from '../game/fixtures';
import { LANGS, useT, type Lang } from '../i18n';

const START = fixture('start');

export function HomeScreen({
  signedIn,
  lang,
  onLang,
}: {
  signedIn: boolean;
  lang: Lang;
  onLang: (lang: Lang) => void;
}) {
  const t = useT();
  const go = useGo();
  const { href } = useApp();
  return (
    <section className="k-screen k-home" data-screen="home" data-component="HomeScreen">
      <header className="k-topbar" data-component="TopBar">
        <label className="k-lang" data-component="LanguageSelect">
          <Globe />
          <select
            className="k-lang__select"
            aria-label="Language"
            value={lang}
            onChange={(e) => onLang(e.target.value as Lang)}
          >
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {t(`lang.${l}`)}
              </option>
            ))}
          </select>
          <ChevronDown />
        </label>
        <div className="k-topbar__spacer"></div>
        {signedIn ? (
          <button className="k-icon-button" aria-label="Profile" onClick={go('profile')}>
            <span className="k-avatar k-avatar--sm k-avatar--light">А</span>
          </button>
        ) : (
          <button className="k-button k-button--ghost k-button--sm" onClick={go('sign-in')}>
            <LogIn />
            <span>{t('home.signIn')}</span>
          </button>
        )}
      </header>
      <main className="k-home__body">
        <Logo className="k-home__logo" tagline />
        <div className="k-home__board" aria-hidden="true">
          <div className="k-board-host" data-board-host="home">
            <BoardHost state={START} layout="h" interactive={false} uid="home" />
          </div>
        </div>
        <div className="k-home__actions">
          <button
            className="k-button k-button--primary k-button--hero k-button--block"
            onClick={go('matchmaking')}
          >
            <span className="k-button__label">{t('home.play')}</span>
            <span className="k-button__sub">{t('home.playSub')}</span>
          </button>
          <nav className="k-menu" data-component="Menu">
            <button className="k-menu__item" onClick={go('friend-create')}>
              <span className="k-menu__icon">
                <Users />
              </span>
              <span className="k-menu__label">{t('home.friend')}</span>
              <ChevronRight className="k-menu__chevron" />
            </button>
            <button className="k-menu__item" onClick={go('bot-setup')}>
              <span className="k-menu__icon">
                <Bot />
              </span>
              <span className="k-menu__label">{t('home.bot')}</span>
              <ChevronRight className="k-menu__chevron" />
            </button>
            <button
              className="k-menu__item"
              onClick={go('game', { mode: 'local', fixture: 'start' })}
            >
              <span className="k-menu__icon">
                <Smartphone />
              </span>
              <span className="k-menu__label">{t('home.local')}</span>
              <ChevronRight className="k-menu__chevron" />
            </button>
          </nav>
          <div className="k-home__links">
            <a className="k-link" href={href('rules')} onClick={go('rules')}>
              <BookOpen />
              <span>{t('home.rules')}</span>
            </a>
            <a className="k-link" href={href('tutorial')} onClick={go('tutorial')}>
              <GraduationCap />
              <span>{t('home.tutorial')}</span>
            </a>
          </div>
        </div>
      </main>
    </section>
  );
}
