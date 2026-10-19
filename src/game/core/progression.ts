/**
 * Progression rules: the operating-day clock, stall mastery and upgrades, the effective
 * (upgrade-adjusted) catalog, daily objectives, milestone tracks, and the per-step update
 * that awards objective and milestone rewards.
 *
 * Objectives and milestones are evaluated in a fixed order and their events are appended in
 * that order, so the rewards are deterministic.
 */
import { calculateLevel, MAX_QUALITY } from "./economy";
import { compute_rush_windows, day_stream, roll_neighbourhood_day, settle_writer_review } from "./neighbourhood";
import { active_rush_window } from "./rush";
import { nextFloat } from "./rng";
import type {
  DailyObjective,
  GameState,
  SimulationCatalog,
  SimulationEvent,
  StallDefinition,
  StallMasteryState,
  NutritionObjectiveCriterion,
  ObjectiveKind,
} from "./types";

/** Length of one operating day in simulated milliseconds (eight minutes). */
export const OPERATING_DAY_MS = 8 * 60 * 1_000;
const OPERATING_START_MINUTE = 10 * 60 + 30;
const MASTERY_RANK_DIVISOR = 100;
/** Cash awarded per tier when a milestone is claimed. */
const MILESTONE_CASH_PER_TIER = 250;
/** XP awarded per tier when a milestone is claimed. */
const MILESTONE_XP_PER_TIER = 100;
/** New visit ratings needed before a happiness objective starts counting progress. */
const HAPPINESS_MIN_NEW_RATINGS = 5;
/** Number of daily objectives offered each operating day. */
const DAILY_OBJECTIVE_COUNT = 3;
/** Shortest order time a stall upgrade can reduce service to, in milliseconds. */
const MIN_ORDER_MS = 100;
/** Most recent visit ratings kept in `metrics.visitRatings`. */
export const VISIT_HISTORY_LIMIT = 50;

/**
 * Returns the operating day an elapsed time falls in.
 *
 * @param elapsedMs - The simulated time since the game started; negative values count as zero.
 * @returns The day number, starting at 1.
 */
export function operatingDay(elapsedMs: number): number {
  return 1 + Math.floor(Math.max(0, elapsedMs) / OPERATING_DAY_MS);
}

/**
 * Returns the in-game clock minute for an elapsed time: each simulated second is one minute after
 * the 10:30 opening.
 *
 * @param elapsedMs - The simulated time since the game started; negative values count as zero.
 * @returns The minutes since midnight on the in-game clock.
 */
export function operatingMinuteOfDay(elapsedMs: number): number {
  const operatingElapsedMs = Math.max(0, elapsedMs) % OPERATING_DAY_MS;
  return OPERATING_START_MINUTE + Math.floor(operatingElapsedMs / 1_000);
}

/**
 * Averages the retained visit ratings.
 *
 * @param state - Any view with the visit metrics.
 * @returns The mean score, or undefined when no visit has been rated.
 */
export function averageVisitRating(state: Pick<GameState, "metrics">): number | undefined {
  const ratings = state.metrics.visitRatings;
  if (ratings.length === 0) return undefined;
  return ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length;
}

/**
 * Returns the mastery rank for a points total: 1 + ⌊√(points / 100)⌋.
 *
 * @param points - The stall's mastery points; negative values count as zero.
 * @returns The rank, starting at 1.
 */
export function masteryRank(points: number): number {
  return 1 + Math.floor(Math.sqrt(Math.max(0, points) / MASTERY_RANK_DIVISOR));
}

/**
 * Applies a stall's current upgrade level to its definition.
 *
 * @param state - Any view with the stall mastery progression.
 * @param definitionId - The stall's placeable definition ID.
 * @param stall - The stall's authored definition.
 * @returns The definition with the upgrade's service time, capacity, quality and menu-slot changes,
 *   or the authored definition when no upgrade matches.
 */
