import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "netlify/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**"],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}", "netlify/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.d.ts",
        "src/routeTree.gen.ts",
        "src/router.tsx",
        "src/routes/**",
        "src/components/**",
        "src/lib/error-component.tsx",
        "src/lib/auth/provider.tsx",
        "src/lib/auth/gates.tsx",
        "src/lib/auth/use-current-user.ts",
        "src/lib/use-pwa.ts",
        "netlify/**/*.test.ts",
      ],
    },
  },
});
