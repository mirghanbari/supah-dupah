import { defineConfig } from "vitest/config";

// Plain Node config: the shared math doesn't need the Workers runtime.
export default defineConfig({ test: { include: ["shared/**/*.test.ts"] } });
