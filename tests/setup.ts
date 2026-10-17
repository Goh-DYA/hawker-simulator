/**
 * Vitest setup file that fails any test emitting an undeclared warning.
 *
 * Each test runs with `console.warn` and `console.error` replaced by recorders, and Node
 * process warnings are recorded through a single `process.on("warning")` listener.
 * After the test, the spies are restored and the test fails if it produced a warning it
 * did not declare with `expect_console_warning`, or declared one that never happened.
 * Recording instead of throwing keeps the control flow of the code under test unchanged.
 */
import { afterEach, beforeEach, vi, type MockInstance } from "vitest";
import { drain_warning_failures, record_warning, type ConsoleMethod } from "./console";

const CAPTURED_CONSOLE_METHODS: readonly ConsoleMethod[] = ["warn", "error"];

/**
 * Global slot that marks the process warning listener as registered. Vitest may run this
 * file several times in one process, so the slot holds the recorder of the latest run:
 * the one listener always reports into the current test file's records instead of a
 * stale module instance's.
 */
const WARNING_LISTENER_KEY: unique symbol = Symbol.for("hawker.warning-listener");

type WarningListenerScope = typeof globalThis & {
  [WARNING_LISTENER_KEY]?: (warning: Error) => void;
};

const listener_scope = globalThis as WarningListenerScope;

if (listener_scope[WARNING_LISTENER_KEY] === undefined) {
  process.on("warning", (warning) => {
    listener_scope[WARNING_LISTENER_KEY]?.(warning);
  });
}
listener_scope[WARNING_LISTENER_KEY] = (warning) => {
  record_warning("process", [warning]);
};

let console_spies: MockInstance[] = [];

beforeEach(() => {
  console_spies = CAPTURED_CONSOLE_METHODS.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      record_warning(method, args);
    }),
  );
});

afterEach(() => {
  for (const spy of console_spies) {
    spy.mockRestore();
  }
  console_spies = [];

  const failures = drain_warning_failures();
  if (failures.length > 0) {
    throw new Error(`Unexpected or missing test warnings:\n${failures.join("\n")}`);
  }
});
