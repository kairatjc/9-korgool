/* Тогуз коргоол — board renderer, geometry and rules.
   Everything here is deterministic: same input → same SVG string.
   Colors/strokes/fonts come from CSS classes (components.css → tokens.css);
   this file owns only geometry (viewBox coordinates). */
(function () {
  'use strict';

  const PIT_N = 14;      // up to 14 balls drawn individually in a pit, more → heap
  const KAZAN_N = 100;   // up to 100 balls drawn in a kazan, more → full kazan, number shows the rest

  const FIXTURES = {
    start:    '9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9/0,0/-,-/w',
    midgame:  '5,0,11,2,1,0,23,1,4,7,3,0,0,14,2,9,1,6/40,33/3,6/w',
    endgame:  '0,0,1,0,2,0,0,3,0,1,0,0,0,0,0,2,0,0/78,75/4,7/w',
    gameover: '0,2,0,1,0,0,4,0,3,0,1,0,0,5,0,0,2,0/84,60/-,-/w'
  };

  /* "pits/kazans W,B/tuzdyks W,B/turn" → state.
     A tuzdyk number is the pit number on the OPPONENT's side. */
  function parseFixture(s) {
    const [p, k, t, turn] = s.split('/');
    const tz = t.split(',');
    return {
      pits: p.split(',').map(Number),
      kazans: k.split(',').map(Number),
      tuzdyks: [tz[0] === '-' ? null : 9 + (+tz[0]) - 1, tz[1] === '-' ? null : (+tz[1]) - 1],
      turn: turn === 'b' ? 'black' : 'white'
    };
  }
  const cloneState = s => ({ pits: s.pits.slice(), kazans: s.kazans.slice(), tuzdyks: s.tuzdyks.slice(), turn: s.turn });

  /* ── Geometry ─────────────────────────────────── */
  const SEAM_H = 'M0 294 H480 Q500 294 500 274 V206 Q500 186 520 186 H1000';
  const SEAM_V = 'M240 0 V300 Q240 320 220 320 H160 Q140 320 140 340 V640';
  const GEO = {
    h: {
      w: 1000, h: 480, radius: 28, inlayInset: 9,
      pit: { rx: 44, ry: 54 }, ring: 5, ballR: 8.5,
      pill: { w: 40, h: 24 }, preview: { h: 26, charW: 9, pad: 14 },
      kazan: { mine: { x: 524, y: 192, w: 440, h: 96, axis: 'x', from: 'end' },
               opp:  { x: 36,  y: 192, w: 440, h: 96, axis: 'x', from: 'start' } },
      kBallR: 7.5, badgeR: 24, medal: { x: 500, y: 240, r: 20 },
      seam: SEAM_H, mineHalf: SEAM_H + ' V480 H0 Z'
    },
    v: {
      w: 380, h: 640, radius: 26, inlayInset: 9,
      pit: { rx: 40, ry: 31 }, ring: 5, ballR: 6,
      pill: { w: 30, h: 20 }, preview: { h: 22, charW: 7.5, pad: 10 },
      kazan: { mine: { x: 144, y: 336, w: 92, h: 290, axis: 'y', from: 'end' },
               opp:  { x: 144, y: 14,  w: 92, h: 290, axis: 'y', from: 'start' } },
      kBallR: 6, badgeR: 18, medal: { x: 190, y: 320, r: 12 },
      seam: SEAM_V, mineHalf: SEAM_V + ' H380 V0 Z'
    }
  };

  /* Slot geometry for board index i (0..17) seen by player `me`.
     My row: bottom (h) / right column, pit 1 at the bottom (v). Sowing runs counter-clockwise. */
  function pitGeom(L, i, me) {
    const mine = (i < 9) === (me !== 'black');
    const p = i % 9;
    if (L === 'h') {
      const col = mine ? p : 8 - p;
      const x = 76 + col * 106;
      return { mine, p, cx: x, cy: mine ? 384 : 96,
        pill: { x, y: mine ? 312 : 168 }, num: { x, y: mine ? 462 : 22 },
        hit: { x: x - 53, y: mine ? 300 : 0, w: 106, h: 180 } };
    }
    const row = mine ? 8 - p : p;
    const y = 44 + row * 69;
    return { mine, p, cx: mine ? 316 : 64, cy: y,
      pill: { x: mine ? 259 : 121, y }, num: { x: mine ? 370 : 10, y },
      hit: { x: mine ? 244 : 0, y: y - 34.5, w: 136, h: 69 } };
  }
  function pitCenter(L, i, me) { const g = pitGeom(L, i, me); return { x: g.cx, y: g.cy }; }
  function kazanGeom(L, side, me) { // side: 0 white, 1 black
    const mineSide = me === 'black' ? 1 : 0;
    return GEO[L].kazan[side === mineSide ? 'mine' : 'opp'];
  }

  /* ── Ball layout ──────────────────────────────── */
  function pitLattice(rx, ry, r) {
    const s = 2 * r + 1, ax = rx - r - 1, ay = ry - r - 1, pts = [];
    const rows = Math.ceil(ay / (s * 0.866)) + 1, cols = Math.ceil(ax / s) + 1;
    for (let j = -rows; j <= rows; j++) {
      const y = j * s * 0.866, off = Math.abs(j) % 2 ? 0.5 : 0;
      for (let i = -cols; i <= cols; i++) {
        const x = (i + off) * s;
        if ((x * x) / (ax * ax) + (y * y) / (ay * ay) <= 1.0001) pts.push({ x, y });
      }
    }
    const d = p => Math.round(((p.x * p.x) / (rx * rx) + (p.y * p.y) / (ry * ry)) * 1e6);
    const ang = p => Math.round(Math.atan2(p.y, p.x) * 1e6);
    pts.sort((a, b) => d(a) - d(b) || ang(a) - ang(b));
    return pts;
  }
  /* slot: {kind:'pit', cx, cy, rx, ry, r} | {kind:'kazan', x, y, w, h, axis, from, r, badge}
     returns [{x, y, layer}] — layer 1 = second layer of a heap. */
  function ballPositions(count, slot) {
    if (count <= 0) return [];
    if (slot.kind === 'pit') {
      const lat = pitLattice(slot.rx, slot.ry, slot.r);
      if (count <= PIT_N) {
        const sel = lat.slice(0, count);
        let mx = 0, my = 0;
        sel.forEach(p => { mx += p.x; my += p.y; });
        mx /= count; my /= count;
        return sel.map(p => ({ x: r2(slot.cx + p.x - mx), y: r2(slot.cy + p.y - my), layer: 0 }));
      }
      const s = 2 * slot.r + 1;
      const base = lat.map(p => ({ x: r2(slot.cx + p.x), y: r2(slot.cy + p.y), layer: 0 }));
      const top = lat.map(p => ({ x: p.x + s / 2, y: p.y + s * 0.289 }))
        .filter(p => (p.x * p.x) / ((slot.rx * 0.62) ** 2) + (p.y * p.y) / ((slot.ry * 0.62) ** 2) <= 1)
        .slice(0, 7)
        .map(p => ({ x: r2(slot.cx + p.x), y: r2(slot.cy + p.y), layer: 1 }));
      return base.concat(top);
    }
    const { x, y, w, h, r, axis, from, badge } = slot;
    const s = 2 * r + 1, pad = r + 4;
    const long = axis === 'x' ? w : h, cross = axis === 'x' ? h : w, half = cross / 2 - pad;
    const out = [], n = Math.min(count, KAZAN_N);
    for (let a = badge + pad, c = 0; a <= long - pad - cross * 0.22 && out.length < n; a += s * 0.866, c++) {
      const off = c % 2 ? 0.5 : 0, k0 = Math.floor(half / s) + 1;
      for (let k = -k0; k <= k0 && out.length < n; k++) {
        const b = (k + off) * s;
        if (Math.abs(b) > half + 0.001) continue;
        const al = from === 'start' ? a : long - a;
        out.push(axis === 'x'
          ? { x: r2(x + al), y: r2(y + h / 2 + b), layer: 0 }
          : { x: r2(x + w / 2 + b), y: r2(y + al), layer: 0 });
      }
    }
    return out;
  }
  const r2 = v => Math.round(v * 100) / 100;
  const kazanBadge = L => GEO[L].badgeR * 2 + 8;
  /* Where the n-th ball (0-based) of a kazan sits — used by motion.js as a landing point. */
  function kazanSlot(L, side, me, n) {
    const k = kazanGeom(L, side, me);
    const pos = ballPositions(Math.min(n, KAZAN_N - 1) + 1, Object.assign({ kind: 'kazan', r: GEO[L].kBallR, badge: kazanBadge(L) }, k));
    return pos[pos.length - 1];
  }

  /* ── Sprite (gradients, filters, ball, ornament) ─ */
  const ORNAMENT = '<path d="M0 -1.5 C0 -5 -1 -7.5 -4 -8.5 C-7 -9.5 -9.2 -6.5 -7.6 -4.6 C-6.4 -3.3 -4.6 -4.2 -5.3 -5.6 M0 -1.5 C0 -5 1 -7.5 4 -8.5 C7 -9.5 9.2 -6.5 7.6 -4.6 C6.4 -3.3 4.6 -4.2 5.3 -5.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>';
  const SPRITE = '<svg class="k-sprite" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>' +
    '<linearGradient id="k-grad-board-opp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="k-stop--board-opp-1"/><stop offset="1" class="k-stop--board-opp-2"/></linearGradient>' +
    '<linearGradient id="k-grad-board-mine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="k-stop--board-mine-1"/><stop offset="1" class="k-stop--board-mine-2"/></linearGradient>' +
    '<linearGradient id="k-grad-pit" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="k-stop--pit-1"/><stop offset="1" class="k-stop--pit-2"/></linearGradient>' +
    '<radialGradient id="k-grad-ball" cx=".35" cy=".3" r=".75"><stop offset="0" class="k-stop--ball-hi"/><stop offset=".55" class="k-stop--ball-mid"/><stop offset="1" class="k-stop--ball-lo"/></radialGradient>' +
    '<filter id="k-grain-h" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.004 0.09" numOctaves="3" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  1.5 0 0 0 -0.5"/></filter>' +
    '<filter id="k-grain-v" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.09 0.004" numOctaves="3" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.09  0 0 0 0 0.04  1.5 0 0 0 -0.5"/></filter>' +
    '<g id="k-ball"><ellipse class="k-ball__shadow" cx=".15" cy=".45" rx=".95" ry=".6"/><circle class="k-ball__body" r="1"/></g>' +
    '<symbol id="k-ornament" viewBox="-11 -11 22 22">' + [0, 90, 180, 270].map(a => `<g transform="rotate(${a})">${ORNAMENT}</g>`).join('') + '<path d="M0 -2.2 L2.2 0 L0 2.2 L-2.2 0Z" fill="currentColor"/></symbol>' +
    '<marker id="k-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="k-diagram__arrowhead" d="M0 0 L10 5 L0 10Z"/></marker>' +
    '</defs></svg>';
  function ensureSprite() {
    if (typeof document === 'undefined' || document.getElementById('k-grad-ball')) return;
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
  }

  /* ── Pieces ───────────────────────────────────── */
  function ballsSVG(list, r) {
    return list.map(p => `<use href="#k-ball" class="k-ball${p.layer ? ' k-ball--top' : ''}" transform="translate(${p.x} ${p.y}) scale(${r})"/>`).join('');
  }
  function pitSVG(L, g, i, n, cls, label) {
    const G = GEO[L], { rx, ry } = G.pit, R = G.ring, a = r2(Math.min(rx, ry) * 0.55);
    const P = G.pill, V = G.preview;
    const lw = label ? String(label).length * V.charW + V.pad * 2 : 0;
    return `<g class="${cls.join(' ')}" data-component="Pit" data-index="${i}" data-number="${g.p + 1}">` +
      `<rect class="k-pit__hit" x="${g.hit.x}" y="${g.hit.y}" width="${g.hit.w}" height="${g.hit.h}"/>` +
      `<ellipse class="k-pit__ring" cx="${g.cx}" cy="${g.cy}" rx="${rx + R}" ry="${ry + R}"/>` +
      `<ellipse class="k-pit__well" cx="${g.cx}" cy="${g.cy}" rx="${rx}" ry="${ry}"/>` +
      `<ellipse class="k-pit__shade" cx="${g.cx}" cy="${g.cy - 1.5}" rx="${rx - 2}" ry="${ry - 2.5}"/>` +
      `<ellipse class="k-pit__tint" cx="${g.cx}" cy="${g.cy}" rx="${rx}" ry="${ry}"/>` +
      `<g class="k-pit__balls">${ballsSVG(ballPositions(n, { kind: 'pit', cx: g.cx, cy: g.cy, rx, ry, r: G.ballR }), G.ballR)}</g>` +
      `<path class="k-pit__mark" pathLength="1" d="M${g.cx - a} ${g.cy - a} L${g.cx + a} ${g.cy + a} M${g.cx + a} ${g.cy - a} L${g.cx - a} ${g.cy + a}"/>` +
      `<g class="k-pit__count"><rect class="k-pit__count-bg" x="${g.pill.x - P.w / 2}" y="${g.pill.y - P.h / 2}" width="${P.w}" height="${P.h}" rx="${P.h / 2}"/>` +
      `<text class="k-pit__count-text" x="${g.pill.x}" y="${g.pill.y}" text-anchor="middle" dominant-baseline="central">${n}</text></g>` +
      `<text class="k-pit__number" x="${g.num.x}" y="${g.num.y}" text-anchor="middle" dominant-baseline="central">${g.p + 1}</text>` +
      `<g class="k-pit__preview"><rect class="k-pit__preview-bg" x="${r2(g.cx - lw / 2)}" y="${g.cy - V.h / 2}" width="${lw}" height="${V.h}" rx="${V.h / 2}"/>` +
      `<text class="k-pit__preview-text" x="${g.cx}" y="${g.cy}" text-anchor="middle" dominant-baseline="central">${label || ''}</text></g>` +
      `</g>`;
  }
  function kazanSVG(L, k, side, count, mine) {
    const G = GEO[L], rr = Math.min(k.w, k.h) / 2, along = 4 + G.badgeR + 4;
    const bx = k.axis === 'x' ? (k.from === 'start' ? k.x + along : k.x + k.w - along) : k.x + k.w / 2;
    const by = k.axis === 'y' ? (k.from === 'start' ? k.y + along : k.y + k.h - along) : k.y + k.h / 2;
    const balls = ballPositions(count, Object.assign({ kind: 'kazan', r: G.kBallR, badge: kazanBadge(L) }, k));
    return `<g class="k-kazan k-kazan--${mine ? 'mine' : 'opponent'}" data-component="Kazan" data-side="${side ? 'black' : 'white'}">` +
      `<rect class="k-kazan__well" x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="${rr}"/>` +
      `<g class="k-kazan__balls">${ballsSVG(balls, G.kBallR)}</g>` +
      `<g class="k-kazan__count"><circle class="k-kazan__count-bg" cx="${bx}" cy="${by}" r="${G.badgeR}"/>` +
      `<text class="k-kazan__count-text" x="${bx}" y="${by}" text-anchor="middle" dominant-baseline="central">${count}</text></g></g>`;
  }
  function baseSVG(L, uid) {
    const G = GEO[L], W = G.w, H = G.h, I = G.inlayInset, m = G.medal;
    return `<defs><clipPath id="${uid}-clip"><rect width="${W}" height="${H}" rx="${G.radius}"/></clipPath></defs>` +
      `<g class="k-board__base" clip-path="url(#${uid}-clip)">` +
      `<rect class="k-board__half k-board__half--opp" width="${W}" height="${H}"/>` +
      `<path class="k-board__half k-board__half--mine" d="${G.mineHalf}"/>` +
      `<rect class="k-board__grain" width="${W}" height="${H}" filter="url(#k-grain-${L})"/></g>` +
      `<rect class="k-board__frame" x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${G.radius - 1}"/>` +
      `<rect class="k-board__inlay" x="${I}" y="${I}" width="${W - 2 * I}" height="${H - 2 * I}" rx="${G.radius - 7}"/>` +
      `<path class="k-board__seam" d="${G.seam}"/>` +
      `<use href="#k-ornament" class="k-board__medallion" x="${m.x - m.r}" y="${m.y - m.r}" width="${m.r * 2}" height="${m.r * 2}"/>`;
  }

  /* ── renderBoard ──────────────────────────────────
     state: { pits:number[18], kazans:[w,b], tuzdyks:[indexOrNull, indexOrNull], turn:'white'|'black' }
     opts:  { layout:'h'|'v', me:'white'|'black', uid, interactive (default true), legalOnly:number[],
              lastFrom, lastTo, capture, hint, hover, pressed, previewTarget, previewLabel,
              pitClass:{[index]: 'extra classes'} } */
  function renderBoard(st, o) {
    o = o || {};
    ensureSprite();
    const L = o.layout === 'v' ? 'v' : 'h', G = GEO[L], me = o.me === 'black' ? 'black' : 'white';
    const meI = me === 'white' ? 0 : 1, opI = 1 - meI, uid = o.uid || 'kb';
    const interactive = o.interactive !== false, myTurn = st.turn === me;
    let s = `<svg class="k-board k-board--${L}" data-component="Board" viewBox="0 0 ${G.w} ${G.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" role="img">`;
    s += baseSVG(L, uid);
    s += kazanSVG(L, G.kazan.mine, meI, st.kazans[meI], true);
    s += kazanSVG(L, G.kazan.opp, opI, st.kazans[opI], false);
    for (let i = 0; i < 18; i++) {
      const g = pitGeom(L, i, me), n = st.pits[i];
      const tzMine = st.tuzdyks[meI] === i, tzOpp = st.tuzdyks[opI] === i;
      const cls = ['k-pit', g.mine ? 'k-pit--mine' : 'k-pit--opponent'];
      if (tzMine) cls.push('k-pit--tuzdyk-mine');
      if (tzOpp) cls.push('k-pit--tuzdyk-opponent');
      if (interactive) {
        const legal = myTurn && g.mine && n > 0 && !tzOpp && (!o.legalOnly || o.legalOnly.includes(i));
        cls.push(legal ? 'k-pit--legal' : 'k-pit--disabled');
      }
      if (o.lastFrom === i) cls.push('k-pit--last-move-from');
      if (o.lastTo === i) cls.push('k-pit--last-move-to');
      if (o.capture === i) cls.push('k-pit--capture');
      if (o.hint === i) cls.push('k-pit--hint');
      if (o.hover === i) cls.push('k-pit--hover');
      if (o.pressed === i) cls.push('k-pit--pressed');
      if (o.previewTarget === i) cls.push('k-pit--preview-target');
      if (o.pitClass && o.pitClass[i]) cls.push(o.pitClass[i]);
      s += pitSVG(L, g, i, n, cls, o.previewTarget === i ? o.previewLabel : '');
    }
    return s + '</svg>';
  }

  /* Mount into a host element: board SVG + an empty FX layer (same viewBox) for flying balls.
     opts.onPit(index), opts.onPitHover(index|null) wire legal pits. */
  function mountBoard(host, st, o) {
    o = o || {};
    const L = o.layout === 'v' ? 'v' : 'h', G = GEO[L];
    host.innerHTML = renderBoard(st, o) +
      `<svg class="k-board-fx" viewBox="0 0 ${G.w} ${G.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" data-ball-r="${G.ballR}" data-kazan-ball-r="${G.kBallR}"></svg>`;
    host.querySelectorAll('.k-pit--legal').forEach(el => {
      const i = +el.dataset.index;
      if (o.onPit) el.addEventListener('click', () => o.onPit(i));
      if (o.onPitHover) {
        el.addEventListener('mouseenter', () => o.onPitHover(i));
        el.addEventListener('mouseleave', () => o.onPitHover(null));
      }
      el.addEventListener('pointerdown', () => el.classList.add('k-pit--pressed'));
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, () => el.classList.remove('k-pit--pressed')));
    });
    return { board: host.querySelector('.k-board'), fx: host.querySelector('.k-board-fx') };
  }

  /* Show / clear the preview target on an already-mounted board without re-rendering. */
  function setPreview(host, target, label) {
    host.querySelectorAll('.k-pit--preview-target').forEach(el => el.classList.remove('k-pit--preview-target'));
    if (target == null) return;
    const el = host.querySelector(`.k-pit[data-index="${target}"]`);
    if (!el) return;
    const L = host.querySelector('.k-board--v') ? 'v' : 'h', V = GEO[L].preview, g = el.querySelector('.k-pit__well');
    const cx = +g.getAttribute('cx'), lw = label ? String(label).length * V.charW + V.pad * 2 : 0;
    const bg = el.querySelector('.k-pit__preview-bg');
    bg.setAttribute('x', r2(cx - lw / 2)); bg.setAttribute('width', lw);
    el.querySelector('.k-pit__preview-text').textContent = label || '';
    el.classList.add('k-pit--preview-target');
  }

  /* ── Rules engine (for preview, tutorial and the prototype's own moves) ──
     Returns the event list in the same format the real engine emits. */
  function computeMove(st0, idx) {
    const st = cloneState(st0), side = idx < 9 ? 'white' : 'black', sI = side === 'white' ? 0 : 1, oI = 1 - sI;
    const n = st.pits[idx], ev = [];
    if (!n) return { events: ev, state: st, last: null };
    st.pits[idx] = 0;
    ev.push({ type: 'pickup', index: idx, count: n });
    let pos = n === 1 ? (idx + 1) % 18 : idx, last = pos;
    for (let k = 0; k < n; k++) {
      const owner = st.tuzdyks[0] === pos ? 0 : st.tuzdyks[1] === pos ? 1 : null;
      if (owner !== null) { st.kazans[owner]++; ev.push({ type: 'sow', index: pos, toKazan: owner ? 'black' : 'white' }); }
      else { st.pits[pos]++; ev.push({ type: 'sow', index: pos, toKazan: null }); }
      last = pos; pos = (pos + 1) % 18;
    }
    const onOpp = side === 'white' ? last >= 9 : last < 9;
    let result = null;
    if (onOpp && st.tuzdyks[0] !== last && st.tuzdyks[1] !== last) {
      const c = st.pits[last];
      if (c % 2 === 0) {
        st.kazans[sI] += c; st.pits[last] = 0;
        ev.push({ type: 'capture', index: last, count: c, by: side }); result = { type: 'capture', count: c };
      } else if (c === 3 && st.tuzdyks[sI] === null && last % 9 !== 8 && !(st.tuzdyks[oI] !== null && st.tuzdyks[oI] % 9 === last % 9)) {
        st.tuzdyks[sI] = last; st.kazans[sI] += 3; st.pits[last] = 0;
        ev.push({ type: 'tuzdyk', index: last, by: side }); result = { type: 'tuzdyk' };
      }
    }
    st.turn = side === 'white' ? 'black' : 'white';
    return { events: ev, state: st, last, result };
  }

  /* ── Single-pit / kazan samples (spec sheet) ──── */
  function renderPitSample(o) {
    ensureSprite();
    const L = o.layout === 'v' ? 'v' : 'h', mine = o.side !== 'opponent';
    const i = mine ? 0 : 9, g = pitGeom(L, i, 'white'), G = GEO[L];
    const box = L === 'h'
      ? { x: g.cx - 60, y: mine ? 296 : 0, w: 120, h: 184 }
      : { x: mine ? 236 : 0, y: g.cy - 36, w: 144, h: 72 };
    const cls = ['k-pit', mine ? 'k-pit--mine' : 'k-pit--opponent'].concat(o.cls || []);
    return `<svg class="k-board k-board--${L}" viewBox="${box.x} ${box.y} ${box.w} ${box.h}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect class="k-board__half k-board__half--${mine ? 'mine' : 'opp'}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}"/>` +
      pitSVG(L, g, i, o.count, cls, o.label || '') + '</svg>';
  }
  function renderKazanSample(o) {
    ensureSprite();
    const L = o.layout === 'v' ? 'v' : 'h', k = GEO[L].kazan.mine;
    return `<svg class="k-board k-board--${L}" viewBox="${k.x - 8} ${k.y - 8} ${k.w + 16} ${k.h + 16}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect class="k-board__half k-board__half--mine" x="${k.x - 8}" y="${k.y - 8}" width="${k.w + 16}" height="${k.h + 16}"/>` +
      kazanSVG(L, k, 0, o.count, true) + '</svg>';
  }

  /* ── Rules diagrams: 5 columns, my pits 5–9 (bottom) and opponent pits 5–1 (top) ──
     d: { bottom:[5], top:[5], states:{ 'b2':'from', 't4':'to'|'capture'|'tuzdyk-mine' }, arrow:['b2','t4'], labels:{ 't3':'+6' } } */
  function renderDiagram(d) {
    ensureSprite();
    const C = 72, R = 26, W = 5 * C + 16, H = 196, Y = { t: 48, b: 148 }, mid = H / 2, a = 13;
    const cx = c => 8 + C / 2 + c * C;
    let s = `<svg class="k-diagram" data-component="RuleDiagram" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img">` +
      `<defs><clipPath id="kd-clip"><rect width="${W}" height="${H}" rx="18"/></clipPath></defs>` +
      `<g clip-path="url(#kd-clip)"><rect class="k-board__half k-board__half--opp" width="${W}" height="${mid}"/><rect class="k-board__half k-board__half--mine" y="${mid}" width="${W}" height="${mid}"/></g>` +
      `<path class="k-board__seam" d="M0 ${mid} H${W}"/>`;
    ['t', 'b'].forEach(row => {
      (row === 't' ? d.top : d.bottom).forEach((v, c) => {
        const key = row + c, st = (d.states || {})[key], x = cx(c), y = Y[row];
        const num = row === 't' ? 5 - c : 5 + c;
        s += `<g class="k-dpit k-dpit--${row === 'b' ? 'mine' : 'opponent'}${st ? ' k-dpit--' + st : ''}">` +
          `<circle class="k-dpit__ring" cx="${x}" cy="${y}" r="${R + 5}"/><circle class="k-dpit__well" cx="${x}" cy="${y}" r="${R}"/><circle class="k-dpit__tint" cx="${x}" cy="${y}" r="${R}"/>` +
          `<path class="k-dpit__mark" d="M${x - a} ${y - a} L${x + a} ${y + a} M${x + a} ${y - a} L${x - a} ${y + a}"/>` +
          `<text class="k-dpit__value" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${v}</text>` +
          `<text class="k-dpit__number" x="${x}" y="${row === 't' ? 12 : 186}" text-anchor="middle" dominant-baseline="central">${num}</text></g>`;
      });
    });
    if (d.arrow) {
      const [f, t] = d.arrow, fx = cx(+f.slice(1)), tx = cx(+t.slice(1));
      s += `<path class="k-diagram__arrow" marker-end="url(#k-arrowhead)" d="M${fx} ${Y.b - R - 8} V${mid} H${tx} V${Y.t + R + 9}"/>`;
    }
    Object.entries(d.labels || {}).forEach(([key, text]) => {
      const x = cx(+key.slice(1)) + R - 4, y = Y[key[0]] - R - 2, w = String(text).length * 8 + 16;
      s += `<rect class="k-diagram__label-bg" x="${x}" y="${y - 11}" width="${w}" height="22" rx="11"/>` +
        `<text class="k-diagram__label" x="${x + w / 2}" y="${y}" text-anchor="middle" dominant-baseline="central">${text}</text>`;
    });
    return s + '</svg>';
  }

  const api = { PIT_N, KAZAN_N, FIXTURES, GEO, parseFixture, cloneState, pitGeom, pitCenter, kazanGeom, kazanSlot,
    ballPositions, renderBoard, mountBoard, setPreview, computeMove, renderPitSample, renderKazanSample, renderDiagram, ensureSprite };
  if (typeof window !== 'undefined') window.TK = api;
  if (typeof module !== 'undefined') module.exports = api;
})();
