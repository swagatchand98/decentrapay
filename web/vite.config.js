import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // Vite denies serving files outside its detected project root by default.
    // shared/DecentraPay.json lives one level above web/ — this is what makes
    // importing it directly (the "never hand-copy the ABI" rule) work in dev.
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
  },
});