export function effectiveStallDefinition(
  state: Pick<GameState, "progression">,
  definitionId: string,
  stall: StallDefinition,
): StallDefinition {
  const level = state.progression.stallMastery[definitionId]?.upgradeLevel ?? 1;
  const upgrade = stall.upgradeLevels?.find((candidate) => candidate.level === level);
  if (!upgrade) return stall;
  return {
    ...stall,
    orderMs: Math.max(MIN_ORDER_MS, Math.round(stall.orderMs * upgrade.serviceTimeMultiplier)),
    preparationCapacity: stall.preparationCapacity + upgrade.capacityBonus,
    queueCapacity: stall.queueCapacity + upgrade.capacityBonus,
    quality: Math.min(MAX_QUALITY, stall.quality + upgrade.qualityBonus),
    menuSlots: (stall.menuSlots ?? stall.dishIds.length) + upgrade.menuSlotsBonus,
  };
}

/**
 * Builds the catalog the simulation runs on, with every stall's mastery upgrades applied.
 *
 * Non-stall definitions are kept by reference; stall definitions are copied with their effective stall stats.
 *
 * @param state - The state whose catalog and stall mastery are read.
 * @returns A catalog whose placeables keep the source key order.
 */
export function get_effective_catalog(state: Pick<GameState, "catalog" | "progression">): SimulationCatalog {
  return {
    ...state.catalog,
    placeables: Object.fromEntries(Object.entries(state.catalog.placeables).map(([id, definition]) => [
      id,
      definition.stall
        ? { ...definition, stall: effectiveStallDefinition(state, id, definition.stall) }
        : definition,
    ])),
  };
}

/**
 * Awards mastery points for one served visit and recomputes the stall's rank.
 *
 * @param state - Any view with the progression.
 * @param definitionId - The stall's placeable definition ID.
 * @param happiness - The visit's happiness from 0 to 100; it adds up to 10 points on top of a base
 *   of 10.
 * @returns The updated progression.
 */
export function awardStallMastery(
  state: Pick<GameState, "progression">,
  definitionId: string,
  happiness: number,
): GameState["progression"] {
  const current = state.progression.stallMastery[definitionId] ?? {
    points: 0,
    rank: 1,
    upgradeLevel: 1,
  } satisfies StallMasteryState;
  const points = current.points + 10 + Math.round(Math.max(0, Math.min(100, happiness)) / 10);
  return {
    ...state.progression,
    stallMastery: {
      ...state.progression.stallMastery,
      [definitionId]: { ...current, points, rank: masteryRank(points) },
    },
  };
}

/**
 * Counts the distinct stall definitions that currently have an open stall placed.
 *
 * @param state - The game state whose placed objects are counted.
 * @returns The number of distinct open stall types.
 */
export function distinctOpenStallTypes(state: GameState): number {
  return new Set(
    Object.values(state.objects)
      .filter((object) => object.open && state.catalog.placeables[object.definitionId]?.kind === "stall")
      .map((object) => object.definitionId),
  ).size;
}

function queueFlowScore(state: GameState): number {
  const counts = Object.values(state.queues).reduce((sum, queue) => sum + queue.length, 0);
  const capacity = Object.values(state.objects).reduce((sum, object) => {
    const stall = state.catalog.placeables[object.definitionId]?.stall;
    return sum + (stall ? effectiveStallDefinition(state, object.definitionId, stall).queueCapacity : 0);
  }, 0);
  return Math.max(0, Math.min(100, 100 - (counts / Math.max(1, capacity)) * 100));
}

function objective(
  day: number,
  slot: number,
  values: Omit<DailyObjective, "id" | "day" | "progress" | "completed">,
): DailyObjective {
  return { id: `day-${day}-${slot}-${values.kind}`, day, progress: 0, completed: false, ...values };
}

