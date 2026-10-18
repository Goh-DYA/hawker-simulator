/**
 * Unit tests for the runtime interaction helpers in `runtime/interaction.ts`.
 *
 * The tile-handling behaviour as a whole stays pinned by the runtime input goldens; these tests
 * cover the interaction-state seeding and the pure hit-testing and ID-sequence helpers directly,
 * on a fresh launch centre.
 */
import { describe, expect, it } from "vitest";
import type { GameState, PlacedObject } from "@/src/game/core";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  create_interaction_state,
  nextObjectId,
  objectAt,
  placementCandidate,
  recomputeObjectSequence,
  type IdSequences,
} from "@/src/game/runtime/interaction";
import { create_fresh_session } from "@/src/game/runtime/world";

const { catalog: AUTHORED_CATALOG } = buildCatalog();

/** Builds a fresh launch session's state with extra objects keyed by ID. */
function state_with_objects(extra: readonly PlacedObject[]): GameState {
  const { state } = create_fresh_session(AUTHORED_CATALOG);
  const objects = { ...state.objects };
  for (const object of extra) objects[object.id] = object;
  return { ...state, objects };
}

describe("create_interaction_state", () => {
  it("starts on the select tool at normal speed with sequences seeded from the state", () => {
    const { state } = create_fresh_session(AUTHORED_CATALOG);
    const interaction = create_interaction_state(state);
    expect(interaction).toMatchObject({
      buildTool: "select",
      selectedRotation: 0,
      queueDraft: [],
      hoverTile: { x: 6, y: 6 },
      speed: 1,
      speedBeforeLayoutEdit: 1,
      accessSequence: state.accessPoints.length + 1,
      objectSequence: Object.keys(state.objects).length + 1,
    });
  });
});

describe("objectAt", () => {
  it("returns the most recently placed object covering the tile", () => {
    const { state, catalog } = create_fresh_session(AUTHORED_CATALOG);
    const [first] = Object.values(state.objects);
    const stacked: PlacedObject = { ...first, id: "placed-99" };
    const layered = { ...state, objects: { ...state.objects, [stacked.id]: stacked } };
    expect(objectAt(layered, catalog, first.origin)?.id).toBe("placed-99");
  });

  it("returns undefined for an empty tile", () => {
    const { state, catalog } = create_fresh_session(AUTHORED_CATALOG);
    expect(objectAt(state, catalog, { x: 0, y: state.map.height - 1 })).toBeUndefined();
  });
});

describe("placementCandidate", () => {
  it("previews the selected build item at the tile with the selected rotation", () => {
    expect(
      placementCandidate({ selectedBuildId: "plant-pot", selectedRotation: 90 }, { x: 3, y: 4 }),
    ).toEqual({
      id: "preview-placement",
      definitionId: "plant-pot",
      origin: { x: 3, y: 4 },
      rotation: 90,
      open: false,
    });
  });

  it("returns undefined without a selected build item", () => {
    expect(
      placementCandidate({ selectedBuildId: undefined, selectedRotation: 0 }, { x: 3, y: 4 }),
    ).toBeUndefined();
  });
});

describe("nextObjectId", () => {
  it("skips IDs already in use and advances the object sequence past the result", () => {
    const [template] = Object.values(create_fresh_session(AUTHORED_CATALOG).state.objects);
    const state = state_with_objects([
      { ...template, id: "placed-3" },
      { ...template, id: "placed-4" },
    ]);
    const sequences: IdSequences = { accessSequence: 1, objectSequence: 3 };
    expect(nextObjectId(state, sequences)).toBe("placed-5");
    expect(sequences).toEqual({ accessSequence: 1, objectSequence: 6 });
  });
});

describe("recomputeObjectSequence", () => {
  it("sets the object sequence one past the highest placed-N ID and leaves access alone", () => {
    const [template] = Object.values(create_fresh_session(AUTHORED_CATALOG).state.objects);
    const state = state_with_objects([
      { ...template, id: "placed-7" },
      { ...template, id: "placed-x" },
    ]);
    const sequences: IdSequences = { accessSequence: 9, objectSequence: 1 };
    recomputeObjectSequence(state, sequences);
    expect(sequences).toEqual({ accessSequence: 9, objectSequence: 8 });
  });

  it("restarts at 1 when no placed-N ID exists", () => {
    const sequences: IdSequences = { accessSequence: 2, objectSequence: 40 };
    recomputeObjectSequence(create_fresh_session(AUTHORED_CATALOG).state, sequences);
    expect(sequences.objectSequence).toBe(1);
  });
});
