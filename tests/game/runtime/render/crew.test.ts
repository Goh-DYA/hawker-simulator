/**
 * Tests for the visible table-cleaning crew in `runtime/render/crew.ts`: one member per crew
 * place, waiting at their posts, walking to a tray the crew is clearing, wiping beside it,
 * carrying it to a tray-return station once it clears, and starting afresh after a reset.
 */
import { describe, expect, it } from "vitest";

import {
  count_cleaning_crew,
  getSeatLocations,
  type GameState,
  type GridPoint,
} from "@/src/game/core";
import { getObjectTrayReturnPoint } from "@/src/game/core/grid";
import { buildCatalog } from "@/src/game/runtime/catalog";
import { CrewMotion, type CrewMemberView } from "@/src/game/runtime/render/crew";
import { create_fresh_session } from "@/src/game/runtime/world";

const { catalog: AUTHORED_CATALOG } = buildCatalog();
/** Simulated time per update, as one 10 Hz step. */
const STEP_MS = 100;
/** Most updates a walk in the launch hall may take. */
const MAX_STEPS = 400;

function fresh_state(): GameState {
  return create_fresh_session(AUTHORED_CATALOG, 7).state;
}

/** The fresh centre with a tray left on its first seat. */
function with_tray(state: GameState): { state: GameState; seat: GridPoint; key: string } {
  const seat = getSeatLocations(state.objects, state.catalog)[0]!;
  return {
    state: {
      ...state,
      unclearedTrays: { [seat.key]: { leftAtTick: state.tick, workRemainingMs: 25_000 } },
    },
    seat: seat.point,
    key: seat.key,
  };
}

/** Advances the crew one step at a time until a member matches, and returns that view. */
function run_until(
  crew: CrewMotion,
  state: GameState,
  predicate: (member: CrewMemberView) => boolean,
): { state: GameState; member: CrewMemberView; trail: CrewMemberView[] } {
  let current = state;
  const trail: CrewMemberView[] = [];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    current = { ...current, elapsedMs: current.elapsedMs + STEP_MS };
    const views = crew.update(current);
    trail.push(...views);
    const member = views.find(predicate);
    if (member) return { state: current, member, trail };
  }
  throw new Error("The crew never reached the expected activity");
}

function station_point(state: GameState): GridPoint {
  const station = Object.values(state.objects).find(
    (object) => state.catalog.placeables[object.definitionId]?.kind === "tray-return",
  )!;
  return getObjectTrayReturnPoint(station, state.catalog)!;
}

describe("crew motion", () => {
  it("puts one member per crew place at their post, waiting", () => {
    const state = fresh_state();
    const views = new CrewMotion().update(state);
    expect(views).toHaveLength(count_cleaning_crew(state.objects, state.catalog));
    expect(views.every((member) => member.activity === "idle")).toBe(true);
    const station = station_point(state);
    expect(views.map((member) => ({ x: member.x, y: member.y }))).toContainEqual(station);
  });

  it("walks a member to a left tray and wipes beside it", () => {
    const crew = new CrewMotion();
    const { state, seat, key } = with_tray(fresh_state());
    crew.update(state);
    const walking = crew.update({ ...state, elapsedMs: state.elapsedMs + STEP_MS });
    expect(walking.filter((member) => member.seatKey === key)).toHaveLength(1);
    expect(walking.find((member) => member.seatKey === key)?.activity).toBe("walk");

    const { member } = run_until(crew, state, (view) => view.activity === "wipe");

    expect([member.seatKey, member.x, member.y]).toEqual([key, seat.x, seat.y]);
  });

  it("carries a cleared tray to a tray-return station, then walks back to the post", () => {
    const crew = new CrewMotion();
    const { state } = with_tray(fresh_state());
    crew.update(state);
    const wiping = run_until(crew, state, (view) => view.activity === "wipe");
    const cleared: GameState = { ...wiping.state, unclearedTrays: {} };

    const carrying = crew
      .update({ ...cleared, elapsedMs: cleared.elapsedMs + STEP_MS })
      .find((member) => member.index === wiping.member.index)!;
    const back = run_until(
      crew,
      cleared,
      (view) => view.index === wiping.member.index && view.activity === "idle",
    );

    const station = station_point(state);
    const dropped = back.trail.find(
      (view) => view.index === wiping.member.index && view.activity !== "carry-walk",
    )!;
    expect([carrying.activity, carrying.seatKey, { x: dropped.x, y: dropped.y }]).toEqual([
      "carry-walk",
      undefined,
      station,
    ]);
  });

  it("stands still while the centre is paused", () => {
    const crew = new CrewMotion();
    const { state } = with_tray(fresh_state());
    crew.update(state);
    const first = crew.update({ ...state, elapsedMs: state.elapsedMs + STEP_MS });
    expect(crew.update({ ...state, elapsedMs: state.elapsedMs + STEP_MS })).toEqual(first);
  });

  it("starts afresh at the posts when the clock runs backwards", () => {
    const crew = new CrewMotion();
    const { state } = with_tray(fresh_state());
    const { state: later } = run_until(crew, state, (view) => view.activity === "wipe");
    const reset = fresh_state();

    const views = crew.update({ ...reset, elapsedMs: 0 });

    expect([later.elapsedMs > 0, views.every((member) => member.activity === "idle")]).toEqual([
      true,
      true,
    ]);
  });
});
