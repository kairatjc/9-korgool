import { parse } from '@korgool/engine';
import type { Player } from '@korgool/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { OnlineGame, type GameOutput } from '../src/game';
import { ManualScheduler } from './helpers';

const alice: Player = { id: 'a', name: 'Алиса' };
const bek: Player = { id: 'b', name: 'Бек' };

type Sent = { event: string; to?: string; payload?: unknown };

let clock: ManualScheduler;
let sent: Sent[];

function recorder(): GameOutput {
  return {
    start: () => sent.push({ event: 'start' }),
    moved: (payload) => sent.push({ event: 'moved', payload }),
    over: (payload) => sent.push({ event: 'over', payload }),
    drawOffered: (to, payload) => sent.push({ event: 'draw-offered', to, payload }),
    drawDeclined: (to) => sent.push({ event: 'draw-declined', to }),
    opponentStatus: (to, payload) => sent.push({ event: 'opponent-status', to, payload }),
  };
}

/** Партия 5+3: Алиса — белые, Бек — чёрные, оба онлайн. */
function started(
  timeControl: { initial: number; increment: number } | null = { initial: 300, increment: 3 },
) {
  const game = new OnlineGame('AB12CD', timeControl, recorder(), clock);
  game.seat('white', alice);
  game.connect('white');
  const joined = game.join(bek);
  expect(joined).toEqual({ ok: true, side: 'black', seated: true });
  game.connect('black');
  game.start();
  return game;
}

const lastOver = () => sent.filter((s) => s.event === 'over').at(-1)?.payload;

beforeEach(() => {
  clock = new ManualScheduler();
  sent = [];
});

describe('вход в партию', () => {
  it('партия начинается, когда сел второй игрок', () => {
    const game = new OnlineGame('AB12CD', null, recorder(), clock);
    game.seat('black', alice);
    expect(game.phase).toBe('waiting');
    expect(game.join(bek)).toEqual({ ok: true, side: 'white', seated: true });
    game.start();
    expect(game.phase).toBe('playing');
    expect(sent.map((s) => s.event)).toEqual(['start']);
  });

  it('свой игрок возвращается на своё место, третьему места нет', () => {
    const game = started();
    expect(game.join(alice)).toEqual({ ok: true, side: 'white', seated: false });
    expect(game.join({ id: 'c', name: 'Чолпон' })).toEqual({ ok: false, error: 'game_full' });
  });

  it('до начала партии ходить нельзя', () => {
    const game = new OnlineGame('AB12CD', null, recorder(), clock);
    game.seat('white', alice);
    expect(game.move('a', 1, 0)).toEqual({ ok: false, error: 'not_started' });
  });
});

describe('ходы', () => {
  it('сервер проверяет очередь, номер полухода и правила', () => {
    const game = started();
    expect(game.move('b', 1, 0)).toEqual({ ok: false, error: 'not_your_turn' });
    expect(game.move('c', 1, 0)).toEqual({ ok: false, error: 'not_a_player' });
    expect(game.move('a', 1, 1)).toEqual({ ok: false, error: 'stale_ply' });
    expect(game.move('a', 7, 0)).toEqual({ ok: true });
    // Повтор того же хода (двойной клик, повторная отправка) отклоняется.
    expect(game.move('a', 7, 0)).toEqual({ ok: false, error: 'stale_ply' });
    expect(game.moves).toEqual([7]);
    expect(game.state.turn).toBe('black');

    const moved = sent.find((s) => s.event === 'moved')?.payload;
    expect(moved).toMatchObject({ gameId: 'AB12CD', pit: 7, ply: 0, side: 'white' });
  });

  it('ход из пустой лунки — ошибка', () => {
    const game = started();
    game.state = parse('0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,10/80,70/-,-/w');
    expect(game.move('a', 1, 0)).toEqual({ ok: false, error: 'illegal_move' });
  });

  it('партия заканчивается по счёту', () => {
    const game = started();
    // Последний шарик белых делает чётное число у чёрных: захват 2 → 82 в казане.
    game.state = parse('0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,10/80,70/-,-/w');
    expect(game.move('a', 9, 0)).toEqual({ ok: true });
    expect(game.phase).toBe('over');
    expect(lastOver()).toMatchObject({ result: 'white_won', reason: 'score' });
    expect(game.move('b', 9, 1)).toEqual({ ok: false, error: 'game_over' });
    expect(clock.pending).toBe(0);
  });
});

