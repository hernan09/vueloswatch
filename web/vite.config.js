import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/health": "http://127.0.0.1:3001",
      "/devices": "http://127.0.0.1:3001",
      "/alerts": "http://127.0.0.1:3001",
      "/check-now": "http://127.0.0.1:3001",
      "/check-for-device": "http://127.0.0.1:3001",
      "/web-push": "http://127.0.0.1:3001",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
