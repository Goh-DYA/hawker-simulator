/**
 * Recent-build undo: recording build commands on the undo stack and restoring the last one.
 *
 * Internal to core; it is not re-exported from the barrel. Build handlers push an entry with
 * `withUndo` after they succeed, and the `undo` command pops it with `apply_undo`. Revenue and
 * progression earned since the build are kept, so undo is a layout rollback, not a time rewind.
 */
import { calculateRefund } from "./economy";
import { reconcileWorldGeometryChange } from "./reconcile";
import { accept, commandEvent, reject } from "./results";
import { compute_undo_window_ticks } from "./state";
import type { BuildCommand, CommandResult, GameState, UndoSnapshot } from "./types";

/** The most build actions kept on the undo stack; older entries are dropped. */
const MAX_UNDO_ENTRIES = 20;

/**
 * Pushes an undo entry for a build command that has just been applied.
 *
 * @param state - The state after the build command.
 * @param command - The build command that produced it.
 * @param before - The snapshot captured before the command ran.
 * @returns The state with the new entry on its undo stack.
 */
export function withUndo(state: GameState, command: BuildCommand, before: UndoSnapshot): GameState {
  const entry = {
    commandType: command.type,
    snapshot: before,
    currencyDelta: state.economy.currency - before.economy.currency,
    lifetimeSpendDelta: state.economy.lifetimeSpend - before.economy.lifetimeSpend,
    expansionCountDelta: state.progression.expansionCount - before.expansionCount,
    createdAtTick: state.tick,
  };
  return {
    ...state,
    undoStack: [...state.undoStack, entry].slice(-MAX_UNDO_ENTRIES),
  };
}

function restoreUndoSnapshot(state: GameState, entry: GameState["undoStack"][number]): GameState {
  const snapshot = entry.snapshot;
  const objectIds = new Set([...Object.keys(state.objects), ...Object.keys(snapshot.objects)]);
  const changedObjectId = [...objectIds].find((id) => JSON.stringify(state.objects[id]) !== JSON.stringify(snapshot.objects[id]));
  const world = {
    ...state,
    map: snapshot.map,
    accessPoints: snapshot.accessPoints,
    routeGuidePoints: snapshot.routeGuidePoints,
    entrance: snapshot.entrance,
    exit: snapshot.exit,
    objects: snapshot.objects,
  };
  const preservesStallTarget =
    entry.commandType === "configure-queue" || entry.commandType === "set-stall-queue-direction";
  const reconciled = reconcileWorldGeometryChange(
    world,
    snapshot.objects,
    preservesStallTarget ? undefined : changedObjectId,
  );
  const placedObject = entry.commandType === "place-object" && changedObjectId
    ? state.objects[changedObjectId]
    : undefined;
  const placedDefinition = placedObject ? state.catalog.placeables[placedObject.definitionId] : undefined;
  const placedStallHasOperated =
    placedDefinition?.kind === "stall" &&
    (state.economy.lifetimeRevenue > snapshot.economy.lifetimeRevenue || state.progression.xp > snapshot.xp);
  // Revenue and progression are intentionally retained across undo. Once a newly
  // placed stall has produced either, treating undo as a build-preview rollback
  // would let players keep the sale while erasing its full purchase cost. From
  // that point on, removing it follows the same resale/lifetime-spend policy as
  // the explicit remove-object command.
  const refund = placedStallHasOperated && placedDefinition
    ? calculateRefund(placedDefinition.price, placedDefinition.refundRate ?? 0.5)
    : undefined;
  return {
    ...state,
    map: snapshot.map,
    accessPoints: snapshot.accessPoints,
    routeGuidePoints: snapshot.routeGuidePoints,
    entrance: snapshot.entrance,
    exit: snapshot.exit,
    objects: snapshot.objects,
    ...reconciled,
    economy: {
      ...state.economy,
      currency: refund === undefined ? state.economy.currency - entry.currencyDelta : state.economy.currency + refund,
      lifetimeSpend: refund === undefined
        ? state.economy.lifetimeSpend - entry.lifetimeSpendDelta
        : state.economy.lifetimeSpend,
    },
    progression: {
      ...state.progression,
      expansionCount: state.progression.expansionCount - entry.expansionCountDelta,
    },
    undoStack: state.undoStack.slice(0, -1),
  };
}

/**
 * Handles the `undo` command: restores the most recent build action if it is still undoable.
 *
 * @param state - The current state.
 * @returns The restored state, or a rejection when the stack is empty, the undo window has
 *   expired, or a guest stands in an expansion that would be removed.
 */
export function apply_undo(state: GameState): CommandResult {
  const entry = state.undoStack.at(-1);
  if (!entry) return reject(state, "There is no build action to undo");
  const maxAgeTicks = compute_undo_window_ticks(state.config);
  if (state.tick - entry.createdAtTick > maxAgeTicks) {
    return reject({ ...state, undoStack: [] }, "The recent-build undo window has expired");
  }
  if (
    entry.commandType === "expand-map" &&
    Object.values(state.customers).some(
      (customer) => customer.position.x >= entry.snapshot.map.width || customer.position.y >= entry.snapshot.map.height,
    )
  ) {
    return reject(state, "Cannot undo expansion while a customer is in the expanded area");
  }
  const restored = restoreUndoSnapshot(state, entry);
  return accept(restored, [commandEvent(state, true, `Undid ${entry.commandType}`)]);
}
