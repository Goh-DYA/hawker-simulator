/**
 * The HUD projections of the seeded neighbourhood: today's and tomorrow's day cards, the rush
 * timeline and its advance notice, the food writer's visit, the Service Review of the last day,
 * and the "next unlock" signpost.
 *
 * Pure and Phaser-free. The copy is warm and descriptive: grades are never a fail, departure
 * reasons name what happened rather than who, and food is never labelled good or bad.
 */
import { CALENDAR_CARD_BY_ID, DISHES, localize_key } from "@/src/content";
import {
  active_rush_window,
  compute_rush_windows,
  count_cleaning_crew,
  LAST_ORDERS_MINUTE,
  operatingMinuteOfDay,
  RUSH_CORE_SHARE,
  score_for_reputation,
  WRITER_VERDICT_MINUTE,
  WRITER_WINDOW_END_MINUTE,
  WRITER_WINDOW_START_MINUTE,
  type DayReport,
  type DepartureReason,
  type GameState,
  type VisitRatingComponents,
} from "@/src/game/core";
import { BUILDABLE_CONTENT, type VisualDefinition } from "./catalog";
import { REPUTATION_SCALE } from "./rules";
import { deriveSatisfactionTips, type SatisfactionTip } from "./satisfactionInsight";
import type {
  RuntimeDayCard,
  RuntimeDayReport,
  RuntimeNeighbourhood,
  RuntimeNextUnlock,
  RuntimeWriterVisit,
} from "./types";

/** In-game minute at which the operating day opens (10:30). */
const OPENING_MINUTE = 10 * 60 + 30;
/** In-game minute at which the operating day closes (18:30). */
const CLOSING_MINUTE = 18 * 60 + 30;
/** How far ahead, in in-game minutes, the HUD announces a rush. */
export const RUSH_NOTICE_LEAD_MINUTES = 90;
/** The fictional neighbourhood paper the food writer writes for. */
const WRITER_PUBLICATION = "The Lane Weekly";
/** Level and reputation gaps that count as one whole unit of distance to an unlock. */
const UNLOCK_LEVEL_SPAN = 12;
const UNLOCK_REPUTATION_SPAN = 60;

/** Grades from the highest threshold down, each with a glyph so it never relies on colour. */
const GRADES: readonly {
  readonly minimum: number;
  readonly grade: string;
  readonly glyph: string;
  readonly headline: string;
}[] = [
  {
    minimum: 85,
    grade: "Outstanding",
    glyph: "◆",
    headline: "The whole neighbourhood is talking about the hall.",
  },
  {
    minimum: 75,
    grade: "Great",
    glyph: "▲",
    headline: "Guests left smiling and the tables kept turning.",
  },
  {
    minimum: 65,
    grade: "Good",
    glyph: "●",
    headline: "A solid service with a few rough edges to smooth.",
  },
  {
    minimum: 55,
    grade: "Steady",
    glyph: "■",
    headline: "The hall kept going; the busy hours showed where it strains.",
  },
  {
    minimum: 0,
    grade: "Finding our feet",
    glyph: "○",
    headline: "A learning day. One change can make tomorrow easier.",
  },
];

/** What each departure reason means to the player, in report copy. */
const DEPARTURE_LABELS: Readonly<Record<DepartureReason, string>> = {
  served: "Finished their visit",
  abandoned: "Left without a clear reason",
  "no-stall": "Found every queue full or nothing within budget",
  "long-queue": "Gave up waiting in a queue",
  "no-dish": "Found nothing to order within budget",
  "no-seat": "Had food but found no free seat",
  "visit-cap": "Ran out of time before sitting down",
};

/**
 * What to try first when one reason dominates why guests left early, tied to the rating factor
 * it hurts most. A departure problem outranks a weak factor, because it costs whole visits.
 */
