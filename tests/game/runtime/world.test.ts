import { describe, expect, it } from "vitest";

import { STALLS } from "@/src/content";
import { OPERATING_DAY_MS, type GameState } from "@/src/game/core";
import { buildCatalog } from "@/src/game/runtime/catalog";
import {
  get_stall_tender_day,
  STALL_TENDER_DAYS,
  STALL_TENDER_LATE_INTERVAL_DAYS,
} from "@/src/game/runtime/rules";
import {
  count_tendered_stalls,
  create_fresh_session,
  plan_stall_tenders,
  reconcileRuntimeUnlocks,
  TENDERED_STALL_IDS,
} from "@/src/game/runtime/world";

const { catalog: AUTHORED_CATALOG } = buildCatalog();

/** Core reputation that clears every authored stall's reputation gate. */
const MAX_CORE_REPUTATION = 5;
/** Level that clears every authored stall's level gate. */
const MAX_LEVEL = 20;

/** A fresh centre that meets every stall's level and reputation gate on the given day. */
function grown_state(day: number): GameState {
  const state = create_fresh_session(AUTHORED_CATALOG, 7).state;
  return {
    ...state,
    elapsedMs: (day - 1) * OPERATING_DAY_MS,
    progression: {
      ...state.progression,
      level: MAX_LEVEL,
      reputation: MAX_CORE_REPUTATION,
      peakReputation: MAX_CORE_REPUTATION,
    },
  };
}

function tendered_count(state: GameState): number {
  return count_tendered_stalls(state.progression.unlockedDefinitionIds);
}

describe("stall tenders", () => {
  it("follow the schedule, then space later tenders evenly", () => {
    expect(STALL_TENDER_DAYS.map((_, index) => get_stall_tender_day(index))).toEqual(
      STALL_TENDER_DAYS,
    );
    const last = STALL_TENDER_DAYS.at(-1)!;
    expect(get_stall_tender_day(STALL_TENDER_DAYS.length)).toBe(
      last + STALL_TENDER_LATE_INTERVAL_DAYS,
    );
    expect(get_stall_tender_day(STALL_TENDER_DAYS.length + 1)).toBe(
      last + 2 * STALL_TENDER_LATE_INTERVAL_DAYS,
    );
  });

  it("cover every stall except the starter stalls", () => {
    const starters = STALLS.filter((stall) => !TENDERED_STALL_IDS.has(stall.id));
    expect(starters.length).toBeGreaterThan(0);
    const fresh = create_fresh_session(AUTHORED_CATALOG, 7).state;
    for (const stall of starters)
      expect(fresh.progression.unlockedDefinitionIds).toContain(stall.id);
    expect(STALL_TENDER_DAYS.length).toBeGreaterThanOrEqual(TENDERED_STALL_IDS.size);
  });

  it("hold every new stall back on opening day, however far the centre has grown", () => {
    expect(tendered_count(reconcileRuntimeUnlocks(grown_state(1)))).toBe(0);
  });

  it("offer one stall on each tender day", () => {
    let state = grown_state(STALL_TENDER_DAYS[0]!);
    state = reconcileRuntimeUnlocks(state);
    expect(tendered_count(state)).toBe(1);
    state = reconcileRuntimeUnlocks({
      ...state,
      elapsedMs: (STALL_TENDER_DAYS[1]! - 2) * OPERATING_DAY_MS,
    });
    expect(tendered_count(state)).toBe(1);
    state = reconcileRuntimeUnlocks({
      ...state,
      elapsedMs: (STALL_TENDER_DAYS[1]! - 1) * OPERATING_DAY_MS,
    });
    expect(tendered_count(state)).toBe(2);
  });

  it("plan one tender per waiting stall, in the order they will unlock", () => {
    const state = grown_state(1);
    const plan = plan_stall_tenders(state);
    expect(plan.size).toBeGreaterThan(1);
    expect([...plan.values()]).toEqual(STALL_TENDER_DAYS.slice(0, plan.size));
    const [first_id] = [...plan.keys()];
    const on_tender_day = reconcileRuntimeUnlocks(grown_state(STALL_TENDER_DAYS[0]!));
    expect(on_tender_day.progression.unlockedDefinitionIds).toContain(first_id);
  });

  it("never locks a stall that an older save already unlocked", () => {
    const state = grown_state(1);
    const early = [...TENDERED_STALL_IDS].slice(0, 4);
    const reconciled = reconcileRuntimeUnlocks({
      ...state,
      progression: {
        ...state.progression,
        unlockedDefinitionIds: [...state.progression.unlockedDefinitionIds, ...early].sort(),
      },
    });
    for (const id of early) expect(reconciled.progression.unlockedDefinitionIds).toContain(id);
    expect(tendered_count(reconciled)).toBe(early.length);
  });
});
