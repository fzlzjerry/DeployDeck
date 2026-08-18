import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    // Main-process dependencies must resolve their Node entry points. Vite's
    // browser-oriented default conditions otherwise pick packages such as
    // `when-exit`'s DOM build and crash Electron before the app is ready.
    conditions: ["node", "module"],
    mainFields: ["module", "main"],
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
