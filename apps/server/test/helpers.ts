import type { Scheduler } from '../src/scheduler';

/** Ручные часы: время идёт только по `advance`. */
export class ManualScheduler implements Scheduler {
  private time = 1_000_000;
  private seq = 0;
  private tasks: { at: number; seq: number; fn: () => void }[] = [];

  now(): number {
    return this.time;
  }

  after(ms: number, fn: () => void): () => void {
    const task = { at: this.time + Math.max(0, ms), seq: this.seq++, fn };
    this.tasks.push(task);
    return () => {
      this.tasks = this.tasks.filter((t) => t !== task);
    };
  }

  advance(ms: number): void {
    const end = this.time + ms;
    for (;;) {
      const due = this.tasks
        .filter((t) => t.at <= end)
        .sort((a, b) => a.at - b.at || a.seq - b.seq)[0];
      if (!due) break;
      this.tasks = this.tasks.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
    }
    this.time = end;
  }

  get pending(): number {
    return this.tasks.length;
  }
}
