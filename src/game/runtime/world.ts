/**
 * New-game setup and map rules for the runtime.
 *
 * Holds the launch map geometry, the starter layout, the fresh-centre state and session, and the
 * checks that keep a loaded save compatible with the runtime's map and unlock rules.
 */
import { ECONOMY, PLACEABLES, STALLS } from "@/src/content";
import {
  compute_fnv1a32,
  create_neighbourhood,
  createGridMap,
  createNewGame,
  operatingDay,
  validatePlacement,
  type GameState,
  type PlacedObject,
  type SimulationCatalog,
} from "@/src/game/core";
import { BUILDABLE_CONTENT, layer_catalog } from "./catalog";
import { defaultDishVariants } from "./nutrition";
import { get_stall_tender_day, REPUTATION_SCALE } from "./rules";
import { defaultStallMenusForProgression } from "./stallMenus";

/** Edge length of one map tile in world pixels. */
export const TILE_SIZE = 48;
/** Width of the launch map in tiles; wider maps come only from expansions. */
export const MAP_WIDTH = 24;
/** Height of the launch map in tiles; taller maps come only from expansions. */
export const MAP_HEIGHT = 16;
/** Row of the launch map's entrance (west wall) and exit (east wall) openings. */
const ACCESS_ROW = 7;
/** Seed every new centre's simulation RNG starts from. */
const LAUNCH_SEED = "neighbourhood-hall-launch";
/**
 * World seed of a new centre when the runtime host supplies none, so tests and previews start
 * from the same neighbourhood. The app supplies a random seed per new centre.
 */
export const LAUNCH_WORLD_SEED = compute_fnv1a32(`${LAUNCH_SEED}:world`);

/**
 * Unlocks every buildable whose level, reputation and prerequisite rules are now satisfied.
 *
 * Core only knows the level-gated unlocks (complex unlocks are pinned to an unreachable level
 * in the catalog projection), so the runtime applies the reputation and prerequisite rules here,
 * between frames: after a load or import, after each simulation advance and when a new centre
 * starts. It stays out of core because those rules come from authored content, which core may
 * not import.
 * The loop repeats until no further unlock applies, so chained prerequisites resolve in one call.
 *
 * @param source - Game state to reconcile; it is not mutated.
 * @returns `source` itself when nothing new unlocks, otherwise a copy with the sorted unlock list.
 */
export function reconcileRuntimeUnlocks(source: GameState): GameState {
  const unlocked = new Set(source.progression.unlockedDefinitionIds);
  const day = operatingDay(source.elapsedMs);
  let tendered_count = count_tendered_stalls(unlocked);
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of BUILDABLE_CONTENT) {
      const requirement = definition.unlockRequirement;
      if (
        unlocked.has(definition.id) ||
        source.progression.level < requirement.level ||
        source.progression.peakReputation * REPUTATION_SCALE < requirement.reputation ||
        !requirement.prerequisiteIds.every((id) => unlocked.has(id))
      ) {
        continue;
      }
      const is_tendered = TENDERED_STALL_IDS.has(definition.id);
      if (is_tendered && day < get_stall_tender_day(tendered_count)) continue;
      unlocked.add(definition.id);
      if (is_tendered) tendered_count += 1;
      changed = true;
    }
  }
  if (unlocked.size === source.progression.unlockedDefinitionIds.length) return source;
  return {
    ...source,
    progression: {
      ...source.progression,
      unlockedDefinitionIds: [...unlocked].sort(),
    },
  };
}

/**
 * Stalls offered by tender: every stall except the starter stalls, which are open to a level-1
 * centre from the start.
 */
export const TENDERED_STALL_IDS: ReadonlySet<string> = new Set(
  STALLS.filter(
    (stall) =>
      stall.unlockRequirement.level > 1 ||
      stall.unlockRequirement.reputation > 0 ||
      stall.unlockRequirement.prerequisiteIds.length > 0,
  ).map((stall) => stall.id),
);

/**
 * Counts the tendered stalls a centre has already unlocked.
 *
 * @param unlocked - The unlocked definition IDs.
 * @returns How many stall tenders have been taken up.
 */
export function count_tendered_stalls(unlocked: ReadonlySet<string> | readonly string[]): number {
  let count = 0;
  for (const id of unlocked) if (TENDERED_STALL_IDS.has(id)) count += 1;
  return count;
}

