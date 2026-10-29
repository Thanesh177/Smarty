export const APP_THEME_KEY = 'smarty:appearance:v1';
export const APP_THEMES = Object.freeze(['dark', 'day']);
export const normalizeAppTheme = value => value === 'day' ? 'day' : 'dark';

export function readAppTheme() {
  try { return normalizeAppTheme(globalThis.localStorage?.getItem(APP_THEME_KEY)); }
  catch { return normalizeAppTheme(globalThis.document?.documentElement?.getAttribute('data-app-theme')); }
}

export function applyAppTheme(value, doc = globalThis.document) {
  const theme = normalizeAppTheme(value);
  const root = doc?.documentElement;
  if (!root) return theme;
  const color = theme === 'day' ? '#f4efe6' : '#06070a';
  const scheme = theme === 'day' ? 'light' : 'dark';
  root.setAttribute('data-app-theme', theme);
  root.style.colorScheme = scheme;
  root.style.backgroundColor = color;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', scheme);
  return theme;
}

export function saveAppTheme(value) {
  const theme = normalizeAppTheme(value);
  try { globalThis.localStorage?.setItem(APP_THEME_KEY, theme); } catch { /* The current session still works without storage. */ }
  return theme;
}
