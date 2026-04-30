import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "logo.svg", "icons.svg", "apple-touch-icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/render\/image\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "supabase-images",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: {
        name: "La 30 Perros y Hamburguesas",
        short_name: "La 30",
        description: "Sistema de gestión para La 30 Perros y Hamburguesas",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "logo.svg",
            sizes: "any",
            type: "image/svg+xml",
          },
          {
            src: "logo.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
              return "vendor-react";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-radix";
            }
            if (id.includes("recharts")) {
              return "vendor-recharts";
            }
            if (id.includes("lucide-react")) {
              return "vendor-lucide";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
