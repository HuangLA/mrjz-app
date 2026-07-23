export type ThemeName = "default" | "island";

const THEME_STORAGE_KEY = "mrjz-desktop-theme";

export function readTheme(): ThemeName {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "island" ? "island" : "default";
  } catch {
    return "default";
  }
}

export function applyTheme(theme: ThemeName): void {
  if (theme === "island") {
    document.documentElement.setAttribute("data-theme", "island");
    document.documentElement.style.colorScheme = "light";
  } else {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.style.colorScheme = "dark";
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage 不可用时静默降级，皮肤仅对当前会话生效
  }
}
