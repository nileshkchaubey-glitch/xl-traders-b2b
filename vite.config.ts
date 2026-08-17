import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Service worker only ships in production builds — dev server is untouched.
      devOptions: { enabled: false },
      includeAssets: [
        // offline.html was removed: with navigateFallback correctly pointing at
        // the app shell, nothing could ever route to it, and shipping an
        // unreachable page is dead weight in the precache.
        "icons/favicon-16.png",
        "icons/favicon-32.png",
        "icons/apple-touch-icon.png",
      ],
      manifest: {
        name: "XL Traders",
        short_name: "XL Traders",
        description:
          "Premium wholesale packaging and disposables supplier in Surat, India.",
        theme_color: "#DC2626",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "icons/maskable-icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "icons/maskable-icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache only the built app shell (HTML/CSS/JS + icons/manifest) —
        // no API/Supabase requests are ever intercepted since no runtimeCaching
        // routes are registered for them; product data always hits the network.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],

        // 🔴 MUST be the app shell, never offline.html.
        //
        // `navigateFallback` is not "the page to show when offline" — Workbox
        // registers a NavigationRoute that serves this document for EVERY
        // navigation request, online or not. Pointing it at offline.html meant
        // the generated SW contained:
        //
        //   new NavigationRoute(createHandlerBoundToURL("/offline.html"),
        //                       { denylist: [/^\/admin/] })
        //
        // so once the service worker was installed, every direct navigation,
        // refresh or shared link to /catalog, /product/:id, /cart or / itself
        // returned the offline page instead of the app — on a perfectly good
        // connection. Cloudflare's `_redirects` SPA rule is correct but never
        // got a say: the SW intercepts before the network. /admin was on the
        // denylist, which is why the admin PIM kept working and hid the bug.
        //
        // index.html IS precached, so serving it here also gives a genuinely
        // better offline experience than a dead-end page: the shell boots, the
        // persisted cart is readable, and data calls fail through the error
        // handling the app already has.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          // Admin is a separate surface and was already excluded.
          /^\/admin/,
          // Anything with a file extension is an asset request, not a route —
          // without this a missing image would be answered with HTML.
          /\/[^/?]+\.[^/]+$/,
        ],
        cleanupOutdatedCaches: true,
        // Workbox's 2MiB default hard-fails the build once a chunk crosses it
        // (the admin bundle is already ~750KB); give real headroom.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
    },
  },
  envDir: path.resolve(__dirname),
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5000,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
