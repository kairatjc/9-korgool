import { useSyncExternalStore } from 'react';
import type { Layout } from './geometry';

/* Same switch as the handoff: matchMedia('(max-width: 767px)') → vertical board. */
const PHONE = '(max-width: 767px)';

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
