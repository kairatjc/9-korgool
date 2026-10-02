/* Pixel comparison of every handoff screen with its implementation (docs/design/handoff.md §3).
   Reference: /__handoff/index.html?…&static=1 (design/handoff as is). Implementation: /__design?…&static=1.
   Fails when more than 0.5 % of the pixels differ; expected / actual / diff PNGs go to test-results/. */
import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { implementationUrl, referenceUrl, SCREENS, VIEWPORTS } from '../src/design/screens';
import en from '../src/i18n/en.json' with { type: 'json' };
import ky from '../src/i18n/ky.json' with { type: 'json' };
import ru from '../src/i18n/ru.json' with { type: 'json' };

const MAX_DIFF = 0.005;
const require = createRequire(import.meta.url);
// The reference loads Lucide from unpkg; serve the same version from node_modules (offline, deterministic).
const LUCIDE = readFileSync(require.resolve('lucide/dist/umd/lucide.min.js'));
// The reference gets the app's strings, so the comparison checks layout and styling; copy differences
// (recorded in design/DEVIATIONS.md) are checked exactly by src/i18n/i18n.test.ts.
const COPY = (() => {
  const langs = { ru, ky, en } as Record<string, Record<string, string>>;
  const merged: Record<string, Record<string, string | undefined>> = {};
  for (const key of Object.keys(ru))
    merged[key] = { ru: langs.ru?.[key], ky: langs.ky?.[key], en: langs.en?.[key] };
  return `window.KCOPY = ${JSON.stringify(merged)};`;
})();

// Google Fonts: fetched once per worker (with retries) and served to both pages from memory, so the reference
// and the implementation always render with exactly the same font files.
const fontCache = new Map<string, { body: Buffer; contentType: string }>();
async function cachedFont(route: Route): Promise<void> {
  const url = route.request().url();
  let hit = fontCache.get(url);
  for (let attempt = 0; !hit && attempt < 4; attempt++) {
    try {
      const res = await route.fetch({ timeout: 15_000 });
      if (res.ok()) {
        hit = { body: await res.body(), contentType: res.headers()['content-type'] ?? '' };
        fontCache.set(url, hit);
      }
    } catch {
      /* retry */
    }
  }
  if (hit) await route.fulfill(hit);
  else await route.abort();
}

/** Every weight and subset the screens use (Cyrillic, Kyrgyz ң ө ү, Latin, digits). */
const FONT_PROBES = [
  '400 16px "Golos Text"',
  '500 16px "Golos Text"',
  '600 16px "Golos Text"',
  '500 16px Rubik',
  '600 16px Rubik',
];
const FONT_TEXT = 'АаБбЖжЧчЁё ҢңӨөҮү Aa Zz 0123456789 +·:';

async function shoot(page: Page, url: string): Promise<PNG> {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, cachedFont);
  await page.route('https://unpkg.com/lucide@0.469.0/**', (route) =>
    route.fulfill({ body: LUCIDE, contentType: 'application/javascript' }),
  );
  await page.route('**/__handoff/copy.js', (route) =>
    route.fulfill({ body: COPY, contentType: 'application/javascript' }),
  );
  await page.goto(url);
  await page.waitForSelector('html[data-ready="1"]');
  await page.evaluate(
    async ({ probes, text }) => {
      await document.fonts.ready;
      const loaded = await Promise.all(probes.map((p) => document.fonts.load(p, text)));
      // Otherwise the comparison would silently run on fallback fonts.
      if (loaded.some((faces) => faces.length === 0)) throw new Error('Web fonts did not load');
      await document.fonts.ready;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    { probes: FONT_PROBES, text: FONT_TEXT },
  );
  return PNG.sync.read(
    await page.screenshot({ fullPage: true, animations: 'disabled', caret: 'hide' }),
  );
}

for (const vp of VIEWPORTS) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    for (const s of SCREENS) {
      test(`${s.label} · ${s.q}`, async ({ page }, info) => {
        const expected = await shoot(page, referenceUrl(s.q));
        const actual = await shoot(page, implementationUrl(s.q));
        const save = async (name: string, png: PNG) =>
          info.attach(name, { body: PNG.sync.write(png), contentType: 'image/png' });
        if (expected.width !== actual.width || expected.height !== actual.height) {
          await save('expected.png', expected);
          await save('actual.png', actual);
          expect(`${actual.width}×${actual.height}`, 'page size').toBe(
            `${expected.width}×${expected.height}`,
          );
        }
        const { width, height } = expected;
        const diff = new PNG({ width, height });
        const changed = pixelmatch(expected.data, actual.data, diff.data, width, height, {
          threshold: 0.1,
        });
        const ratio = changed / (width * height);
        info.annotations.push({ type: 'diff', description: `${(ratio * 100).toFixed(3)} %` });
        if (process.env.VISUAL_LOG)
          console.log(`[diff] ${vp.name} ${s.q} ${(ratio * 100).toFixed(3)} %`);
        if (ratio > 0) {
          await save('expected.png', expected);
          await save('actual.png', actual);
          await save('diff.png', diff);
        }
        expect(ratio, `${(ratio * 100).toFixed(3)} % of pixels differ`).toBeLessThanOrEqual(
          MAX_DIFF,
        );
      });
    }
  });
}
