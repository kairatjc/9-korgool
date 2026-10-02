/* Shared app-shell pieces. Markup and classes follow design/handoff/index.html one-to-one. */
import { ArrowLeft, Bot } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useApp, type Params, type ScreenId } from '../app';
import { Ornament } from '../board/Sprite';
import { useT } from '../i18n';

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
