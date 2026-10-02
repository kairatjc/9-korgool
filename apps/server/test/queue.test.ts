import { describe, expect, it } from 'vitest';
import { Matchmaker } from '../src/queue';

const a = { id: 'a', name: 'Алиса' };
const b = { id: 'b', name: 'Бек' };
const c = { id: 'c', name: 'Чолпон' };

describe('очередь подбора', () => {
  it('первые двое образуют пару, третий ждёт', () => {
    const q = new Matchmaker();
    expect(q.join(a, 's1')).toBeNull();
    expect(q.join(b, 's2')).toEqual([a, b]);
    expect(q.size).toBe(0);
    expect(q.join(c, 's3')).toBeNull();
    expect(q.size).toBe(1);
  });

  it('игрок не попадает в пару сам с собой (две вкладки)', () => {
    const q = new Matchmaker();
    q.join(a, 's1');
    expect(q.join(a, 's2')).toBeNull();
    expect(q.size).toBe(1);
  });

  it('уход из очереди и закрытие последней вкладки', () => {
    const q = new Matchmaker();
    q.join(a, 's1');
    q.join(a, 's2');
    q.dropSocket('a', 's1');
    expect(q.size).toBe(1);
    q.dropSocket('a', 's2');
    expect(q.size).toBe(0);

    q.join(b, 's3');
    q.leave('b');
    expect(q.join(c, 's4')).toBeNull();
  });
});