describe('часы (rules.md §8)', () => {
  it('до первого хода часы стоят', () => {
    const game = started();
    clock.advance(20_000);
    expect(game.clocks()).toEqual({ white: 300_000, black: 300_000, running: null });
  });

  it('добавка по Фишеру начисляется после хода', () => {
    const game = started();
    game.move('a', 7, 0);
    expect(game.clocks()).toEqual({ white: 303_000, black: 300_000, running: 'black' });
    clock.advance(10_000);
    expect(game.clocks()).toEqual({ white: 303_000, black: 290_000, running: 'black' });
    game.move('b', 1, 1);
    expect(game.clocks()).toEqual({ white: 303_000, black: 293_000, running: 'white' });
  });

  it('отклонённый ход не списывает время дважды', () => {
    const game = started();
    game.move('a', 7, 0);
    clock.advance(5_000);
    game.state = { ...game.state, pits: game.state.pits.map((n, i) => (i === 9 ? 0 : n)) };
    expect(game.move('b', 1, 1)).toEqual({ ok: false, error: 'illegal_move' });
    clock.advance(5_000);
    expect(game.move('b', 2, 1)).toEqual({ ok: true });
    expect(game.clocks()).toMatchObject({ black: 293_000 });
  });

  it('флаг: у кого кончилось время — тот проиграл, даже при перевесе в счёте', () => {
    const game = started({ initial: 60, increment: 0 });
    game.move('a', 7, 0);
    game.state = { ...game.state, kazans: [0, 40] };
    clock.advance(59_999);
    expect(game.phase).toBe('playing');
    clock.advance(1);
    expect(game.phase).toBe('over');
    expect(lastOver()).toEqual({
      gameId: 'AB12CD',
      result: 'white_won',
      reason: 'timeout',
      clocks: { white: 60_000, black: 0, running: null },
    });
  });

  it('без часов флага нет', () => {
    const game = started(null);
    game.move('a', 7, 0);
    clock.advance(24 * 60 * 60_000);
    expect(game.phase).toBe('playing');
    expect(game.clocks()).toBeNull();
  });

  it('если первый ход не сделан за 30 с — партия отменяется', () => {
    const game = started();
    clock.advance(29_999);
    expect(game.phase).toBe('playing');
    clock.advance(1);
    expect(lastOver()).toMatchObject({ result: 'cancelled', reason: 'no_first_move' });
  });

  it('после первого хода таймер отмены не срабатывает', () => {
    const game = started(null);
    clock.advance(20_000);
    game.move('a', 7, 0);
    clock.advance(20_000);
    expect(game.phase).toBe('playing');
  });
});

describe('отключение (rules.md §8)', () => {
  it('не вернулся за 60 с — поражение; часы продолжают идти', () => {
    const game = started(null);
    game.move('a', 7, 0);
    game.disconnect('black');
    expect(sent.at(-1)).toEqual({
      event: 'opponent-status',
      to: 'white',
      payload: { gameId: 'AB12CD', online: false },
    });
    clock.advance(60_000);
    expect(lastOver()).toMatchObject({ result: 'white_won', reason: 'disconnect' });
  });

  it('вернулся вовремя — партия продолжается', () => {
    const game = started(null);
    game.move('a', 7, 0);
    game.disconnect('black');
    clock.advance(59_000);
    game.connect('black');
    expect(sent.at(-1)).toMatchObject({
      event: 'opponent-status',
      to: 'white',
      payload: { online: true },
    });
    clock.advance(10 * 60_000);
    expect(game.phase).toBe('playing');
  });

  it('пока открыта хотя бы одна вкладка, игрок онлайн', () => {
    const game = started(null);
    game.move('a', 7, 0);
    game.connect('black');
    game.disconnect('black');
    clock.advance(120_000);
    expect(game.phase).toBe('playing');
    expect(game.isOnline('black')).toBe(true);
  });

  it('создатель ушёл, пока ждал соперника, — отсчёт идёт с начала партии', () => {
    const game = new OnlineGame('AB12CD', null, recorder(), clock);
    game.seat('black', alice);
    game.connect('black');
    game.disconnect('black');
    clock.advance(10 * 60_000);
    expect(game.phase).toBe('waiting');
    game.join(bek);
    game.connect('white');
    game.start();
    game.move('b', 7, 0);
    clock.advance(60_000);
    expect(lastOver()).toMatchObject({ result: 'white_won', reason: 'disconnect' });
  });
});

