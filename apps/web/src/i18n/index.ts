/* i18n — strings come from design/handoff/copy.json (split into ru / ky / en with the same keys). */
import i18n from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import en from './en.json';
import ky from './ky.json';
import ru from './ru.json';

export type Lang = 'ru' | 'ky' | 'en';
export const LANGS: readonly Lang[] = ['ky', 'ru', 'en'];
export const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'ky' || v === 'en';

void i18n.use(initReactI18next).init({
  resources: { ru: { translation: ru }, ky: { translation: ky }, en: { translation: en } },
  lng: 'ru',
  fallbackLng: 'ru',
  // Keys contain dots ("game.yourTurn") and are flat.
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  initAsync: false,
  returnNull: false,
});

export function setLang(lang: Lang): void {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export type T = (key: string, vars?: Record<string, string | number>) => string;

export function useT(): T {
  const { t } = useTranslation();
  return (key, vars) => t(key, vars ?? {});
}

export { i18n };
