import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // `server-only` throws whenever it is imported outside an RSC graph, so
      // a server module that guards itself with it cannot be imported by a
      // test at all without this stand-in.
      "server-only": fileURLToPath(
        new URL("./test/server-only-stub.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    // DB tests share one database; serialize files to avoid cross-file
    // interference on the shared system-account balance rows.
    fileParallelism: false,
    setupFiles: ["dotenv/config"],
  },
})
