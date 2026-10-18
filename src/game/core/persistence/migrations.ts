/**
 * Per-version save parsers and the one-way migration to the current schema.
 *
 * Each `parseVN` validates a save written at schema version N. `migratePersistentState`
 * parses the input at its own version and upgrades it step by step.
 */
import { calculateLevel } from "../economy";
import { PERSISTENT_SCHEMA_VERSION } from "../enums";
import { createEmptyNutritionMetrics } from "../nutrition";
import type {
  PersistentGameStateV1,
  PersistentGameStateV2,
  PersistentGameStateV3,
  PersistentGameStateV4,
} from "../types";
import {
  PersistenceError,
  finite,
  isRecord,
  parsePoint,
  safeInteger,
  stringValue,
} from "./fields";
import {
  parseDailyObjectives,
  parseMap,
  parseMastery,
  parseNutritionMetrics,
  parseObject,
  parseQuality,
  parseVisitRatings,
} from "./parsers";

function parseV2(value: Record<string, unknown>): PersistentGameStateV2 {
  if (!Array.isArray(value.objects)) throw new PersistenceError("objects must be an array");
  if (!isRecord(value.economy) || !isRecord(value.progression)) {
    throw new PersistenceError("economy and progression must be objects");
  }
  const unlocks = value.progression.unlockedDefinitionIds;
  if (!Array.isArray(unlocks) || unlocks.some((id) => typeof id !== "string")) {
    throw new PersistenceError("progression.unlockedDefinitionIds must be a string array");
  }
  safeInteger(value.progression.level, "progression.level", 1);
  const xp = safeInteger(value.progression.xp, "progression.xp", 0);
  const level = calculateLevel(xp);
  const savedAtTick = safeInteger(value.savedAtTick, "savedAtTick", 0);
  const nextCustomerSequence = safeInteger(value.nextCustomerSequence, "nextCustomerSequence", 1);
  return {
    schemaVersion: 2,
    savedAtTick,
    map: parseMap(value.map),
    entrance: parsePoint(value.entrance, "entrance"),
    exit: parsePoint(value.exit, "exit"),
    qualityMode: parseQuality(value.qualityMode),
    objects: value.objects.map(parseObject),
    economy: {
      currency: finite(value.economy.currency, "economy.currency", 0),
      lifetimeRevenue: finite(value.economy.lifetimeRevenue, "economy.lifetimeRevenue", 0),
      lifetimeSpend: finite(value.economy.lifetimeSpend, "economy.lifetimeSpend", 0),
      completedVisits: safeInteger(value.economy.completedVisits, "economy.completedVisits", 0),
      abandonedVisits: safeInteger(value.economy.abandonedVisits, "economy.abandonedVisits", 0),
    },
    progression: {
      xp,
      level,
      reputation: Math.max(0, Math.min(5, finite(value.progression.reputation, "progression.reputation", 0))),
      unlockedDefinitionIds: unlocks as string[],
      expansionCount: safeInteger(value.progression.expansionCount, "progression.expansionCount", 0),
      focusDay: 0,
      dailyObjectives: [],
      claimedMilestoneIds: [],
      stallMastery: {},
    },
    rngState: safeInteger(value.rngState, "rngState", 1, 0xffff_ffff),
    nextCustomerSequence,
    elapsedMs: safeInteger(value.elapsedMs, "elapsedMs", 0),
  };
}

