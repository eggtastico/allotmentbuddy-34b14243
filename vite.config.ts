import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/allotment/",
  server: {
    host: "::",
    port: 5173,
    hmr: false,
    middlewareMode: false,
    fs: {
      allow: ['..'],
    },
    allowedHosts: ['appsabaloo.com', 'www.appsabaloo.com', 'localhost', '127.0.0.1'],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // VitePWA disabled - using manual service worker registration instead
    // The service worker is registered in src/main.tsx
  ].filter(Boolean),
  preview: {
    allowedHosts: ['appsabaloo.com', 'www.appsabaloo.com', 'localhost', '127.0.0.1'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
