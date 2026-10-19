import { describe, expect, it } from "vitest";
import {
  activityEntryMessage,
  appendActivityEvent,
  formatSimulationEvent,
  shouldShowPopup,
  type ActivityEntry,
} from "@/src/game/runtime/activityFeed";
import type { RuntimeEvent } from "@/src/game/runtime/types";

const sale = (amount: number): RuntimeEvent => ({
  kind: "success",
  message: `A neighbour enjoyed their meal · +$${amount}`,
  importance: "routine",
  groupKey: "sales",
  amount,
});

describe("activity feed notification routing", () => {
  it("keeps routine events in Activity and reserves popups for important events", () => {
    expect(shouldShowPopup(sale(7))).toBe(false);
    expect(shouldShowPopup({ kind: "info", message: "Saved" })).toBe(false);
    expect(shouldShowPopup({ kind: "warning", message: "Route blocked" })).toBe(true);
    expect(shouldShowPopup({ kind: "error", message: "Save failed" })).toBe(true);
    expect(
      shouldShowPopup({ kind: "success", message: "Milestone completed", importance: "important" }),
    ).toBe(true);
    expect(
      shouldShowPopup({ kind: "warning", message: "Minor recovery", importance: "routine" }),
    ).toBe(false);
  });

  it("groups consecutive sales into one readable entry", () => {
    let entries: readonly ActivityEntry[] = appendActivityEvent([], sale(7), 1);
    entries = appendActivityEvent(entries, sale(3), 2);
    entries = appendActivityEvent(entries, sale(6), 3);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 1, count: 3, amount: 16, groupKey: "sales" });
    expect(activityEntryMessage(entries[0]!)).toBe("3 neighbours enjoyed their meals · +$16");
  });

  it("keeps only the configured number of recent entries", () => {
    let entries: readonly ActivityEntry[] = [];
    for (let index = 1; index <= 5; index += 1) {
      entries = appendActivityEvent(entries, { kind: "info", message: `Event ${index}` }, index, 3);
    }

    expect(entries.map((entry) => entry.message)).toEqual(["Event 5", "Event 4", "Event 3"]);
  });
});

describe("neighbourhood events in the activity feed", () => {
  const stall_names: Readonly<Record<string, string>> = { "stall.kopi-canopy": "Kopi Canopy" };
  const resolve_name = (definition_id: string) => stall_names[definition_id] ?? definition_id;

  it("announces the end of a day and its Service Review", () => {
    expect(
      formatSimulationEvent(
        { type: "day-ended", tick: 10, amount: 4, message: "calendar.quiet-weekday" },
        resolve_name,
      ),
    ).toEqual({
      kind: "info",
      message: "Day 4 wrapped. Your Service Review is ready.",
      importance: "important",
    });
  });

  it("celebrates a Writer's Pick plaque as an important success", () => {
    const event = formatSimulationEvent(
      { type: "writer-reviewed", tick: 10, entityId: "stall.kopi-canopy", message: "plaque", amount: 78 },
      resolve_name,
    );

    expect([event, event && shouldShowPopup(event)]).toEqual([
      {
        kind: "success",
        message: "Kopi Canopy earned a Writer's Pick plaque from the food writer!",
        importance: "important",
      },
      true,
    ]);
  });

  it.each(["no-plaque", "too-few-visits"])(
    "notes a %s review quietly in the feed, without a popup",
    (outcome) => {
      const event = formatSimulationEvent(
        { type: "writer-reviewed", tick: 10, entityId: "stall.kopi-canopy", message: outcome, amount: 61 },
        resolve_name,
      );

      expect([event, event && shouldShowPopup(event)]).toEqual([
        {
          kind: "info",
          message: "The food writer finished their review of Kopi Canopy.",
          importance: "routine",
        },
        false,
      ]);
    },
  );

  it("names the stall by its ID without a name resolver", () => {
    expect(
      formatSimulationEvent({
        type: "writer-reviewed",
        tick: 10,
        entityId: "stall.kopi-canopy",
        message: "plaque",
      })?.message,
    ).toBe("stall.kopi-canopy earned a Writer's Pick plaque from the food writer!");
  });
});
