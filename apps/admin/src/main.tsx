import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import "./admin.css";

const root = document.querySelector<HTMLElement>("#root");
if (root) createRoot(root).render(<App />);