function parseV3(value: Record<string, unknown>): PersistentGameStateV3 {
  if (!Array.isArray(value.accessPoints)) throw new PersistenceError("accessPoints must be an array");
  const accessPoints = value.accessPoints.map((entry, index) => {
    if (!isRecord(entry)) throw new PersistenceError(`accessPoints[${index}] must be an object`);
    if (entry.kind !== "entrance" && entry.kind !== "exit") throw new PersistenceError(`accessPoints[${index}].kind is invalid`);
    return { id: stringValue(entry.id, `accessPoints[${index}].id`), kind: entry.kind as "entrance" | "exit", position: parsePoint(entry.position, `accessPoints[${index}].position`) };
  });
  const entrance = accessPoints.find((point) => point.kind === "entrance")?.position;
  const exit = accessPoints.find((point) => point.kind === "exit")?.position;
  if (!entrance || !exit) throw new PersistenceError("At least one entrance and one exit are required");
  const common = parseV2({ ...value, schemaVersion: 2, entrance, exit });
  let routeGuidePoints: readonly { x: number; y: number }[] = [];
  if (value.routeGuidePoints !== undefined) {
    if (!Array.isArray(value.routeGuidePoints)) {
      throw new PersistenceError("routeGuidePoints must be an array");
    }
    routeGuidePoints = value.routeGuidePoints.map((point, index) =>
      parsePoint(point, `routeGuidePoints[${index}]`),
    );
  }
  const progressionRecord = isRecord(value.progression) ? value.progression : {};
  const claimed = progressionRecord.claimedMilestoneIds;
  if (claimed !== undefined && (!Array.isArray(claimed) || claimed.some((id) => typeof id !== "string"))) {
    throw new PersistenceError("progression.claimedMilestoneIds must be a string array");
  }
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  return {
    schemaVersion: 3,
    savedAtTick: common.savedAtTick,
    map: common.map,
    accessPoints,
    routeGuidePoints,
    qualityMode: common.qualityMode,
    objects: common.objects,
    economy: common.economy,
    progression: {
      ...common.progression,
      focusDay: safeInteger(progressionRecord.focusDay ?? 0, "progression.focusDay", 0),
      dailyObjectives: parseDailyObjectives(progressionRecord.dailyObjectives),
      claimedMilestoneIds: (claimed as string[] | undefined) ?? [],
      stallMastery: parseMastery(progressionRecord.stallMastery),
    },
    metrics: {
      trayReturns: safeInteger(metrics.trayReturns ?? 0, "metrics.trayReturns", 0),
      visitRatings: parseVisitRatings(metrics.visitRatings),
    },
    rngState: common.rngState,
    nextCustomerSequence: common.nextCustomerSequence,
    elapsedMs: common.elapsedMs,
  };
}

function parseV4(value: Record<string, unknown>): PersistentGameStateV4 {
  const old = parseV3({ ...value, schemaVersion: 3 });
  const metrics = isRecord(value.metrics) ? value.metrics : {};
  return {
    ...old,
    schemaVersion: 4,
    metrics: {
      ...old.metrics,
      nutrition: parseNutritionMetrics(metrics.nutrition),
    },
  };
}

function parseV1(value: Record<string, unknown>): PersistentGameStateV1 {
  if (!Array.isArray(value.objects)) throw new PersistenceError("objects must be an array");
  return {
    schemaVersion: 1,
    map: parseMap(value.map),
    entrance: parsePoint(value.entrance, "entrance"),
    exit: parsePoint(value.exit, "exit"),
    objects: value.objects.map(parseObject),
    money: finite(value.money, "money", 0),
    xp: safeInteger(value.xp, "xp", 0),
    reputation: value.reputation === undefined ? undefined : finite(value.reputation, "reputation", 0),
    seed: safeInteger(value.seed, "seed", 1, 0xffff_ffff),
  };
}

/**
 * Rebuilds a parsed V1 save as an unvalidated V2 save.
 *
 * The `level` written here only has to pass `parseV2`'s check; `parseV2` then recomputes the
 * level from XP. The V3-only progression fields are written with their empty values.
 *
 * @param old - The parsed V1 save.
 * @returns The V2 save, for `parseV2` to validate.
 */
