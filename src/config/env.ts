/**
 * The single reader of build-mode and developer query-flag values for the app.
 *
 * Application code reads `NODE_ENV` and the `?debug` / `?visualQa` URL flags only through this
 * module, so every environment-dependent branch is auditable in one place. The constants keep
 * the literal `process.env.NODE_ENV` comparisons, so each bundler inlines them inside this
 * module. Vite (`npm run build`) also folds the guards at call sites and drops the
 * development-only branches from production bundles. Turbopack (`npm run build:vercel`) does
 * not propagate the constants across modules, so it keeps the branch text; that text cannot run,
 * because `IS_PRODUCTION_BUILD` is true and `has_dev_query_flag` returns false.
 *
 * Documented exceptions, which run in Node outside the app bundle and read `process.env`
 * directly: `vite.config.ts` and the `tools/*.mjs` scripts.
 */

/** True when the bundle was built for production. */
export const IS_PRODUCTION_BUILD = process.env.NODE_ENV === "production";

/** True when the bundle was built for local development (`next dev` or `vinext dev`). */
export const IS_DEVELOPMENT_BUILD = process.env.NODE_ENV === "development";

/** Developer-only URL query flags that the app recognises. */
export type DevQueryFlag = "debug" | "visualQa";

/**
 * Report whether a developer query flag is present in the current page URL.
 *
 * Production builds always return false, so the flags cannot enable debug tooling for players.
 * Server rendering has no `location`, so it also returns false there. Bundlers do not inline
 * this function across chunks, so call sites also test `!IS_PRODUCTION_BUILD` first. Vite folds
 * that guard and drops the developer-only branch from production bundles. Turbopack
 * (`build:vercel`) keeps the branch text, which cannot run there because `IS_PRODUCTION_BUILD`
 * is true and this function returns false.
 *
 * @param name - The query parameter to look for, such as `debug` in `?debug`.
 * @returns True only outside production when the page URL carries the flag.
 */
export function has_dev_query_flag(name: DevQueryFlag): boolean {
  return (
    !IS_PRODUCTION_BUILD &&
    typeof location !== "undefined" &&
    new URLSearchParams(location.search).has(name)
  );
}
