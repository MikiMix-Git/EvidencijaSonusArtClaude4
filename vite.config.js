import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sqliteApi } from "./server/dbPlugin.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), sqliteApi()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    // SQLite stalno upisuje u data/ — Vite ne treba da prati te fajlove
    watch: { ignored: ["**/data/**"] },
    hmr: {
      port: 3000,
    },
  },
});
