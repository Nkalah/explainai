// @lovable.dev/vite-tanstack-config already includes tanstackStart, viteReact, tailwindcss,
// tsConfigPaths and nitro. Do NOT add them manually or you'll get duplicate plugins.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel sets VERCEL=1 during its builds
const onVercel = !!process.env.VERCEL;

export default defineConfig({
  nitro: onVercel
    ? {
        // Emits .vercel/output, which Vercel serves automatically
        preset: "vercel",
      }
    : {
        // Local build/preview, same as before
        preset: "node-server",
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/client",
        },
      },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper)
    server: { entry: "server" },
  },
});