function nutritionObjectiveCriterion(
  state: GameState,
  day: number,
): NutritionObjectiveCriterion {
  if (state.progression.level < 2) return "profiled-servings";
  const preferred: NutritionObjectiveCriterion = [
    "profiled-servings",
    "intent-matches",
    "variant-servings",
  ][(day - 1) % 3] as NutritionObjectiveCriterion;
  const profiles = Object.values(state.objects).flatMap((object) => {
    const stall = state.catalog.placeables[object.definitionId]?.stall;
    if (!object.open || !stall) return [];
    const rank = state.progression.stallMastery[object.definitionId]?.rank ?? 1;
    const dishIds = stall.allDishIds ?? stall.dishIds;
    return dishIds.flatMap((dishId) => {
      const dish = state.catalog.dishes[dishId];
      if (
        !dish ||
        state.progression.level < (dish.unlockLevel ?? 1) ||
        state.progression.peakReputation < (dish.unlockReputation ?? 0)
      ) return [];
      return dish.nutritionVariants
        ?.filter((variant) => variant.unlockRank <= rank)
        .map((variant) => ({ dish, variant })) ?? [];
    });
  });
  if (preferred === "intent-matches") {
    const hasIntentFit = profiles.some(
      ({ variant }) =>
        variant.profile?.status === "released" &&
        Object.values(variant.profile.intentFits).some((fit) => typeof fit === "number"),
    );
    return hasIntentFit ? preferred : "profiled-servings";
  }
  if (preferred === "variant-servings") {
    const hasAlternative = profiles.some(
      ({ dish, variant }) =>
        variant.profile?.status === "released" &&
        variant.id !== dish.defaultNutritionVariantId,
    );
    return hasAlternative ? preferred : "profiled-servings";
  }
  return preferred;
}

function nutritionObjective(state: GameState, day: number, scale: number): DailyObjective {
  const criterion = nutritionObjectiveCriterion(state, day);
  const values = criterion === "intent-matches"
    ? {
        title: "Read the request",
        description: `Match ${Math.min(6, 2 + Math.floor(scale / 3))} nutrition intents today.`,
        target: Math.min(6, 2 + Math.floor(scale / 3)),
        startValue: state.metrics.nutrition.intentMatches,
      }
    : criterion === "variant-servings"
      ? {
          title: "Try another recipe",
          description: `Serve ${Math.min(10, 3 + Math.floor(scale / 2))} reviewed non-default variants today.`,
          target: Math.min(10, 3 + Math.floor(scale / 2)),
          startValue: state.metrics.nutrition.nonDefaultVariantServings,
        }
      : {
          title: "Read the plate",
          description: `Serve ${Math.min(12, 4 + scale)} meals with reviewed nutrition data today.`,
          target: Math.min(12, 4 + scale),
          startValue: state.metrics.nutrition.profiledServings,
        };
  return objective(day, 3, {
    kind: "nutrition",
    nutritionCriterion: criterion,
    ...values,
    rewardCash: 80 + scale * 20,
    rewardXp: 25 + scale * 5,
  });
}

/**
 * Creates the three objectives for an operating day: a service objective, a quality objective, and
 * a nutrition objective, with targets and rewards scaled by level.
 *
 * @param state - The game state that supplies the level, the starting counters and the open stalls.
 * @param day - The day to create objectives for; defaults to the current day.
 * @returns The day's objectives.
 */
export function createDailyObjectives(state: GameState, day = operatingDay(state.elapsedMs)): readonly DailyObjective[] {
  if (state.neighbourhood) return create_seeded_objectives(state, state.neighbourhood, day);
  const scale = Math.max(1, state.progression.level);
  const rewardCash = 80 + scale * 20;
  const rewardXp = 25 + scale * 5;
  const service = day % 2 === 0
    ? objective(day, 1, {
        kind: "revenue",
        title: "A lively service",
        description: `Earn ${Math.round(35 + scale * 8)} credits today.`,
        target: Math.round(35 + scale * 8),
        startValue: state.economy.lifetimeRevenue,
        rewardCash,
        rewardXp,
      })
    : objective(day, 1, {
        kind: "serve",
        title: "Warm welcome",
        description: `Serve ${5 + scale * 2} neighbours today.`,
        target: 5 + scale * 2,
        startValue: state.economy.completedVisits,
        rewardCash,
        rewardXp,
      });
  const quality = day % 3 === 0
    ? objective(day, 2, {
        kind: "flow",
        title: "Easy movement",
        description: "Keep queue flow at 80% or better.",
        target: 80,
        startValue: 0,
        rewardCash,
        rewardXp,
      })
    : objective(day, 2, {
        kind: "happiness",
        title: "Happy tables",
        description: `Reach ${Math.min(92, 72 + scale)}% happiness after five new ratings.`,
        target: Math.min(92, 72 + scale),
        startValue: state.metrics.completedCustomers,
        rewardCash,
        rewardXp,
      });
  return [service, quality, nutritionObjective(state, day, scale)];
}

