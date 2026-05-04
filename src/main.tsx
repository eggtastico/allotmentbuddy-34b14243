import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA support (only when on /allotment/ path)
if ("serviceWorker" in navigator && window.location.pathname.startsWith("/allotment")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/allotment/sw.js")
      .then((registration) => {
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 300000); // Check every 5 minutes
      })
      .catch(() => {
        // Registration failed — PWA offline features unavailable, app still works
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
