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
    define: {
      __FOOTER_CONFIG__: JSON.stringify({
        schoolName: env.BEL_SCHOOL_NAME ?? "Bel Madrasah",
        schoolYear: env.BEL_SCHOOL_YEAR ?? new Date().getFullYear().toString(),
        poweredBy: env.BEL_POWERED_BY ?? "",
        poweredByUrl: env.BEL_POWERED_BY_URL ?? "#",
        instagramUrl: env.BEL_SOCIAL_INSTAGRAM_URL ?? "",
        youtubeUrl: env.BEL_SOCIAL_YOUTUBE_URL ?? "",
        uploadUrl: env.BEL_UPLOAD_URL ?? "",
        githubUrl: env.BEL_DEVELOPER_URL ?? "",
        developerName: env.BEL_DEVELOPER_NAME ?? "",
        developerUrl: env.BEL_DEVELOPER_URL ?? "",
        developerInstagramUrl: env.BEL_DEVELOPER_INSTAGRAM_URL ?? "",
        developerLinkedinUrl: env.BEL_DEVELOPER_LINKEDIN_URL ?? "",
      }),
    },
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
