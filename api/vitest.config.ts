import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Load ONLY .env.test into process.env. The runtime .dev.vars is never read
// here, so tests cannot inherit prod values. A real env var (e.g. from CI)
// takes precedence over the file.
const envPath = fileURLToPath(new URL(".env.test", import.meta.url));
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    if (/^\s*#/.test(line)) continue;
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) process.env[match[1]] ??= match[2];
  }
} catch {
  // No .env.test yet; helpers.ts throws a clear error when the URL is missing.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
