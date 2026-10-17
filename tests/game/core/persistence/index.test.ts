/**
 * Contract tests for the persisted save shape and the save loader's error messages.
 *
 * The runtime stores `persistentStateFromGame` output as is, so its field order is part
 * of the save format. The `PersistenceError` messages are pinned word for word because
 * the runtime shows them to the player when a save cannot be loaded and it starts a new
 * centre instead. Each case starts from a frozen fixture in `fixtures/` and breaks one
 * thing.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  deserializeGameState,
  PersistenceError,
  persistentStateFromGame,
  type DeserializeOptions,
  type SimulationCatalog,
} from "@/src/game/core";
import golden_inputs from "../fixtures/golden-inputs.json";

const TEST_CATALOG = golden_inputs.testCatalog as SimulationCatalog;

/** A save field bag that a test may break before loading it. */
type SaveRecord = Record<string, unknown>;

/** One way to make the loader reject a save, and the exact message it must give. */
interface RejectedSaveCase {
  readonly name: string;
  readonly buildInput: () => unknown;
  readonly options?: DeserializeOptions;
  readonly message: string;
}

/** Parse a frozen save fixture afresh, so no test can see another test's changes. */
function load_save_fixture(file_name: string): SaveRecord {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/${file_name}`, import.meta.url), "utf8"),
  ) as SaveRecord;
}

/** Load the V4 fixture with the definition of object `seat-1` renamed to one the catalog lacks. */
function build_save_with_retired_seat(): SaveRecord {
  const save = load_save_fixture("save-v4.json");
  const objects = save.objects as readonly SaveRecord[];
  return {
    ...save,
    objects: objects.map((object) =>
      object.id === "seat-1" ? { ...object, definitionId: "retired-seat" } : object,
    ),
  };
}

/**
 * Run `action` and return what it threw.
 *
 * @param action - The call expected to throw.
 * @returns The thrown value.
 * @throws Error If `action` returns without throwing.
 */
function capture_thrown(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw");
}

const REJECTED_SAVE_CASES: readonly RejectedSaveCase[] = [
  {
    name: "a save that is not an object",
    buildInput: () => null,
    message: "Save data must be an object",
  },
  {
    name: "an unsupported schema version",
    buildInput: () => ({ ...load_save_fixture("save-v4.json"), schemaVersion: 5 }),
    message: "Unsupported save version: 5",
  },
  {
    name: "a save string that is not valid JSON",
    buildInput: () => "{ not json",
    message: "Save data is not valid JSON",
  },
  {
    name: "a duplicate object id",
    buildInput: () => {
      const save = load_save_fixture("save-v4.json");
      const objects = save.objects as readonly SaveRecord[];
      return { ...save, objects: [...objects, objects[0]] };
    },
    message: "Duplicate saved object id: seat-1",
  },
  {
    name: "a negative refund for removed content",
    buildInput: build_save_with_retired_seat,
    options: { removedDefinitionRefunds: { "retired-seat": -5 } },
    message: "Refund migration for retired-seat must be non-negative",
  },
  {
    name: "an object whose definition is unknown",
    buildInput: build_save_with_retired_seat,
    message:
      "Saved object seat-1 references removed definition retired-seat; provide an alias or explicit refund migration",
  },
  {
    name: "a V2 save without progression.level",
    buildInput: () => {
      const save = load_save_fixture("save-v2.json");
      const progression = { ...(save.progression as SaveRecord) };
      delete progression.level;
      return { ...save, progression };
    },
    message: "progression.level must be a finite number >= 1",
  },
];

describe("persistentStateFromGame", () => {
  it("writes the top-level save fields in today's order", () => {
    const state = deserializeGameState(load_save_fixture("save-v4.json"), TEST_CATALOG);
    expect(Object.keys(persistentStateFromGame(state))).toEqual([
      "schemaVersion",
      "savedAtTick",
      "map",
      "accessPoints",
      "routeGuidePoints",
      "qualityMode",
      "objects",
      "economy",
      "progression",
      "metrics",
      "rngState",
      "nextCustomerSequence",
      "elapsedMs",
    ]);
  });

  it("writes only tray returns, visit ratings and nutrition as metrics", () => {
    const state = deserializeGameState(load_save_fixture("save-v4.json"), TEST_CATALOG);
    expect(Object.keys(persistentStateFromGame(state).metrics)).toEqual([
      "trayReturns",
      "visitRatings",
      "nutrition",
    ]);
  });
});

describe("deserializeGameState errors", () => {
  it.each(REJECTED_SAVE_CASES)("rejects $name", ({ buildInput, options, message }) => {
    const thrown = capture_thrown(() =>
      deserializeGameState(buildInput(), TEST_CATALOG, options),
    );
    expect(thrown).toBeInstanceOf(PersistenceError);
    expect((thrown as PersistenceError).message).toBe(message);
  });
});
