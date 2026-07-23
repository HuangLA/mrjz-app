import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyTheme, readTheme } from "./theme";
import "@fontsource/zcool-kuaile/400.css";
import "./styles.css";
import "./island.css";

applyTheme(readTheme());

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Missing #root element for desktop web app.");
createRoot(root).render(<App />);
