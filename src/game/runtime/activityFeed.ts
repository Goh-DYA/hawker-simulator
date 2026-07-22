import type { RuntimeEvent } from "./types";
import { describeSgd, formatSgd } from "./money";

export interface ActivityEntry extends RuntimeEvent {
  readonly id: number;
  readonly count: number;
}

export function shouldShowPopup(event: RuntimeEvent): boolean {
  if (event.importance) return event.importance === "important";
  return event.kind === "warning" || event.kind === "error";
}

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
        amountCents: (latest.amountCents ?? 0) + (event.amountCents ?? 0),
      },
      ...current.slice(1),
    ];
  }

  return [{ ...event, id, count: 1 }, ...current].slice(0, Math.max(1, limit));
}

export function activityEntryMessage(entry: ActivityEntry): string {
  if (entry.groupKey === "sales" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} neighbours enjoyed their meals · ${formatSgd(entry.amountCents)} gross sales`
      : `A neighbour enjoyed their meal · ${formatSgd(entry.amountCents)} gross sale`;
  }
  if (entry.groupKey === "resales" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} items resold · ${formatSgd(entry.amountCents)} received`
      : `Item resold · ${formatSgd(entry.amountCents)} received`;
  }
  if (entry.groupKey === "purchases" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} purchases · ${formatSgd(entry.amountCents)} paid`
      : `Purchase · ${formatSgd(entry.amountCents)} paid`;
  }
  if (entry.groupKey === "recovery" && entry.amountCents !== undefined) {
    return `Valid-setup recovery · ${formatSgd(entry.amountCents)} granted`;
  }
  return entry.message;
}

/** Full Singapore-dollar wording for assistive technology. */
export function activityEntryAccessibleMessage(entry: ActivityEntry): string {
  if (entry.groupKey === "sales" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} neighbours enjoyed their meals · ${describeSgd(entry.amountCents)} gross sales`
      : `A neighbour enjoyed their meal · ${describeSgd(entry.amountCents)} gross sale`;
  }
  if (entry.groupKey === "resales" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} items resold · ${describeSgd(entry.amountCents)} received`
      : `Item resold · ${describeSgd(entry.amountCents)} received`;
  }
  if (entry.groupKey === "purchases" && entry.amountCents !== undefined) {
    return entry.count > 1
      ? `${entry.count} purchases · ${describeSgd(entry.amountCents)} paid`
      : `Purchase · ${describeSgd(entry.amountCents)} paid`;
  }
  if (entry.groupKey === "recovery" && entry.amountCents !== undefined) {
    return `Valid-setup recovery · ${describeSgd(entry.amountCents)} granted`;
  }
  return entry.message;
}
