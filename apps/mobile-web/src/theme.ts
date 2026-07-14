export const appThemes = ["classic", "island"] as const;

export type AppTheme = (typeof appThemes)[number];

export const themeStorageKey = "mrjz-h5-theme";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function normalizeTheme(value: string | null | undefined): AppTheme {
  return value === "island" ? "island" : "classic";
}

export function readStoredTheme(storage: Pick<ThemeStorage, "getItem"> | null | undefined): AppTheme {
  if (!storage) {
    return "classic";
  }

  try {
    return normalizeTheme(storage.getItem(themeStorageKey));
  } catch {
    return "classic";
  }
}

export function storeTheme(storage: Pick<ThemeStorage, "setItem"> | null | undefined, theme: AppTheme): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(themeStorageKey, theme);
  } catch {
    // Storage may be unavailable in embedded/private browser contexts.
  }
}

export function nextTheme(theme: AppTheme): AppTheme {
  return theme === "classic" ? "island" : "classic";
}
