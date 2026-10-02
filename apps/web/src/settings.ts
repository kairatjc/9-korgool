/* User preferences kept in localStorage (language, playback speed, toggles). */
import { useState } from 'react';
import { SPEEDS, type Speed } from './board/motion';
import { isLang, setLang as applyLang, type Lang } from './i18n';
import type { Prefs } from './screens/SettingsScreen';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep the in-memory value */
  }
}

export function storedLang(): Lang {
  const v = read('k.lang');
  return isLang(v) ? v : 'ru';
}

export function storedSpeed(): Speed {
  const v = read('k.speed');
  return SPEEDS.includes(v as Speed) ? (v as Speed) : 'normal';
}

function storedPrefs(): Prefs {
  try {
    const v = JSON.parse(read('k.prefs') ?? 'null') as Partial<Prefs> | null;
    return { sound: v?.sound ?? true, vibration: v?.vibration ?? true, flip: v?.flip ?? false };
  } catch {
    return { sound: true, vibration: true, flip: false };
  }
}

export function useSettings() {
  const [lang, setLangState] = useState<Lang>(() => {
    const l = storedLang();
    applyLang(l);
    return l;
  });
  const [speed, setSpeedState] = useState<Speed>(storedSpeed);
  const [prefs, setPrefsState] = useState<Prefs>(storedPrefs);
  return {
    lang,
    speed,
    prefs,
    setLang: (l: Lang) => {
      applyLang(l);
      write('k.lang', l);
      setLangState(l);
    },
    setSpeed: (s: Speed) => {
      write('k.speed', s);
      setSpeedState(s);
    },
    setPrefs: (p: Prefs) => {
      write('k.prefs', JSON.stringify(p));
      setPrefsState(p);
    },
  };
}
