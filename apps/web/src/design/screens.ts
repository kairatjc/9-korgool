/* Screens to compare with the handoff — the list from design/Экраны.dc.html (prompt §6.4).
   Used by /__design/compare and by e2e/visual.spec.ts. Each `q` is appended with `&static=1`. */
export interface DesignScreen {
  label: string;
  q: string;
}

export const SCREENS: DesignScreen[] = [
  { label: 'Главная', q: 'screen=home' },
  { label: 'Главная — вход выполнен', q: 'screen=home&state=signed-in' },
  { label: 'Бот — настройка', q: 'screen=bot-setup' },
  { label: 'С другом — создание', q: 'screen=friend-create' },
  { label: 'С другом — ожидание', q: 'screen=friend-wait' },
  { label: 'Вход по коду', q: 'screen=join-code' },
  { label: 'Поиск соперника', q: 'screen=matchmaking' },
  { label: 'Поиск — 30 с, бот', q: 'screen=matchmaking-offer-bot' },
  { label: 'Партия — мой ход', q: 'screen=game&fixture=midgame&state=my-turn' },
  { label: 'Партия — ход соперника', q: 'screen=game&fixture=midgame&state=opponent-turn' },
  { label: 'Партия — превью (лунка 7)', q: 'screen=game&fixture=midgame&state=preview' },
  { label: 'Партия — мало времени', q: 'screen=game&fixture=endgame&state=low-time' },
  { label: 'Партия — переподключение', q: 'screen=game&fixture=midgame&state=reconnecting' },
  {
    label: 'Партия — соперник отключился',
    q: 'screen=game&fixture=midgame&state=opponent-offline',
  },
  { label: 'Партия — подтверждение сдачи', q: 'screen=game&fixture=midgame&state=resign-confirm' },
  { label: 'История ходов (шторка)', q: 'screen=game&fixture=midgame&state=history-open' },
  { label: 'Партия с ботом (start)', q: 'screen=game&fixture=start&mode=bot' },
  { label: 'Партия с другом', q: 'screen=game&fixture=midgame&mode=friend' },
  { label: 'Конец партии', q: 'screen=game-over&fixture=gameover' },
  {
    label: 'Конец партии — поражение',
    q: 'screen=game-over&fixture=gameover&outcome=loss&reason=resign',
  },
  { label: 'Конец партии — ничья', q: 'screen=game-over&fixture=gameover&outcome=draw' },
  { label: 'Вход', q: 'screen=sign-in' },
  { label: 'Профиль', q: 'screen=profile' },
  { label: 'Правила', q: 'screen=rules' },
  { label: 'Обучение', q: 'screen=tutorial' },
  { label: 'Настройки', q: 'screen=settings' },
  { label: 'Спецификация доски', q: 'screen=spec' },
  { label: 'Кыргызча — партия', q: 'screen=game&fixture=midgame&mode=bot&lang=ky' },
  { label: 'Кыргызча — главная', q: 'screen=home&lang=ky' },
  { label: 'Кыргызча — конец партии', q: 'screen=game-over&fixture=gameover&lang=ky' },
  { label: 'English — rules', q: 'screen=rules&lang=en' },
];

export const VIEWPORTS = [
  { name: 'phone-360', width: 360, height: 780 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

/** The reference prototype, served by the dev server from design/handoff. */
export const referenceUrl = (q: string) => `/__handoff/index.html?${q}&static=1`;
/** The implementation of the same screen. */
export const implementationUrl = (q: string) => `/__design?${q}&static=1`;
