/**
 * Player command dispatch: the single entry point that applies a `GameCommand` to the state.
 *
 * `dispatchCommand` validates a command before it changes anything; a rejection returns
 * `accepted: false` with the gameplay state unchanged. Settings, stall upgrades and stall
 * opening are handled here; build commands live in `build.ts`, undo in `undo.ts`, and the
 * reconciliation of guests after a layout change in `reconcile.ts`.
 */
import { applyPurchase, canAfford } from "./economy";
import {
  handle_add_access_point,
  handle_configure_guest_route,
  handle_configure_queue,
  handle_expand_map,
  handle_move_access_point,
  handle_place_object,
  handle_remove_access_point,
  handle_remove_object,
  handle_set_queue_direction,
  handle_transform_object,
  navigationError,
} from "./build";
import { UPGRADE_RANK_REQUIREMENTS } from "./progression";
import { reconcileWorldGeometryChange } from "./reconcile";
import { accept, commandEvent, reject } from "./results";
import { captureUndoSnapshot } from "./state";
import { apply_undo } from "./undo";
import type {
  BuildCommand,
  CommandResult,
  GameCommand,
  GameState,
  UndoSnapshot,
  UpgradeStallCommand,
} from "./types";

/** The `set-quality-mode` command. */
type SetQualityModeCommand = Extract<GameCommand, { type: "set-quality-mode" }>;
/** The `set-stall-open` command. */
type SetStallOpenCommand = Extract<GameCommand, { type: "set-stall-open" }>;

/**
 * Handles `set-quality-mode`: switches between the standard and lower-end quality modes.
 *
 * @param state - The current state.
 * @param command - The command to apply.
 * @returns The accepted result, or a rejection for an unknown mode.
 */
function handle_set_quality_mode(state: GameState, command: SetQualityModeCommand): CommandResult {
  if (command.mode !== "standard" && command.mode !== "lower-end") return reject(state, "Unknown quality mode");
  return accept({ ...state, qualityMode: command.mode }, [commandEvent(state, true)]);
}

/**
 * Handles `upgrade-stall`: buys the next authored upgrade level for a stall definition.
 *
 * @param state - The current state.
 * @param command - The command to apply.
 * @returns The accepted result, or the first rejection found.
 */
function handle_upgrade_stall(state: GameState, command: UpgradeStallCommand): CommandResult {
  const definition = state.catalog.placeables[command.definitionId];
  if (!definition?.stall) return reject(state, "Stall definition does not exist");
  const mastery = state.progression.stallMastery[command.definitionId] ?? { points: 0, rank: 1, upgradeLevel: 1 as const };
  const nextLevel = (mastery.upgradeLevel + 1) as 2 | 3 | 4 | 5;
  if (nextLevel > 4) return reject(state, "This stall is fully upgraded");
  const requiredRank = UPGRADE_RANK_REQUIREMENTS[nextLevel as 2 | 3 | 4];
  if (mastery.rank < requiredRank) return reject(state, `Mastery rank ${requiredRank} is required`);
  const upgrade = definition.stall.upgradeLevels?.find((candidate) => candidate.level === nextLevel);
  if (!upgrade) return reject(state, "This stall has no authored upgrade at that level");
  if (!canAfford(state.economy, upgrade.cost)) return reject(state, "Insufficient currency");
  const progression = {
    ...state.progression,
    stallMastery: {
      ...state.progression.stallMastery,
      [command.definitionId]: { ...mastery, upgradeLevel: nextLevel as 2 | 3 | 4 },
    },
  };
  return accept(
    { ...state, economy: applyPurchase(state.economy, upgrade.cost), progression },
    [commandEvent(state, true, `Upgraded ${command.definitionId} to level ${nextLevel}`)],
  );
}

/**
 * Handles `set-stall-open`: opens or closes a stall, which also clears the undo stack.
 *
 * @param state - The current state.
 * @param command - The command to apply.
 * @returns The accepted result, or the first rejection found.
 */
function handle_set_stall_open(state: GameState, command: SetStallOpenCommand): CommandResult {
  const object = state.objects[command.objectId];
  const definition = object ? state.catalog.placeables[object.definitionId] : undefined;
  if (!object || definition?.kind !== "stall") return reject(state, "Stall does not exist");
  if (object.open === command.open) return accept(state, [commandEvent(state, true)]);
  const objects = { ...state.objects, [object.id]: { ...object, open: command.open } };
  const routeError = command.open ? navigationError(state, objects) : undefined;
  if (routeError) return reject(state, routeError);
  const reconciled = reconcileWorldGeometryChange(
    state,
    objects,
    command.open ? undefined : object.id,
  );
  return accept({ ...state, objects, ...reconciled, undoStack: [] }, [commandEvent(state, true)]);
}

/** Applies one command type; `command` is narrowed to that type. */
type CommandHandler<K extends GameCommand["type"]> = (
  state: GameState,
  command: Extract<GameCommand, { type: K }>,
) => CommandResult;

/** A handler called with a command whose type has already been matched to it. */
type AnyCommandHandler = (state: GameState, command: GameCommand) => CommandResult;

/**
 * Wraps a build handler so the undo snapshot is captured before the command is validated.
 *
 * @param handler - The build handler to wrap.
 * @returns A handler that captures the snapshot and passes it on.
 */
function with_undo_snapshot<C extends BuildCommand>(
  handler: (state: GameState, command: C, before: UndoSnapshot) => CommandResult,
): (state: GameState, command: C) => CommandResult {
  return (state, command) => handler(state, command, captureUndoSnapshot(state));
}

/** One handler per command type; a new `GameCommand` without a handler fails to compile. */
const COMMAND_HANDLERS: { [K in GameCommand["type"]]: CommandHandler<K> } = {
  undo: apply_undo,
  "set-quality-mode": handle_set_quality_mode,
  "upgrade-stall": handle_upgrade_stall,
  "set-stall-open": handle_set_stall_open,
  "add-access-point": with_undo_snapshot(handle_add_access_point),
  "move-access-point": with_undo_snapshot(handle_move_access_point),
  "remove-access-point": with_undo_snapshot(handle_remove_access_point),
  "configure-guest-route": with_undo_snapshot(handle_configure_guest_route),
  "place-object": with_undo_snapshot(handle_place_object),
  "expand-map": with_undo_snapshot(handle_expand_map),
  "configure-queue": with_undo_snapshot(handle_configure_queue),
  "set-stall-queue-direction": with_undo_snapshot(handle_set_queue_direction),
  "remove-object": with_undo_snapshot(handle_remove_object),
  "move-object": with_undo_snapshot(handle_transform_object),
  "rotate-object": with_undo_snapshot(handle_transform_object),
};

/**
 * Applies a player command to the state.
 *
 * Command types without a handler, including inherited object keys such as `toString`, get
 * the deterministic "Unsupported command" rejection.
 *
 * @param state - The current state.
 * @param command - The command to apply.
 * @returns The next state, whether the command was accepted, the rejection reason and the events.
 */
export function dispatchCommand(state: GameState, command: GameCommand): CommandResult {
  if (!Object.hasOwn(COMMAND_HANDLERS, command.type)) return reject(state, "Unsupported command");
  const handler = COMMAND_HANDLERS[command.type] as AnyCommandHandler;
  return handler(state, command);
}