/**
 * Plans the stall tenders still to come for the stalls that wait only for one.
 *
 * A stall waits when it is tendered, still locked and meets its level, reputation and
 * prerequisite rules. Waiting stalls take the coming tenders in the order
 * `reconcileRuntimeUnlocks` checks them, so the first is offered on the next tender day and each
 * later one on the tender after.
 *
 * @param state - The game state.
 * @returns The tender day of each waiting stall, keyed by stall ID, in tender order.
 */
export function plan_stall_tenders(state: GameState): ReadonlyMap<string, number> {
  const unlocked = new Set(state.progression.unlockedDefinitionIds);
  const peak = state.progression.peakReputation * REPUTATION_SCALE;
  const tendered_count = count_tendered_stalls(unlocked);
  const plan = new Map<string, number>();
  for (const definition of BUILDABLE_CONTENT) {
    const requirement = definition.unlockRequirement;
    if (
      !TENDERED_STALL_IDS.has(definition.id) ||
      unlocked.has(definition.id) ||
      state.progression.level < requirement.level ||
      peak < requirement.reputation ||
      !requirement.prerequisiteIds.every((id) => unlocked.has(id))
    ) {
      continue;
    }
    plan.set(definition.id, get_stall_tender_day(tendered_count + plan.size));
  }
  return plan;
}

/** Authored table IDs in content order; the starter layout places the first two. */
const STARTER_TABLE_IDS = PLACEABLES.filter((item) => item.category === "table").map((item) => item.id);
/** First authored seat, placed six times in the starter layout. */
const STARTER_SEAT_ID = PLACEABLES.find((item) => item.category === "seat")?.id;
/** First authored tray-and-waste item with a return-tray point, placed once in the starter layout. */
const STARTER_TRAY_ID = PLACEABLES.find(
  (item) =>
    item.category === "tray-waste" &&
    item.interactionPoints.some((point) => point.role === "return-tray"),
)?.id;
/** First authored plant, placed twice in the starter layout. */
const STARTER_PLANT_ID = PLACEABLES.find((item) => item.category === "plant")?.id;
/** First authored fan, placed once in the starter layout. */
const STARTER_FAN_ID = PLACEABLES.find((item) => item.category === "fan")?.id;

/**
 * Starter layout of a new centre, in placement order: definition ID, origin x, origin y and
 * whether the object starts open. Entries whose definition is missing or whose placement fails
 * are skipped.
 */
const STARTER_LAYOUT: ReadonlyArray<readonly [string | undefined, number, number, boolean]> = [
  [STALLS[0]?.id, 2, 1, false],
  [STALLS[1]?.id, 10, 1, false],
  [STARTER_TABLE_IDS[0], 5, 8, false],
  [STARTER_TABLE_IDS[1] ?? STARTER_TABLE_IDS[0], 12, 9, false],
  [STARTER_SEAT_ID, 4, 8, false],
  [STARTER_SEAT_ID, 8, 8, false],
  [STARTER_SEAT_ID, 11, 9, false],
  [STARTER_SEAT_ID, 15, 9, false],
  [STARTER_SEAT_ID, 6, 11, false],
  [STARTER_SEAT_ID, 13, 12, false],
  [STARTER_TRAY_ID, 20, 7, false],
  [STARTER_PLANT_ID, 20, 2, false],
  [STARTER_PLANT_ID, 20, 12, false],
  [STARTER_FAN_ID, 9, 7, false],
];

function starterObjects(
  catalog: SimulationCatalog,
  map: ReturnType<typeof createGridMap>,
): readonly PlacedObject[] {
  const candidates: PlacedObject[] = [];
  for (const [definitionId, x, y, open] of STARTER_LAYOUT) {
    if (!definitionId || !catalog.placeables[definitionId]) continue;
    const object: PlacedObject = {
      id: `starter-${candidates.length + 1}`,
      definitionId,
      origin: { x, y },
      rotation: 0,
      open,
    };
    const existing = Object.fromEntries(candidates.map((candidate) => [candidate.id, candidate]));
    const validation = validatePlacement(map, existing, catalog, object, {
      reservedPoints: [
        { x: 0, y: ACCESS_ROW },
        { x: MAP_WIDTH - 1, y: ACCESS_ROW },
      ],
    });
    if (validation.valid) candidates.push(object);
  }
  return candidates;
}

/**
 * Creates a new centre on the launch map with the starter layout and starting economy.
 *
 * @param catalog - Authored catalog used to validate the starter layout and seed the unlocks.
 * @param world_seed - Seed of the new centre's neighbourhood.
 * @returns The fresh game state, with runtime unlocks already reconciled.
 */
