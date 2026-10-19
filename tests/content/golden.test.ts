/**
 * Golden master for the launch content data and its validation report.
 *
 * Each literal is the sha256 of a raw `JSON.stringify` string, so array order, object key
 * order and every derived field are pinned along with the values. The localization table
 * is hashed as `Object.entries`, which pins the order of its keys as well as the key
 * strings, because the runtime and saves address copy by those keys.
 *
 * The per-collection hashes only locate which collection moved once the combined hash
 * fails. The literals change only in intentional content commits. If a refactor makes one
 * fail, the refactor changed the shipped content: fix the code, never the literal.
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  CUSTOMER_ARCHETYPES,
  DISHES,
  ENGLISH_LOCALIZATION,
  LAUNCH_CONTENT,
  PLACEABLES,
  STALLS,
  validateContent,
} from "@/src/content";

/** sha256 of `JSON.stringify` of the combined launch data. */
const CONTENT_SHA256 = "2be26f55205b086b41cd6a0ada1338ed53e239faaf207feed68a59df6a97b4ac";

/** sha256 of `JSON.stringify` of each part of {@link CONTENT_SHA256}, as a diff aid. */
const CONTENT_PART_SHA256 = {
  stalls: "044ef6d0f012446b15d02ee48bad79eaaa7d1e569c4eb793e3ef59884c62fcd2",
  dishes: "df4060fb290ebeae87c20c595a0601331fd9ceccb9410c8fe94a3f8c85b9da1c",
  placeables: "5244912bfba4e749105eb988e6af89961d0affbdc0eea8a855490e7428e00dfe",
  customerArchetypes: "960a2929f347478ee2f62ab561cf5ebeddf1266985ccddd246fbce2a59023d91",
  localizationEntries: "f389e29e43075dee4d2a4aff66c9ef124d0612e7e3e51763bea700555677fd91",
} as const;

/** sha256 of `JSON.stringify(LAUNCH_CONTENT)`, which adds the economy and nutrition data. */
const LAUNCH_CONTENT_SHA256 = "524568df648f3180f996e619d18c7140c180e02fd00db4dd951253a79a06ee4c";

/** sha256 of `JSON.stringify(validateContent())`. */
const VALIDATION_REPORT_SHA256 = "b6679c4c5e763f82cada7135925a766f9aa4a4990813a2bcd30e37a8b185f296";

function hash_json(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

describe("launch content golden", () => {
  it("pins the stalls, dishes, placeables, archetypes and localization order", () => {
    expect(
      hash_json({
        STALLS,
        DISHES,
        PLACEABLES,
        CUSTOMER_ARCHETYPES,
        entries: Object.entries(ENGLISH_LOCALIZATION),
      }),
    ).toBe(CONTENT_SHA256);
  });

  it("pins each content collection separately", () => {
    expect({
      stalls: hash_json(STALLS),
      dishes: hash_json(DISHES),
      placeables: hash_json(PLACEABLES),
      customerArchetypes: hash_json(CUSTOMER_ARCHETYPES),
      localizationEntries: hash_json(Object.entries(ENGLISH_LOCALIZATION)),
    }).toEqual(CONTENT_PART_SHA256);
  });

  it("pins the whole launch content object", () => {
    expect(hash_json(LAUNCH_CONTENT)).toBe(LAUNCH_CONTENT_SHA256);
  });

  it("pins the validation report", () => {
    expect(hash_json(validateContent())).toBe(VALIDATION_REPORT_SHA256);
  });
});
