import { Copy, KeyRound, MessageCircle, Send } from 'lucide-react';
import { useState } from 'react';
import { SideDot, TopBar, useGo, type SideKind } from '../components/ui';
import { useT } from '../i18n';
import { FieldGroup, SideSegmented, TimeChips, type TimeControl } from './setup';

export function FriendCreateScreen({
  onCreate,
  busy = false,
  error,
}: {
  /** Create the game on the server; without it the button only opens the waiting screen. */
  onCreate?: (time: TimeControl, side: SideKind) => void;
  busy?: boolean;
  error?: string | undefined;
} = {}) {
  const t = useT();
  const go = useGo();
  const [time, setTime] = useState<TimeControl>('10+5');
  const [side, setSide] = useState<SideKind>('white');
  return (
    <section className="k-screen" data-screen="friend-create" data-component="FriendCreateScreen">
      <TopBar />
      <main className="k-page">
        <h1 className="k-page__title">{t('friend.title')}</h1>
        <FieldGroup label={t('common.timeControl')}>
          <TimeChips value={time} onChange={setTime} />
        </FieldGroup>
        <FieldGroup label={t('common.color')}>
          <SideSegmented value={side} onChange={setSide} />
        </FieldGroup>
        <div className="k-page__footer">
          <button
            className="k-button k-button--primary k-button--lg k-button--block"
            disabled={busy}
            onClick={onCreate ? () => onCreate(time, side) : go('friend-wait', { time, side })}
          >
            <span>{t('friend.create')}</span>
          </button>
          {error && <p className="k-page__lead">{error}</p>}
          <button className="k-button k-button--ghost k-button--block" onClick={go('join-code')}>
            <KeyRound />
            <span>{t('friend.haveCode')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}

export function FriendWaitScreen({
  roomCode,
  inviteLink,
  inviteUrl = 'https://' + inviteLink,
  time = '10+5',
  side = 'white',
}: {
  roomCode: string;
  /** The link as shown, without the protocol. */
  inviteLink: string;
  /** The full link for copying and sharing. */
  inviteUrl?: string;
  time?: string;
  side?: SideKind;
}) {
  const t = useT();
  const go = useGo();
  const share = (base: string) => () =>
    window.open(base + encodeURIComponent(inviteUrl), '_blank', 'noopener');
  return (
    <section className="k-screen" data-screen="friend-wait" data-component="FriendWaitScreen">
      <TopBar back="friend-create" />
      <main className="k-page">
        <div className="k-page__stack">
          <h1 className="k-page__title">{t('friend.waitTitle')}</h1>
          <p className="k-page__lead">{t('friend.waitLead')}</p>
        </div>
        <div className="k-room-code" data-component="RoomCode">
          <span className="k-room-code__label">{t('friend.roomCode')}</span>
          <span className="k-room-code__value">{roomCode}</span>
          <div className="k-summary">
            <span className="k-badge k-badge--muted">
              {time === 'none' ? t('common.noClock') : time}
            </span>
            <span className="k-badge k-badge--muted">
              <SideDot side={side} />
              <span>{t(`common.${side}`)}</span>
            </span>
          </div>
        </div>
        <div className="k-page__stack">
          <div className="k-field" data-component="ShareField">
            <span className="k-field__value">{inviteLink}</span>
            <button
              className="k-button k-button--ink k-button--sm"
              onClick={() => void navigator.clipboard?.writeText(inviteUrl)}
            >
              <Copy />
              <span>{t('friend.copy')}</span>
            </button>
          </div>
          <div className="k-share">
            <button className="k-button" onClick={share('https://wa.me/?text=')}>
              <MessageCircle />
              <span>{t('friend.whatsapp')}</span>
            </button>
            <button className="k-button" onClick={share('https://t.me/share/url?url=')}>
              <Send />
              <span>{t('friend.telegram')}</span>
            </button>
          </div>
        </div>
        <div className="k-waiting">
          <span className="k-spinner"></span>
          <span>{t('friend.waiting')}</span>
        </div>
        <div className="k-page__footer">
          <button className="k-button k-button--ghost k-button--block" onClick={go('home')}>
            <span>{t('common.cancel')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}

export function JoinCodeScreen({
  prefill = '',
  onSubmit,
}: {
  prefill?: string;
  /** Open the game with this code; without it the button opens a local game. */
  onSubmit?: (code: string) => void;
}) {
  const t = useT();
  const go = useGo();
  const [value, setValue] = useState(prefill);
  const v = value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  return (
    <section className="k-screen" data-screen="join-code" data-component="JoinCodeScreen">
      <TopBar back="friend-create" />
      <main className="k-page">
        <div className="k-page__stack">
          <h1 className="k-page__title">{t('join.title')}</h1>
          <p className="k-page__lead">{t('join.lead')}</p>
        </div>
        <div className="k-code" data-component="CodeInput">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className={[
                'k-code__cell',
                i < v.length ? 'k-code__cell--filled' : '',
                i === Math.min(v.length, 5) && v.length < 6 ? 'k-code__cell--focus' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {v[i] ?? ''}
            </span>
          ))}
          <input
            className="k-code__input"
            maxLength={6}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-label="Room code"
            value={v}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="k-page__footer">
          <button
            className="k-button k-button--primary k-button--lg k-button--block"
            disabled={v.length < 6}
            onClick={
              onSubmit
                ? () => onSubmit(v)
                : go('game', { mode: 'friend', fixture: 'start', state: 'opponent-turn' })
            }
          >
            <span>{t('join.submit')}</span>
          </button>
        </div>
      </main>
    </section>
  );
}
