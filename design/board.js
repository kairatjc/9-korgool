(function () {
  const PIT_N = 14, KAZAN_N = 100;
  const FIXTURES = {
    start: '9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9/0,0/-,-/w',
    midgame: '5,0,11,2,1,0,23,1,4,7,3,0,0,14,2,9,1,6/40,33/3,6/w',
    endgame: '0,0,1,0,2,0,0,3,0,1,0,0,0,0,0,2,0,0/78,75/4,7/w',
    gameover: '0,2,0,1,0,0,4,0,3,0,1,0,0,5,0,0,2,0/84,60/-,-/w'
  };
  function parseFixture(s) {
    const [p, k, t, turn] = s.split('/');
    const tz = t.split(',');
    return {
      pits: p.split(',').map(Number),
      kazans: k.split(',').map(Number),
      tuzdyks: [tz[0] === '-' ? null : 9 + (+tz[0]) - 1, tz[1] === '-' ? null : (+tz[1]) - 1],
      turn: turn === 'w' ? 'white' : 'black'
    };
  }
  const GEO = {
    h: { w: 1000, h: 480, radius: 28, pit: { rx: 44, ry: 54 }, ballR: 8.5, pill: { w: 40, h: 24, fs: 15 }, numFs: 13,
      kazans: [{ x: 524, y: 192, w: 440, h: 96, axis: 'x', from: 'end' }, { x: 36, y: 192, w: 440, h: 96, axis: 'x', from: 'start' }],
      kBallR: 7.5, badge: { r: 24, fs: 20 }, medal: { x: 500, y: 240, r: 20 },
      split: { seam: 'M0 294 H480 Q500 294 500 274 V206 Q500 186 520 186 H1000', fill: 'M0 294 H480 Q500 294 500 274 V206 Q500 186 520 186 H1000 V480 H0 Z' } },
    v: { w: 380, h: 640, radius: 26, pit: { rx: 40, ry: 31 }, ballR: 6, pill: { w: 30, h: 20, fs: 12 }, numFs: 11,
      kazans: [{ x: 144, y: 336, w: 92, h: 290, axis: 'y', from: 'end' }, { x: 144, y: 14, w: 92, h: 290, axis: 'y', from: 'start' }],
      kBallR: 6, badge: { r: 18, fs: 15 }, medal: { x: 190, y: 320, r: 12 },
      split: { seam: 'M240 0 V300 Q240 320 220 320 H160 Q140 320 140 340 V640', fill: 'M240 0 V300 Q240 320 220 320 H160 Q140 320 140 340 V640 H380 V0 Z' } }
  };
  function pitCenter(L, i) {
    if (L === 'h') { const col = i < 9 ? i : 17 - i; return { x: 76 + col * 106, y: i < 9 ? 384 : 96 }; }
    const row = i < 9 ? 8 - i : i - 9; return { x: i < 9 ? 316 : 64, y: 44 + row * 69 };
  }
  function pillPos(L, i) { const c = pitCenter(L, i); return L === 'h' ? { x: c.x, y: i < 9 ? 312 : 168 } : { x: i < 9 ? 259 : 121, y: c.y }; }
  function numPos(L, i) { const c = pitCenter(L, i); return L === 'h' ? { x: c.x, y: i < 9 ? 462 : 22 } : { x: i < 9 ? 370 : 10, y: c.y }; }

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
    pts.sort((a, b) => d(a) - d(b) || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
    return pts;
  }
  // slot: {kind:'pit',cx,cy,rx,ry,r} | {kind:'kazan',x,y,w,h,r,axis,from,badge}
  function ballPositions(count, slot) {
    if (count <= 0) return [];
    if (slot.kind === 'pit') {
      const lat = pitLattice(slot.rx, slot.ry, slot.r);
      if (count <= PIT_N) {
        const sel = lat.slice(0, count); let mx = 0, my = 0;
        sel.forEach(p => { mx += p.x; my += p.y; }); mx /= count; my /= count;
        return sel.map(p => ({ x: slot.cx + p.x - mx, y: slot.cy + p.y - my, layer: 0 }));
      }
      const s = 2 * slot.r + 1;
      const base = lat.map(p => ({ x: slot.cx + p.x, y: slot.cy + p.y, layer: 0 }));
      const top = lat.map(p => ({ x: p.x + s / 2, y: p.y + s * 0.289 }))
        .filter(p => (p.x * p.x) / ((slot.rx * 0.62) ** 2) + (p.y * p.y) / ((slot.ry * 0.62) ** 2) <= 1)
        .slice(0, 7).map(p => ({ x: slot.cx + p.x, y: slot.cy + p.y, layer: 1 }));
      return base.concat(top);
    }
    const { x, y, w, h, r, axis, from, badge } = slot;
    const s = 2 * r + 1, pad = r + 4;
    const long = axis === 'x' ? w : h, cross = axis === 'x' ? h : w, half = cross / 2 - pad;
    const out = [], n = Math.min(count, KAZAN_N);
    for (let a = badge + pad, c = 0; a <= long - pad - cross * 0.22 && out.length < n; a += s * 0.866, c++) {
      const off = c % 2 ? 0.5 : 0, k0 = Math.floor(half / s) + 1;
      for (let k = -k0; k <= k0 && out.length < n; k++) {
        const b = (k + off) * s; if (Math.abs(b) > half + 0.001) continue;
        const al = from === 'start' ? a : long - a;
        out.push(axis === 'x' ? { x: x + al, y: y + h / 2 + b, layer: 0 } : { x: x + w / 2 + b, y: y + al, layer: 0 });
      }
    }
    return out;
  }

  const THEMES = {
    walnut: { texture: 'wood', board: ['#5E3720', '#3E220F'], boardMine: ['#BC8650', '#94603A'], numMine: '#2E1A0C', grain: '#2A160A', grainK: 1.5, grainB: -0.5, frame: '#3E2414', inlay: '#D3A566',
      pit: ['#24130A', '#4A2B17'], pitEdge: '#A87448', ball: { type: 'bone', hi: '#FFFBF0', mid: '#E6D9BC', lo: '#9E8963' },
      pillBg: '#F7EEDD', pillFg: '#2A1A10', num: '#EBD3AC', legal: '#F2C14E', from: '#D5E0F0', to: '#F2C14E', toFg: '#2A1A10',
      tuzMine: '#F0603F', tuzOpp: '#8FB0EA', font: 'Golos Text' },
    felt: { texture: 'felt', board: ['#A6352B', '#88271F'], grain: '#3B0E0A', grainK: 0.9, grainB: -0.25, frame: '#5E1712', inlay: '#F1E2C2',
      pit: ['#55140F', '#741F18'], pitEdge: '#F1E2C2', ball: { type: 'stone', hi: '#A8A39B', mid: '#55514C', lo: '#1D1B19' },
      pillBg: '#F6EBD3', pillFg: '#3A1410', num: '#F6EBD3', legal: '#F6EBD3', from: '#F6EBD3', to: '#F6C453', toFg: '#3A1410',
      tuzMine: '#F6C453', tuzOpp: '#A9C4F2', font: 'Onest' },
    birch: { texture: 'birch', board: ['#F0E2C6', '#DCC49D'], grain: '#8E6C3E', grainK: 1.1, grainB: -0.45, frame: '#B89566', inlay: '#A47C50',
      pit: ['#B08A5A', '#D6BA8E'], pitEdge: '#F8EEDB', ball: { type: 'apricot', hi: '#E8AE70', mid: '#A9652F', lo: '#5A2F12' },
      pillBg: '#17201F', pillFg: '#FFFFFF', num: '#5E4628', legal: '#0F6E66', from: '#55615E', to: '#E0673F', toFg: '#FFFFFF',
      tuzMine: '#0F6E66', tuzOpp: '#D2552E', font: 'Manrope' }
  };
  const hex = h => [1, 3, 5].map(i => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3));
  const f = v => +v.toFixed(2);

  function ball(T, u, x, y, r, k, layer) {
    const ang = (k * 53) % 180;
    let s = `<ellipse cx="${f(x + r * 0.15)}" cy="${f(y + r * 0.45)}" rx="${f(r * 0.95)}" ry="${f(r * 0.6)}" fill="#000" fill-opacity="${layer ? 0.22 : 0.32}"/>`;
    const t = T.ball.type;
    if (t === 'bone') s += `<circle cx="${f(x)}" cy="${f(y)}" r="${r}" fill="url(#${u}bl)"/>`;
    else {
      const ex = t === 'stone' ? 1.08 : 1.2, ey = t === 'stone' ? 0.9 : 0.85;
      s += `<g transform="rotate(${ang} ${f(x)} ${f(y)})"><ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * ex)}" ry="${f(r * ey)}" fill="url(#${u}bl)"/>`;
      if (t === 'apricot') s += `<path d="M${f(x - r)} ${f(y)} Q${f(x)} ${f(y - r * 0.3)} ${f(x + r)} ${f(y)}" fill="none" stroke="${T.ball.lo}" stroke-opacity=".55" stroke-width=".9"/>`;
      s += `</g>`;
    }
    return s;
  }
  function horns(cx, cy, R, col) {
    const sc = R / 10; let p = '';
    for (let a = 0; a < 360; a += 90)
      p += `<path transform="translate(${cx} ${cy}) rotate(${a}) scale(${f(sc)})" d="M0 -1.5 C0 -5 -1 -7.5 -4 -8.5 C-7 -9.5 -9.2 -6.5 -7.6 -4.6 C-6.4 -3.3 -4.6 -4.2 -5.3 -5.6 M0 -1.5 C0 -5 1 -7.5 4 -8.5 C7 -9.5 9.2 -6.5 7.6 -4.6 C6.4 -3.3 4.6 -4.2 5.3 -5.6" fill="none" stroke="${col}" stroke-width="${f(1.4 / sc)}" stroke-linecap="round"/>`;
    p += `<path transform="translate(${cx} ${cy}) scale(${f(sc)})" d="M0 -2.2 L2.2 0 L0 2.2 L-2.2 0Z" fill="${col}"/>`;
    return p;
  }

  // opts: {layout:'h'|'v', theme, uid, lastFrom, lastTo, me:'white'}
  function renderBoardSVG(st, o) {
    const L = o.layout || 'h', G = GEO[L], T = THEMES[o.theme] || THEMES.walnut, u = o.uid || 'tk';
    const W = G.w, H = G.h, FF = `font-family="'${T.font}', sans-serif"`;
    const myTurn = st.turn === (o.me || 'white');
    const [gr, gg, gb] = hex(T.grain);
    const bf = T.texture === 'felt' ? '0.85' : (L === 'h' ? '0.004 0.09' : '0.09 0.004');
    let d = `<linearGradient id="${u}bd" x1="0" y1="0" x2="${L === 'h' ? 0 : 1}" y2="${L === 'h' ? 1 : 0}"><stop offset="0" stop-color="${T.board[0]}"/><stop offset="1" stop-color="${T.board[1]}"/></linearGradient>`;
    d += `<linearGradient id="${u}pt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.pit[0]}"/><stop offset="1" stop-color="${T.pit[1]}"/></linearGradient>`;
    d += `<radialGradient id="${u}bl" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="${T.ball.hi}"/><stop offset=".55" stop-color="${T.ball.mid}"/><stop offset="1" stop-color="${T.ball.lo}"/></radialGradient>`;
    d += `<filter id="${u}gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${bf}" numOctaves="${T.texture === 'felt' ? 2 : 3}" seed="7"/><feColorMatrix type="matrix" values="0 0 0 0 ${gr} 0 0 0 0 ${gg} 0 0 0 0 ${gb} ${T.grainK} 0 0 0 ${T.grainB}"/></filter>`;
    if (T.boardMine) d += `<linearGradient id="${u}bm" x1="0" y1="0" x2="${L === 'h' ? 0 : 1}" y2="${L === 'h' ? 1 : 0}"><stop offset="0" stop-color="${T.boardMine[0]}"/><stop offset="1" stop-color="${T.boardMine[1]}"/></linearGradient>`;
    d += `<clipPath id="${u}cl"><rect width="${W}" height="${H}" rx="${G.radius}"/></clipPath>`;

    let s = `<rect width="${W}" height="${H}" rx="${G.radius}" fill="url(#${u}bd)"/>`;
    if (T.boardMine) s += `<g clip-path="url(#${u}cl)"><path d="${G.split.fill}" fill="url(#${u}bm)"/></g>`;
    s += `<g clip-path="url(#${u}cl)"><rect width="${W}" height="${H}" filter="url(#${u}gr)"/></g>`;
    if (T.boardMine) s += `<path d="${G.split.seam}" fill="none" stroke="${T.inlay}" stroke-width="2" stroke-opacity=".8"/>`;
    s += `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" rx="${G.radius - 1}" fill="none" stroke="${T.frame}" stroke-width="3"/>`;
    s += `<rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="${G.radius - 7}" fill="none" stroke="${T.inlay}" stroke-width="1.5" stroke-opacity="${T.texture === 'felt' ? 0.9 : 0.5}"${T.texture === 'felt' ? ' stroke-dasharray="5 4"' : ''}/>`;
    s += horns(G.medal.x, G.medal.y, G.medal.r, T.inlay);

    // kazans: 0 = white, 1 = black
    G.kazans.forEach((k, i) => {
      const rr = Math.min(k.w, k.h) / 2;
      s += `<rect x="${k.x}" y="${k.y}" width="${k.w}" height="${k.h}" rx="${rr}" fill="url(#${u}pt)" stroke="${T.pitEdge}" stroke-opacity=".5" stroke-width="1.5"/>`;
      if (T.texture === 'felt') s += `<rect x="${k.x + 5}" y="${k.y + 5}" width="${k.w - 10}" height="${k.h - 10}" rx="${rr - 5}" fill="none" stroke="${T.pitEdge}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
      const badge = G.badge.r * 2 + 8;
      ballPositions(st.kazans[i], { kind: 'kazan', ...k, r: G.kBallR, badge }).forEach((p, j) => { s += ball(T, u, p.x, p.y, G.kBallR, j, p.layer); });
      const along = 4 + G.badge.r + 4;
      const bx = k.axis === 'x' ? (k.from === 'start' ? k.x + along : k.x + k.w - along) : k.x + k.w / 2;
      const by = k.axis === 'y' ? (k.from === 'start' ? k.y + along : k.y + k.h - along) : k.y + k.h / 2;
      s += `<circle cx="${bx}" cy="${by}" r="${G.badge.r}" fill="${T.pillBg}"/><text x="${bx}" y="${f(by + G.badge.fs * 0.36)}" text-anchor="middle" font-size="${G.badge.fs}" font-weight="700" fill="${T.pillFg}" ${FF}>${st.kazans[i]}</text>`;
    });

    for (let i = 0; i < 18; i++) {
      const c = pitCenter(L, i), { rx, ry } = G.pit, n = st.pits[i];
      const tz = st.tuzdyks[0] === i ? T.tuzMine : st.tuzdyks[1] === i ? T.tuzOpp : null;
      const legal = myTurn && i < 9 && n > 0 && !tz;
      if (legal) s += `<ellipse cx="${c.x}" cy="${c.y}" rx="${rx + 5}" ry="${ry + 5}" fill="none" stroke="${T.legal}" stroke-width="2.5"/>`;
      if (o.lastFrom === i) s += `<ellipse cx="${c.x}" cy="${c.y}" rx="${rx + 5}" ry="${ry + 5}" fill="none" stroke="${T.from}" stroke-width="2" stroke-dasharray="5 5"/>`;
      s += `<ellipse cx="${c.x}" cy="${c.y}" rx="${rx}" ry="${ry}" fill="url(#${u}pt)" stroke="${T.pitEdge}" stroke-opacity="${T.texture === 'birch' ? 0.9 : 0.5}" stroke-width="1.5"/>`;
      s += `<ellipse cx="${c.x}" cy="${c.y - 1.5}" rx="${rx - 2}" ry="${ry - 2.5}" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="3"/>`;
      if (T.texture === 'felt') s += `<ellipse cx="${c.x}" cy="${c.y}" rx="${rx - 5}" ry="${ry - 5}" fill="none" stroke="${T.pitEdge}" stroke-width="1.3" stroke-dasharray="3 3"/>`;
      if (tz) s += `<ellipse cx="${c.x}" cy="${c.y}" rx="${rx}" ry="${ry}" fill="${tz}" fill-opacity=".18"/>`;
      ballPositions(n, { kind: 'pit', cx: c.x, cy: c.y, rx, ry, r: G.ballR }).forEach((p, j) => { s += ball(T, u, p.x, p.y, G.ballR, j, p.layer); });
      if (tz) { const a = Math.min(rx, ry) * 0.55; s += `<path d="M${c.x - a} ${c.y - a} L${c.x + a} ${c.y + a} M${c.x + a} ${c.y - a} L${c.x - a} ${c.y + a}" stroke="${tz}" stroke-width="${L === 'h' ? 6 : 5}" stroke-linecap="round"/>`; }
      const pp = pillPos(L, i), P = G.pill, isTo = o.lastTo === i;
      s += `<rect x="${pp.x - P.w / 2}" y="${pp.y - P.h / 2}" width="${P.w}" height="${P.h}" rx="${P.h / 2}" fill="${isTo ? T.to : T.pillBg}"/>`;
      s += `<text x="${pp.x}" y="${f(pp.y + P.fs * 0.36)}" text-anchor="middle" font-size="${P.fs}" font-weight="600" fill="${isTo ? T.toFg : T.pillFg}" ${FF}>${n}</text>`;
      const np = numPos(L, i);
      s += `<text x="${np.x}" y="${f(np.y + G.numFs * 0.36)}" text-anchor="middle" font-size="${G.numFs}" font-weight="500" fill="${i < 9 && T.numMine ? T.numMine : T.num}" ${FF}>${i < 9 ? i + 1 : i - 8}</text>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="display:block" role="img" aria-label="board"><defs>${d}</defs>${s}</svg>`;
  }

  window.TK = { FIXTURES, parseFixture, GEO, THEMES, pitCenter, pillPos, numPos, ballPositions, renderBoardSVG, PIT_N, KAZAN_N };
})();
