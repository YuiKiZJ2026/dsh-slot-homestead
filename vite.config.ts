// @ts-expect-error -- this repository intentionally omits @types/node from its browser-facing typecheck.
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
  },
  test: {
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
    css: true,
    exclude: [...configDefaults.exclude, "tests/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/plugin/preview/main.tsx",
      ],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    alias: {
      "@deepseek-ai/dsh-storage-domain": fileURLToPath(
        new URL("./src/plugin/host/testing/dsh-storage-domain.ts", import.meta.url),
      ),
    },
  },
});
