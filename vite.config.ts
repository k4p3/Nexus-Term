/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    // Por defecto Vitest sustituye el CSS por una cadena vacía; la prueba del sitio necesita leer su hoja de estilos.
    css: { include: [/site\/assets\/style\.css/] },
  },
  // Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor_terminal: [
            "@xterm/xterm",
            "@xterm/addon-fit",
            "@xterm/addon-search",
            "@xterm/addon-web-links",
            "@xterm/addon-webgl",
          ],
          vendor_icons: ["lucide-vue-next"],
          vendor_core: ["vue", "pinia", "vue-i18n"],
        },
      },
    },
  },
  // To make use of `TAURI_DEBUG` and other env variables
  // https://tauri.app/v1/api/config#buildconfig.beforedevcommand
  clearScreen: false,
});
