import { resolve } from "node:path";
import { defineConfig } from "vite";
import { isClientExternal, isHostExternal } from "./src/plugin/build-externals.ts";

export default defineConfig(({ mode }) => {
  const client = mode === "plugin-client";
  const companion = mode === "plugin-companion";

  return {
    publicDir: false,
    define: companion ? { "process.env.NODE_ENV": JSON.stringify("production") } : undefined,
    build: {
      outDir: client ? ".plugin-build/client" : "lib",
      emptyOutDir: client,
      copyPublicDir: false,
      assetsInlineLimit: Number.MAX_SAFE_INTEGER,
      cssCodeSplit: false,
      minify: false,
      sourcemap: true,
      lib: {
        entry: resolve(
          import.meta.dirname,
          client
            ? "src/plugin/client/index.tsx"
            : companion ? "src/plugin/companion/main.tsx" : "src/plugin/host/index.ts",
        ),
        formats: [client ? "cjs" : companion ? "iife" : "es"],
        name: companion ? "DshSlotCompanion" : undefined,
        fileName: () => client ? "client-body.cjs" : companion ? "companion.js" : "index.js",
      },
      rollupOptions: {
        external: companion ? [] : client ? isClientExternal : isHostExternal,
        output: {
          codeSplitting: false,
          exports: companion ? "none" : "named",
        },
      },
    },
  };
});
