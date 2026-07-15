import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource/zcool-kuaile/400.css";
import "animal-island-ui/style";
import "./styles.css";
import "./island-theme.css";
import { readStoredTheme } from "./theme";

const initialTheme = readStoredTheme(window.localStorage);
document.documentElement.dataset.theme = initialTheme;
document.documentElement.style.colorScheme = initialTheme === "island" ? "light" : "dark";

const root = document.querySelector<HTMLDivElement>("#root");

if (!root) {
  throw new Error("Missing #root element for mobile web app.");
}

createRoot(root).render(<App />);