function upgrade_v1_to_v2(old: PersistentGameStateV1): Record<string, unknown> {
  const level = 1 + Math.floor(Math.sqrt(old.xp / 100));
  return {
    schemaVersion: 2,
    savedAtTick: 0,
    map: old.map,
    entrance: old.entrance,
    exit: old.exit,
    qualityMode: "standard",
    objects: old.objects,
    economy: {
      currency: old.money,
      lifetimeRevenue: 0,
      lifetimeSpend: 0,
      completedVisits: 0,
      abandonedVisits: 0,
    },
    progression: {
      xp: old.xp,
      level,
      reputation: Math.max(0, Math.min(5, old.reputation ?? 2.5)),
      unlockedDefinitionIds: [],
      expansionCount: 0,
      focusDay: 0,
      dailyObjectives: [],
      claimedMilestoneIds: [],
      stallMastery: {},
    },
    rngState: old.seed,
    nextCustomerSequence: 1,
    elapsedMs: 0,
  };
}

/**
 * Rebuilds a parsed V2 save as an unvalidated V3 save.
 *
 * The single entrance and exit become the access points `entrance-1` and `exit-1`, and the
 * route guides and V3 metrics start empty.
 *
 * @param old - The parsed V2 save.
 * @returns The V3 save, for `parseV3` to validate.
 */
function upgrade_v2_to_v3(old: PersistentGameStateV2): Record<string, unknown> {
  return {
    schemaVersion: 3,
    savedAtTick: old.savedAtTick,
    map: old.map,
    accessPoints: [
      { id: "entrance-1", kind: "entrance", position: old.entrance },
      { id: "exit-1", kind: "exit", position: old.exit },
    ],
    routeGuidePoints: [],
    qualityMode: old.qualityMode,
    objects: old.objects,
    economy: old.economy,
    progression: old.progression,
    metrics: {
      trayReturns: 0,
      visitRatings: [],
    },
    rngState: old.rngState,
    nextCustomerSequence: old.nextCustomerSequence,
    elapsedMs: old.elapsedMs,
  } satisfies PersistentGameStateV3;
}

/**
 * Rebuilds a parsed V3 save as an unvalidated V4 save with empty nutrition metrics.
 *
 * @param old - The parsed V3 save.
 * @returns The V4 save, for `parseV4` to validate.
 */
function upgrade_v3_to_v4(old: PersistentGameStateV3): Record<string, unknown> {
  return {
    ...old,
    schemaVersion: 4,
    metrics: { ...old.metrics, nutrition: createEmptyNutritionMetrics() },
  } satisfies PersistentGameStateV4;
}

/**
 * One-version upgrades keyed by the schema version they start from.
 *
 * Each entry parses a save written at its key's version and rebuilds it at the next version.
 * A `Map` is used so the lookup matches versions with `===` semantics: a string `"1"` is not
 * version 1.
 */
const UPGRADES: ReadonlyMap<unknown, (value: Record<string, unknown>) => Record<string, unknown>> =
  new Map<unknown, (value: Record<string, unknown>) => Record<string, unknown>>([
    [1, (value) => upgrade_v1_to_v2(parseV1(value))],
    [2, (value) => upgrade_v2_to_v3(parseV2(value))],
    [3, (value) => upgrade_v3_to_v4(parseV3(value))],
  ]);

/**
 * Parses a save of any supported schema version and migrates it to the current version.
 *
 * The save is parsed at its own version, upgraded one version, and parsed again at the new
 * version, until it reaches `PERSISTENT_SCHEMA_VERSION`.
 *
 * @param value - The untrusted, already JSON-decoded save.
 * @returns The save as a current-version persistent state.
 * @throws PersistenceError When the save is not an object, has an unsupported version or is malformed.
 */
export function migratePersistentState(value: unknown): PersistentGameStateV4 {
  if (!isRecord(value)) throw new PersistenceError("Save data must be an object");
  let current = value;
  while (current.schemaVersion !== PERSISTENT_SCHEMA_VERSION) {
    const upgrade = UPGRADES.get(current.schemaVersion);
    if (upgrade === undefined) {
      throw new PersistenceError(`Unsupported save version: ${String(current.schemaVersion)}`);
    }
    current = upgrade(current);
  }
  return parseV4(current);
}
