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

export function MiniProgramThemeProvider(props: { children: ReactNode }) {
  const [theme, setTheme] = useState<MiniProgramTheme>(() =>
    readStoredMiniProgramTheme(miniProgramThemeStorage),
  );
  const [noticeKey, setNoticeKey] = useState(0);

  useEffect(() => {
    storeMiniProgramTheme(miniProgramThemeStorage, theme);

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
