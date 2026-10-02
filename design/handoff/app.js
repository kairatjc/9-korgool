/* Тогуз коргоол — prototype router, i18n and screen fixtures.
   URL: index.html?screen=<id>&fixture=<id>&state=<state>&static=1&lang=ru|ky|en&mode=online|bot|friend|local
   Extra (game-over): &outcome=win|loss|draw &reason=82|noMoves|time|resign|disconnect */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const P = {
    screen: Q.get('screen') || 'home',
    fixture: Q.get('fixture'),
    state: Q.get('state') || 'my-turn',
    static: Q.get('static') === '1',
    lang: ['ru', 'ky', 'en'].includes(Q.get('lang')) ? Q.get('lang') : 'ru',
    mode: ['online', 'bot', 'friend', 'local'].includes(Q.get('mode')) ? Q.get('mode') : 'online',
    outcome: Q.get('outcome'),
    reason: Q.get('reason') || '82',
    auth: Q.get('auth') === '1' || Q.get('state') === 'signed-in'
  };
  const SCREEN_SECTION = {
    'home': 'home', 'bot-setup': 'bot-setup', 'friend-create': 'friend-create', 'friend-wait': 'friend-wait',
    'join-code': 'join-code', 'matchmaking': 'matchmaking', 'matchmaking-offer-bot': 'matchmaking',
    'game': 'game', 'game-over': 'game', 'sign-in': 'sign-in', 'profile': 'profile', 'rules': 'rules',
    'tutorial': 'tutorial', 'settings': 'settings', 'spec': 'spec'
  };

  /* ── Fixture data (not UI copy) ─────────────── */
  const DATA = {
    me: { name: 'Айбек', initial: 'А', place: 'Бишкек, Кыргызстан' },
    opponent: { name: 'Бүркүт_42', initial: 'Б' },
    bot: { name: 'Устат (бот)', icon: 'bot' },
    clocks: { me: '3:47', opponent: '4:12', low: '0:14' },
    time: { online: '5+3', friend: '10+5' },
    roomCode: 'K7M2QX',
    inviteLink: 'toguz.kg/r/K7M2QX',
    joinPrefill: 'K7M',
    moves: [['7', '3'], ['9x', '5'], ['3', '7x'], ['1', '2'], ['8x', '9X'], ['6', '4x'], ['2X', '1'], ['5', '8'], ['4x', '3x'], ['9', '6'], ['7x', '2'], ['3', '5']],
    stats: { wins: 48, losses: 31, draws: 4, tuzdyks: 37 },
    history: [
      { name: 'Бүркүт_42', initial: 'Б', result: 'win', score: '84 : 78', date: '28.09.2026' },
      { name: 'Устат (бот)', icon: 'bot', result: 'loss', score: '71 : 91', date: '27.09.2026' },
      { name: 'Асель_kg', initial: 'А', result: 'win', score: '82 : 67', date: '25.09.2026' },
      { name: 'Талант', initial: 'Т', result: 'draw', score: '81 : 81', date: '24.09.2026' },
      { name: 'nurlan.b', initial: 'N', result: 'loss', score: '66 : 96', date: '21.09.2026' },
      { name: 'Бүркүт_42', initial: 'Б', result: 'win', score: '90 : 72', date: '19.09.2026' }
    ],
    diagrams: {
      sow: { bottom: [9, 9, 1, 10, 10], top: [9, 9, 9, 9, 7], states: { b2: 'from', t4: 'to' }, arrow: ['b2', 't4'] },
      capture: { bottom: [9, 9, 9, 9, 1], top: [9, 9, 9, 6, 8], states: { b4: 'from', t3: 'capture' }, arrow: ['b4', 't3'], labels: { t3: 'rules.labelCapture' } },
      tuzdyk: { bottom: [9, 9, 9, 1, 10], top: [9, 9, 9, 9, 3], states: { b3: 'from', t4: 'tuzdyk-mine' }, arrow: ['b3', 't4'], labels: { t4: 'game.tuzdyk' } }
    },
    /* Event list from the brief (start position, white plays pit 9). */
    demoEvents: [
      { type: 'pickup', index: 8, count: 9 },
      { type: 'sow', index: 8, toKazan: null }, { type: 'sow', index: 9, toKazan: null }, { type: 'sow', index: 10, toKazan: null },
      { type: 'sow', index: 11, toKazan: null }, { type: 'sow', index: 12, toKazan: null }, { type: 'sow', index: 13, toKazan: null },
      { type: 'sow', index: 14, toKazan: null }, { type: 'sow', index: 15, toKazan: null }, { type: 'sow', index: 16, toKazan: null },
      { type: 'capture', index: 16, count: 10, by: 'white' }
    ]
  };

  /* ── i18n ───────────────────────────────────── */
  const COPY = window.KCOPY || {};
  function t(key, vars) {
    const e = COPY[key];
    let s = e ? (e[P.lang] != null ? e[P.lang] : e.ru) : key;
    if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function applyI18n(root) {
    (root || document).querySelectorAll('[data-i18n]').forEach(el => {
      const vars = el.dataset.i18nVars ? JSON.parse(el.dataset.i18nVars) : null;
      el.textContent = t(el.dataset.i18n, vars);
    });
    document.documentElement.lang = P.lang;
  }
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const slot = (name, root) => $(`[data-slot="${name}"]`, root);
  const show = (el, on) => { if (el) el.hidden = !on; };

  /* ── Navigation ─────────────────────────────── */
  function go(screen, params) {
    const q = new URLSearchParams(params || '');
    q.set('screen', screen);
    if (P.lang !== 'ru') q.set('lang', P.lang);
    if (P.auth) q.set('auth', '1');
    location.search = q.toString();
  }
  function setLang(lang) {
    const q = new URLSearchParams(location.search);
    q.set('lang', lang);
    location.search = q.toString();
  }

  const phoneMQ = window.matchMedia('(max-width: 767px)');
  const boardLayout = () => (phoneMQ.matches ? 'v' : 'h');
  const speed = () => localStorage.getItem('k.speed') || 'normal';

  /* ── Screens ────────────────────────────────── */
  const screens = {};

  screens.home = root => {
    $$('[data-when]', root).forEach(el => show(el, (el.dataset.when === 'signed-in') === P.auth));
    const sel = $('[data-lang-select]', root);
    sel.value = P.lang;
    sel.addEventListener('change', () => setLang(sel.value));
    TK.mountBoard($('[data-board-host="home"]', root), TK.parseFixture(TK.FIXTURES.start), { layout: 'h', interactive: false, uid: 'home' });
  };

  screens['friend-wait'] = root => {
    slot('room-code', root).textContent = DATA.roomCode;
    slot('invite-link', root).textContent = DATA.inviteLink;
  };

  screens['join-code'] = root => {
    const input = $('[data-code-input]', root), cells = $$('.k-code__cell', root), submit = $('[data-join-submit]', root);
    const paint = () => {
      const v = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      input.value = v;
      cells.forEach((c, i) => {
        c.textContent = v[i] || '';
        c.classList.toggle('k-code__cell--filled', i < v.length);
        c.classList.toggle('k-code__cell--focus', i === Math.min(v.length, 5) && v.length < 6);
      });
      submit.disabled = v.length < 6;
    };
    input.value = DATA.joinPrefill;
    input.addEventListener('input', paint);
    paint();
    submit.addEventListener('click', () => go('game', 'mode=friend&fixture=start&state=opponent-turn'));
  };

  screens.matchmaking = root => {
    const offer = P.screen === 'matchmaking-offer-bot';
    let sec = offer ? 31 : 12;
    const timer = slot('mm-timer', root);
    const paint = () => { timer.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); show(slot('mm-offer', root), sec >= 30); };
    paint();
    if (!P.static) setInterval(() => { sec++; paint(); }, 1000);
  };

  screens.profile = root => {
    slot('profile-avatar', root).textContent = DATA.me.initial;
    slot('profile-name', root).textContent = DATA.me.name;
    slot('profile-place', root).textContent = DATA.me.place;
    Object.keys(DATA.stats).forEach(k => { slot('stat-' + k, root).textContent = DATA.stats[k]; });
    const list = slot('history', root), tpl = $('#tpl-history-item');
    const badge = { win: 'k-badge--success', loss: 'k-badge--danger', draw: 'k-badge--muted' };
    DATA.history.forEach(h => {
      const n = tpl.content.firstElementChild.cloneNode(true);
      const av = $('.k-avatar', n);
      if (h.icon) av.innerHTML = `<i data-lucide="${h.icon}"></i>`; else av.textContent = h.initial;
      $('.k-history__name', n).textContent = h.name;
      $('.k-history__date', n).textContent = h.date;
      const b = $('.k-badge', n); b.classList.add(badge[h.result]); b.dataset.i18n = 'result.' + h.result;
      $('.k-history__score', n).textContent = h.score;
      list.appendChild(n);
    });
  };

  screens.rules = root => {
    $$('[data-diagram]', root).forEach(el => {
      const d = JSON.parse(JSON.stringify(DATA.diagrams[el.dataset.diagram]));
      if (d.labels) Object.keys(d.labels).forEach(k => { d.labels[k] = t(d.labels[k]); });
      el.innerHTML = TK.renderDiagram(d);
    });
  };

  screens.tutorial = root => {
    const host = $('[data-board-host="tutorial"]', root);
    let st = TK.parseFixture(TK.FIXTURES.start), busy = false;
    const render = () => TK.mountBoard(host, st, { layout: boardLayout(), uid: 'tut', legalOnly: [6], hint: 6, onPit: play });
    function play(i) {
      if (busy) return; busy = true;
      const mv = TK.computeMove(st, i);
      KMotion.playMove(host, st, mv.events, { layout: boardLayout(), speed: speed(), onDone: (ns, hl) => { st = ns; TK.mountBoard(host, st, { layout: boardLayout(), uid: 'tut', interactive: false, lastFrom: hl.lastFrom, lastTo: hl.lastTo }); } });
    }
    render();
    phoneMQ.addEventListener('change', () => { if (!busy) render(); });
  };

  screens.settings = root => {
    const cur = { lang: P.lang, speed: speed() };
    $$('[data-setting]', root).forEach(group => {
      $$('.k-segmented__option', group).forEach(b => {
        b.classList.toggle('k-segmented__option--selected', b.dataset.value === cur[group.dataset.setting]);
        b.addEventListener('click', () => {
          if (group.dataset.setting === 'lang') return setLang(b.dataset.value);
          localStorage.setItem('k.speed', b.dataset.value);
          $$('.k-segmented__option', group).forEach(x => x.classList.toggle('k-segmented__option--selected', x === b));
        });
      });
    });
    $$('.k-toggle', root).forEach(tg => tg.addEventListener('click', () => {
      const on = !tg.classList.contains('k-toggle--on');
      tg.classList.toggle('k-toggle--on', on); tg.setAttribute('aria-checked', String(on));
    }));
  };

  screens.spec = root => {
    const tpl = $('#tpl-spec-cell');
    const cell = (host, svg, label) => {
      const n = tpl.content.firstElementChild.cloneNode(true);
      $('.k-spec__art', n).innerHTML = svg;
      $('.k-spec__label', n).textContent = label;
      host.appendChild(n);
    };
    const states = [
      ['default', [], 9], ['hover', ['k-pit--legal', 'k-pit--hover'], 9], ['pressed', ['k-pit--legal', 'k-pit--pressed'], 9],
      ['legal', ['k-pit--legal'], 9], ['disabled', ['k-pit--disabled'], 9], ['last-move-from', ['k-pit--last-move-from'], 0],
      ['last-move-to', ['k-pit--last-move-to'], 5], ['capture', ['k-pit--capture'], 10], ['tuzdyk-mine', ['k-pit--tuzdyk-mine'], 0, 'opponent'],
      ['tuzdyk-opponent', ['k-pit--tuzdyk-opponent'], 0], ['hint', ['k-pit--hint', 'k-pit--legal'], 9], ['preview-target', ['k-pit--preview-target'], 9, 'opponent', '+10']
    ];
    const sHost = slot('spec-states', root);
    states.forEach(([name, cls, count, side, label]) => cell(sHost, TK.renderPitSample({ layout: 'h', count, cls, side, label }), name));
    const bHost = slot('spec-balls', root);
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 23, 40].forEach(n => cell(bHost, TK.renderPitSample({ layout: 'h', count: n }), String(n)));
    const kHost = slot('spec-kazan', root);
    [0, 9, 40, 100, 162].forEach(n => cell(kHost, TK.renderKazanSample({ layout: 'h', count: n }), String(n)));
  };

  /* ── Game ───────────────────────────────────── */
  screens.game = root => {
    const isOver = P.screen === 'game-over';
    const fx = P.fixture && TK.FIXTURES[P.fixture] ? P.fixture : (isOver ? 'gameover' : 'midgame');
    let st = TK.parseFixture(TK.FIXTURES[fx]);
    let me = 'white';
    const state = isOver ? 'my-turn' : P.state;
    if (state === 'opponent-turn') st.turn = 'black';
    let hl = fx === 'midgame' ? { lastFrom: 13, lastTo: 2 } : {};
    let moves = fx === 'start' ? [] : DATA.moves.map(m => m.slice());
    let busy = false;
    const host = $('[data-board-host="game"]', root);
    const opp = P.mode === 'bot' ? DATA.bot : DATA.opponent;

    // title
    const title = { online: t('game.modeOnline') + ' · ' + DATA.time.online, bot: t('game.modeBot') + ' · ' + t('bot.level4'), friend: t('game.modeFriend') + ' · ' + DATA.time.friend, local: t('game.modeLocal') }[P.mode];
    slot('game-title', root).textContent = title;

    // actions per mode
    $$('[data-modes]', root).forEach(b => show(b, b.dataset.modes.split(' ').includes(P.mode)));

    // plates
    const plate = who => $(`[data-player="${who}"]`, root);
    const pMe = plate('me'), pOpp = plate('opponent');
    slot('avatar', pMe).textContent = DATA.me.initial;
    slot('name', pMe).textContent = DATA.me.name;
    const oa = slot('avatar', pOpp);
    if (opp.icon) oa.innerHTML = `<i data-lucide="${opp.icon}"></i>`; else oa.textContent = opp.initial;
    slot('name', pOpp).textContent = opp.name;
    if (P.mode === 'bot') { pMe.classList.add('k-player--no-clock'); pOpp.classList.add('k-player--no-clock'); }
    slot('clock', pMe).textContent = state === 'low-time' ? DATA.clocks.low : DATA.clocks.me;
    slot('clock', pOpp).textContent = DATA.clocks.opponent;
    if (state === 'low-time') slot('clock', pMe).classList.add('k-clock--low');

    function paintTurn() {
      const mine = st.turn === me && !isOver;
      const oppTurn = st.turn !== me && !isOver;
      pMe.classList.toggle('k-player--active', mine);
      pOpp.classList.toggle('k-player--active', oppTurn);
      slot('clock', pMe).classList.toggle('k-clock--running', mine);
      slot('clock', pOpp).classList.toggle('k-clock--running', oppTurn && state !== 'opponent-offline');
    }
    pOpp.classList.toggle('k-player--offline', state === 'opponent-offline');
    show(slot('offline-banner', root), state === 'opponent-offline');
    show(slot('reconnecting', root), state === 'reconnecting');
    show(slot('resign-modal', root), state === 'resign-confirm');
    const sheetOpen = on => { show(slot('sheet', root), on); show(slot('sheet-scrim', root), on); };
    sheetOpen(state === 'history-open');

    // moves
    function paintMoves() {
      const tpl = $('#tpl-move-row');
      const fill = host => {
        host.innerHTML = '';
        if (!moves.length) { host.innerHTML = `<div class="k-moves__empty">${t('game.noMoves')}</div>`; return; }
        moves.forEach((m, i) => {
          const r = tpl.content.firstElementChild.cloneNode(true), cells = $$('.k-moves__move', r);
          $('.k-moves__num', r).textContent = (i + 1) + '.';
          cells[0].textContent = m[0] || ''; cells[1].textContent = m[1] || '';
          if (i === moves.length - 1) cells[m[1] ? 1 : 0].classList.add('k-moves__move--last');
          host.appendChild(r);
        });
      };
      fill(slot('moves-list', root)); fill(slot('moves-sheet', root));
      const strip = slot('moves-strip', root);
      if (!moves.length) { strip.textContent = t('game.noMoves'); return; }
      const tail = moves.slice(-3), base = moves.length - tail.length;
      strip.innerHTML = tail.map((m, k) => {
        const lastPair = k === tail.length - 1;
        const w = lastPair && !m[1] ? `<b>${m[0]}</b>` : m[0];
        const b = m[1] ? (lastPair ? `<b>${m[1]}</b>` : m[1]) : '';
        return `${base + k + 1}. ${w} ${b}`.trim();
      }).join(' · ');
      const list = slot('moves-list', root); list.scrollTop = list.scrollHeight;
    }

    // board
    function preview(i) {
      if (i == null) return TK.setPreview(host, null);
      const mv = TK.computeMove(st, i);
      const label = mv.result ? (mv.result.type === 'capture' ? '+' + mv.result.count : t('game.tuzdyk')) : '';
      TK.setPreview(host, mv.last, label);
    }
    function render() {
      const o = { layout: boardLayout(), me, uid: 'game', lastFrom: hl.lastFrom, lastTo: hl.lastTo, interactive: !isOver && !busy, onPit: play, onPitHover: preview };
      if (state === 'preview' && !busy) {
        const mv = TK.computeMove(st, 6);
        o.hover = 6; o.previewTarget = mv.last;
        o.previewLabel = mv.result ? (mv.result.type === 'capture' ? '+' + mv.result.count : t('game.tuzdyk')) : '';
      }
      TK.mountBoard(host, st, o);
    }
    function notate(mv, i) {
      const n = (i % 9) + 1;
      const tail = mv.result ? (mv.result.type === 'capture' ? 'x' : 'X') : '';
      return n + tail;
    }
    function run(events, start, after) {
      busy = true; render();
      return KMotion.playMove(host, start, events, {
        layout: boardLayout(), me, speed: P.static ? 'off' : (slot('dev-speed').value || speed()),
        onDone: (ns, h) => { st = ns; hl = h; busy = false; after && after(); paintTurn(); render(); }
      });
    }
    function play(i) {
      if (busy || st.turn !== me) return;
      const mv = TK.computeMove(st, i);
      const start = TK.cloneState(st);
      run(mv.events, start, () => {
        st.turn = mv.state.turn;
        const note = notate(mv, i);
        if (me === 'white') moves.push([note]); else if (moves.length) moves[moves.length - 1][1] = note; else moves.push(['', note]);
        paintMoves();
      });
    }

    // game over
    if (isOver) {
      const my = st.kazans[0], their = st.kazans[1];
      const outcome = P.outcome || (my > 81 ? 'win' : their > 81 ? 'loss' : my === 81 && their === 81 ? 'draw' : 'win');
      const m = slot('over-modal', root);
      m.classList.add('k-modal--' + outcome);
      slot('over-title', m).dataset.i18n = 'over.' + outcome;
      slot('over-reason', m).dataset.i18n = outcome === 'draw' ? 'over.reason.draw' : 'over.reason.' + P.reason;
      slot('over-me-avatar', m).textContent = DATA.me.initial;
      slot('over-me-name', m).textContent = DATA.me.name;
      const oav = slot('over-opp-avatar', m);
      if (opp.icon) oav.innerHTML = `<i data-lucide="${opp.icon}"></i>`; else oav.textContent = opp.initial;
      slot('over-opp-name', m).textContent = opp.name;
      slot('over-me-score', m).textContent = outcome === 'draw' ? 81 : my;
      slot('over-opp-score', m).textContent = outcome === 'draw' ? 81 : their;
      show(m, true);
    }

    // actions
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-action]');
      if (!a) return;
      const act = a.dataset.action;
      if (act === 'resign') show(slot('resign-modal', root), true);
      if (act === 'modal-close') show(slot('resign-modal', root), false);
      if (act === 'resign-confirm') go('game-over', `mode=${P.mode}&outcome=loss&reason=resign`);
      if (act === 'history-open') sheetOpen(true);
      if (act === 'history-close') sheetOpen(false);
      if (act === 'flip') { me = me === 'white' ? 'black' : 'white'; flipPlates(); render(); }
      if (act === 'rematch') go('game', `mode=${P.mode}&fixture=start`);
    });
    function flipPlates() {
      // plates follow the board: my plate is always at the bottom
      const sideOf = who => (who === 'me' ? me : (me === 'white' ? 'black' : 'white'));
      ['me', 'opponent'].forEach(who => {
        const p = plate(who), s = sideOf(who), dot = $('.k-side-dot', p), lbl = $('.k-player__side [data-i18n]', p);
        dot.className = 'k-side-dot k-side-dot--' + s; lbl.dataset.i18n = 'common.' + s; lbl.textContent = t('common.' + s);
      });
      paintTurn();
    }

    // dev bar: plays the brief's event list from the start position
    if (!P.static) {
      const bar = slot('devbar'); show(bar, true);
      slot('dev-speed').value = speed();
      $('[data-action="play-move"]', bar).addEventListener('click', () => {
        if (busy) return;
        me = 'white'; flipPlates();
        const start = TK.parseFixture(TK.FIXTURES.start);
        st = start; hl = {}; moves = []; paintMoves();
        run(DATA.demoEvents, start, () => { st.turn = 'black'; moves.push(['9x']); paintMoves(); });
      });
    }

    paintTurn(); paintMoves(); render();
    phoneMQ.addEventListener('change', () => { if (!busy) render(); });
  };

  /* ── Boot ───────────────────────────────────── */
  function boot() {
    if (P.static) document.documentElement.classList.add('k-static');
    TK.ensureSprite();
    const id = SCREEN_SECTION[P.screen] ? P.screen : 'home';
    const root = $(`[data-screen="${SCREEN_SECTION[id]}"]`);
    root.hidden = false;
    if (screens[SCREEN_SECTION[id]]) screens[SCREEN_SECTION[id]](root);
    // generic single-choice groups
    $$('[data-choice-group]', root).forEach(g => {
      const kids = Array.from(g.children);
      kids.forEach(k => k.addEventListener('click', () => kids.forEach(x => {
        const base = x.classList[0];
        x.classList.toggle(base + '--selected', x === k);
      })));
    });
    document.addEventListener('click', e => {
      const g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); go(g.dataset.go, g.dataset.goParams); }
    });
    applyI18n();
    if (window.lucide) window.lucide.createIcons();
    document.documentElement.dataset.ready = '1';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.KApp = { P, t, go };
})();
