export const miniProgramThemes = ["classic", "island"] as const;

export type MiniProgramTheme = (typeof miniProgramThemes)[number];

export const miniProgramThemeStorageKey = "mrjz-miniprogram-theme";

export type MiniProgramThemeStorage = {
  getItem: (key: string) => unknown;
  setItem: (key: string, value: string) => void;
};

export function normalizeMiniProgramTheme(value: unknown): MiniProgramTheme {
  return value === "island" ? "island" : "classic";
}

export function readStoredMiniProgramTheme(
  storage: Pick<MiniProgramThemeStorage, "getItem"> | null | undefined,
): MiniProgramTheme {
  if (!storage) {
    return "classic";
  }

  try {
    return normalizeMiniProgramTheme(storage.getItem(miniProgramThemeStorageKey));
  } catch {
    return "classic";
  }
}

export function storeMiniProgramTheme(
  storage: Pick<MiniProgramThemeStorage, "setItem"> | null | undefined,
  theme: MiniProgramTheme,
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(miniProgramThemeStorageKey, theme);
  } catch {
    // Theme persistence must never block the public browsing surface.
  }
}

export function nextMiniProgramTheme(theme: MiniProgramTheme): MiniProgramTheme {
  return theme === "classic" ? "island" : "classic";
}
