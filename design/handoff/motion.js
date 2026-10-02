/* Тогуз коргоол — move playback.
   Plays the engine's event list on a mounted board. All timings/easings are read from tokens.css
   and multiplied by the speed factor (--speed-slow | normal | fast | off). */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const css = () => getComputedStyle(document.documentElement);
  const ms = name => { const v = css().getPropertyValue(name).trim(); return v.endsWith('ms') ? parseFloat(v) : v.endsWith('s') ? parseFloat(v) * 1000 : parseFloat(v) || 0; };
  const num = name => parseFloat(css().getPropertyValue(name)) || 0;
  const str = name => css().getPropertyValue(name).trim();
  const sleep = t => new Promise(r => setTimeout(r, t));
  const SPEED_TOKEN = { slow: '--speed-slow', normal: '--speed-normal', fast: '--speed-fast', off: '--speed-off' };

  /* One ball flying along a quadratic arc (control point lifted by --motion-arc-lift × distance, capped by --motion-arc-max). */
  function fly(fx, from, to, r, duration, easing, delay) {
    const u = document.createElementNS(NS, 'use');
    u.setAttribute('href', '#k-ball');
    u.setAttribute('class', 'k-ball k-ball--flying');
    fx.appendChild(u);
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const lift = Math.min(num('--motion-arc-max'), dist * num('--motion-arc-lift'));
    const c = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - lift };
    const frames = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
      frames.push({ transform: `translate(${a * from.x + b * c.x + d * to.x}px, ${a * from.y + b * c.y + d * to.y}px) scale(${r})` });
    }
    u.style.transform = frames[0].transform;
    const anim = u.animate(frames, { duration, easing, delay: delay || 0, fill: 'both' });
    return anim.finished.then(() => u.remove());
  }

  function applyInstant(st, ev) {
    const side = s => (s === 'black' ? 1 : 0);
    switch (ev.type) {
      case 'pickup': st.pits[ev.index] = 0; break;
      case 'sow': if (ev.toKazan) st.kazans[side(ev.toKazan)]++; else st.pits[ev.index]++; break;
      case 'capture': st.pits[ev.index] = 0; st.kazans[side(ev.by)] += ev.count; break;
      case 'tuzdyk': st.tuzdyks[side(ev.by)] = ev.index; st.kazans[side(ev.by)] += st.pits[ev.index]; st.pits[ev.index] = 0; break;
      case 'collect': { const s = side(ev.side); for (let i = s * 9; i < s * 9 + 9; i++) { st.kazans[s] += st.pits[i]; st.pits[i] = 0; } break; }
    }
  }

  /* host: element passed to TK.mountBoard. start: state before the move. events: engine list.
     opts: { layout, me, speed:'slow'|'normal'|'fast'|'off', board:{...extra renderBoard opts}, onGameOver(status), onDone(state, highlight) } */
  async function playMove(host, start, events, opts) {
    const o = opts || {}, L = o.layout === 'v' ? 'v' : 'h', me = o.me || 'white';
    const k = num(SPEED_TOKEN[o.speed] || SPEED_TOKEN.normal);
    const st = TK.cloneState(start), hl = { lastFrom: null, lastTo: null };
    const render = extra => TK.mountBoard(host, st, Object.assign({}, o.board, hl, extra, { layout: L, me, interactive: false })).fx;
    const sideI = s => (s === 'black' ? 1 : 0);
    const T = name => ms(name) * k;
    const ballR = () => +host.querySelector('.k-board-fx').dataset.ballR;
    const kBallR = () => +host.querySelector('.k-board-fx').dataset.kazanBallR;
    const bump = sel => { const el = host.querySelector(sel); if (el) el.classList.add(sel.startsWith('.k-kazan') ? 'k-kazan--bump' : 'k-pit--bump'); };
    const cap = num('--motion-flight-cap');

    if (k === 0) {
      events.forEach(ev => {
        applyInstant(st, ev);
        if (ev.type === 'pickup') hl.lastFrom = ev.index;
        if (ev.type === 'sow' && !ev.toKazan) hl.lastTo = ev.index;
        if (ev.type === 'game_over' && o.onGameOver) o.onGameOver(ev.status);
      });
      render();
      if (o.onDone) o.onDone(st, hl);
      return st;
    }

    let fx = render(), hand = null;
    for (const ev of events) {
      if (ev.type === 'pickup') {
        hl.lastFrom = ev.index;
        const el = host.querySelector(`.k-pit[data-index="${ev.index}"]`);
        if (el) el.classList.add('k-pit--lifting');
        await sleep(T('--duration-pickup'));
        st.pits[ev.index] = 0;
        fx = render();
        hand = TK.pitCenter(L, ev.index, me);
      } else if (ev.type === 'sow') {
        const to = TK.pitCenter(L, ev.index, me);
        await fly(fx, hand || to, to, ballR(), T('--duration-sow-flight'), str('--ease-sow'));
        if (ev.toKazan) {
          const s = sideI(ev.toKazan);
          await fly(fx, to, TK.kazanSlot(L, s, me, st.kazans[s]), kBallR(), T('--duration-sow-flight'), str('--ease-sow'));
          st.kazans[s]++;
          fx = render();
          bump(`.k-kazan[data-side="${ev.toKazan}"]`);
        } else {
          st.pits[ev.index]++;
          hl.lastTo = ev.index;
          fx = render();
          bump(`.k-pit[data-index="${ev.index}"]`);
        }
        hand = to;
        await sleep(T('--delay-sow-step'));
      } else if (ev.type === 'capture' || ev.type === 'tuzdyk') {
        const s = sideI(ev.by), count = ev.type === 'capture' ? ev.count : st.pits[ev.index];
        if (ev.type === 'tuzdyk') st.tuzdyks[s] = ev.index;
        const mark = ev.type === 'capture' ? { capture: ev.index } : { pitClass: { [ev.index]: 'k-pit--tuzdyk-new' } };
        fx = render(mark);
        await sleep(T(ev.type === 'capture' ? '--duration-capture-hold' : '--duration-tuzdyk-mark'));
        const src = TK.pitCenter(L, ev.index, me), base = st.kazans[s];
        st.pits[ev.index] = 0;
        fx = render(mark);
        const flights = [];
        for (let j = 0; j < Math.min(count, cap); j++)
          flights.push(fly(fx, src, TK.kazanSlot(L, s, me, base + j), kBallR(), T('--duration-capture-flight'), str('--ease-out'), j * T('--delay-capture-stagger')));
        await Promise.all(flights);
        st.kazans[s] += count;
        fx = render(ev.type === 'capture' ? {} : {});
        bump(`.k-kazan[data-side="${ev.by}"]`);
      } else if (ev.type === 'collect') {
        const s = sideI(ev.side), flights = [];
        let base = st.kazans[s], j = 0;
        for (let i = s * 9; i < s * 9 + 9; i++) {
          const n = st.pits[i];
          if (!n) continue;
          const src = TK.pitCenter(L, i, me);
          for (let q = 0; q < Math.min(n, cap); q++, j++)
            flights.push(fly(fx, src, TK.kazanSlot(L, s, me, base + j), kBallR(), T('--duration-collect-flight'), str('--ease-out'), j * T('--delay-collect-stagger')));
          st.kazans[s] += n; st.pits[i] = 0;
        }
        await Promise.all(flights);
        fx = render();
        bump(`.k-kazan[data-side="${ev.side}"]`);
      } else if (ev.type === 'game_over') {
        if (o.onGameOver) o.onGameOver(ev.status);
      }
    }
    if (o.onDone) o.onDone(st, hl);
    return st;
  }

  window.KMotion = { playMove, fly, applyInstant };
})();
