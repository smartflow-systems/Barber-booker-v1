import "./styles/sfs-theme.css";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add global error handlers
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

createRoot(document.getElementById("root")!).render(<App />);
