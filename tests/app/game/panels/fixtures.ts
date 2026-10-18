/**
 * Shared fixtures for the management panel suites in this folder: the captured runtime snapshot,
 * a new centre's unlock progress, the shell's server-render golden and a markup counter.
 */
import type { RuntimeSnapshot } from "@/src/game/runtime/types";
import SNAPSHOT_FIXTURE_JSON from "../fixtures/snapshot.json";

/** The captured runtime snapshot the component suites also use. */
export const SNAPSHOT_FIXTURE = SNAPSHOT_FIXTURE_JSON as RuntimeSnapshot;

/** The unlock progress of a new centre, as the shell's initial snapshot holds it. */
export const NEW_CENTRE = { level: 1, reputation: 8, unlockedContentIds: [] };

/** The shell's server-render golden, relative to this file. */
export const SSR_GOLDEN_URL = new URL("../__snapshots__/HawkerSimulator.ssr.html", import.meta.url);

/** A runtime controller ref with no runtime, as during server rendering. */
export const NO_CONTROLLER = { current: undefined };

/**
 * @param html - Rendered markup.
 * @param fragment - The text to count.
 * @returns How often the fragment occurs in the markup.
 */
export function count_occurrences(html: string, fragment: string): number {
  return html.split(fragment).length - 1;
}
