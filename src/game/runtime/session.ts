/**
 * The runtime session holder: the live game state with its catalog layers and save bookkeeping,
 * and the domain operations on it that touch no scene, HUD or callback.
 *
 * The composition root creates one {@link RuntimeSession} and never replaces it; these functions
 * mutate its fields in place. The root keeps every side effect (events, saves, renders and HUD
 * pushes) and the frame step, whose `performance.now()` reads and guest-cleanup event sit between
 * the domain updates.
 */
import {
  dispatchCommand,
  persistentStateFromGame,
  type GameCommand,
  type GameState,
  type SimulationCatalog,
  type SimulationEvent,
} from "@/src/game/core";
import { NUTRITION_CONTENT } from "@/src/content";
import { layer_catalog, type VisualDefinition } from "./catalog";
import {
  RUNTIME_SCHEMA_VERSION,
  type LoadedRuntimeSave,
  type RuntimePersistentState,
} from "./saves";
import {
  resolveStallMenus,
  stallMenuProgression,
  stallMenuSlotBonuses,
  stallMenusMatch,
} from "./stallMenus";
import type { FreshSession } from "./world";

/** The runtime's live session: game state, catalog layers and save bookkeeping. */
export interface RuntimeSession {
  /** The catalog built from content, before menus and variants are layered on. */
  readonly authoredCatalog: SimulationCatalog;
  /** Visual definitions for every placeable, from content. */
  readonly visuals: Readonly<Record<string, VisualDefinition>>;
  /** The authored catalog with the stall menus and active dish variants layered on. */
  catalog: SimulationCatalog;
  /** The live game state, which carries `catalog` too. */
  state: GameState;
  /** The dishes each stall serves. */
  stallMenus: Readonly<Record<string, readonly string[]>>;
  /** The active variant of each dish family. */
  activeDishVariants: Readonly<Record<string, string>>;
  /** Lifetime revenue at the last save the frame step triggered by a revenue change. */
  lastPersistentRevenue: number;
  /** `performance.now()` reading at the last frame-step save. */
  lastPeriodicSaveAt: number;
  /** Real time the last simulation advance took, in milliseconds. */
  lastSimulationMs: number;
}

/** What {@link dispatch_session_command} reports back to the root. */
export interface SessionCommandResult {
  /** Whether core accepted the command, as in `CommandResult`. */
  readonly accepted: boolean;
  /** The simulation events the command produced. */
  readonly events: readonly SimulationEvent[];
  /** Whether the stall menus changed while resynchronising after the command. */
  readonly hasMenusChanged: boolean;
}

/**
 * Creates the session a runtime starts with, from a loaded or fresh session.
 *
 * @param authored_catalog - The catalog built from content.
 * @param visuals - Visual definitions for every placeable.
 * @param initial - The loaded or fresh session to start from.
 * @returns A session whose revenue bookkeeping starts from the initial state, with the periodic
 *   save clock and simulation cost at 0.
 */
export function create_runtime_session(
  authored_catalog: SimulationCatalog,
  visuals: Readonly<Record<string, VisualDefinition>>,
  initial: FreshSession | LoadedRuntimeSave,
): RuntimeSession {
  return {
    authoredCatalog: authored_catalog,
    visuals,
    catalog: initial.catalog,
    state: initial.state,
    stallMenus: initial.stallMenus,
    activeDishVariants: initial.activeDishVariants,
    lastPersistentRevenue: initial.state.economy.lifetimeRevenue,
    lastPeriodicSaveAt: 0,
    lastSimulationMs: 0,
  };
}

/**
 * Adopts a loaded or fresh session's state, layered catalog, menus and variants. The save
 * bookkeeping is left for the caller.
 *
 * @param session - The live session.
 * @param adopted - The loaded or fresh session to adopt.
 */
export function adopt_session(session: RuntimeSession, adopted: FreshSession | LoadedRuntimeSave) {
  session.state = adopted.state;
  session.catalog = adopted.catalog;
  session.stallMenus = adopted.stallMenus;
  session.activeDishVariants = adopted.activeDishVariants;
}

/**
 * Re-layers the menus and variants onto the authored catalog and stores it on the state too.
 *
 * @param session - The live session.
 */
export function apply_catalog_layers(session: RuntimeSession) {
  session.catalog = layer_catalog(
    session.authoredCatalog,
    session.activeDishVariants,
    session.stallMenus,
  );
  session.state = { ...session.state, catalog: session.catalog };
}

/**
 * Re-resolves the stall menus against the current progression and slot bonuses, re-layering the
 * catalog when they changed.
 *
 * @param session - The live session.
 * @returns Whether the menus changed.
 */
export function synchronize_stall_menus(session: RuntimeSession): boolean {
  const nextMenus = resolveStallMenus(session.stallMenus, {
    ...stallMenuProgression(session.state),
    slotBonuses: stallMenuSlotBonuses(session.state),
  });
  if (stallMenusMatch(session.stallMenus, nextMenus)) return false;
  session.stallMenus = nextMenus;
  apply_catalog_layers(session);
  return true;
}

/**
 * Builds the runtime save envelope for the session.
 *
 * @param session - The live session.
 * @returns The persistent state to save or export.
 */
export function build_persistent_payload(session: RuntimeSession): RuntimePersistentState {
  return {
    runtimeSchemaVersion: RUNTIME_SCHEMA_VERSION,
    core: persistentStateFromGame(session.state),
    stallMenus: session.stallMenus,
    nutritionDataVersion: NUTRITION_CONTENT.dataVersion,
    activeDishVariants: session.activeDishVariants,
  };
}

/**
 * Dispatches a command to core, adopts the resulting state and resynchronises the stall menus.
 *
 * @param session - The live session.
 * @param command - The command to run.
 * @returns Whether core accepted it, its events, and whether the menus changed.
 */
export function dispatch_session_command(
  session: RuntimeSession,
  command: GameCommand,
): SessionCommandResult {
  const result = dispatchCommand(session.state, command);
  session.state = result.state;
  const has_menus_changed = synchronize_stall_menus(session);
  return { accepted: result.accepted, events: result.events, hasMenusChanged: has_menus_changed };
}
