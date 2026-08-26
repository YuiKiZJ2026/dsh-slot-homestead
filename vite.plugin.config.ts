import { resolve } from "node:path";
import { defineConfig } from "vite";
import { isClientExternal, isHostExternal } from "./src/plugin/build-externals.ts";

export default defineConfig(({ mode }) => {
  const client = mode === "plugin-client";

  return {
    publicDir: false,
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
          client ? "src/plugin/client/index.tsx" : "src/plugin/host/index.ts",
        ),
        formats: [client ? "cjs" : "es"],
        fileName: () => client ? "client-body.cjs" : "index.js",
      },
      rollupOptions: {
        external: client ? isClientExternal : isHostExternal,
        output: {
          codeSplitting: false,
          exports: "named",
        },
      },
    },
  };
});