const DEPARTURE_TIPS: Readonly<Partial<Record<DepartureReason, SatisfactionTip>>> = {
  "no-stall": {
    factor: "wait",
    label: "Queues",
    score: 0,
    action:
      "Every queue was full at the rush. Add another stall or give the busiest stall a longer queue lane.",
  },
  "long-queue": {
    factor: "wait",
    label: "Queues",
    score: 0,
    action:
      "Guests gave up waiting. Upgrade the busiest stall or open a second stall nearby to share the crowd.",
  },
  "no-seat": {
    factor: "comfort",
    label: "Seating",
    score: 0,
    action:
      "Guests with food found no free seat. Add tables and seats near the stalls, and a tray return so tables clear faster.",
  },
  "no-dish": {
    factor: "value",
    label: "Prices",
    score: 0,
    action: "Some guests found nothing within budget. Put a lower-priced dish on a stall's menu.",
  },
  "visit-cap": {
    factor: "walking",
    label: "Walking",
    score: 0,
    action:
      "Guests ran out of time before sitting down. Bring seats closer to the stalls and clear the main path.",
  },
};
/** Share of rated visits a departure reason must reach before its tip replaces the factor tip. */
const DEPARTURE_TIP_SHARE = 0.1;

/** How the food writer describes each rating factor at its best and at its weakest. */
const WRITER_PHRASES: Readonly<
  Record<keyof VisitRatingComponents, { readonly strong: string; readonly weak: string }>
> = {
  foodQuality: { strong: "food worth crossing town for", weak: "dishes that could use more care" },
  wait: { strong: "a queue that moves briskly", weak: "a queue that tested my patience" },
  value: { strong: "prices that feel fair", weak: "prices that felt steep" },
  walking: { strong: "an easy walk from the gate", weak: "a long walk to everything" },
  comfort: { strong: "comfortable seats", weak: "seats that were hard to find" },
  cleanliness: { strong: "tables kept spotless", weak: "trays left waiting on tables" },
  ambience: { strong: "a lovely atmosphere", weak: "a hall that could feel warmer" },
};

function card_view(card_id: string): RuntimeDayCard {
  const card = CALENDAR_CARD_BY_ID.get(card_id);
  return {
    id: card_id,
    name: card?.copy.name ?? "An ordinary day",
    summary: card?.copy.summary ?? "Nothing special planned.",
    forecast: card?.copy.forecast ?? "Nothing special is planned.",
  };
}

