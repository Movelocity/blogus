import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5177,
    proxy: {
      "/api": "http://127.0.0.1:3009",
      "/uploads": "http://127.0.0.1:3009"
    }
  }
});
