import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],

    // Agent worktrees under .claude/ hold full copies of the repo, including
    // its tests. Without this they are collected alongside the real suite,
    // which silently inflates the reported test count and runs duplicate
    // copies of the same file against the same module state.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**", "**/.claude/**"],

    // Several suites `await import(...)` a module whose dependency graph is
    // expensive to transform (the PayPal client pulls in a large chunk of the
    // server runtime). Under parallel file execution that first import can
    // exceed vitest's 5s default, which surfaced as a phantom "test timed
    // out" — and, worse, the timed-out call stayed in flight and consumed the
    // next test's queued fetch mocks, so an unrelated test failed too. The
    // budget here is for module loading, not for any assertion.
    testTimeout: 20_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
