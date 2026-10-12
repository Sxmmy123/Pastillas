import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
const projectRoot = import.meta.dirname;
export default defineConfig({
  root: resolve(projectRoot, "app"),
  publicDir: resolve(projectRoot, "public"),
  base: "./",
  resolve: { alias: { "/src": resolve(projectRoot, "src") } },
  server: { fs: { allow: [projectRoot] } },
  plugins: [react()],
  build: { outDir: resolve(projectRoot, "dist"), emptyOutDir: true },
});
