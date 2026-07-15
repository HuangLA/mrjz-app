import type { PropsWithChildren } from "react";
import { MiniProgramThemeProvider } from "./ThemeProvider";
import "./app.css";

export default function App({ children }: PropsWithChildren) {
  return <MiniProgramThemeProvider>{children}</MiniProgramThemeProvider>;
}