/** Smallest stretch over yesterday's result that a seeded objective asks for. */
const SEEDED_TARGET_MIN_STRETCH = 0.95;
/** Largest stretch over yesterday's result that a seeded objective asks for. */
const SEEDED_TARGET_MAX_STRETCH = 1.15;
/** Visit score points above yesterday's average that a seeded happiness objective asks for. */
const SEEDED_HAPPINESS_LIFT = 4;
/** Lowest and highest seeded happiness targets. */
const SEEDED_HAPPINESS_RANGE = [60, 92] as const;
/** Fewest tray returns a seeded tray-return objective asks for. */
const SEEDED_MIN_TRAY_RETURNS = 4;
/** Fewest distinct stalls a seeded variety objective asks for. */
const SEEDED_MIN_VARIETY = 3;

/**
 * Creates a day's objectives for a centre with a neighbourhood: one service and one quality
 * objective picked by the day's objective stream, plus the nutrition objective.
 *
 * Targets follow what the centre showed it can do the day before (`lastReport`), stretched by a
 * seeded 95-115%, with the fixed formulas as the floor, so goals keep pace with the hall without
 * running away from it. The quality slot also offers the variety objective (guests served by
 * several stalls today) and the tray-return objective, which the fixed rotation never generated.
 *
 * @param state - The state at the start of the day, after the previous day was closed.
 * @param neighbourhood - The centre's neighbourhood.
 * @param day - The day to create objectives for.
 * @returns The three objectives.
 */
function create_seeded_objectives(
  state: GameState,
  neighbourhood: NonNullable<GameState["neighbourhood"]>,
  day: number,
): readonly DailyObjective[] {
  const scale = Math.max(1, state.progression.level);
  const rewardCash = 80 + scale * 20;
  const rewardXp = 25 + scale * 5;
  const report = neighbourhood.lastReport;
  let stream = day_stream(neighbourhood.worldSeed, "objectives", day);
  const draw = (): number => {
    const result = nextFloat(stream);
    stream = result.state;
    return result.value;
  };
  const stretch = SEEDED_TARGET_MIN_STRETCH + draw() * (SEEDED_TARGET_MAX_STRETCH - SEEDED_TARGET_MIN_STRETCH);
  const service_roll = draw();
  const quality_roll = draw();
  const serve_target = Math.max(5 + scale * 2, Math.round((report?.served ?? 0) * stretch));
  const revenue_target = Math.max(Math.round(35 + scale * 8), Math.round((report?.revenue ?? 0) * stretch));
  const service = service_roll < 0.5
    ? objective(day, 1, {
        kind: "serve",
        title: "Warm welcome",
        description: `Serve ${serve_target} neighbours today.`,
        target: serve_target,
        startValue: state.economy.completedVisits,
        rewardCash,
        rewardXp,
      })
    : objective(day, 1, {
        kind: "revenue",
        title: "A lively service",
        description: `Earn ${revenue_target} credits today.`,
        target: revenue_target,
        startValue: state.economy.lifetimeRevenue,
        rewardCash,
        rewardXp,
      });
  const open_stalls = distinctOpenStallTypes(state);
  const quality_kinds: ObjectiveKind[] = ["happiness", "flow"];
  if (open_stalls >= SEEDED_MIN_VARIETY) quality_kinds.push("variety");
  if (Object.values(state.objects).some((object) => state.catalog.placeables[object.definitionId]?.kind === "tray-return")) {
    quality_kinds.push("facility");
  }
  const quality_kind = quality_kinds[Math.min(quality_kinds.length - 1, Math.floor(quality_roll * quality_kinds.length))];
  const happiness_target = Math.max(
    SEEDED_HAPPINESS_RANGE[0],
    Math.min(SEEDED_HAPPINESS_RANGE[1], Math.round((report?.averageScore || 60) + SEEDED_HAPPINESS_LIFT)),
  );
  const variety_target = Math.min(open_stalls, Math.max(SEEDED_MIN_VARIETY, (report?.servedStallCount ?? 0) + 1));
  const tray_target = Math.max(SEEDED_MIN_TRAY_RETURNS, Math.round((report?.trayReturns ?? 0) * stretch));
  const quality = quality_kind === "flow"
    ? objective(day, 2, {
        kind: "flow",
        title: "Easy movement",
        description: "Keep queue flow at 80% or better during a rush.",
        target: 80,
        startValue: 0,
        rewardCash,
        rewardXp,
      })
    : quality_kind === "variety"
      ? objective(day, 2, {
          kind: "variety",
          title: "Something for everyone",
          description: `Serve guests from ${variety_target} different stalls today.`,
          target: variety_target,
          startValue: 0,
          rewardCash,
          rewardXp,
        })
      : quality_kind === "facility"
        ? objective(day, 2, {
            kind: "facility",
            title: "Clear tables",
            description: `Have guests return ${tray_target} trays today.`,
            target: tray_target,
            startValue: state.metrics.trayReturns,
            rewardCash,
            rewardXp,
          })
        : objective(day, 2, {
            kind: "happiness",
            title: "Happy tables",
            description: `Reach ${happiness_target}% happiness after five new ratings.`,
            target: happiness_target,
            startValue: state.metrics.completedCustomers,
            rewardCash,
            rewardXp,
          });
  return [service, quality, nutritionObjective(state, day, scale)];
}

