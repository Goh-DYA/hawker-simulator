/**
 * The seeded neighbourhood: a calendar of local day cards, an adaptive director, the food
 * writer, and the day ledger that becomes each day's Service Review.
 *
 * Determinism. Every random draw here comes from a short xorshift stream seeded by
 * `hashSeed(`${worldSeed}:${system}:${day}`)`, a pure function of the centre's world seed, a
 * system name and a day. Nothing here reads or advances the simulation's `rngState`, so a centre
 * without a neighbourhood (`GameState.neighbourhood` undefined, as in the core golden tests) runs
 * exactly as before, and the forecast for tomorrow is fixed the moment it is drawn.
 *
 * The calendar is a shuffle bag. Each day's card is drawn without replacement from the bag by a
 * weighted roulette draw, so every card appears once before any repeats, and today's card is
 * never drawn again for tomorrow. The weights come from the director: `tension` is an
 * exponentially weighted average of recent day performance, and a card's weight rises with its
 * intensity when recent days went well and falls when they were rough, so the neighbourhood
 * eases off after a hard day and gets livelier as the player masters the hall.
 *
 * The food writer is scheduled for tomorrow with a fixed chance once the centre has run a few
 * days. On the day, they review one open stall over the lunch window; a stall whose average
 * visit score meets the threshold earns a permanent Writer's Pick plaque, which gives it a small
 * popularity boost in stall choice. A missed plaque costs nothing, and the threshold rises with
 * each plaque held.
 */
import { DEPARTURE_REASONS, VISIT_RATING_COMPONENT_KEYS } from "./enums";
import { compareIds } from "./ordering";
import { operatingDay, operatingMinuteOfDay } from "./progression";
import { compute_fnv1a32, hashSeed, nextFloat } from "./rng";
import { DINNER_RUSH, LUNCH_RUSH, type RushWindow } from "./rush";
import type {
  CalendarCardDefinition,
  CalendarState,
  DayLedger,
  DayReport,
  DepartureCounts,
  DepartureReason,
  GameState,
  NeighbourhoodState,
  SimulationCatalog,
  SimulationEvent,
  VisitRating,
  VisitRatingComponents,
  WriterReport,
  WriterVisit,
} from "./types";

/** Director tension of a new neighbourhood, halfway between calm and lively. */
const INITIAL_TENSION = 0.5;
/** Share of the gap to a day's performance that the director's tension closes each day. */
const TENSION_SMOOTHING = 0.4;
/** Visit score at which a day's performance counts as zero. */
const PERFORMANCE_FLOOR_SCORE = 50;
/** Visit score points above the floor at which a day's performance counts as one. */
const PERFORMANCE_SCORE_SPAN = 40;
/** How strongly the director tilts card weights towards or away from intense days. */
const DIRECTOR_TILT = 2;
/** Lowest weight a card can have, so every card stays possible. */
const MIN_CARD_WEIGHT = 0.2;
/** Largest shift, in minutes, of a rush centre from its default time. */
const RUSH_JITTER_MINUTES = 15;
/** First day a food writer can visit. */
const WRITER_FIRST_DAY = 3;
/** Fewest days between two food-writer visits. */
const WRITER_MIN_GAP_DAYS = 3;
/** Chance that an eligible day gets a food-writer visit. */
const WRITER_CHANCE = 0.45;
/** First in-game minute at which a sale counts towards the review (12:00). */
export const WRITER_WINDOW_START_MINUTE = 12 * 60;
/** In-game minute after which sales stop counting towards the review (14:00). */
export const WRITER_WINDOW_END_MINUTE = 14 * 60;
/** In-game minute at which the review is settled (14:30), so lunch visits can finish. */
export const WRITER_VERDICT_MINUTE = 14 * 60 + 30;
/** Fewest counted visits for the writer to give a verdict. */
export const WRITER_MIN_VISITS = 3;
/** Average visit score needed for the first plaque. */
const WRITER_BASE_THRESHOLD = 68;
/** Extra average score needed for each plaque already held. */
const WRITER_THRESHOLD_STEP = 3;
/** Highest average score the writer ever asks for. */
const WRITER_MAX_THRESHOLD = 82;
/** Popularity added in stall choice to a stall holding a Writer's Pick plaque. */
export const WRITER_PICK_POPULARITY_BONUS = 0.04;

