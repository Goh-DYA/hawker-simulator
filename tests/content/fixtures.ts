/**
 * Shared helpers for the content validator tests.
 *
 * A test takes a writable deep copy of the launch content, breaks one rule, and collects
 * the issues `validateContent` reports. `tests/content/validate.test.ts` keeps its own
 * copies of these helpers, because its literals are frozen.
 */
import {
  ContentValidationError,
  LAUNCH_CONTENT,
  validateContent,
  type LaunchContent,
} from "@/src/content";

/** A deeply writable view of the launch content, so a test can break one field. */
export type Draft<T> = { -readonly [K in keyof T]: Draft<T[K]> };

/**
 * @returns A deep copy of the launch content that a test may change freely.
 */
export function create_draft(): Draft<LaunchContent> {
  return structuredClone(LAUNCH_CONTENT) as unknown as Draft<LaunchContent>;
}

/**
 * Validate `candidate` and collect what the validator reports.
 *
 * @param candidate - The content to validate.
 * @returns The issues of the thrown {@link ContentValidationError}, or an empty list when
 * the content is valid.
 * @throws Error Any other error the validator throws, unchanged.
 */
export function collect_issues(candidate: unknown): readonly string[] {
  try {
    validateContent(candidate);
    return [];
  } catch (error) {
    if (error instanceof ContentValidationError) return error.issues;
    throw error;
  }
}
