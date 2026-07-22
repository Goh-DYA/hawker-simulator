import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  activityEntryAccessibleMessage,
  activityEntryMessage,
  appendActivityEvent,
  shouldShowPopup,
  type ActivityEntry,
} from "../src/game/runtime/activityFeed";
import type { RuntimeEvent } from "../src/game/runtime/types";

const sale = (amount: number): RuntimeEvent => ({
  kind: "success",
  message: "A neighbour enjoyed their meal.",
  importance: "routine",
  groupKey: "sales",
  amountCents: amount,
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
    let entries: readonly ActivityEntry[] = appendActivityEvent([], sale(700), 1);
    entries = appendActivityEvent(entries, sale(300), 2);
    entries = appendActivityEvent(entries, sale(600), 3);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 1, count: 3, amountCents: 1_600, groupKey: "sales" });
    expect(activityEntryMessage(entries[0]!)).toBe("3 neighbours enjoyed their meals · S$16 gross sales");
    expect(activityEntryAccessibleMessage(entries[0]!)).toBe(
      "3 neighbours enjoyed their meals · 16 Singapore dollars and 0 cents gross sales",
    );
  });

  it("keeps only the configured number of recent entries", () => {
    let entries: readonly ActivityEntry[] = [];
    for (let index = 1; index <= 5; index += 1) {
      entries = appendActivityEvent(entries, { kind: "info", message: `Event ${index}` }, index, 3);
    }

    expect(entries.map((entry) => entry.message)).toEqual(["Event 5", "Event 4", "Event 3"]);
  });

  it("aggregates purchase and resale cents without describing them as net cash", () => {
    const purchases = appendActivityEvent([], {
      kind: "info",
      message: "Purchase recorded",
      groupKey: "purchases",
      amountCents: 12_345,
    }, 1);
    const resales = appendActivityEvent([], {
      kind: "info",
      message: "Resale recorded",
      groupKey: "resales",
      amountCents: 8_641,
    }, 2);

    expect(activityEntryMessage(purchases[0]!)).toBe("Purchase · S$123.45 paid");
    expect(activityEntryMessage(resales[0]!)).toBe("Item resold · S$86.41 received");
    expect(activityEntryAccessibleMessage(purchases[0]!)).toBe(
      "Purchase · 123 Singapore dollars and 45 cents paid",
    );
  });

  it("labels a setup recovery amount without grouping it with sales", () => {
    const [entry] = appendActivityEvent([], {
      kind: "success",
      message: "Setup recovered",
      groupKey: "recovery",
      amountCents: 65_000,
    }, 1);

    expect(activityEntryMessage(entry!)).toBe("Valid-setup recovery · S$650 granted");
  });

  it("renders Activity as a first-class panel with an unread indicator", async () => {
    const [component, styles] = await Promise.all([
      readFile(new URL("../app/game/HawkerSimulator.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    ]);

    expect(component).toContain('panel === "activity"');
    expect(component).toContain('className="activity-panel"');
    expect(component).toContain('className="dock-unread"');
    expect(component).toContain("routine events stay here");
    expect(styles).toContain(".activity-list article");
    expect(styles).toContain(".dock-unread");
  });
});
