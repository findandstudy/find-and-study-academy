import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "flag-icons/css/flag-icons.min.css";
import "./i18n";

createRoot(document.getElementById("root")!).render(<App />);
