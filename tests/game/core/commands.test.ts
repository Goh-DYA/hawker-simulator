/**
 * Contract tests for `dispatchCommand`'s handling of command types it has no handler for.
 *
 * Commands arrive from the runtime, so a malformed or unknown `type` is possible at run time
 * even though the union forbids it. The dispatcher must reject such a command with the fixed
 * "Unsupported command" message and leave the gameplay state as it was, including for a type
 * that names an inherited object key such as `toString`.
 */
import { describe, expect, it } from "vitest";

import { dispatchCommand, type GameCommand, type GameState } from "@/src/game/core";
import { makeGame } from "./fixtures";

/**
 * Dispatch a command whose type is outside the `GameCommand` union.
 *
 * @param state - The state to dispatch against.
 * @param type - The unsupported command type.
 * @returns The dispatch result.
 */
function dispatch_unknown_type(state: GameState, type: string) {
  return dispatchCommand(state, { type } as unknown as GameCommand);
}

describe("dispatchCommand with unsupported command types", () => {
  it.each(["teleport-guest", "toString"])("rejects %s as an unsupported command", (type) => {
    const initial = makeGame();
    const result = dispatch_unknown_type(initial, type);
    const rejection = {
      type: "command-rejected",
      tick: initial.tick,
      message: "Unsupported command",
    };

    expect(result).toEqual({
      state: { ...initial, events: [rejection] },
      accepted: false,
      error: "Unsupported command",
      events: [rejection],
    });
  });
});
