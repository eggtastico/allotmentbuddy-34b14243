import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/allotment-v1/",
  server: {
    host: "::",
    port: 5173,
    hmr: { host: 'localhost', protocol: 'ws' },
    middlewareMode: false,
    fs: {
      allow: ['..'],
    },
    allowedHosts: ['appsabaloo.com', 'www.appsabaloo.com', 'localhost', '127.0.0.1', '140.238.126.166'],
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
    // Inject build hash into service worker on build
    {
      name: 'sw-cache-version',
      writeBundle() {
        const swPath = path.resolve(__dirname, 'dist/sw.js');
        if (fs.existsSync(swPath)) {
          const buildHash = Date.now().toString(36);
          let sw = fs.readFileSync(swPath, 'utf-8');
          sw = sw.replace(/allotment-buddy-v\d+/, `allotment-buddy-${buildHash}`);
          fs.writeFileSync(swPath, sw);
        }
      },
    },
  ].filter(Boolean),
  preview: {
    allowedHosts: ['appsabaloo.com', 'www.appsabaloo.com', 'localhost', '127.0.0.1', '140.238.126.166'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('jspdf')) return 'vendor-pdf';
          if (id.includes('@radix-ui/')) return 'vendor-radix';
          // Stable framework core — always eager, so a dedicated chunk just
          // improves cross-deploy caching without dragging lazy deps eager.
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler|@tanstack)\//.test(id)) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
