/**
 * Light / dark theme. Light is the product's look and the default; dark is
 * opt-in. The choice is a per-device preference, so it lives in localStorage
 * (never the database, never a cookie the server reads):
 *
 *   "light" (default, also when nothing is stored)
 *   "dark"
 *   "system" — follow the operating system's setting
 *
 * It is applied as data-theme="dark" on <html>; with no attribute the page is
 * light. The CSS has no prefers-color-scheme rule of its own, so a device in
 * dark mode only gets the dark theme if its owner chose "dark" or "system".
 *
 * Pure apart from applyTheme/storedTheme, which touch the DOM.
 */
export type ThemeChoice = "light" | "dark" | "system";

export const THEME_KEY = "pf-theme";

export function parseTheme(value: unknown): ThemeChoice {
  return value === "dark" || value === "system" ? value : "light";
}

/** Is the page dark for this choice, given whether the device prefers dark? */
export function isDark(choice: ThemeChoice, devicePrefersDark: boolean): boolean {
  return choice === "dark" || (choice === "system" && devicePrefersDark);
}

/**
 * Inlined in <head>, so it runs before the first paint and a dark-mode user
 * never sees a white flash. Storage or matchMedia can throw (private mode,
 * blocked site data); the page then simply stays light.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.setAttribute("data-theme","dark");}catch(e){}})();`;

/** Apply a choice now, and remember it on this device. */
export function applyTheme(choice: ThemeChoice): void {
  const prefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  const root = document.documentElement;
  if (isDark(choice, prefersDark)) root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");
  try {
    if (choice === "light") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // not remembered; it still applies for this page
  }
}

export function storedTheme(): ThemeChoice {
  try {
    return parseTheme(localStorage.getItem(THEME_KEY));
  } catch {
    return "light";
  }
}
