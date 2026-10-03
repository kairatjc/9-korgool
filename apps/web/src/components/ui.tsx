/* Shared app-shell pieces. Markup and classes follow design/handoff/index.html one-to-one. */
import { ArrowLeft, Bot, Check, ChevronDown, Globe } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useApp, type Params, type ScreenId } from '../app';
import { Ornament } from '../board/Sprite';
import { LANGS, useT, type Lang } from '../i18n';

/** Navigation handler for buttons / links: `onClick={useGo()('home')}`. */
export function useGo() {
  const { go } = useApp();
  return (screen: ScreenId, params?: Params) => (e?: MouseEvent) => {
    e?.preventDefault();
    go(screen, params);
  };
}

export function BackButton({ to = 'home' }: { to?: ScreenId }) {
  const go = useGo();
  return (
    <button className="k-icon-button" aria-label="Back" onClick={go(to)}>
      <ArrowLeft />
    </button>
  );
}

export function InlineLogo() {
  const t = useT();
  const { href } = useApp();
  const go = useGo();
  return (
    <a className="k-topbar__logo k-logo k-logo--inline" href={href('home')} onClick={go('home')}>
      <Ornament className="k-logo__mark" />
      <span className="k-logo__name">{t('common.appName')}</span>
    </a>
  );
}

/**
 * TopBar: [back] [logo] [title | spacer] [end].
 * `end` is rendered whenever it is passed (even empty), like `.k-topbar__end` in the handoff.
 */
export function TopBar({
  back = 'home',
  logo = true,
  title,
  end,
}: {
  back?: ScreenId;
  logo?: boolean;
  title?: ReactNode;
  end?: ReactNode;
}) {
  return (
    <header className="k-topbar" data-component="TopBar">
      <BackButton to={back} />
      {logo && <InlineLogo />}
      {title !== undefined ? (
        <div className="k-topbar__title">{title}</div>
      ) : (
        <div className="k-topbar__spacer"></div>
      )}
      {end !== undefined && <div className="k-topbar__end">{end}</div>}
    </header>
  );
}

export function Logo({
  tagline = false,
  className = '',
}: {
  tagline?: boolean;
  className?: string;
}) {
  const t = useT();
  return (
    <div className={className ? `${className} k-logo` : 'k-logo'} data-component="Logo">
      <Ornament className="k-logo__mark" />
      <h1 className="k-logo__name">{t('common.appName')}</h1>
      {tagline && <p className="k-logo__tagline">{t('common.tagline')}</p>}
    </div>
  );
}

export type SideKind = 'white' | 'black' | 'random';

export function SideDot({ side }: { side: SideKind }) {
  return <span className={`k-side-dot k-side-dot--${side}`}></span>;
}

export interface Person {
  name: string;
  initial?: string;
  icon?: 'bot';
}

/** Avatar content: an initial or a Lucide icon. */
export function AvatarContent({ person }: { person: Person }) {
  return person.icon === 'bot' ? <Bot /> : <>{person.initial ?? ''}</>;
}

/** A single-choice group whose items toggle `<base>--selected` (generic `data-choice-group` in the prototype). */
export function choiceClass(base: string, selected: boolean, extra = ''): string {
  return [base, extra, selected ? `${base}--selected` : ''].filter(Boolean).join(' ');
}

/** Language picker: a pill button opening a styled listbox (a native <select> popup can't be themed). */
export function LanguageSelect({ lang, onLang }: { lang: Lang; onLang: (lang: Lang) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    options.current[LANGS.indexOf(lang)]?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, lang]);

  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const pick = (l: Lang) => {
    onLang(l);
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    const i = options.current.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (e.key === 'Escape') close();
    else if (e.key === 'Tab') setOpen(false);
    else if (step) {
      e.preventDefault();
      options.current[(i + step + LANGS.length) % LANGS.length]?.focus();
    }
  };

  return (
    <div className="k-lang" data-component="LanguageSelect" ref={root} onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        className="k-lang__button"
        aria-label="Language"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Globe />
        <span className="k-lang__value">{t(`lang.${lang}`)}</span>
        <ChevronDown className="k-lang__chevron" />
      </button>
      {open && (
        <div className="k-lang__menu" role="listbox" aria-label="Language">
          {LANGS.map((l, i) => (
            <button
              key={l}
              ref={(el) => {
                options.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={l === lang}
              className={choiceClass('k-lang__option', l === lang)}
              onClick={() => pick(l)}
            >
              <span>{t(`lang.${l}`)}</span>
              {l === lang && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
