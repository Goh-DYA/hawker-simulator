/**
 * Per-test collector for console and process warnings.
 *
 * `tests/setup.ts` routes every `console.warn`, `console.error` and Node process
 * warning into {@link warning_records}. After each test the setup file asks
 * {@link drain_warning_failures} for anything the test did not declare, and fails the
 * test if the answer is non-empty. Records are collected instead of thrown in place, so
 * the code under test keeps its normal failure-path control flow.
 *
 * Tests that deliberately exercise a logged failure declare it with
 * {@link expect_console_warning}.
 */
import { format } from "node:util";

/** Console methods whose calls are captured during each test. */
export type ConsoleMethod = "warn" | "error";

/** Where a captured warning came from. */
export type WarningSource = ConsoleMethod | "process";

/** One captured console call or process warning. */
export interface WarningRecord {
  source: WarningSource;
  args: unknown[];
  isExpected: boolean;
}

interface WarningExpectation {
  pattern: RegExp;
  method: ConsoleMethod;
}

/** Warnings captured since the last {@link drain_warning_failures} call, in arrival order. */
export const warning_records: WarningRecord[] = [];

const warning_expectations: WarningExpectation[] = [];

/**
 * Append a captured warning to {@link warning_records}. Never throws, so capturing a
 * warning cannot change the control flow of the code that emitted it.
 *
 * @param source - The console method or `"process"` that produced the warning.
 * @param args - The arguments that were passed, or the process warning itself.
 */
export function record_warning(source: WarningSource, args: unknown[]): void {
  warning_records.push({ source, args, isExpected: false });
}

/**
 * Declare that the current test expects one console call matching `pattern`.
 *
 * Call it once per expected call, before or after the code that logs. The expectation
 * is checked when the test ends: it claims the first unclaimed call of `method` whose
 * printed message matches, and the test fails if no such call exists.
 *
 * @param pattern - Matched against the message as the console would print it
 * (`util.format` of the call's arguments).
 * @param method - The console method the call is expected on.
 */
export function expect_console_warning(pattern: RegExp, method: ConsoleMethod = "warn"): void {
  warning_expectations.push({ pattern, method });
}

/**
 * Match expectations against captured warnings, describe what is left over, and reset
 * both lists for the next test.
 *
 * @returns One line per unexpected warning and per unmet expectation; empty when the
 * test's warnings were exactly the declared ones.
 */
export function drain_warning_failures(): string[] {
  const failures: string[] = [];

  for (const expectation of warning_expectations) {
    const matching_record = warning_records.find(
      (record) =>
        !record.isExpected &&
        record.source === expectation.method &&
        expectation.pattern.test(format(...record.args)),
    );
    if (matching_record === undefined) {
      failures.push(
        `expected console.${expectation.method} matching ${expectation.pattern} was not called`,
      );
    } else {
      matching_record.isExpected = true;
    }
  }

  for (const record of warning_records) {
    if (!record.isExpected) {
      const label = record.source === "process" ? "process warning" : `console.${record.source}`;
      failures.push(`unexpected ${label}: ${format(...record.args)}`);
    }
  }

  warning_records.length = 0;
  warning_expectations.length = 0;
  return failures;
}
