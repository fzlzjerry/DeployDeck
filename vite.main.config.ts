import path from "node:path";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const vercelId = env.VERCEL_OAUTH_CLIENT_ID ?? process.env.VERCEL_OAUTH_CLIENT_ID ?? "";
  const cloudflareId = env.CLOUDFLARE_OAUTH_CLIENT_ID ?? process.env.CLOUDFLARE_OAUTH_CLIENT_ID ?? "";
  const cloudflareScopes = env.CLOUDFLARE_OAUTH_SCOPES ?? process.env.CLOUDFLARE_OAUTH_SCOPES ?? "";

  return {
    define: {
      "process.env.VERCEL_OAUTH_CLIENT_ID": JSON.stringify(vercelId),
      "process.env.CLOUDFLARE_OAUTH_CLIENT_ID": JSON.stringify(cloudflareId),
      "process.env.CLOUDFLARE_OAUTH_SCOPES": JSON.stringify(cloudflareScopes),
    },
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
  };
});
