import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
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
