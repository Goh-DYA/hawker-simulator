/**
 * Requires every source module to open with a module JSDoc block.
 *
 * The scan covers `src/**\/*.ts`, `app/**\/*.{ts,tsx}`, `tools/**\/*.mjs` and
 * `worker/**\/*.ts`. A module passes when its first non-blank token is `/**`; a leading
 * `"use client"` directive may come before it. The block must be a module header, not
 * the JSDoc of the first declaration, so the next token after it may not open a
 * declaration such as `export function` or `const`. Files that were undocumented when this
 * test was added are listed in {@link UNDOCUMENTED_BASELINE}. That list may only get shorter:
 * the test fails when an unlisted file lacks the doc, and also when a listed file has
 * gained one but is still listed.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Source roots that are scanned, each with the file extensions it holds. */
const SCANNED_ROOTS: ReadonlyArray<{ root: string; pattern: RegExp }> = [
  { root: "src", pattern: /\.ts$/ },
  { root: "app", pattern: /\.tsx?$/ },
  { root: "tools", pattern: /\.mjs$/ },
  { root: "worker", pattern: /\.ts$/ },
];

/**
 * Files that lacked a module JSDoc when this test was added. Remove entries; never add them.
 *
 * The service-worker stamp tool is out of scope for the structural refactor, which may not
 * change it, so it stays listed until that work is picked up.
 */
const UNDOCUMENTED_BASELINE: readonly string[] = ["tools/stamp-service-worker.mjs"];

const USE_CLIENT_DIRECTIVE = /^(["'])use client\1;?/;

/** A declaration keyword, which marks a leading block as that declaration's own JSDoc. */
const DECLARATION_START =
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:async\s+)?(?:function|const|let|var|class|interface|enum|abstract|type\s+\w+)\b/;

/**
 * List every scanned module as a repo-relative, forward-slash path.
 *
 * @returns The sorted module paths.
 */
function list_scanned_modules(): string[] {
  const module_paths: string[] = [];
  for (const { root, pattern } of SCANNED_ROOTS) {
    const entries = readdirSync(`${REPO_ROOT}${root}`, { recursive: true, encoding: "utf8" });
    for (const entry of entries) {
      const module_path = `${root}/${entry.replaceAll("\\", "/")}`;
      if (pattern.test(module_path)) {
        module_paths.push(module_path);
      }
    }
  }
  return module_paths.sort();
}

/**
 * Report whether a module opens with a module JSDoc header.
 *
 * The first non-blank token, after any `"use client"`, must open a `/**` block, and the
 * block must not be followed directly by a declaration, whose own JSDoc it would be.
 *
 * @param module_path - Repo-relative path of the module to read.
 * @returns True when the module starts with a `/**` header block.
 */
function has_module_doc(module_path: string): boolean {
  const source = readFileSync(`${REPO_ROOT}${module_path}`, "utf8").replace(/^\uFEFF/, "");
  const body = source.trimStart().replace(USE_CLIENT_DIRECTIVE, "").trimStart();
  if (!body.startsWith("/**")) {
    return false;
  }
  const after_block = body.slice(body.indexOf("*/") + 2).trimStart();
  return !DECLARATION_START.test(after_block);
}

describe("module JSDoc", () => {
  const module_paths = list_scanned_modules();
  const undocumented = new Set(module_paths.filter((module_path) => !has_module_doc(module_path)));

  it("scans the source roots", () => {
    expect(module_paths.length).toBeGreaterThan(0);
  });

  it("documents every module outside the baseline", () => {
    const baseline = new Set(UNDOCUMENTED_BASELINE);
    expect([...undocumented].filter((module_path) => !baseline.has(module_path))).toEqual([]);
  });

  it("drops baseline entries that are now documented or no longer exist", () => {
    expect(UNDOCUMENTED_BASELINE.filter((module_path) => !undocumented.has(module_path))).toEqual(
      [],
    );
  });
});
