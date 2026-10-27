import { useSyncExternalStore } from 'react';
import type { Layout } from './geometry';

/* The handoff switch, matchMedia('(max-width: 767px)') → vertical board, limited to an upright screen:
   a phone held sideways gets the horizontal board (see the landscape section of components.css). */
const PHONE = '(max-width: 767px) and (orientation: portrait)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useBoardLayout(): Layout {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(PHONE).matches ? 'v' : 'h'),
    () => 'h',
  );
}
