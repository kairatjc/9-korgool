import { applyMove, indexToPit } from '@korgool/engine';
import { describe, expect, it } from 'vitest';
import ru from '../i18n/ru.json';
import { STEPS, stepState } from './steps';

const strings = ru as Record<string, string>;
const result = (n: number) => {
  const step = STEPS[n]!;
  return applyMove(stepState(step), indexToPit(step.pit!).pit);
};

describe('tutorial steps', () => {
  it('every step has its strings and a position with White to move', () => {
    for (const step of STEPS) {
      for (const key of [step.title, step.text, step.done])
        if (key) expect(strings[key], key).toBeTruthy();
      expect(stepState(step).turn).toBe('white');
    }
  });

  it('step 2: pit 7 from the start captures 10 in the opponent pit 6', () => {
    expect(result(1).events).toContainEqual({ type: 'capture', index: 14, count: 10, by: 'white' });
  });

  it('step 3: pit 4 captures 6 in the opponent pit 2', () => {
    expect(result(2).events).toContainEqual({ type: 'capture', index: 10, count: 6, by: 'white' });
  });

  it('step 4: pit 5 makes the opponent pit 3 a tuzdyk', () => {
    expect(result(3).events).toContainEqual({ type: 'tuzdyk', index: 11, by: 'white' });
  });

  it('step 5: pit 9 takes the kazan to 82 and wins', () => {
    const r = result(4);
    expect(r.state.kazans[0]).toBe(82);
    expect(r.state.status).toBe('white_won');
  });
});
