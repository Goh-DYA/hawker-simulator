/**
 * Game-rule constants shared by the runtime and the HUD.
 *
 * The module imports nothing, so the eagerly loaded HUD can read these rules without pulling
 * the runtime's catalog projection or new-game setup into its chunk.
 */

/**
 * Ratio of content reputation points to core reputation; divide content values by it for core
 * and multiply core values by it for display.
 */
export const REPUTATION_SCALE = 20;

/**
 * The hall-expansion rule: each expansion adds these columns and rows, and needs this level.
 * The property names mirror the `expand-map` command.
 */
export const MAP_EXPANSION = { addColumns: 4, addRows: 2, minimumLevel: 3 } as const;
