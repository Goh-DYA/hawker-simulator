/**
 * Activity-feed rules for the HUD.
 *
 * Converts simulation events into player-facing runtime events, decides which events pop up,
 * groups repeated events into one feed entry and formats each entry's message.
 */
import type { SimulationEvent } from "@/src/game/core";
import type { RuntimeEvent } from "./types";

/** Group key shared by sale events, so consecutive sales are grouped into one feed entry. */
const SALES_GROUP_KEY = "sales";

/**
 * A feed entry: a runtime event with a stable ID and the number of grouped events it stands for.
 */
export interface ActivityEntry extends RuntimeEvent {
  readonly id: number;
  readonly count: number;
}

/**
 * Decides whether an event also appears as a popup toast.
 *
 * @param event - The runtime event.
 * @returns True for events marked important; for unmarked events, true for warnings and errors.
 */
export function shouldShowPopup(event: RuntimeEvent): boolean {
  if (event.importance) return event.importance === "important";
  return event.kind === "warning" || event.kind === "error";
}

/**
 * Adds an event to the front of the feed, merging it into the newest entry when both share a group
 * key.
 *
 * A merged entry keeps its ID, counts one more event and sums the amounts.
 *
 * @param current - The feed, newest first.
 * @param event - The event to add.
 * @param id - The ID for a new entry.
 * @param limit - The most entries kept; defaults to 60, and at least one is kept.
 * @returns The updated feed, newest first.
 */
export function appendActivityEvent(
  current: readonly ActivityEntry[],
  event: RuntimeEvent,
  id: number,
  limit = 60,
): readonly ActivityEntry[] {
  const latest = current[0];
  if (event.groupKey && latest?.groupKey === event.groupKey) {
    return [
      {
        ...latest,
        ...event,
        id: latest.id,
        count: latest.count + 1,
        amount: (latest.amount ?? 0) + (event.amount ?? 0),
      },
      ...current.slice(1),
    ];
  }

  return [{ ...event, id, count: 1 }, ...current].slice(0, Math.max(1, limit));
}

/**
 * Formats an entry's message, summarising grouped sales as a count and total.
 *
 * @param entry - The feed entry.
 * @returns The message to show.
 */
export function activityEntryMessage(entry: ActivityEntry): string {
  if (entry.groupKey === SALES_GROUP_KEY && entry.count > 1) {
    return `${entry.count} neighbours enjoyed their meals · +$${Math.round(entry.amount ?? 0)}`;
  }
  return entry.message;
}

/**
 * Turns a simulation event into the activity-feed event the HUD shows, if it shows one.
 *
 * @param event - The event emitted by the core simulation or a command.
 * @returns The player-facing runtime event, or `undefined` for events the feed ignores.
 */
export function formatSimulationEvent(event: SimulationEvent): RuntimeEvent | undefined {
  if (event.type === "sale-completed") {
    return {
      kind: "success",
      message: `A neighbour enjoyed their meal · +$${event.amount ?? 0}`,
      importance: "routine",
      groupKey: SALES_GROUP_KEY,
      amount: event.amount ?? 0,
    };
  }
  if (event.type === "level-up") {
    return { kind: "success", message: "Centre level increased — new catalogue entries unlocked.", importance: "important" };
  }
  if (event.type === "objective-completed") {
    return { kind: "success", message: `${event.message ?? "Today's focus"} complete · +$${event.amount ?? 0}`, importance: "important" };
  }
  if (event.type === "milestone-completed") {
    return { kind: "success", message: `Centre journey milestone complete · +$${event.amount ?? 0}`, importance: "important" };
  }
  if (event.type === "command-rejected") {
    return { kind: "error", message: event.message ?? "That build action is not valid.", importance: "important" };
  }
  if (event.type === "target-recovered") {
    return { kind: "warning", message: "A guest rerouted after the layout changed.", importance: "routine", groupKey: "reroutes" };
  }
  return undefined;
}
