import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

const env = loadEnv("", process.cwd(), "BEL_");
const BACKEND_URL = env.BEL_BACKEND_URL ?? "http://localhost:8082";

export default defineConfig({
  integrations: [react()],
  build: {
    format: "file",
  },
  server: {
    port: parseInt(env.BEL_FRONTEND_PORT ?? "4321"),
    host: env.BEL_FRONTEND_HOST ?? "localhost",
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        "/api": { target: BACKEND_URL, changeOrigin: true },
        "/login": { target: BACKEND_URL, changeOrigin: true },
        "/logout": { target: BACKEND_URL, changeOrigin: true },
        "/healthz": { target: BACKEND_URL, changeOrigin: true },
      },
    },
  },
});
