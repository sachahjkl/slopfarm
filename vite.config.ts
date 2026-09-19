import { defineConfig } from "vitest/config";
import { VitePWA } from "vite-plugin-pwa";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const base =
    mode === "production" ? (environment.VITE_BASE_PATH ?? "/") : "/";

  return {
    base,
    plugins: [
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: [
          "favicon-32.png",
          "apple-touch-icon.png",
          "icon-192.png",
          "icon-512.png",
          "icon-maskable-512.png",
          "loading-illustration.png",
        ],
        manifest: {
          id: base,
          name: "Slopfarm",
          short_name: "Slopfarm",
          description: "Récolte, empile et automatise une forêt cartoon.",
          lang: "fr",
          categories: ["games", "entertainment"],
          start_url: base,
          scope: base,
          theme_color: "#35563a",
          background_color: "#35563a",
          display: "standalone",
          display_override: ["window-controls-overlay", "standalone"],
          orientation: "any",
          icons: [
            {
              src: "icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "icon-maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ttf,glb}"],
          navigateFallback: `${base}index.html`,
        },
      }),
    ],
    build: {
      target: "es2022",
      rollupOptions: {
        input: {
          game: new URL("./index.html", import.meta.url).pathname,
          ...(mode === "development"
            ? { viewer: new URL("./viewer.html", import.meta.url).pathname }
            : {}),
        },
      },
    },
    test: {
      coverage: {
        reporter: ["text", "html"],
      },
    },
  };
});
