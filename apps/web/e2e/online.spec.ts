/* Online game with a friend: two browser contexts = two guests, the real game server in between. */
import { expect, test, type Browser, type Page } from '@playwright/test';

// One server and one shared queue: run these one after another so queue tests don't pair across tests.
test.describe.configure({ mode: 'default' });

const pit = (page: Page, index: number) => page.locator(`.k-board .k-pit[data-index="${index}"]`);
const kazan = async (page: Page, side: 'white' | 'black') =>
  Number(await page.locator(`.k-kazan[data-side="${side}"] .k-kazan__count-text`).textContent());

async function guest(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('k.speed', 'off'));
  return page;
}

/** Alice creates a 5+3 game as White; Bek opens it by code. */
async function start(browser: Browser) {
  const alice = await guest(browser);
  const bek = await guest(browser);
  await alice.goto('/friend');
  await alice.getByRole('button', { name: '5+3' }).click();
  await alice.getByRole('button', { name: 'Создать приглашение' }).click();
  await expect(alice).toHaveURL(/\/g\/[A-Z2-9]{6}$/);
  const code = (await alice.locator('.k-room-code__value').textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(alice.locator('.k-field__value')).toHaveText(`localhost:5173/g/${code}`);

  // Bek types the code on the join screen.
  await bek.goto('/join');
  await bek.locator('.k-code__input').fill(code.toLowerCase());
  await bek.getByRole('button', { name: 'Войти' }).click();
  for (const page of [alice, bek]) await expect(page.locator('.k-board')).toBeVisible();
  return { alice, bek, code };
}

test('friend game over the server: moves, clocks, reconnect, draw by agreement', async ({
  browser,
}) => {
  const { alice, bek } = await start(browser);

  // Alice (White) is to move; Bek sees the board from Black's side and waits.
  await expect(alice.locator('.k-player--me.k-player--active')).toHaveCount(1);
  await expect(bek.locator('.k-player--opponent.k-player--active')).toHaveCount(1);
  await expect(alice.locator('.k-player--me .k-clock')).toHaveText('5:00');
  await expect(bek.locator('.k-pit--mine[data-index="9"]')).toHaveCount(1);

  // White 9: capture of 10 on both screens.
  await pit(alice, 8).click();
  await expect.poll(() => kazan(bek, 'white')).toBe(10);
  await expect.poll(() => kazan(alice, 'white')).toBe(10);
  // Fischer: +3 s after the move; Black's clock is running now.
  await expect(alice.locator('.k-player--me .k-clock')).toHaveText('5:03');
  await expect(bek.locator('.k-player--me .k-clock--running')).toHaveCount(1);

  // Bek reloads mid-game: the position comes back from the server.
  await bek.reload();
  await expect.poll(() => kazan(bek, 'white')).toBe(10);
  await expect(bek.locator('.k-moves__row')).toHaveCount(1);
  await pit(bek, 9).click();
  await expect(alice.locator('.k-player--me.k-player--active')).toHaveCount(1);
  await expect(alice.locator('.k-moves__row').first()).toContainText('9x');

  // Draw offer → accepted → both see the result.
  await alice.getByRole('button', { name: 'Предложить ничью' }).click();
  await expect(bek.locator('.k-modal__title')).toHaveText('Соперник предлагает ничью');
  await bek.getByRole('button', { name: 'Согласиться на ничью' }).click();
  for (const page of [alice, bek]) {
    await expect(page.locator('.k-modal--result.k-modal--draw')).toBeVisible();
    await expect(page.locator('.k-modal--result .k-modal__text')).toHaveText('Ничья по согласию');
  }
});

test('settings during an online game: Back returns to the game, still connected', async ({
  browser,
}) => {
  const { alice, bek, code } = await start(browser);
  await alice.getByRole('button', { name: 'Settings' }).click();
  await expect(alice.locator('[data-screen="settings"]')).toBeVisible();
  await alice.getByRole('button', { name: 'Back' }).click();
  await expect(alice).toHaveURL(new RegExp(`/g/${code}$`));
  await pit(alice, 8).click();
  await expect.poll(() => kazan(bek, 'white')).toBe(10);
  // Bek moves while Alice is in the settings: she sees it when she comes back.
  await alice.getByRole('button', { name: 'Settings' }).click();
  await pit(bek, 9).click();
  await alice.getByRole('button', { name: 'Back' }).click();
  await expect(alice.locator('.k-moves__row')).toHaveCount(1);
  await expect(alice.locator('.k-player--me.k-player--active')).toHaveCount(1);
  await expect(alice.locator('.k-banner')).toHaveCount(0);
});

test('resignation ends the game for both', async ({ browser }) => {
  const { alice, bek } = await start(browser);
  await pit(alice, 6).click();
  await expect(bek.locator('.k-player--me.k-player--active')).toHaveCount(1);
  await bek.locator('.k-button--danger.k-game__action').click();
  await bek.getByRole('button', { name: 'Да, сдаться' }).click();
  await expect(bek.locator('.k-modal--result.k-modal--loss')).toBeVisible();
  await expect(alice.locator('.k-modal--result.k-modal--win')).toBeVisible();
  await expect(alice.locator('.k-modal--result .k-modal__text')).toHaveText('Сдача');
});

test('a third guest cannot take a seat; an unknown code is reported', async ({ browser }) => {
  const { code } = await start(browser);
  const carol = await guest(browser);
  await carol.goto(`/g/${code}`);
  await expect(carol.locator('.k-page__title')).toHaveText('В этой партии уже два игрока');
  await carol.goto('/g/ZZZZZZ');
  await expect(carol.locator('.k-page__title')).toHaveText('Партия не найдена');
});

test('opponent leaves: banner with the countdown, cleared when they come back', async ({
  browser,
}) => {
  const { alice, bek, code } = await start(browser);
  await pit(alice, 6).click();
  await bek.close();
  await expect(alice.locator('.k-banner')).toContainText('Соперник отключился');
  await expect(alice.locator('.k-banner__timer')).toHaveText(/^[01]:\d\d$/);
  await expect(alice.locator('.k-player--opponent.k-player--offline')).toHaveCount(1);

  // A new tab of the same guest (same token in localStorage) returns to the game.
  const back = await bek.context().newPage();
  await back.goto(`/g/${code}`);
  await expect(back.locator('.k-board')).toBeVisible();
  await expect(alice.locator('.k-banner')).toHaveCount(0);
});

test('random opponent: two guests press «Play» and meet in a 5+3 game', async ({ browser }) => {
  const alice = await guest(browser);
  const bek = await guest(browser);
  for (const page of [alice, bek]) {
    await page.goto('/');
    await page.locator('.k-button', { hasText: 'Играть' }).first().click();
    await expect(page).toHaveURL(/\/play$/);
  }
  for (const page of [alice, bek]) {
    await expect(page).toHaveURL(/\/g\/[A-Z2-9]{6}$/);
    await expect(page.locator('.k-board')).toBeVisible();
    await expect(page.locator('.k-topbar')).toContainText('Онлайн · 5+3');
  }
  expect(alice.url()).toBe(bek.url());
  // One is White, the other Black: exactly one of them may move.
  const active = async (page: Page) => page.locator('.k-player--me.k-player--active').count();
  expect((await active(alice)) + (await active(bek))).toBe(1);
});

test('leaving the search leaves the queue', async ({ browser }) => {
  const alice = await guest(browser);
  await alice.goto('/play');
  await alice.getByRole('button', { name: 'Отмена' }).click();
  await expect(alice).toHaveURL(/\/$/);
  // Two new guests are paired with each other, not with Alice.
  const bek = await guest(browser);
  const carol = await guest(browser);
  await bek.goto('/play');
  await carol.goto('/play');
  for (const page of [bek, carol]) await expect(page).toHaveURL(/\/g\/[A-Z2-9]{6}$/);
  expect(bek.url()).toBe(carol.url());
});
