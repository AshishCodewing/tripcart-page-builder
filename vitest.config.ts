import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only`/`client-only` throw unless the bundler sets the right
      // export condition (Next sets `react-server`; Vitest does not). Stub them
      // so tests can import modules that transitively depend on them.
      "server-only": fileURLToPath(
        new URL("./test/stubs/empty.ts", import.meta.url)
      ),
      "client-only": fileURLToPath(
        new URL("./test/stubs/empty.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/*.test.ts",
      "components/**/*.test.ts",
      "hooks/**/*.test.ts",
    ],
    // DB-backed integration tests run in their own config (need Postgres); keep
    // the default suite pure so `pnpm test` passes with no database.
    exclude: [...configDefaults.exclude, "**/*.integration.test.ts"],
  },
})
