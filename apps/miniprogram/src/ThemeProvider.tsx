import Taro from "@tarojs/taro";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  nextMiniProgramTheme,
  readStoredMiniProgramTheme,
  storeMiniProgramTheme,
  type MiniProgramTheme,
} from "./theme";

type MiniProgramThemeContextValue = {
  noticeKey: number;
  theme: MiniProgramTheme;
  toggleTheme: () => void;
};

const MiniProgramThemeContext = createContext<MiniProgramThemeContextValue | null>(null);

const miniProgramThemeStorage = {
  getItem(key: string): unknown {
    return Taro.getStorageSync(key);
  },
  setItem(key: string, value: string): void {
    Taro.setStorageSync(key, value);
  },
};

const islandFontRoot =
  "https://cdn.jsdelivr.net/npm/animal-island-ui@1.2.0/dist/files";
let islandFontsStarted = false;

function ensureIslandFonts(): void {
  if (islandFontsStarted) {
    return;
  }

  islandFontsStarted = true;
  const global = Taro.getEnv() === Taro.ENV_TYPE.WEAPP;
  const loads = [
    Taro.loadFontFace({
      ...(global ? { global: true } : {}),
      family: "MRJZ Island Sans",
      source: `url("${islandFontRoot}/noto-sans-sc-chinese-simplified-500-normal.d3553b6f.woff2")`,
      desc: { style: "normal", weight: "500" },
    }),
    Taro.loadFontFace({
      ...(global ? { global: true } : {}),
      family: "MRJZ Island Rounded",
      source: `url("${islandFontRoot}/nunito-latin-900-normal.8b5d13b8.woff2")`,
      desc: { style: "normal", weight: "900" },
    }),
  ];

  void Promise.all(loads).catch(() => {
    islandFontsStarted = false;
  });
}

export function MiniProgramThemeProvider(props: { children: ReactNode }) {
  const [theme, setTheme] = useState<MiniProgramTheme>(() =>
    readStoredMiniProgramTheme(miniProgramThemeStorage),
  );
  const [noticeKey, setNoticeKey] = useState(0);

  useEffect(() => {
    storeMiniProgramTheme(miniProgramThemeStorage, theme);

    if (theme === "island") {
      ensureIslandFonts();
    }

    if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP) {
      const backgroundColor = theme === "island" ? "#f8f8f0" : "#07090c";
      void Taro.setBackgroundColor({
        backgroundColor,
        backgroundColorBottom: backgroundColor,
        backgroundColorTop: backgroundColor,
      });
    }
  }, [theme]);

  function toggleTheme(): void {
    setTheme((current) => nextMiniProgramTheme(current));
    setNoticeKey((current) => current + 1);
  }

  return (
    <MiniProgramThemeContext.Provider value={{ noticeKey, theme, toggleTheme }}>
      {props.children}
    </MiniProgramThemeContext.Provider>
  );
}

export function useMiniProgramTheme(): MiniProgramThemeContextValue {
  const context = useContext(MiniProgramThemeContext);

  if (!context) {
    return {
      noticeKey: 0,
      theme: "classic",
      toggleTheme: () => undefined,
    };
  }

  return context;
}