function format_clock(minute: number): string {
  const hour = Math.floor(minute / 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${(minute % 60).toString().padStart(2, "0")} ${suffix}`;
}

function grade_for(score: number, rated_visits: number) {
  if (rated_visits === 0) return GRADES[GRADES.length - 1]!;
  return GRADES.find((entry) => score >= entry.minimum) ?? GRADES[GRADES.length - 1]!;
}

function writer_quote(components: VisitRatingComponents): string {
  const keys = Object.keys(WRITER_PHRASES) as (keyof VisitRatingComponents)[];
  const strongest = keys.reduce(
    (best, key) => (components[key] > components[best] ? key : best),
    keys[0]!,
  );
  const weakest = keys.reduce(
    (worst, key) => (components[key] < components[worst] ? key : worst),
    keys[0]!,
  );
  return `“${capitalise(WRITER_PHRASES[strongest].strong)}, though ${WRITER_PHRASES[weakest].weak}.” — ${WRITER_PUBLICATION}`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Projects a finished day's report into the Service Review.
 *
 * @param report - The core day report.
 * @param visuals - Display names by definition ID.
 * @returns The review.
 */
export function build_day_review(
  report: DayReport,
  visuals: Readonly<Record<string, VisualDefinition>>,
): RuntimeDayReport {
  const grade = grade_for(report.averageScore, report.ratedVisits);
  const leftEarlyReasons = (Object.keys(DEPARTURE_LABELS) as DepartureReason[])
    .filter((reason) => reason !== "served" && report.departureCounts[reason] > 0)
    .map((reason) => ({
      reason,
      label: DEPARTURE_LABELS[reason],
      count: report.departureCounts[reason],
    }))
    .sort((a, b) => b.count - a.count);
  const top_reason = leftEarlyReasons[0];
  const departure_tip =
    report.ratedVisits > 0 &&
    top_reason &&
    top_reason.count >= report.ratedVisits * DEPARTURE_TIP_SHARE
      ? DEPARTURE_TIPS[top_reason.reason as DepartureReason]
      : undefined;
  const [factor_tip] =
    report.ratedVisits > 0 ? deriveSatisfactionTips(report.componentAverages, 1) : [];
  const focusTip = departure_tip ?? factor_tip;
  const writer = report.writer;
  return {
    day: report.day,
    cardName: card_view(report.cardId).name,
    grade: grade.grade,
    gradeGlyph: grade.glyph,
    headline: grade.headline,
    served: report.served,
    leftEarly: report.leftEarly,
    revenue: report.revenue,
    averageScore: report.averageScore,
    ratedVisits: report.ratedVisits,
    leftEarlyReasons,
    focusTip,
    trayReturns: report.trayReturns,
    objectivesCompleted: report.objectivesCompleted,
    objectivesTotal: report.objectivesTotal,
    unlockedCount: report.unlockedCount,
    writer: writer
      ? {
          stallName: visuals[writer.stallDefinitionId]?.name ?? writer.stallDefinitionId,
          outcome: writer.outcome,
          averageScore: writer.averageScore,
          threshold: writer.threshold,
          quote: writer_quote(report.componentAverages),
        }
      : undefined,
  };
}

/**
 * Projects the neighbourhood into the HUD view.
 *
 * @param state - The game state.
 * @param visuals - Display names by definition ID.
 * @returns The view, or `undefined` for a centre without a neighbourhood.
 */
export function build_neighbourhood_view(
  state: GameState,
  visuals: Readonly<Record<string, VisualDefinition>>,
): RuntimeNeighbourhood | undefined {
  const neighbourhood = state.neighbourhood;
  if (!neighbourhood) return undefined;
  const minute = operatingMinuteOfDay(state.elapsedMs);
  const windows = compute_rush_windows(state);
  const rushWindows = windows.map((window) => ({
    kind: window.kind,
    label: window.kind === "lunch" ? "Lunch" : "Dinner",
    startMinute: Math.round(window.centre_minute - window.half_width_minutes * RUSH_CORE_SHARE),
    endMinute: Math.round(window.centre_minute + window.half_width_minutes * RUSH_CORE_SHARE),
  }));
  const activeRush = active_rush_window(minute, windows)?.kind;
  const next = rushWindows.find(
    (window) =>
      window.startMinute > minute && window.startMinute - minute <= RUSH_NOTICE_LEAD_MINUTES,
  );
  const writer = neighbourhood.calendar.writer;
  const writerView: RuntimeWriterVisit | undefined = writer
    ? {
        stallDefinitionId: writer.stallDefinitionId,
        stallName: visuals[writer.stallDefinitionId]?.name ?? writer.stallDefinitionId,
        threshold: writer.threshold,
        windowStartMinute: WRITER_WINDOW_START_MINUTE,
        windowEndMinute: WRITER_WINDOW_END_MINUTE,
        status:
          writer.outcome !== "pending"
            ? "done"
            : minute < WRITER_WINDOW_START_MINUTE
              ? "upcoming"
              : minute < WRITER_VERDICT_MINUTE
                ? "reviewing"
                : "done",
        outcome: writer.outcome,
        visitCount: writer.visitCount,
        averageScore: writer.visitCount > 0 ? writer.scoreTotal / writer.visitCount : 0,
      }
    : undefined;
  return {
    today: card_view(neighbourhood.calendar.todayCardId),
    tomorrow: card_view(neighbourhood.calendar.tomorrowCardId),
    minuteOfDay: minute,
    openingMinute: OPENING_MINUTE,
    lastOrdersMinute: LAST_ORDERS_MINUTE,
    closingMinute: CLOSING_MINUTE,
    rushWindows,
    activeRush,
    rushNotice: activeRush
      ? `${activeRush === "lunch" ? "Lunch" : "Dinner"} rush under way. Queues and seats fill quickly.`
      : next
        ? `${next.label} crowd from about ${format_clock(next.startMinute)}. Ready the queues and seats.`
        : undefined,
    writer: writerView,
    isWriterTomorrow: neighbourhood.calendar.isWriterTomorrow,
    writerPickStallIds: neighbourhood.writerPickStallIds,
    lastReport: neighbourhood.lastReport
      ? build_day_review(neighbourhood.lastReport, visuals)
      : undefined,
  };
}

/**
 * Counts the table-cleaning crew of the hall.
 *
 * @param state - The game state.
 * @returns The crew size.
 */
export function count_hall_cleaning_crew(state: GameState): number {
  return count_cleaning_crew(state.objects, state.catalog);
}

function unlock_hint(
  level_gap: number,
  required_reputation: number,
  peak_reputation: number,
): string {
  const reputation_gap = required_reputation - peak_reputation;
  const steady_score = Math.ceil(score_for_reputation(required_reputation / REPUTATION_SCALE));
  if (level_gap > 0 && reputation_gap > 0) {
    return `Reach level ${level_gap === 1 ? "one more" : `${level_gap} more`} and keep visits averaging about ${steady_score} to lift reputation to ${Math.ceil(required_reputation)}.`;
  }
  if (level_gap > 0)
    return `Serve guests to gain ${level_gap === 1 ? "one more level" : `${level_gap} more levels`}.`;
  return `Keep visits averaging about ${steady_score} so reputation climbs to ${Math.ceil(required_reputation)}.`;
}

/**
 * Finds the locked stall, placeable or dish closest to unlocking.
 *
 * Distance is the larger of the level gap over twelve levels and the reputation gap over sixty
 * points, so the signpost points at whichever unlock is genuinely next. Items whose prerequisite
 * stall is still locked are skipped.
 *
 * @param state - The game state.
 * @returns The next unlock, or `undefined` once everything is unlocked.
 */
export function find_next_unlock(state: GameState): RuntimeNextUnlock | undefined {
  const level = state.progression.level;
  const peak = state.progression.peakReputation * REPUTATION_SCALE;
  const unlocked = new Set(state.progression.unlockedDefinitionIds);
  type Candidate = {
    id: string;
    name: string;
    kind: RuntimeNextUnlock["kind"];
    level: number;
    reputation: number;
  };
  const candidates: Candidate[] = [];
  for (const definition of BUILDABLE_CONTENT) {
    if (unlocked.has(definition.id)) continue;
    const requirement = definition.unlockRequirement;
    if (!requirement.prerequisiteIds.every((id) => unlocked.has(id))) continue;
    candidates.push({
      id: definition.id,
      name: localize_key(definition.nameKey),
      kind: definition.id.startsWith("stall.") ? "stall" : "placeable",
      level: requirement.level,
      reputation: requirement.reputation,
    });
  }
  for (const dish of DISHES) {
    const requirement = dish.unlockRequirement;
    if (requirement.level <= level && requirement.reputation <= peak) continue;
    candidates.push({
      id: dish.id,
      name: localize_key(dish.nameKey),
      kind: "dish",
      level: requirement.level,
      reputation: requirement.reputation,
    });
  }
  const distance = (candidate: Candidate) =>
    Math.max(
      Math.max(0, candidate.level - level) / UNLOCK_LEVEL_SPAN,
      Math.max(0, candidate.reputation - peak) / UNLOCK_REPUTATION_SPAN,
    );
  const best = candidates
    .filter((candidate) => distance(candidate) > 0)
    .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))[0];
  if (!best) return undefined;
  const level_gap = Math.max(0, best.level - level);
  const level_progress = best.level > 0 ? Math.min(1, level / best.level) : 1;
  const reputation_progress = best.reputation > 0 ? Math.min(1, peak / best.reputation) : 1;
  return {
    id: best.id,
    name: best.name,
    kind: best.kind,
    requiredLevel: best.level,
    requiredReputation: best.reputation,
    isLevelMet: level_gap === 0,
    isReputationMet: peak >= best.reputation,
    progress: Math.min(level_progress, reputation_progress),
    hint: unlock_hint(level_gap, best.reputation, peak),
  };
}
