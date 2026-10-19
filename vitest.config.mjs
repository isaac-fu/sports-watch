import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(process.cwd()).replaceAll("\\", "/");

export default defineConfig({
  resolve: {
    alias: { "@": projectRoot },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
