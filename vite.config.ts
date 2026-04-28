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
      includeAssets: ["favicon.svg", "icons.svg", "apple-touch-icon.png"],
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
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
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