/**
 * Whether one of the day's crowds is under way, which is when a centre with a neighbourhood
 * measures the flow objective; an empty hall would otherwise flow perfectly.
 */
function is_rush_now(state: GameState): boolean {
  return active_rush_window(operatingMinuteOfDay(state.elapsedMs), compute_rush_windows(state)) !== undefined;
}

function objectiveProgress(state: GameState, item: DailyObjective): number {
  switch (item.kind) {
    case "serve": return state.economy.completedVisits - item.startValue;
    case "revenue": return state.economy.lifetimeRevenue - item.startValue;
    case "happiness": {
      const newRatingCount = state.metrics.completedCustomers - item.startValue;
      if (newRatingCount < HAPPINESS_MIN_NEW_RATINGS) return 0;
      const newRatings = state.metrics.visitRatings.slice(-Math.min(VISIT_HISTORY_LIMIT, newRatingCount));
      return newRatings.reduce((sum, rating) => sum + rating.score, 0) / newRatings.length;
    }
    case "flow": return state.neighbourhood && !is_rush_now(state) ? 0 : queueFlowScore(state);
    case "variety": return state.neighbourhood ? state.neighbourhood.ledger.servedStallIds.length : distinctOpenStallTypes(state);
    case "facility": return state.metrics.trayReturns - item.startValue;
    case "nutrition": {
      if (item.nutritionCriterion === "intent-matches") {
        return state.metrics.nutrition.intentMatches - item.startValue;
      }
      if (item.nutritionCriterion === "variant-servings") {
        return state.metrics.nutrition.nonDefaultVariantServings - item.startValue;
      }
      return state.metrics.nutrition.profiledServings - item.startValue;
    }
  }
}

/** One milestone track: its ID prefix and the ascending target of each tier. */
export interface MilestoneTrack {
  readonly id: "service" | "hospitality" | "variety" | "growth";
  readonly targets: readonly number[];
}

/**
 * Milestone tracks in claim order. Tier `n` of a track has ID `${id}-${n}` and is met once the
 * track's measure reaches `targets[n - 1]`.
 */
export const MILESTONE_TRACKS: readonly MilestoneTrack[] = [
  { id: "service", targets: [50, 250, 1_000, 5_000] },
  { id: "hospitality", targets: [75, 85, 90, 95] },
  { id: "variety", targets: [2, 4, 6, 8] },
  { id: "growth", targets: [3, 7, 12, 20] },
];

/** Whether a track's measure has reached `target` in `state`. */
const MILESTONE_TRACK_MET: Readonly<Record<MilestoneTrack["id"], (state: GameState, target: number) => boolean>> = {
  service: (state, target) => state.economy.completedVisits >= target,
  hospitality: (state, target) => state.metrics.visitRatings.length >= 20 && (averageVisitRating(state) ?? 0) >= target,
  variety: (state, target) => distinctOpenStallTypes(state) >= target,
  growth: (state, target) => state.progression.level >= target,
};

/** Every claimable milestone tier, flattened from `MILESTONE_TRACKS` in claim order. */
export const MILESTONES = MILESTONE_TRACKS.flatMap((track) =>
  track.targets.map((target, index) => ({
    id: `${track.id}-${index + 1}`,
    tier: index + 1,
    met: (state: GameState) => MILESTONE_TRACK_MET[track.id](state, target),
  })),
);

