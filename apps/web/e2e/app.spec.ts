/* Functional checks of the real app routes (not the design fixtures). */
import { expect, test, type Page } from '@playwright/test';

const pit = (page: Page, index: number) => page.locator(`.k-board .k-pit[data-index="${index}"]`);
const count = async (page: Page, index: number) =>
  Number(await pit(page, index).locator('.k-pit__count-text').textContent());
const kazan = async (page: Page, side: 'white' | 'black') =>
  Number(await page.locator(`.k-kazan[data-side="${side}"] .k-kazan__count-text`).textContent());

test.beforeEach(async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // Network failures of external resources (fonts) are not app errors.
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
      errors.push(m.text());
  });
  (page as Page & { errors?: string[] }).errors = errors;
  // Instant playback keeps the checks fast and deterministic (except where a test opts in to animation).
  if (!info.title.includes('animated'))
    await page.addInitScript(
      () => localStorage.getItem('k.speed') ?? localStorage.setItem('k.speed', 'off'),
    );
});

test.afterEach(async ({ page }) => {
  expect((page as Page & { errors?: string[] }).errors ?? []).toEqual([]);
});

test('home → hot-seat game: both sides move, moves are recorded', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'За одним устройством' }).click();
  await expect(page).toHaveURL(/\/game\?mode=local/);
  await expect(page.locator('.k-pit--legal')).toHaveCount(9);
  // White plays pit 9: 9 balls → pits 9, then Black 1..8; the last lands on Black 8 (10, even) → capture.
  await pit(page, 8).click();
  await expect.poll(() => kazan(page, 'white')).toBe(10);
  expect(await count(page, 16)).toBe(0);
  await expect(page.locator('.k-pit--last-move-from[data-index="8"]')).toHaveCount(1);
  // Now Black moves from this device.
  await expect(page.locator('.k-player--opponent.k-player--active')).toHaveCount(1);
  await pit(page, 9).click();
  await expect(page.locator('.k-player--me.k-player--active')).toHaveCount(1);
});

test('bot game: the bot replies, undo restores the position', async ({ page }) => {
  await page.goto('/bot');
  await page.getByRole('button', { name: 'Начать игру' }).click();
  await expect(page).toHaveURL(/mode=bot/);
  await expect(page.locator('.k-player--no-clock')).toHaveCount(2);
  const worker = page.waitForEvent('worker');
  await pit(page, 0).click();
  // Bot (Black) answers from its Web Worker; then it is White's turn again.
  expect((await worker).url()).toContain('bot.worker');
  await expect(page.locator('.k-player--me.k-player--active')).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator('.k-moves__row')).toHaveCount(1);
  await page.locator('.k-game__action').first().click(); // Undo
  await expect.poll(() => count(page, 0)).toBe(9);
  expect(await kazan(page, 'white')).toBe(0);
});

test('resign shows the result modal; rematch starts over', async ({ page }) => {
  await page.goto('/game?mode=local');
  await page.locator('.k-button--danger.k-game__action').click();
  await expect(page.locator('.k-modal .k-modal__title')).toHaveText('Сдаться?');
  await page.getByRole('button', { name: 'Да, сдаться' }).click();
  await expect(page.locator('.k-modal--result.k-modal--loss')).toBeVisible();
  await page.getByRole('button', { name: 'Реванш' }).click();
  await expect(page.locator('.k-modal--result')).toHaveCount(0);
  await expect(page.locator('.k-pit--legal')).toHaveCount(9);
});

test('tutorial: tapping pit 7 plays the move', async ({ page }) => {
  await page.goto('/tutorial');
  await expect(page.locator('.k-pit--hint')).toHaveCount(1);
  await pit(page, 6).click();
  await expect.poll(() => count(page, 6)).toBe(1);
  await expect(page.locator('.k-pit--legal')).toHaveCount(0);
});

for (const mode of ['local', 'bot'] as const)
  test(`settings during a ${mode} game: Back returns to the same game`, async ({ page }) => {
    await page.goto(`/game?mode=${mode}&side=white`);
    await pit(page, 8).click();
    await expect.poll(() => kazan(page, 'white')).toBe(10);
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.locator('[data-screen="settings"]')).toBeVisible();
    await page.getByRole('button', { name: 'Быстро' }).click();
    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.locator('[data-screen="settings"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/game\?/);
    await expect.poll(() => kazan(page, 'white')).toBe(10);
    await expect(page.locator('.k-moves__row')).toHaveCount(1);
    expect(await page.evaluate(() => localStorage.getItem('k.speed'))).toBe('fast');
  });

test('settings during a game: the browser Back closes them, the game stays', async ({ page }) => {
  await page.goto('/');
  await page.goto('/game?mode=local');
  await pit(page, 8).click();
  await expect.poll(() => kazan(page, 'white')).toBe(10);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('[data-screen="settings"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-screen="settings"]')).toHaveCount(0);
  await expect(page).toHaveURL(/\/game\?mode=local$/);
  await expect.poll(() => kazan(page, 'white')).toBe(10);
  // The in-app Back left no extra entry: one more browser Back leaves the game.
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('[data-screen="settings"]')).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
});

test('language and speed settings persist', async ({ page }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Кыргызча' }).click();
  await page.getByRole('button', { name: 'Тез' }).click();
  expect(await page.evaluate(() => localStorage.getItem('k.speed'))).toBe('fast');
  await page.goto('/');
  await expect(page.locator('.k-logo__tagline')).toHaveText('Кыргыздын улуттук оюну');
});

test('animated move: balls fly, counters update, capture lands in the kazan', async ({ page }) => {
  await page.goto('/game?mode=local');
  await pit(page, 8).click();
  // Mid-flight: flying balls exist in the FX layer and the board is locked.
  await expect(page.locator('.k-board-fx .k-ball--flying').first()).toBeAttached();
  await expect(page.locator('.k-pit--legal')).toHaveCount(0);
  await expect.poll(() => kazan(page, 'white'), { timeout: 8000 }).toBe(10);
  await expect(page.locator('.k-board-fx .k-ball--flying')).toHaveCount(0);
  // Black to move; its pit 8 was just captured, so 8 pits are playable.
  await expect(page.locator('.k-player--opponent.k-player--active')).toHaveCount(1);
  await expect(page.locator('.k-pit--legal')).toHaveCount(8);
});

test('hot-seat with «flip board» on: the board turns to the side to move', async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem('k.prefs', JSON.stringify({ sound: true, vibration: false, flip: true })),
  );
  await page.goto('/game?mode=local');
  await expect(page.locator('.k-pit--mine[data-index="0"]')).toHaveCount(1);
  await pit(page, 8).click();
  // Black to move: Black's pits are now at the bottom, with Black's name on the bottom plate.
  await expect(page.locator('.k-pit--mine[data-index="9"]')).toHaveCount(1);
  await expect(page.locator('.k-player--me .k-player__name')).toHaveText('Чёрные');
  await expect(page.locator('.k-player--me.k-player--active')).toHaveCount(1);
});
