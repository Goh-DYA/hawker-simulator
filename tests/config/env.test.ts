/**
 * Tests for the centralised build-mode and developer query-flag reader.
 *
 * `src/config/env.ts` evaluates `NODE_ENV` once at import, so each test that needs a different
 * build mode stubs the variable and re-imports a fresh copy of the module.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Import a fresh copy of the env module under the given `NODE_ENV`.
 *
 * @param node_env - The build mode to evaluate the module under.
 * @returns The module's exports as evaluated under that mode.
 */
async function import_env_for(node_env: string) {
  vi.stubEnv("NODE_ENV", node_env);
  vi.resetModules();
  return import("@/src/config/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("build-mode constants", () => {
  it("marks a production build as production only", async () => {
    const env = await import_env_for("production");

    expect([env.IS_PRODUCTION_BUILD, env.IS_DEVELOPMENT_BUILD]).toEqual([true, false]);
  });

  it("marks a development build as development only", async () => {
    const env = await import_env_for("development");

    expect([env.IS_PRODUCTION_BUILD, env.IS_DEVELOPMENT_BUILD]).toEqual([false, true]);
  });

  it("treats the test mode as neither production nor development", async () => {
    const env = await import_env_for("test");

    expect([env.IS_PRODUCTION_BUILD, env.IS_DEVELOPMENT_BUILD]).toEqual([false, false]);
  });
});

describe("has_dev_query_flag", () => {
  it("detects a flag present in the page URL outside production", async () => {
    vi.stubGlobal("location", { search: "?debug&visualQa=1" });
    const env = await import_env_for("development");

    expect([env.has_dev_query_flag("debug"), env.has_dev_query_flag("visualQa")]).toEqual([
      true,
      true,
    ]);
  });

  it("returns false for a flag missing from the page URL", async () => {
    vi.stubGlobal("location", { search: "?debug" });
    const env = await import_env_for("development");

    expect(env.has_dev_query_flag("visualQa")).toBe(false);
  });

  it("ignores flags in a production build", async () => {
    vi.stubGlobal("location", { search: "?debug&visualQa" });
    const env = await import_env_for("production");

    expect([env.has_dev_query_flag("debug"), env.has_dev_query_flag("visualQa")]).toEqual([
      false,
      false,
    ]);
  });

  it("returns false when there is no location, as during server rendering", async () => {
    const env = await import_env_for("development");

    expect(typeof location).toBe("undefined");
    expect(env.has_dev_query_flag("debug")).toBe(false);
  });
});