/**
 * Seeds the stream of one neighbourhood system for one day.
 *
 * @param world_seed - The centre's world seed.
 * @param system - The system name, such as `calendar` or `writer`.
 * @param day - The operating day.
 * @returns A non-zero xorshift32 state.
 */
export function day_stream(world_seed: number, system: string, day: number): number {
  return hashSeed(mix_hash(compute_fnv1a32(`${world_seed}:${system}:${day}`)));
}

/**
 * Scrambles a 32-bit hash with the MurmurHash3 finaliser, so seeds that differ only in a few
 * characters (consecutive days) give uncorrelated streams. FNV-1a alone leaves neighbouring
 * days' first draws measurably correlated.
 *
 * @param hash - An unsigned 32-bit hash.
 * @returns The mixed unsigned 32-bit hash.
 */
function mix_hash(hash: number): number {
  let mixed = hash >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x85ebca6b);
  mixed ^= mixed >>> 13;
  mixed = Math.imul(mixed, 0xc2b2ae35);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

function draw_float(world_seed: number, system: string, day: number): number {
  return nextFloat(day_stream(world_seed, system, day)).value;
}

/** Returns a departure count of zero for every reason, in `DEPARTURE_REASONS` order. */
export function create_empty_departure_counts(): DepartureCounts {
  return Object.fromEntries(DEPARTURE_REASONS.map((reason) => [reason, 0])) as Record<
    DepartureReason,
    number
  >;
}

function create_empty_components(): VisitRatingComponents {
  return Object.fromEntries(
    VISIT_RATING_COMPONENT_KEYS.map((key) => [key, 0]),
  ) as unknown as VisitRatingComponents;
}

/**
 * Lists the cards that can be drawn from the bag: every card except the opening day.
 *
 * @param catalog - The catalog holding the cards.
 * @returns The bag card IDs, in authored order.
 */
export function list_bag_card_ids(catalog: SimulationCatalog): readonly string[] {
  return (catalog.calendarCards ?? []).filter((card) => !card.isOpeningDay).map((card) => card.id);
}

/**
 * Finds a card by ID.
 *
 * @param catalog - The catalog holding the cards.
 * @param card_id - The card to find.
 * @returns The card, or `undefined` when the catalog has no such card.
 */
export function find_calendar_card(
  catalog: SimulationCatalog,
  card_id: string,
): CalendarCardDefinition | undefined {
  return catalog.calendarCards?.find((card) => card.id === card_id);
}

/**
 * Computes a card's draw weight from the director's tension.
 *
 * @param card - The card.
 * @param tension - The director's tension, from 0 to 1.
 * @returns The weight, at least `MIN_CARD_WEIGHT`.
 */
export function compute_card_weight(card: CalendarCardDefinition, tension: number): number {
  return Math.max(MIN_CARD_WEIGHT, 1 + DIRECTOR_TILT * (tension - 0.5) * (2 * card.intensity - 1));
}

/**
 * Draws the card for a day from the shuffle bag, refilling the bag when it runs out.
 *
 * The draw is a weighted roulette over the bag in authored order, using one value from the
 * day's calendar stream. `excluded_card_id` (the card of the day before) is never drawn, so no
 * card runs on two days in a row while the catalog holds at least two bag cards.
 *
 * @param catalog - The catalog holding the cards.
 * @param bag_card_ids - The cards still in the bag.
 * @param excluded_card_id - The card that may not be drawn.
 * @param tension - The director's tension.
 * @param world_seed - The centre's world seed.
 * @param day - The day the card is for.
 * @returns The drawn card and the bag without it; the card is empty when the catalog has none.
 */
