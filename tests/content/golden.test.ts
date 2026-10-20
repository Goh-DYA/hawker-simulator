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
const CONTENT_SHA256 = "9f6bb65d337aa965ddf1365dab58ae4aadf9e650055e362aa24e564558475c63";

/** sha256 of `JSON.stringify` of each part of {@link CONTENT_SHA256}, as a diff aid. */
const CONTENT_PART_SHA256 = {
  stalls: "74e76735a94dc25c10274066d1f37078618102ef8a3f49dd3e49a2dc209829bb",
  dishes: "7c646d7d1ce56453351c899858fc045ad60a412979fe85070c0b2b7ec573b0c8",
  placeables: "5244912bfba4e749105eb988e6af89961d0affbdc0eea8a855490e7428e00dfe",
  customerArchetypes: "511a1cc7425691baa23464b197a4925468701f4d7db3933a19c1250e7d028856",
  localizationEntries: "4cabda0d2a1fce8ae148facec620fc3059e07f57027d0381d1da1f6e69360558",
} as const;

/** sha256 of `JSON.stringify(LAUNCH_CONTENT)`, which adds the economy and nutrition data. */
const LAUNCH_CONTENT_SHA256 = "4ac78365f1e71a4247fa91d2753ab961642fef5b01539cc9ad758e13e58dc3b3";

/** sha256 of `JSON.stringify(validateContent())`. */
const VALIDATION_REPORT_SHA256 = "963205a7e7ae0bacca7c797e873e58dfb68f2bc269d17941d4ce6964cbc94b93";

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