describe('сдача и ничья', () => {
  it('сдавшийся проигрывает', () => {
    const game = started();
    expect(game.resign('b')).toEqual({ ok: true });
    expect(lastOver()).toMatchObject({ result: 'white_won', reason: 'resign' });
    expect(game.resign('a')).toEqual({ ok: false, error: 'game_over' });
  });

  it('предложение ничьей: принять', () => {
    const game = started();
    game.offerDraw('a');
    expect(sent.at(-1)).toEqual({
      event: 'draw-offered',
      to: 'black',
      payload: { gameId: 'AB12CD', by: 'white' },
    });
    expect(game.answerDraw('a', true)).toEqual({ ok: false, error: 'no_draw_offer' });
    expect(game.answerDraw('b', true)).toEqual({ ok: true });
    expect(lastOver()).toMatchObject({ result: 'draw', reason: 'draw_agreed' });
  });

  it('предложение ничьей: отклонить; ход снимает предложение', () => {
    const game = started();
    game.offerDraw('a');
    game.answerDraw('b', false);
    expect(sent.at(-1)).toEqual({ event: 'draw-declined', to: 'white' });
    expect(game.drawOffer).toBeNull();

    game.offerDraw('a');
    game.move('a', 7, 0);
    expect(game.drawOffer).toBeNull();
    expect(game.answerDraw('b', true)).toEqual({ ok: false, error: 'no_draw_offer' });
  });

  it('встречное предложение — согласие', () => {
    const game = started();
    game.offerDraw('a');
    game.offerDraw('b');
    expect(lastOver()).toMatchObject({ result: 'draw', reason: 'draw_agreed' });
  });
});

describe('снимок партии', () => {
  it('показывает получателю его сторону и не раскрывает лишнего', () => {
    const game = started();
    game.move('a', 7, 0);
    const snap = game.snapshot('b');
    expect(snap).toMatchObject({
      gameId: 'AB12CD',
      phase: 'playing',
      you: 'black',
      moves: [7],
      players: { white: alice, black: bek },
      online: { white: true, black: true },
      result: null,
    });
    expect(game.snapshot('zzz').you).toBeNull();
  });
});

describe('перезапуск сервера', () => {
  /** Сохранить партию, «перезапустить» сервер через `downtimeMs` и поднять её. */
  function restart(game: OnlineGame, downtimeMs: number) {
    const saved = JSON.parse(JSON.stringify(game.save()));
    game.dispose();
    clock.advance(downtimeMs);
    sent = [];
    return OnlineGame.restore(saved, recorder(), clock);
  }

  it('позиция, ходы и часы восстанавливаются; простой сервера не засчитывается', () => {
    const game = started();
    game.move('a', 7, 0);
    clock.advance(10_000);
    const back = restart(game, 120_000);
    expect(back.snapshot('b')).toMatchObject({
      phase: 'playing',
      you: 'black',
      moves: [7],
      state: game.state,
      clocks: { white: 303_000, black: 290_000, running: 'black' },
      online: { white: false, black: false },
    });
    back.connect('white');
    back.connect('black');
    expect(back.move('b', 1, 1)).toEqual({ ok: true });
  });

  it('флаг после восстановления срабатывает по оставшемуся времени', () => {
    const game = started();
    game.move('a', 7, 0);
    clock.advance(280_000);
    const back = restart(game, 5_000);
    back.connect('white');
    back.connect('black');
    clock.advance(19_999);
    expect(back.phase).toBe('playing');
    clock.advance(1);
    expect(lastOver()).toMatchObject({ result: 'white_won', reason: 'timeout' });
  });

  it('кто не вернулся за 60 с — проиграл; не вернулся никто — партия отменена', () => {
    const game = started();
    game.move('a', 7, 0);
    const back = restart(game, 1_000);
    back.connect('black');
    clock.advance(60_000);
    expect(lastOver()).toMatchObject({ result: 'black_won', reason: 'disconnect' });

    const other = started();
    other.move('a', 7, 0);
    const nobody = restart(other, 1_000);
    clock.advance(60_000);
    expect(nobody.result).toBe('cancelled');
    expect(lastOver()).toMatchObject({ result: 'cancelled', reason: 'disconnect' });
  });

  it('без первого хода снова идёт таймер отмены', () => {
    const back = restart(started(), 1_000);
    back.connect('white');
    back.connect('black');
    clock.advance(30_000);
    expect(lastOver()).toMatchObject({ result: 'cancelled', reason: 'no_first_move' });
  });

  it('законченная партия остаётся законченной', () => {
    const game = started();
    game.resign('b');
    const back = restart(game, 1_000);
    expect(back.snapshot('a')).toMatchObject({
      phase: 'over',
      result: 'white_won',
      reason: 'resign',
    });
    clock.advance(120_000);
    expect(sent).toEqual([]);
  });
});
