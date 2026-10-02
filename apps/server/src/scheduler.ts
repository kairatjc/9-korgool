/** Время и таймеры партии. В тестах подменяется ручным планировщиком. */
export interface Scheduler {
  now(): number;
  /** Запускает `fn` через `ms` миллисекунд; возвращает функцию отмены. */
  after(ms: number, fn: () => void): () => void;
}

export const realScheduler: Scheduler = {
  now: () => Date.now(),
  after(ms, fn) {
    const timer = setTimeout(fn, Math.max(0, ms));
    timer.unref();
    return () => clearTimeout(timer);
  },
};
