/**
 * Command results: the accepted and rejected `CommandResult` shapes every command handler returns.
 *
 * Internal to core; it is not re-exported from the barrel. The dispatcher in `commands.ts`, the
 * build handlers in `build.ts` and the undo handler in `undo.ts` all build their results here, so
 * the event emitted for a command is the same wherever it is handled.
 */
import type { CommandResult, GameState, SimulationEvent } from "./types";

/**
 * Builds the event that reports a command's outcome.
 *
 * @param state - The state the command was applied to; its tick stamps the event.
 * @param accepted - Whether the command was accepted.
 * @param message - Optional detail, such as the rejection reason.
 * @returns A `command-applied` or `command-rejected` event.
 */
export function commandEvent(state: GameState, accepted: boolean, message?: string): SimulationEvent {
  return {
    type: accepted ? "command-applied" : "command-rejected",
    tick: state.tick,
    message,
  };
}

/**
 * Rejects a command, leaving the gameplay state as it was apart from the event list.
 *
 * @param state - The state to return unchanged.
 * @param error - The player-facing rejection reason.
 * @returns A rejected result carrying a single `command-rejected` event.
 */
export function reject(state: GameState, error: string): CommandResult {
  const event = commandEvent(state, false, error);
  return { state: { ...state, events: [event] }, accepted: false, error, events: [event] };
}

/**
 * Accepts a command with the given next state and events.
 *
 * @param state - The state after the command.
 * @param events - The events to attach to that state and the result.
 * @returns An accepted result.
 */
export function accept(state: GameState, events: readonly SimulationEvent[]): CommandResult {
  return { state: { ...state, events }, accepted: true, events };
}
