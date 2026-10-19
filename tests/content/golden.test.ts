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
const CONTENT_SHA256 = "aa22994a939e5dc50e99460b8bb1aaa3f5ef91499ac63814aa3ccb11535de125";

/** sha256 of `JSON.stringify` of each part of {@link CONTENT_SHA256}, as a diff aid. */
const CONTENT_PART_SHA256 = {
  stalls: "727e989e7669a7fcc160924064f1208bcd186fd19c59c9a91f1afbdff4736495",
  dishes: "416db1969dc891f1633873b596554fb35cf4bf42341319faaa8097be0dad278e",
  placeables: "5244912bfba4e749105eb988e6af89961d0affbdc0eea8a855490e7428e00dfe",
  customerArchetypes: "960a2929f347478ee2f62ab561cf5ebeddf1266985ccddd246fbce2a59023d91",
  localizationEntries: "1f63bb18faa97f641ff8f33912bb1a49b79c1d8ca9675c43ee8f3528a48bdbe4",
} as const;

/** sha256 of `JSON.stringify(LAUNCH_CONTENT)`, which adds the economy and nutrition data. */
const LAUNCH_CONTENT_SHA256 = "9a9ebfb10f493c53fd54811d7d18379556cdab6aa796a74e98e6866a780f1d57";

/** sha256 of `JSON.stringify(validateContent())`. */
const VALIDATION_REPORT_SHA256 = "ab8f128fb1c5f248a43db33bf6393d02e69684090eed4785b0fc15f3ffc93165";

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
