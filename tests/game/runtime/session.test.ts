/**
 * Unit tests for the runtime session holder in `runtime/session.ts`.
 *
 * The side-effect order around these functions stays pinned by the runtime controller and input
 * goldens; these tests cover the session operations directly, on a fresh launch centre.
 */
import { describe, expect, it } from "vitest";
import { buildCatalog } from "@/src/game/runtime/catalog";
import { RUNTIME_SCHEMA_VERSION } from "@/src/game/runtime/saves";
import {
  apply_catalog_layers,
  build_persistent_payload,
  create_runtime_session,
  dispatch_session_command,
  synchronize_stall_menus,
  type RuntimeSession,
} from "@/src/game/runtime/session";
import { create_fresh_session } from "@/src/game/runtime/world";

/** Builds a runtime session on a fresh launch centre. */
function fresh_runtime_session(): RuntimeSession {
  const { catalog, visuals } = buildCatalog();
  return create_runtime_session(catalog, visuals, create_fresh_session(catalog));
}

describe("create_runtime_session", () => {
  it("starts the save bookkeeping from the initial state", () => {
    const session = fresh_runtime_session();
    expect(session.lastPersistentRevenue).toBe(session.state.economy.lifetimeRevenue);
    expect(session.lastPeriodicSaveAt).toBe(0);
    expect(session.lastSimulationMs).toBe(0);
  });
});

describe("build_persistent_payload", () => {
  it("writes the runtime envelope fields in the saved key order", () => {
    const payload = build_persistent_payload(fresh_runtime_session());
    expect(Object.keys(payload)).toEqual([
      "runtimeSchemaVersion",
      "core",
      "stallMenus",
      "nutritionDataVersion",
      "activeDishVariants",
    ]);
    expect(payload.runtimeSchemaVersion).toBe(RUNTIME_SCHEMA_VERSION);
  });
});

describe("apply_catalog_layers", () => {
  it("stores the re-layered catalog on the session and its state", () => {
    const session = fresh_runtime_session();
    const before = session.catalog;
    apply_catalog_layers(session);
    expect(session.catalog).not.toBe(before);
    expect(session.state.catalog).toBe(session.catalog);
  });
});

describe("synchronize_stall_menus", () => {
  it("reports no change for menus already resolved against the progression", () => {
    const session = fresh_runtime_session();
    const menus = session.stallMenus;
    expect(synchronize_stall_menus(session)).toBe(false);
    expect(session.stallMenus).toBe(menus);
  });
});

describe("dispatch_session_command", () => {
  it("reports a rejected command without changing the menus", () => {
    const session = fresh_runtime_session();
    const result = dispatch_session_command(session, { type: "undo" });
    expect([result.accepted, result.hasMenusChanged]).toEqual([false, false]);
  });

  it("adopts the state of an accepted command", () => {
    const session = fresh_runtime_session();
    const result = dispatch_session_command(session, {
      type: "set-quality-mode",
      mode: "lower-end",
    });
    expect(result.accepted).toBe(true);
    expect(session.state.qualityMode).toBe("lower-end");
  });
});