/** Mastery rank a stall needs before it can be upgraded to each level. */
export const UPGRADE_RANK_REQUIREMENTS = { 2: 2, 3: 4, 4: 7 } as const;

/**
 * Completes every met daily objective, adding its cash, XP and event.
 *
 * @param state - The state whose objectives are evaluated.
 * @returns The state with progress updated and rewards added; the level is recomputed.
 */
function award_daily_objectives(state: GameState): GameState {
  let currency = state.economy.currency;
  let xp = state.progression.xp;
  const events: SimulationEvent[] = [...state.events];
  const dailyObjectives = state.progression.dailyObjectives.map((item) => {
    if (item.completed) return item;
    const progress = Math.max(0, objectiveProgress(state, item));
    if (progress < item.target) return { ...item, progress };
    currency += item.rewardCash;
    xp += item.rewardXp;
    events.push({ type: "objective-completed", tick: state.tick, entityId: item.id, amount: item.rewardCash, message: item.title });
    return { ...item, progress, completed: true };
  });
  return {
    ...state,
    economy: { ...state.economy, currency },
    progression: { ...state.progression, xp, level: calculateLevel(xp), dailyObjectives },
    events,
  };
}

/**
 * Closes a finished day: awards the outgoing day's objectives, then, with a neighbourhood,
 * reports the day, emits `day-ended` and turns the calendar.
 *
 * The outgoing objectives are evaluated against the step that crossed midnight, so its sales
 * count towards the day they were made in.
 *
 * @param state - The state at the first step of `day`, still holding the old day's objectives.
 * @param day - The new operating day.
 * @returns The state with the old day closed.
 */
function close_finished_day(state: GameState, day: number): GameState {
  let closed = state.progression.focusDay >= 1 && state.progression.dailyObjectives.length === DAILY_OBJECTIVE_COUNT
    ? award_daily_objectives(state)
    : state;
  const neighbourhood = closed.neighbourhood;
  if (neighbourhood && neighbourhood.ledger.day < day) {
    const rolled = roll_neighbourhood_day(closed, day);
    closed = {
      ...closed,
      neighbourhood: rolled.neighbourhood,
      events: [
        ...closed.events,
        { type: "day-ended", tick: closed.tick, amount: rolled.report.day, message: rolled.report.cardId },
      ],
    };
  }
  return closed;
}

/**
 * Refreshes the daily objectives on a new day, then completes any objective or milestone that has
 * been met, adding their cash, XP and events, and settles the food writer's review.
 *
 * On a new day the outgoing day is closed first (`close_finished_day`), so its objectives and
 * report see the step that crossed midnight.
 *
 * @param source - The game state after a simulation step.
 * @returns The state with updated objectives, milestones, currency, XP, level and events.
 */
export function updateProgressionSystems(source: GameState): GameState {
  const day = operatingDay(source.elapsedMs);
  let state = source;
  if (state.progression.focusDay !== day || state.progression.dailyObjectives.length !== DAILY_OBJECTIVE_COUNT) {
    if (state.progression.focusDay !== day) state = close_finished_day(state, day);
    state = {
      ...state,
      progression: { ...state.progression, focusDay: day, dailyObjectives: createDailyObjectives(state, day) },
    };
  }
  state = award_daily_objectives(state);
  let currency = state.economy.currency;
  let xp = state.progression.xp;
  const events: SimulationEvent[] = [...state.events];
  const claimed = new Set(state.progression.claimedMilestoneIds);
  for (const milestone of MILESTONES) {
    if (claimed.has(milestone.id) || !milestone.met(state)) continue;
    claimed.add(milestone.id);
    const cashReward = MILESTONE_CASH_PER_TIER * milestone.tier;
    const xpReward = MILESTONE_XP_PER_TIER * milestone.tier;
    currency += cashReward;
    xp += xpReward;
    events.push({ type: "milestone-completed", tick: state.tick, entityId: milestone.id, amount: cashReward });
  }
  return settle_writer_review({
    ...state,
    economy: { ...state.economy, currency },
    progression: {
      ...state.progression,
      xp,
      level: calculateLevel(xp),
      claimedMilestoneIds: [...claimed],
    },
    events,
  });
}