export function draw_calendar_card(
  catalog: SimulationCatalog,
  bag_card_ids: readonly string[],
  excluded_card_id: string,
  tension: number,
  world_seed: number,
  day: number,
): { readonly cardId: string; readonly bagCardIds: readonly string[] } {
  const all_ids = list_bag_card_ids(catalog);
  const live_bag = bag_card_ids.filter((id) => all_ids.includes(id));
  let bag: readonly string[] = live_bag.some((id) => id !== excluded_card_id) ? live_bag : all_ids;
  let candidates: readonly string[] = bag.filter((id) => id !== excluded_card_id);
  if (candidates.length === 0) candidates = bag;
  if (candidates.length === 0) return { cardId: "", bagCardIds: [] };
  const weights = candidates.map((id) => {
    const card = find_calendar_card(catalog, id);
    return card ? compute_card_weight(card, tension) : MIN_CARD_WEIGHT;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let remaining = draw_float(world_seed, "calendar", day) * total;
  let picked = candidates[candidates.length - 1] as string;
  for (let index = 0; index < candidates.length; index += 1) {
    remaining -= weights[index] as number;
    if (remaining < 0) {
      picked = candidates[index] as string;
      break;
    }
  }
  bag = bag.filter((id) => id !== picked);
  return { cardId: picked, bagCardIds: bag };
}

function schedules_writer(world_seed: number, day: number, last_writer_day: number): boolean {
  if (day < WRITER_FIRST_DAY || day - last_writer_day < WRITER_MIN_GAP_DAYS) return false;
  return draw_float(world_seed, "writer", day) < WRITER_CHANCE;
}

/**
 * Returns the average visit score the food writer needs for the next plaque.
 *
 * @param plaque_count - Plaques the centre already holds.
 * @returns The threshold, from 68 up to 82.
 */
export function compute_writer_threshold(plaque_count: number): number {
  return Math.min(
    WRITER_MAX_THRESHOLD,
    WRITER_BASE_THRESHOLD + WRITER_THRESHOLD_STEP * plaque_count,
  );
}

/**
 * Lists the stall definitions placed in the hall, open or not. The writer chooses among all of
 * them, so closing stalls before the day starts cannot steer which stall is reviewed.
 */
function placed_stall_definition_ids(state: GameState): readonly string[] {
  const ids = new Set<string>();
  for (const object of Object.values(state.objects)) {
    if (state.catalog.placeables[object.definitionId]?.kind === "stall") ids.add(object.definitionId);
  }
  return [...ids].sort(compareIds);
}

function choose_writer_visit(
  state: GameState,
  world_seed: number,
  day: number,
  plaques: readonly string[],
): WriterVisit | null {
  const placed_ids = placed_stall_definition_ids(state);
  const unplaqued = placed_ids.filter((id) => !plaques.includes(id));
  const pool = unplaqued.length > 0 ? unplaqued : placed_ids;
  if (pool.length === 0) return null;
  const index = Math.min(
    pool.length - 1,
    Math.floor(draw_float(world_seed, "writer-stall", day) * pool.length),
  );
  return {
    stallDefinitionId: pool[index] as string,
    threshold: compute_writer_threshold(plaques.length),
    scoreTotal: 0,
    visitCount: 0,
    outcome: "pending",
  };
}

/**
 * Opens an empty ledger for a day from the state's current counters.
 *
 * @param state - The state whose counters the day starts from.
 * @param day - The day the ledger records.
 * @returns The ledger.
 */
export function start_day_ledger(state: GameState, day: number): DayLedger {
  return {
    day,
    startCompletedVisits: state.economy.completedVisits,
    startLifetimeRevenue: state.economy.lifetimeRevenue,
    startTrayReturns: state.metrics.trayReturns,
    startUnlockedCount: state.progression.unlockedDefinitionIds.length,
    ratedVisits: 0,
    unservedDepartures: 0,
    ratingScoreTotal: 0,
    componentTotals: create_empty_components(),
    departureCounts: create_empty_departure_counts(),
    servedStallIds: [],
  };
}

/**
 * Creates a neighbourhood for a centre at its current day.
 *
 * Day 1 opens with the catalog's opening-day card; a later day (an older save gaining a
 * neighbourhood) draws its card from the bag. Tomorrow's card is drawn at once, so the forecast
 * is always known.
 *
 * @param state - The centre the neighbourhood is created for.
 * @param world_seed - The centre's world seed; zero is replaced by a fixed non-zero seed.
 * @returns The neighbourhood.
 */
export function create_neighbourhood(state: GameState, world_seed: number): NeighbourhoodState {
  const seed = hashSeed(world_seed);
  const day = operatingDay(state.elapsedMs);
  const opening = (state.catalog.calendarCards ?? []).find((card) => card.isOpeningDay);
  const today =
    day === 1 && opening
      ? { cardId: opening.id, bagCardIds: list_bag_card_ids(state.catalog) }
      : draw_calendar_card(
          state.catalog,
          list_bag_card_ids(state.catalog),
          "",
          INITIAL_TENSION,
          seed,
          day,
        );
  const tomorrow = draw_calendar_card(
    state.catalog,
    today.bagCardIds,
    today.cardId,
    INITIAL_TENSION,
    seed,
    day + 1,
  );
  const calendar: CalendarState = {
    day,
    todayCardId: today.cardId,
    tomorrowCardId: tomorrow.cardId,
    bagCardIds: tomorrow.bagCardIds,
    writer: null,
    isWriterTomorrow: schedules_writer(seed, day + 1, 0),
    lastWriterDay: 0,
  };
  return {
    worldSeed: seed,
    calendar: calendar.isWriterTomorrow ? { ...calendar, lastWriterDay: day + 1 } : calendar,
    tension: INITIAL_TENSION,
    ledger: start_day_ledger(state, day),
    lastReport: null,
    writerPickStallIds: [],
  };
}

/**
 * Returns the card in effect for the state's current day.
 *
 * @param state - The state.
 * @returns Today's card, or `undefined` without a neighbourhood or a matching card.
 */
export function get_today_card(
  state: Pick<GameState, "neighbourhood" | "catalog">,
): CalendarCardDefinition | undefined {
  const neighbourhood = state.neighbourhood;
  if (!neighbourhood) return undefined;
  return find_calendar_card(state.catalog, neighbourhood.calendar.todayCardId);
}

/**
 * Returns the day's two crowds, shifted by the day's seeded jitter and scaled by today's card.
 *
 * @param state - The state.
 * @returns The lunch and dinner windows; the defaults without a neighbourhood.
 */
export function compute_rush_windows(
  state: Pick<GameState, "neighbourhood" | "catalog">,
): readonly RushWindow[] {
  const neighbourhood = state.neighbourhood;
  if (!neighbourhood) return [LUNCH_RUSH, DINNER_RUSH];
  const card = get_today_card(state);
  const day = neighbourhood.calendar.day;
  const jitter = (system: string): number =>
    Math.floor(draw_float(neighbourhood.worldSeed, system, day) * (2 * RUSH_JITTER_MINUTES + 1)) -
    RUSH_JITTER_MINUTES;
  return [
    {
      ...LUNCH_RUSH,
      centre_minute: LUNCH_RUSH.centre_minute + jitter("rush-lunch"),
      peak: LUNCH_RUSH.peak * (card?.lunchPeakFactor ?? 1),
    },
    {
      ...DINNER_RUSH,
      centre_minute: DINNER_RUSH.centre_minute + jitter("rush-dinner"),
      peak: DINNER_RUSH.peak * (card?.dinnerPeakFactor ?? 1),
    },
  ];
}

/**
 * Returns today's arrival-weight factor for an archetype.
 *
 * @param state - The state.
 * @param archetype_id - The archetype.
 * @returns The card's factor, or `undefined` when today's card does not change the archetype.
 */
export function get_archetype_factor(
  state: Pick<GameState, "neighbourhood" | "catalog">,
  archetype_id: string,
): number | undefined {
  return get_today_card(state)?.archetypeFactors.find((entry) => entry.archetypeId === archetype_id)
    ?.factor;
}

/**
 * Returns today's appeal bonus for a dish category.
 *
 * @param state - The state.
 * @param category - The dish's category, if it has one.
 * @returns The bonus, or 0.
 */
export function get_category_appeal(
  state: Pick<GameState, "neighbourhood" | "catalog">,
  category: string | undefined,
): number {
  if (category === undefined) return 0;
  return (
    get_today_card(state)?.categoryAppeal.find((entry) => entry.category === category)?.bonus ?? 0
  );
}

/**
 * Returns the stall-choice popularity bonus of a stall definition's Writer's Pick plaque.
 *
 * @param state - The state.
 * @param stall_definition_id - The stall definition.
 * @returns `WRITER_PICK_POPULARITY_BONUS` for a plaque holder, otherwise 0.
 */
export function get_writer_pick_bonus(
  state: Pick<GameState, "neighbourhood">,
  stall_definition_id: string,
): number {
  return state.neighbourhood?.writerPickStallIds.includes(stall_definition_id)
    ? WRITER_PICK_POPULARITY_BONUS
    : 0;
}

/**
 * Whether a sale at a stall, made now, counts towards today's food-writer review.
 *
 * @param neighbourhood - The neighbourhood, if any.
 * @param stall_definition_id - The stall that made the sale.
 * @param elapsed_ms - The simulated time of the sale.
 * @returns True inside the review window at the reviewed stall while the review is open.
 */
export function is_writer_sample(
  neighbourhood: NeighbourhoodState | undefined,
  stall_definition_id: string | undefined,
  elapsed_ms: number,
): boolean {
  const writer = neighbourhood?.calendar.writer;
  if (!writer || writer.outcome !== "pending" || writer.stallDefinitionId !== stall_definition_id)
    return false;
  const minute = operatingMinuteOfDay(elapsed_ms);
  return minute >= WRITER_WINDOW_START_MINUTE && minute < WRITER_WINDOW_END_MINUTE;
}

/**
 * Records that a stall made a sale today, for the variety objective and the day report.
 *
 * Counted at the sale rather than when the visit is rated, so guests still finishing yesterday's
 * meals after the rollover do not count towards today.
 *
 * @param neighbourhood - The neighbourhood.
 * @param stall_definition_id - The stall that made the sale.
 * @returns The neighbourhood, unchanged when the stall already sold today.
 */
export function record_stall_sale(
  neighbourhood: NeighbourhoodState,
  stall_definition_id: string,
): NeighbourhoodState {
  if (neighbourhood.ledger.servedStallIds.includes(stall_definition_id)) return neighbourhood;
  return {
    ...neighbourhood,
    ledger: {
      ...neighbourhood.ledger,
      servedStallIds: [...neighbourhood.ledger.servedStallIds, stall_definition_id].sort(compareIds),
    },
  };
}

/**
 * Adds a settled visit to the day ledger and, when it was a sampled sale, to the writer's tally.
 *
 * @param neighbourhood - The neighbourhood.
 * @param rating - The visit's rating.
 * @param is_sample - Whether the visit's sale counts towards today's review.
 * @returns The updated neighbourhood.
 */
export function record_visit(
  neighbourhood: NeighbourhoodState,
  rating: VisitRating,
  is_sample: boolean,
): NeighbourhoodState {
  const ledger = neighbourhood.ledger;
  const reason = (DEPARTURE_REASONS as readonly string[]).includes(rating.reason)
    ? (rating.reason as DepartureReason)
    : "abandoned";
  const componentTotals = { ...ledger.componentTotals };
  for (const key of VISIT_RATING_COMPONENT_KEYS) componentTotals[key] += rating.components[key];
  const writer = neighbourhood.calendar.writer;
  const counted_writer =
    is_sample && writer && writer.outcome === "pending"
      ? {
          ...writer,
          scoreTotal: writer.scoreTotal + rating.score,
          visitCount: writer.visitCount + 1,
        }
      : writer;
  return {
    ...neighbourhood,
    calendar:
      counted_writer === writer
        ? neighbourhood.calendar
        : { ...neighbourhood.calendar, writer: counted_writer },
    ledger: {
      ...ledger,
      ratedVisits: ledger.ratedVisits + 1,
      unservedDepartures: ledger.unservedDepartures + (rating.served ? 0 : 1),
      ratingScoreTotal: ledger.ratingScoreTotal + rating.score,
      componentTotals,
      departureCounts: { ...ledger.departureCounts, [reason]: ledger.departureCounts[reason] + 1 },
    },
  };
}

/**
 * Settles today's food-writer review once its window has closed.
 *
 * @param state - The state after a step.
 * @returns The state with the verdict and any plaque applied, plus a `writer-reviewed` event;
 *   `state` itself when there is nothing to settle.
 */
export function settle_writer_review(state: GameState): GameState {
  const neighbourhood = state.neighbourhood;
  const writer = neighbourhood?.calendar.writer;
  if (!neighbourhood || !writer || writer.outcome !== "pending") return state;
  if (operatingMinuteOfDay(state.elapsedMs) < WRITER_VERDICT_MINUTE) return state;
  const average = writer.visitCount > 0 ? writer.scoreTotal / writer.visitCount : 0;
  const outcome: WriterVisit["outcome"] =
    writer.visitCount < WRITER_MIN_VISITS
      ? "too-few-visits"
      : average >= writer.threshold
        ? "plaque"
        : "no-plaque";
  const writerPickStallIds =
    outcome === "plaque" && !neighbourhood.writerPickStallIds.includes(writer.stallDefinitionId)
      ? [...neighbourhood.writerPickStallIds, writer.stallDefinitionId].sort(compareIds)
      : neighbourhood.writerPickStallIds;
  const event: SimulationEvent = {
    type: "writer-reviewed",
    tick: state.tick,
    entityId: writer.stallDefinitionId,
    message: outcome,
    amount: Math.round(average),
  };
  return {
    ...state,
    neighbourhood: {
      ...neighbourhood,
      calendar: { ...neighbourhood.calendar, writer: { ...writer, outcome } },
      writerPickStallIds,
    },
    events: [...state.events, event],
  };
}

function writer_report(writer: WriterVisit | null): WriterReport | null {
  if (!writer) return null;
  const average = writer.visitCount > 0 ? writer.scoreTotal / writer.visitCount : 0;
  const outcome =
    writer.outcome === "pending"
      ? writer.visitCount < WRITER_MIN_VISITS
        ? "too-few-visits"
        : average >= writer.threshold
          ? "plaque"
          : "no-plaque"
      : writer.outcome;
  return {
    stallDefinitionId: writer.stallDefinitionId,
    threshold: writer.threshold,
    averageScore: average,
    visitCount: writer.visitCount,
    outcome,
  };
}

/**
 * Builds the Service Review of the ledger's day from the state at the day's end.
 *
 * @param state - The state at the end of the day, before the next day's objectives replace it.
 * @param neighbourhood - The neighbourhood whose ledger is reported.
 * @returns The report.
 */
export function build_day_report(state: GameState, neighbourhood: NeighbourhoodState): DayReport {
  const ledger = neighbourhood.ledger;
  const rated = ledger.ratedVisits;
  const componentAverages = Object.fromEntries(
    VISIT_RATING_COMPONENT_KEYS.map((key) => [
      key,
      rated > 0 ? ledger.componentTotals[key] / rated : 0,
    ]),
  ) as unknown as VisitRatingComponents;
  const objectives = state.progression.dailyObjectives;
  return {
    day: ledger.day,
    cardId: neighbourhood.calendar.todayCardId,
    served: state.economy.completedVisits - ledger.startCompletedVisits,
    leftEarly: ledger.unservedDepartures,
    revenue: state.economy.lifetimeRevenue - ledger.startLifetimeRevenue,
    ratedVisits: rated,
    averageScore: rated > 0 ? ledger.ratingScoreTotal / rated : 0,
    componentAverages,
    departureCounts: { ...ledger.departureCounts },
    trayReturns: state.metrics.trayReturns - ledger.startTrayReturns,
    servedStallCount: ledger.servedStallIds.length,
    objectivesCompleted: objectives.filter((objective) => objective.completed).length,
    objectivesTotal: objectives.length,
    unlockedCount: Math.max(
      0,
      state.progression.unlockedDefinitionIds.length - ledger.startUnlockedCount,
    ),
    writer: writer_report(neighbourhood.calendar.writer),
  };
}

/**
 * Scores a finished day for the director, from 0 (rough) to 1 (excellent).
 *
 * @param report - The day's report.
 * @returns The day's performance.
 */
export function compute_day_performance(report: DayReport): number {
  if (report.ratedVisits === 0) return INITIAL_TENSION;
  const quality = Math.max(
    0,
    Math.min(1, (report.averageScore - PERFORMANCE_FLOOR_SCORE) / PERFORMANCE_SCORE_SPAN),
  );
  const completion = report.departureCounts.served / report.ratedVisits;
  return quality * completion;
}

/**
 * Closes the ledger's day and opens the next: reports the day, moves the director, turns the
 * calendar and schedules the food writer.
 *
 * @param state - The state at the step that crossed into `day`, with the old day's objectives.
 * @param day - The new operating day.
 * @returns The new neighbourhood and the closed day's report.
 */
export function roll_neighbourhood_day(
  state: GameState,
  day: number,
): { readonly neighbourhood: NeighbourhoodState; readonly report: DayReport } {
  const neighbourhood = state.neighbourhood as NeighbourhoodState;
  const report = build_day_report(state, neighbourhood);
  const tension =
    neighbourhood.tension +
    TENSION_SMOOTHING * (compute_day_performance(report) - neighbourhood.tension);
  const seed = neighbourhood.worldSeed;
  const previous = neighbourhood.calendar;
  const today =
    previous.day === day - 1
      ? { cardId: previous.tomorrowCardId, bagCardIds: previous.bagCardIds }
      : draw_calendar_card(
          state.catalog,
          previous.bagCardIds,
          previous.todayCardId,
          tension,
          seed,
          day,
        );
  const today_card_id = today.cardId;
  const tomorrow = draw_calendar_card(
    state.catalog,
    today.bagCardIds,
    today_card_id,
    tension,
    seed,
    day + 1,
  );
  const is_writer_today = previous.day === day - 1 && previous.isWriterTomorrow;
  const isWriterTomorrow = schedules_writer(seed, day + 1, previous.lastWriterDay);
  return {
    report,
    neighbourhood: {
      ...neighbourhood,
      tension,
      calendar: {
        day,
        todayCardId: today_card_id,
        tomorrowCardId: tomorrow.cardId,
        bagCardIds: tomorrow.bagCardIds,
        writer: is_writer_today
          ? choose_writer_visit(state, seed, day, neighbourhood.writerPickStallIds)
          : null,
        isWriterTomorrow,
        lastWriterDay: isWriterTomorrow ? day + 1 : previous.lastWriterDay,
      },
      ledger: start_day_ledger(state, day),
      lastReport: report,
    },
  };
}

/**
 * Deep-copies a neighbourhood.
 *
 * @param neighbourhood - The neighbourhood to copy.
 * @returns The copy.
 */
export function clone_neighbourhood(neighbourhood: NeighbourhoodState): NeighbourhoodState {
  const report = neighbourhood.lastReport;
  return {
    ...neighbourhood,
    calendar: {
      ...neighbourhood.calendar,
      bagCardIds: [...neighbourhood.calendar.bagCardIds],
      writer: neighbourhood.calendar.writer ? { ...neighbourhood.calendar.writer } : null,
    },
    ledger: {
      ...neighbourhood.ledger,
      componentTotals: { ...neighbourhood.ledger.componentTotals },
      departureCounts: { ...neighbourhood.ledger.departureCounts },
      servedStallIds: [...neighbourhood.ledger.servedStallIds],
    },
    lastReport: report
      ? {
          ...report,
          componentAverages: { ...report.componentAverages },
          departureCounts: { ...report.departureCounts },
          writer: report.writer ? { ...report.writer } : null,
        }
      : null,
    writerPickStallIds: [...neighbourhood.writerPickStallIds],
  };
}
