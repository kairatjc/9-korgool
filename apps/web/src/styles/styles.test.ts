/* The handoff styles are copied, not redrawn (docs/design/handoff.md §2): tokens.css byte for byte,
   components.css split into files whose concatenation (in index.css order) is the original. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const HANDOFF = '../../../../design/handoff/';

describe('handoff styles', () => {
  it('tokens.css is identical to the handoff', () => {
    expect(read('./tokens.css')).toBe(read(HANDOFF + 'tokens.css'));
  });

  it('components/*.css concatenated in index.css order equal components.css', () => {
    const imports = [...read('./index.css').matchAll(/@import '\.\/(components\/[^']+)';/g)].map(
      (m) => m[1]!,
    );
    expect(imports.length).toBeGreaterThan(0);
    expect(imports.map((f) => read('./' + f)).join('')).toBe(read(HANDOFF + 'components.css'));
  });
});
