import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const BACKEND_URL = process.env.BEL_BACKEND_URL ?? "http://localhost:8082";

export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/login": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/logout": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
        "/healthz": {
          target: BACKEND_URL,
          changeOrigin: true,
        },
      },
    },
  },
});