export function freshState(catalog: SimulationCatalog, world_seed = LAUNCH_WORLD_SEED): GameState {
  const tiles = Array<"floor" | "wall">(MAP_WIDTH * MAP_HEIGHT).fill("floor");
  for (let x = 0; x < MAP_WIDTH; x += 1) {
    tiles[x] = "wall";
    tiles[(MAP_HEIGHT - 1) * MAP_WIDTH + x] = "wall";
  }
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    tiles[y * MAP_WIDTH] = "wall";
    tiles[y * MAP_WIDTH + MAP_WIDTH - 1] = "wall";
  }
  tiles[ACCESS_ROW * MAP_WIDTH] = "floor";
  tiles[ACCESS_ROW * MAP_WIDTH + MAP_WIDTH - 1] = "floor";

  const map = createGridMap(MAP_WIDTH, MAP_HEIGHT, {
    tileSize: TILE_SIZE,
    worldOrigin: { x: 0, y: 0 },
    tiles,
  });
  const created = createNewGame({
    map,
    entrance: { x: 0, y: ACCESS_ROW },
    exit: { x: MAP_WIDTH - 1, y: ACCESS_ROW },
    catalog,
    seed: LAUNCH_SEED,
    worldSeed: world_seed,
    startingCurrency: ECONOMY.startingCash,
    initialObjects: starterObjects(catalog, map),
    initiallyUnlockedDefinitionIds: Object.values(catalog.placeables)
      .filter((definition) => (definition.unlockLevel ?? 1) <= 1)
      .map((definition) => definition.id),
  });
  return reconcileRuntimeUnlocks({
    ...created,
    progression: {
      ...created.progression,
      reputation: ECONOMY.startingReputation / REPUTATION_SCALE,
      peakReputation: ECONOMY.startingReputation / REPUTATION_SCALE,
    },
  });
}

/** A new centre with its default stall menus and dish variants layered onto the catalog. */
export interface FreshSession {
  /** Fresh game state, carrying the layered catalog. */
  readonly state: GameState;
  /** Authored catalog with the default stall menus and dish variants layered on top. */
  readonly catalog: SimulationCatalog;
  /** Default stall menus for a level 1 centre at the starting reputation. */
  readonly stallMenus: Readonly<Record<string, readonly string[]>>;
  /** Reviewed default variant for every dish family. */
  readonly activeDishVariants: Readonly<Record<string, string>>;
}

/**
 * Creates a new centre session: the fresh state with default menus and variants layered on.
 *
 * Startup (with no usable save), save recovery and reset all start from this session.
 *
 * @param authored - Authored catalog the menus and variants are layered onto.
 * @param world_seed - Seed of the new centre's neighbourhood.
 * @returns The fresh state, its layered catalog and the default menus and variants.
 */
export function create_fresh_session(authored: SimulationCatalog, world_seed = LAUNCH_WORLD_SEED): FreshSession {
  const fresh_state = freshState(authored, world_seed);
  const stallMenus = defaultStallMenusForProgression({
    level: 1,
    reputation: ECONOMY.startingReputation,
    unlockedDefinitionIds: fresh_state.progression.unlockedDefinitionIds,
  });
  const activeDishVariants = defaultDishVariants();
  const catalog = layer_catalog(authored, activeDishVariants, stallMenus);
  return {
    state: { ...fresh_state, catalog },
    catalog,
    stallMenus,
    activeDishVariants,
  };
}

/**
 * Rejects a loaded save whose map geometry the runtime cannot render.
 *
 * @param state - Deserialised game state.
 * @returns `state` unchanged when its tile size matches and it is at least the launch size.
 * @throws Error When the tile size differs or the map is smaller than the launch map.
 */
export function assertRuntimeMap(state: GameState): GameState {
  if (
    state.map.tileSize !== TILE_SIZE ||
    state.map.width < MAP_WIDTH ||
    state.map.height < MAP_HEIGHT
  ) {
    throw new Error(
      `This save uses an unsupported map geometry (${state.map.width}×${state.map.height} at ${state.map.tileSize}px).`,
    );
  }
  return state;
}

/**
 * Gives a loaded centre without a neighbourhood (a save from before neighbourhoods) one, seeded
 * from its saved random state so the same save always gains the same neighbourhood.
 *
 * @param state - The loaded game state.
 * @returns `state` itself when it already has a neighbourhood, otherwise a copy with one.
 */
export function ensure_neighbourhood(state: GameState): GameState {
  if (state.neighbourhood) return state;
  return { ...state, neighbourhood: create_neighbourhood(state, compute_fnv1a32(`world-seed:${state.rngState}`)) };
}
