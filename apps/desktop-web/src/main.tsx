import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource/zcool-kuaile/400.css";
import "./styles.css";

document.documentElement.style.colorScheme = "dark";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Missing #root element for desktop web app.");
createRoot(root).render(<App />);
