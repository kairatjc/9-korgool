import { LogIn } from 'lucide-react';
import { Logo, TopBar, useGo } from '../components/ui';
import { useT } from '../i18n';

export function SignInScreen() {
  const t = useT();
  const go = useGo();
  return (
    <section className="k-screen" data-screen="sign-in" data-component="SignInScreen">
      <TopBar logo={false} />
      <main className="k-page k-page--center">
        <Logo />
        <p className="k-page__lead">{t('signin.lead')}</p>
        <div className="k-page__stack">
          {/* Google's official «G» mark is not part of the design yet. */}
          <button
            className="k-button k-button--ink k-button--lg k-button--block"
            onClick={go('home', { auth: '1' })}
          >
            <LogIn />
            <span>{t('signin.google')}</span>
          </button>
          <button className="k-button k-button--ghost k-button--block" onClick={go('home')}>
            <span>{t('signin.guest')}</span>
          </button>
        </div>
        <p className="k-page__note">{t('signin.note')}</p>
      </main>
    </section>
  );
}
