import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: process.env.ADMIN_DEV_API_TARGET ?? "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
